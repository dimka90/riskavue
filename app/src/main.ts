import './style.css';
import { enhanceTradeSelects } from './trade-select.ts';
import { deadline, actionText } from '../../shared/session-text.ts';
import type { Snapshot, Action, Preset, Rules } from '../../shared/types.ts';
import { display, type Page } from '../../shared/display.ts';
import { glasses } from './glasses.ts';
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const backendOrigin = import.meta.env.VITE_API_ORIGIN || location.origin;
const esc = (v: unknown) => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number | undefined) => n === undefined ? '—' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);
let state: Snapshot | undefined, page: Page = 'session', selected: string | undefined, token = sessionStorage.getItem('riskavue-token') ?? '', presets: Preset[] = [], bridge: Awaited<ReturnType<typeof glasses>> | undefined;
let socket: WebSocket | undefined, reconnect: ReturnType<typeof setTimeout>, recording = false, chunks: Uint8Array[] = [], audio: AudioContext | undefined, media: MediaStream | undefined, processor: ScriptProcessorNode | undefined, recordTimer: ReturnType<typeof setTimeout>, g2Active = false;
$('app').innerHTML = `
<header><a class="brand" href="/" aria-label="Riskavue home"><span class="brand-mark">R<span>·</span></span>riskavue</a><span class="tagline">Your limits. In sight.</span><div class="header-right"><span id="mode" class="badge">CONNECTING</span><button id="access" class="quiet">Connection settings</button></div></header>
<main><section class="intro"><div><p class="eyebrow">YOUR TRADING SESSION</p><h1>A little distance.<br>A clearer decision.</h1></div><p class="intro-note">Keep your limits in view.<br>Act with a glance and a tap.</p></section>
<div id="notice" role="status" aria-live="polite"></div>
<div class="workspace"><section class="primary"><div class="panel session-panel"><div class="panel-heading"><h2>Room to your limit</h2><span id="connection" class="connection">Connecting</span></div><div class="amount" id="remaining">—</div><p id="risk-caption">Waiting for your account</p><div class="meter"><div id="meter-fill"></div><i></i></div><div class="meter-labels"><span id="floor">Floor —</span><span id="equity">Equity —</span></div><div class="stats"><div><span>Entries left</span><strong id="entries">—</strong></div><div><span>Loss streak</span><strong id="losses">—</strong></div><div><span>Daily reset</span><strong id="reset">—</strong></div></div><div class="baseline" id="baseline"></div><div class="session-actions"><button id="lock" class="secondary">Lock my session</button><button id="close-all" class="quiet">Close all positions</button></div></div>
<div class="panel"><div class="panel-heading"><h2>Open positions</h2><span id="position-count" class="subtle">0</span></div><div id="positions" class="empty">No positions open.</div></div>
<div class="panel"><div class="panel-heading"><h2>Pending entries</h2><span class="subtle">Stops stay protected</span></div><div id="orders" class="empty">No pending entries.</div></div>
<div class="panel"><div class="panel-heading"><h2>Decisions, remembered</h2><button id="review" class="quiet">Generate AI review</button></div><p id="review-text" class="review-text">Your session review will appear here.</p><div id="decisions" class="timeline"></div></div></section>
<aside><section class="glasses-panel"><div class="panel-heading"><h2>In your line of sight</h2><span id="g2" class="subtle">Browser preview</span></div><div class="display-frame"><pre id="display">Riskavue\nYour limits. In sight.\nConnecting...</pre></div><div class="glasses-controls"><button id="previous" aria-label="Previous glasses view">↑</button><button id="tap" class="tap">Tap to confirm</button><button id="next" aria-label="Next glasses view">↓</button></div><button id="voice" class="voice">Hold to speak</button><p class="hint">G2: swipe to browse · tap to act · double-tap to exit</p></section>
<section class="panel ticket-panel"><div class="panel-heading"><h2>Check a trade</h2><span class="subtle">Before it leaves</span></div><form id="ticket"><div class="form-row"><label>Market<select name="symbol"><option>BTCUSDT</option><option>ETHUSDT</option><option>SOLUSDT</option></select></label><label>Direction<select name="side"><option value="BUY">Long / buy</option><option value="SELL">Short / sell</option></select></label></div><label>Quantity<input name="qty" type="number" min="0.0001" step="any" value="0.01" required></label><div class="form-row"><label>Limit price<input name="entry" type="number" min="0.01" step="any" value="60000" required></label><label>Stop price<input name="stop" type="number" min="0.01" step="any" value="59000" required></label></div><button type="submit" class="primary-button">Check against my rules</button><p class="hint">Nothing is submitted until you confirm. Binance entries use post-only limits.</p></form><div id="confirmation"></div></section>
<section class="panel"><div class="panel-heading"><h2>Your rules</h2><button id="edit-rules" class="quiet">Edit</button></div><div id="rule-summary" class="rule-summary"></div></section>
<section class="panel"><h2>Connected tools</h2><div id="integrations" class="integrations"></div><button id="pair" class="quiet">Pair with Telegram</button></section>
<section id="paper-panel" class="panel paper-panel" hidden><h2>Demo controls</h2><p class="hint">Synthetic paper scenarios. No exchange orders.</p><div class="scenario-grid"><button data-scenario="seed">Load $190 scenario</button><button data-scenario="fill">Fill pending entry</button><button data-scenario="loss">Record a $50 loss</button><button data-scenario="profit">Move past +1R</button><button data-scenario="disconnect">Disconnect feed</button><button data-scenario="reconnect">Reconnect feed</button><button data-scenario="reset">Reset paper session</button></div></section></aside></div>
<footer><span>RISKAVUE / HEADS UP 2026</span><span>Demo funds only. Your rules, your decisions.</span></footer></main>
<dialog id="settings"><form id="settings-form"><div class="panel-heading"><h2>Connection settings</h2><button type="button" data-close="settings" class="quiet">Close</button></div><p>Use the access token configured on your Riskavue server.</p><label>Server access token<input id="token" type="password" autocomplete="off"></label><button class="primary-button">Connect</button><p class="hint">Stored in this tab only. Exchange keys stay on the server.</p></form></dialog>
<dialog id="rules-dialog"><form id="rules-form"><div class="panel-heading"><h2>Set your session rules</h2><button type="button" data-close="rules-dialog" class="quiet">Close</button></div><label>Preset<select id="preset"></select></label><p id="preset-description" class="hint"></p><div class="form-row"><label>Initial balance<input name="initialBalance" type="number" min="1" required></label><label>Daily limit (%)<input name="dailyPct" type="number" min="0.1" max="50" step="0.1" required></label></div><div class="form-row"><label>Maximum loss (%)<input name="maxPct" type="number" min="0.1" max="90" step="0.1" required></label><label>Buffer (% of daily allowance)<input name="bufferPct" type="number" min="0" max="100" required></label></div><div class="form-row"><label>Entry limit<input name="maxTrades" type="number" min="1" required></label><label>Loss limit<input name="maxLosses" type="number" min="1" required></label></div><div class="form-row"><label>Loss counting<select name="lossMode"><option value="consecutive">Consecutive</option><option value="total">Total</option></select></label><label>Time zone<input name="timezone" required></label></div><div class="form-row"><label>Reset hour<input name="resetHour" type="number" min="0" max="23" required></label><label>Reset minute<input name="resetMinute" type="number" min="0" max="59" required></label></div><div class="form-row"><label>Daily reference<select name="dailyBasis"><option value="balance">Day-start balance</option><option value="equity">Day-start equity</option><option value="higher">Higher balance/equity</option></select></label><label>Daily percentage basis<select name="dailyAllowanceBasis"><option value="initial">Initial balance</option><option value="day">Day-start reference</option></select></label></div><div class="form-row"><label>Maximum floor<select name="maxMode"><option value="static">Static</option><option value="trailing">End-of-day trailing</option><option value="capped">Trailing, capped at initial</option></select></label><label>Maximum loss amount (optional)<input name="maxLossAmount" type="number" min="1" step="any" placeholder="Use percentage"></label></div><div class="form-row"><label>Breach boundary<select name="touchBreach"><option value="false">Below floor</option><option value="true">Touches floor</option></select></label><label>Fee estimate (%)<input name="feeRate" type="number" min="0" max="2" step="0.001" required></label></div><label>Slippage estimate (%)<input name="slippageRate" type="number" min="0" max="5" step="0.001" required></label><button class="primary-button">Start rule session</button><p class="hint">Close positions and cancel entries before changing rules. Firm-style presets are calculation models, not prop-firm integrations.</p></form></dialog>
<dialog id="pair-dialog"><div class="panel-heading"><h2>Pair your glasses</h2><button data-close="pair-dialog" class="quiet">Close</button></div><p>Send this to your configured Telegram bot:</p><code id="pair-code"></code><p class="hint" id="pair-status">Code expires in five minutes.</p></dialog>`;
function notify(text: string, error = false) { $('notice').textContent = text; $('notice').className = error ? 'notice error' : 'notice'; }
enhanceTradeSelects($<HTMLFormElement>('ticket'));
async function api<T = any>(path: string, body?: unknown, raw = false): Promise<T> { const res = await fetch(`${backendOrigin}/api${path}`, { method: body === undefined ? 'GET' : 'POST', headers: { Authorization: `Bearer ${token}`, ...(body !== undefined ? { 'Content-Type': raw ? 'application/octet-stream' : 'application/json' } : {}) }, body: body === undefined ? undefined : raw ? body as BodyInit : JSON.stringify(body) }); const result = await res.json(); if (!res.ok) {
    if (res.status === 401)
        ($('settings') as HTMLDialogElement).showModal();
    throw new Error(result.error ?? 'Request failed');
} return result; }
function safe(task: () => Promise<unknown>) { return () => { void task().catch(e => notify(e.message, true)); }; }
function action() { return state?.actions.find(a => a.id === selected); }
function render() {
    if (!state)
        return;
    const s = state;
    const stale = s.stale || Date.now() - s.account.at > 5000;
    $('mode').textContent = s.account.mode === 'paper' ? 'PAPER DEMO' : 'BINANCE DEMO';
    $('paper-panel').hidden = s.account.mode !== 'paper';
    $('connection').textContent = stale ? 'Connection lost' : s.lock ? 'Session locked' : 'Connected';
    $('connection').className = `connection ${stale || s.lock ? 'warning' : ''}`;
    $('remaining').textContent = stale ? '—' : money(s.risk?.remaining);
    $('remaining').className = `amount ${s.risk?.warning ? 'warn' : ''}`;
    $('risk-caption').textContent = stale ? (s.account.error ?? 'Account data is stale. Actions are paused.') : s.lock ? `New trades blocked until ${deadline(s.lock.until, s.rules.timezone).full}. Protective stops kept.` : s.risk?.unknown[0] ?? (s.risk?.warning ? 'Inside your warning buffer. Take a moment.' : 'Space to act within your own rules.');
    $('meter-fill').style.width = `${stale ? 0 : Math.max(0, Math.min(100, 100 * (s.risk?.remaining ?? 0) / (s.risk?.dailyAllowance ?? 1)))}%`;
    $('floor').textContent = `Floor ${stale ? '—' : money(s.risk?.floor)}`;
    $('equity').textContent = `Equity ${stale ? '—' : money(s.account.equity)}`;
    $('entries').textContent = s.lock ? 'Locked' : String(Math.max(0, s.rules.maxTrades - (s.baseline?.trades ?? 0)));
    $<HTMLButtonElement>('lock').disabled = !!s.lock;
    $('lock').textContent = s.lock ? 'Session locked' : 'Lock my session';
    $('losses').textContent = `${s.baseline?.streak ?? 0} / ${s.rules.maxLosses}`;
    const minutes = Math.max(0, Math.floor((s.resetAt - Date.now()) / 60000));
    $('reset').textContent = `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
    $('baseline').textContent = s.baseline?.estimated ? `Estimated floor · day-start data unknown. Tracking since ${new Date(s.baseline.capturedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : 'Baseline captured for this session.';
    $('position-count').textContent = String(s.account.positions.length);
    $('positions').className = '';
    $('positions').innerHTML = s.account.positions.length ? s.account.positions.map(p => `<div class="position"><div><strong>${esc(p.symbol)}</strong><span>${p.qty > 0 ? 'Long' : 'Short'} · ${Math.abs(p.qty)} · stop ${p.stop ?? 'unknown'}</span></div><div class="position-value">${money(p.qty * (p.mark - p.entry))}<div><button data-position="${esc(p.symbol)}" data-kind="breakeven">Break-even stop</button><button data-position="${esc(p.symbol)}" data-kind="close">Close</button></div></div></div>`).join('') : '<p class="empty">No open positions. Room to think.</p>';
    $('orders').innerHTML = s.account.orders.filter(o => !o.protective).map(o => `<div class="position"><div><strong>${esc(o.symbol)}</strong><span>${o.side} ${o.qty} at ${o.price}</span></div><button data-order="${esc(o.id)}">Review cancellation</button></div>`).join('') || '<p class="empty">No pending entries.</p>';
    $('rule-summary').innerHTML = `<strong>${esc(s.rules.name)}</strong><p>${s.rules.dailyPct * 100}% daily · ${s.rules.maxPct * 100}% overall</p><p>Stop after ${s.rules.maxLosses} ${s.rules.lossMode} losses</p><p>Reset ${s.rules.resetHour}:${String(s.rules.resetMinute).padStart(2, '0')} ${esc(s.rules.timezone)}</p>`;
    $('integrations').innerHTML = Object.entries({ Binance: s.integrations.binance, Telegram: s.integrations.telegram, 'Voice / Deepgram': s.integrations.voice, 'Review / Claude': s.integrations.claude }).map(([k, v]) => `<div><span>${esc(k)}</span><span class="${v ? 'ready' : 'subtle'}">${v ? 'Configured' : 'Needs setup'}</span></div>`).join('');
    $('review-text').textContent = s.review || 'A short account of the rules you kept and the decisions you made.';
    $('decisions').innerHTML = s.decisions.slice(0, 8).map(d => `<div><time>${new Date(d.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time><span>${esc(d.message)}</span></div>`).join('') || '<p class="empty">Your decisions will appear here.</p>';
    const pending = s.actions.find(a => a.status === 'pending' && a.expiresAt > Date.now());
    if (pending && (!selected || !s.actions.some(a => a.id === selected && a.status === 'pending')))
        selected = pending.id;
    const a = action();
    $('confirmation').innerHTML = a ? `<div class="confirmation"><span class="eyebrow">${esc(a.status)}</span><h3>${esc(a.status === 'pending' ? a.title : a.status === 'done' ? 'Completed' : 'Action status')}</h3><p>${esc(a.status === 'pending' ? a.detail : actionText(a))}</p>${a.status === 'pending' && a.expiresAt > Date.now() ? `<div class="form-row"><button id="confirm" class="primary-button">${a.kind === 'discard' ? 'Discard' : 'Confirm'}</button><button id="dismiss">Dismiss</button></div>` : '<button id="clear-action">Back to session</button>'}</div>` : '';
    if ($('confirm'))
        $('confirm').onclick = safe(confirm);
    if ($('dismiss'))
        $('dismiss').onclick = safe(dismiss);
    if ($('clear-action'))
        $('clear-action').onclick = () => { selected = undefined; render(); };
    renderGlasses();
}
function renderGlasses() { if (!state)
    return; const content = recording ? 'RISKAVUE / LISTENING\n\nSay a short command.\nRelease to finish.' : display(state, page, action()); $('display').textContent = content; bridge?.update(content); }
async function confirm() { const a = action(); if (!a)
    return; if (a.status !== 'pending') {
    selected = undefined;
    page = 'session';
    render();
    return;
} const result = await api<Action>(`/actions/${a.id}/confirm`, {}); notify(result.result ?? 'Working...', result.status === 'failed' || result.status === 'unknown'); await load(); }
async function dismiss() { const a = action(); if (a)
    await api(`/actions/${a.id}/dismiss`, {}); selected = undefined; await load(); }
async function navigate(delta: number) { if (action()?.status === 'pending')
    await dismiss();
else
    selected = undefined; const pages: Page[] = ['session', 'positions', 'rules', 'review']; page = pages[(pages.indexOf(page) + delta + 4) % 4]; render(); }
async function load() { state = await api<Snapshot>('/state'); render(); }
function connect() { clearTimeout(reconnect); socket?.close(); const ws = new WebSocket(`${backendOrigin.replace(/^http/, 'ws')}/ws`); socket = ws; ws.onopen = () => ws.send(JSON.stringify({ token })); ws.onmessage = e => { state = JSON.parse(e.data); render(); }; ws.onclose = () => { if (socket === ws) {
    if (state) {
        state.stale = true;
        render();
    }
    reconnect = setTimeout(connect, 2500);
} }; ws.onerror = () => { }; }
$('ticket').onsubmit = e => { e.preventDefault(); void (async () => { const f = new FormData(e.target as HTMLFormElement); const a = await api<Action>('/ticket', { symbol: f.get('symbol'), side: f.get('side'), qty: Number(f.get('qty')), entry: Number(f.get('entry')), stop: Number(f.get('stop')) }); selected = a.id; await load(); })().catch(e => notify(e.message, true)); };
$('tap').onclick = safe(confirm);
$('previous').onclick = safe(() => navigate(-1));
$('next').onclick = safe(() => navigate(1));
$('lock').onclick = safe(async () => { selected = (await api<Action>('/action', { kind: 'lock' })).id; await load(); });
$('close-all').onclick = safe(async () => { selected = (await api<Action>('/action', { kind: 'close-all' })).id; await load(); });
$('review').onclick = safe(async () => { notify('Claude is reviewing the decision log…'); await api('/review', {}); notify('Session review ready.'); await load(); });
document.addEventListener('click', e => { const b = (e.target as HTMLElement).closest<HTMLElement>('button'); if (!b)
    return; if (b.dataset.close)
    ($<HTMLDialogElement>(b.dataset.close)).close(); if (b.dataset.position)
    void (async () => { selected = (await api<Action>('/action', { kind: b.dataset.kind, symbol: b.dataset.position })).id; await load(); })().catch(e => notify(e.message, true)); if (b.dataset.order) {
    selected = state?.actions.find(a => a.kind === 'cancel' && a.payload.orderId === b.dataset.order && a.status === 'pending')?.id;
    render();
} if (b.dataset.scenario)
    void api('/paper/' + b.dataset.scenario, {}).then(() => { selected = undefined; return load(); }).catch(e => notify(e.message, true)); });
$('access').onclick = () => { $<HTMLInputElement>('token').value = token; $<HTMLDialogElement>('settings').showModal(); };
$('settings-form').onsubmit = e => { e.preventDefault(); token = $<HTMLInputElement>('token').value; sessionStorage.setItem('riskavue-token', token); $<HTMLDialogElement>('settings').close(); connect(); void load().then(() => notify('Connected successfully.')).catch(e => notify(e.message, true)); };
let draft: Rules | undefined;
function fillRules(r: Rules) { draft = { ...r }; const form = $<HTMLFormElement>('rules-form'); for (const [k, v] of Object.entries({ ...r, maxLossAmount: r.maxLossAmount ?? '' })) {
    const input = form.elements.namedItem(k) as HTMLInputElement | HTMLSelectElement | null;
    if (input)
        input.value = String(['dailyPct', 'maxPct', 'bufferPct', 'feeRate', 'slippageRate'].includes(k) ? Number(v) * 100 : v);
} }
$('edit-rules').onclick = safe(async () => { presets = await api('/presets'); $<HTMLSelectElement>('preset').innerHTML = presets.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join(''); if (state)
    fillRules(state.rules); $<HTMLDialogElement>('rules-dialog').showModal(); });
$('preset').onchange = () => { const preset = presets.find(p => p.id === $<HTMLSelectElement>('preset').value); if (preset && state) {
    fillRules({ ...state.rules, ...preset.rules });
    $('preset-description').textContent = preset.description;
} };
$('rules-form').onsubmit = e => { e.preventDefault(); void (async () => { if (!draft)
    return; const f = new FormData(e.target as HTMLFormElement), r: any = { ...draft }; for (const [k, v] of f)
    r[k] = k === 'touchBreach' ? v === 'true' : k === 'maxLossAmount' && v === '' ? undefined : ['timezone', 'lossMode', 'dailyBasis', 'dailyAllowanceBasis', 'maxMode'].includes(k) ? v : Number(v); for (const k of ['dailyPct', 'maxPct', 'bufferPct', 'feeRate', 'slippageRate'])
    r[k] /= 100; await api('/rules', r); $<HTMLDialogElement>('rules-dialog').close(); await load(); })().catch(e => notify(e.message, true)); };
$('pair').onclick = safe(async () => { const p = await api('/pair/start', {}); $('pair-code').textContent = `/pair ${p.code}`; $<HTMLDialogElement>('pair-dialog').showModal(); const timer = setInterval(() => { if (Date.now() > p.expiresAt || !$<HTMLDialogElement>('pair-dialog').open) {
    clearInterval(timer);
    return;
} void api('/pair/poll', { session: p.session }).then(r => { if (r.paired) {
    clearInterval(timer);
    token = r.token;
    sessionStorage.setItem('riskavue-token', token);
    $('pair-status').textContent = 'Paired successfully.';
    connect();
    void load().then(() => notify('Paired successfully.')).catch(e => notify(e.message, true));
} }).catch(() => { }); }, 2500); });
async function beginVoice(g2 = false) {
    if (recording)
        return;
    if (!state?.integrations.voice)
        throw new Error('Add DEEPGRAM_API_KEY on the server to enable voice');
    recording = true;
    chunks = [];
    renderGlasses();
    $('voice').textContent = 'Listening… release to finish';
    try {
        if (g2 && bridge)
            await bridge.mic(true);
        else {
            media = await navigator.mediaDevices.getUserMedia({ audio: true });
            audio = new AudioContext({ sampleRate: 16000 });
            const source = audio.createMediaStreamSource(media);
            processor = audio.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = e => { if (!recording)
                return; const samples = e.inputBuffer.getChannelData(0), buffer = new ArrayBuffer(samples.length * 2), view = new DataView(buffer); for (let i = 0; i < samples.length; i++)
                view.setInt16(i * 2, Math.max(-1, Math.min(1, samples[i])) * 32767, true); chunks.push(new Uint8Array(buffer)); };
            source.connect(processor);
            processor.connect(audio.destination);
        }
        recordTimer = setTimeout(() => void endVoice().catch(e => notify(e.message, true)), 15000);
    }
    catch (e) {
        recording = false;
        renderGlasses();
        throw e;
    }
}
async function endVoice() { if (!recording)
    return; recording = false; clearTimeout(recordTimer); if (bridge)
    await bridge.mic(false); processor?.disconnect(); media?.getTracks().forEach(t => t.stop()); await audio?.close(); audio = undefined; $('voice').textContent = 'Hold to speak'; renderGlasses(); const size = chunks.reduce((s, c) => s + c.length, 0), data = new Uint8Array(size); let offset = 0; for (const c of chunks) {
    data.set(c, offset);
    offset += c.length;
} const r = await api('/voice', data, true); notify(`Heard: ${r.text}${r.result.message ? ' · ' + r.result.message : ''}`); if (r.result.id)
    selected = r.result.id; await load(); }
$('voice').onpointerdown = e => { e.preventDefault(); $('voice').setPointerCapture(e.pointerId); void beginVoice().catch(e => notify(e.message, true)); };
$('voice').onpointerup = safe(endVoice);
$('voice').onpointercancel = safe(endVoice);
$('voice').onkeydown = e => { if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    void beginVoice().catch(e => notify(e.message, true));
} };
$('voice').onkeyup = e => { if (e.code === 'Space')
    void endVoice().catch(e => notify(e.message, true)); };
void glasses(event => { if (event === 'active') {
    g2Active = true;
    return;
} if (event === 'inactive') {
    g2Active = false;
    return;
} if (event === 'tap')
    void confirm().catch(e => notify(e.message, true)); if (event === 'up' || event === 'down')
    void navigate(event === 'up' ? -1 : 1).catch(e => notify(e.message, true)); if (event === 'hold')
    void beginVoice(true).catch(e => notify(e.message, true)); if (event === 'release')
    void endVoice().catch(e => notify(e.message, true)); }, bytes => { if (recording && chunks.reduce((n, c) => n + c.length, 0) < 640000)
    chunks.push(new Uint8Array(bytes)); }, status => { $('g2').textContent = status; }).then(b => { bridge = b; g2Active = true; renderGlasses(); }).catch(() => { $('g2').textContent = 'Browser preview'; });
setInterval(() => { if (state) {
    renderGlasses();
    if (Date.now() - state.account.at > 5000) {
        state.stale = true;
        render();
    }
} if (g2Active)
    void api('/presence', {}).catch(() => { }); }, 2000);
connect();
void load().catch(e => notify(e.message, true));
