import express from 'express';
import { judgeRouter } from './judge.ts';
import { createServer } from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import { WebSocketServer } from 'ws';
import { z } from 'zod';
import { config } from './config.ts';
import { Store } from './store.ts';
import { Binance, Paper } from './exchange.ts';
import { Service } from './service.ts';
import { presets } from './rules.ts';
import { Pairing, makeReview, telegram, transcribe, voiceCommand } from './integrations.ts';
const store = new Store(config.db);
const exchange = config.mode === 'paper' ? new Paper(store.get('paper')) : new Binance(config.binanceKey, config.binanceSecret);
const service = new Service(store, exchange, { binance: !!config.binanceKey, telegram: false, voice: !!config.deepgram, claude: !!config.anthropic });
const pairing = new Pairing(service);
const app = express();
app.disable('x-powered-by');
const allowed = new Set([config.origin, `http://localhost:${config.port}`, `http://127.0.0.1:${config.port}`, 'http://127.0.0.1:5173']);
if (config.token) allowed.add('null'); // Packaged WebViews may use an opaque origin; bearer authentication remains required.
function tokenValid(token: string) { if (!config.token)
    return true; const given = Buffer.from(token), expected = Buffer.from(config.token); return (given.length === expected.length && timingSafeEqual(given, expected)) || pairing.valid(token); }
app.use((req, res, next) => { const host = req.headers.host?.split(':')[0]; if (config.host === '127.0.0.1' && !['localhost', '127.0.0.1'].includes(host ?? '')) {
    res.status(403).json({ error: 'Host not allowed' });
    return;
} const origin = req.headers.origin; if (origin && !allowed.has(origin)) {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
} if (origin)
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin'); res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type'); res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS'); res.setHeader('X-Content-Type-Options', 'nosniff'); if (req.method === 'OPTIONS') {
    res.sendStatus(204);
    return;
} next(); });
app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'Riskavue', mode: config.mode }));
const rate = new Map<string, {
    at: number;
    n: number;
}>();
app.use('/api', (req, res, next) => { const key = req.socket.remoteAddress ?? 'unknown'; let bucket = rate.get(key); if (!bucket || Date.now() - bucket.at > 60000) {
    bucket = { at: Date.now(), n: 0 };
    rate.set(key, bucket);
} if (++bucket.n > 240) {
    res.status(429).json({ error: 'Too many requests' });
    return;
} next(); });
app.use(express.json({ limit: '32kb' }));
app.use('/api/judge', judgeRouter());
app.post('/api/pair/start', (_req, res) => res.json(pairing.issue()));
app.post('/api/pair/poll', (req, res) => { const s = z.object({ session: z.string().length(48) }).parse(req.body); res.json(pairing.poll(s.session)); });
app.use('/api', (req, res, next) => { if (!tokenValid(req.headers.authorization?.replace(/^Bearer /, '') ?? '')) {
    res.status(401).json({ error: 'Enter your server access token or pair using Telegram' });
    return;
} next(); });
app.get('/api/state', (_req, res) => res.json(service.snapshot()));
app.get('/api/presets', (_req, res) => res.json(presets));
app.post('/api/ticket', (req, res) => res.json(service.ticket(req.body)));
app.post('/api/rules', async (req, res) => { await service.setRules(req.body); res.json(service.snapshot()); });
app.post('/api/action', (req, res) => {
    const data = z.object({ kind: z.enum(['lock', 'close', 'close-all', 'breakeven', 'cancel']), symbol: z.enum(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']).optional(), orderId: z.string().min(1).optional() }).parse(req.body);
    if (data.kind === 'cancel') {
        const order = service.account.orders.find(o => o.id === data.orderId && !o.protective);
        if (!order) throw new Error('Pending entry is no longer available');
        res.json(service.propose('cancel', `Cancel ${order.symbol} entry?`, 'Protective stops will stay in place.', { orderId: order.id })); return;
    }
    const title = { lock: 'Lock new trades through Riskavue?', close: `Close ${data.symbol} position?`, 'close-all': 'Close all demo positions?', breakeven: `Move ${data.symbol} stop to break-even?` }[data.kind];
    res.json(service.propose(data.kind, title, 'Tap to confirm. This action applies to your current demo session.', { symbol: data.symbol }));
});
app.post('/api/override', (req, res) => {
    const { reason } = z.object({ reason: z.enum(['I requested this lock by mistake', 'I have reviewed my plan and limits']) }).parse(req.body);
    if (!service.snapshot().lock || service.snapshot().lock!.hard) throw new Error('Only soft locks can be overridden');
    res.json(service.propose('override', 'Override soft lock?', reason, { reason, inputMethod: 'touch' }));
});
app.post('/api/actions/:id/confirm', async (req, res) => { const input = z.object({ heldMs: z.number().min(0).max(60000).optional() }).parse(req.body ?? {}); res.json(await service.execute(String(req.params.id), input.heldMs === undefined ? undefined : { heldMs: input.heldMs })); });
app.post('/api/actions/:id/dismiss', (req, res) => res.json(service.dismiss(String(req.params.id)) ?? { error: 'Not found' }));
app.post('/api/presence', (_req, res) => { service.activeUntil = Date.now() + 10000; res.json({ ok: true }); });
app.post('/api/review', async (_req, res) => res.json({ review: await makeReview(service) }));
app.post('/api/voice', express.raw({ type: 'application/octet-stream', limit: '640kb' }), async (req, res) => { if (!Buffer.isBuffer(req.body))
    throw new Error('Expected raw PCM 16 kHz mono audio'); const text = await transcribe(req.body); res.json({ text, result: voiceCommand(service, text, true) }); });
app.post('/api/paper/:scenario', async (req, res) => {
    if (!(exchange instanceof Paper)) {
        res.status(403).json({ error: 'Scenarios only work in paper mode' });
        return;
    }
    const scenario = z.enum(['seed', 'fill', 'loss', 'profit', 'disconnect', 'reconnect', 'reset']).parse(req.params.scenario);
    if (scenario === 'seed') {
        exchange.seed();
        service.baseline = { day: (await import('./rules.ts')).tradingDay(Date.now(), service.rules).day, balance: 10000, equity: 10000, highBalance: 10000, estimated: false, capturedAt: Date.now(), trades: 1, losses: 0, streak: 0 };
        store.set('baseline', service.baseline);
        service.lock = null;
        store.set('lock', null);
    }
    if (scenario === 'reset') {
        exchange.account = { wallet: service.rules.initialBalance, equity: service.rules.initialBalance, positions: [], orders: [], at: Date.now(), connected: true, mode: 'paper' };
        service.baseline = null;
        service.lock = null;
        store.set('baseline', null);
        store.set('lock', null);
        for (const a of store.actions().filter(a => a.status === 'pending'))
            service.dismiss(a.id);
    }
    if (scenario === 'fill') {
        const o = exchange.fill();
        service.recordEntry(o.id);
    }
    if (scenario === 'loss') {
        exchange.account.wallet -= 50;
        service.recordClose(crypto.randomUUID(), -50);
    }
    if (scenario === 'profit') {
        for (const p of exchange.account.positions)
            p.mark = p.entry + (p.qty > 0 ? 1 : -1) * Math.abs(p.entry - (p.stop ?? p.entry * .99)) * 1.2;
    }
    if (scenario === 'disconnect') {
        service.stopped = true;
        service.account.connected = false;
        service.publish();
        res.json(service.snapshot());
        return;
    }
    if (scenario === 'reconnect')
        service.stopped = false;
    store.log('paper', `Synthetic scenario: ${scenario}`);
    await service.refresh();
    res.json(service.snapshot());
});
app.get('/judge/', (req, res, next) => { if (req.path.endsWith('/')) res.redirect(308, '/judge'); else next(); });
app.get('/judge', (_req, res) => res.sendFile(resolve('app/dist/judge.html')));
app.use(express.static(resolve('app/dist')));
app.use((err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => { res.status(400).json({ error: err instanceof z.ZodError ? err.issues.map(x => x.message).join('; ') : err instanceof Error ? err.message : 'Request failed' }); });
const server = createServer(app), wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
    const url = new URL(req.url ?? '/', config.origin);
    const origin = req.headers.origin;
    if (url.pathname !== '/ws' || (origin && !allowed.has(origin))) {
        socket.destroy();
        return;
    }
    wss.handleUpgrade(req, socket, head, ws => {
        let authenticated = false;
        const timeout = setTimeout(() => ws.close(1008, 'Authenticate'), 5000);
        ws.on('message', data => { if (authenticated)
            return; try {
            const body = JSON.parse(String(data));
            if (!tokenValid(String(body.token ?? ''))) {
                ws.close(1008, 'Unauthorized');
                return;
            }
            authenticated = true;
            clearTimeout(timeout);
            ws.send(JSON.stringify(service.snapshot()));
            service.on('state', send);
        }
        catch {
            ws.close(1008, 'Invalid authentication');
        } });
        const send = (state: unknown) => { if (authenticated && ws.readyState === 1)
            ws.send(JSON.stringify(state)); };
        ws.on('close', () => { clearTimeout(timeout); service.off('state', send); });
    });
});
const bot = telegram(service, pairing);
server.listen(config.port, config.host, () => console.log(`Riskavue ${config.mode} server: http://${config.host}:${config.port}`));
void service.start();
function shutdown() { service.stop(); if (bot?.isRunning())
    void bot.stop(); wss.clients.forEach(ws => ws.close()); server.close(() => { store.close(); process.exit(0); }); }
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
