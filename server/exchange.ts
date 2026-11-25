import { createHmac, randomUUID } from 'node:crypto';
import { WebSocket } from 'ws';
import { Decimal } from 'decimal.js';
import { demoDispatcher, demoLookup } from './demo-dns.ts';
import type { Fill } from './ledger.ts';
import type { Account, Ticket, Position, Order } from '../shared/types.ts';
export interface Exchange {
    mode: 'paper' | 'binance';
    read(): Promise<Account>;
    place(t: Ticket, id: string): Promise<string>;
    cancel(o: Order): Promise<string>;
    close(p: Position, id: string): Promise<string>;
    breakeven(p: Position, id: string): Promise<string>;
    fills?(since: number, symbols: string[]): Promise<Fill[]>;
    start?(refresh: () => void): Promise<void>;
    stop?(): void;
}
export class UncertainExecution extends Error {
}
export class Binance implements Exchange {
    mode = 'binance' as const;
    readonly host = 'https://demo-fapi.binance.com';
    offset = 0;
    sockets: WebSocket[] = [];
    timers: NodeJS.Timeout[] = [];
    stopped = false;
    listenKey = '';
    constructor(private key: string, private secret: string) { }
    async request(path: string, params: Record<string, string | number | boolean> = {}, method = 'GET', signed = true, clockRetry = true, networkRetry = true): Promise<any> {
        const q = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
        if (signed) {
            q.set('timestamp', String(Date.now() + this.offset));
            q.set('recvWindow', method === 'GET' ? '10000' : '5000');
            q.set('signature', createHmac('sha256', this.secret).update(q.toString()).digest('hex'));
        }
        let res: Response;
        try {
            const options = { method, headers: { 'X-MBX-APIKEY': this.key }, signal: AbortSignal.timeout(8000), dispatcher: demoDispatcher };
            res = await fetch(`${this.host}${path}?${q}`, options);
        }
        catch (error) {
            if (method !== 'GET')
                throw new UncertainExecution('Exchange response missing. Execution may have occurred; reconcile before retrying.');
            if (networkRetry) {
                await new Promise(resolve => setTimeout(resolve, 250));
                return this.request(path, params, method, signed, clockRetry, false);
            }
            const code = (error as { cause?: { code?: string }; name?: string }).cause?.code ?? (error as Error).name;
            throw new Error(`Binance demo is unreachable (${code ?? 'network error'})`);
        }
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            if (method === 'GET' && signed && clockRetry && data.code === -1021) {
                await this.syncTime();
                return this.request(path, params, method, signed, false, networkRetry);
            }
            if (res.status >= 500 && method !== 'GET')
                throw new UncertainExecution('Exchange returned an uncertain execution result. Check exchange state.');
            throw new Error(`Binance demo ${res.status}: ${data.code ?? 'request rejected'} ${String(data.msg ?? '').slice(0, 180)}`);
        }
        return data;
    }
    async syncTime() { const t = await this.request('/fapi/v1/time', {}, 'GET', false); this.offset = t.serverTime - Date.now(); }
    async read(): Promise<Account> {
        const [a, positions, orders, algos, config] = await Promise.all([this.request('/fapi/v3/account'), this.request('/fapi/v3/positionRisk'), this.request('/fapi/v1/openOrders'), this.request('/fapi/v1/openAlgoOrders'), this.request('/fapi/v1/accountConfig')]);
        if (config.dualSidePosition || config.multiAssetsMargin)
            throw new Error('Riskavue requires single-asset, one-way demo mode. Change this in Binance before connecting.');
        const protective = (Array.isArray(algos) ? algos : algos.orders ?? []).filter((x: any) => x.orderType === 'STOP_MARKET' || x.type === 'STOP_MARKET');
        const ps: Position[] = positions.filter((p: any) => Number(p.positionAmt) !== 0).map((p: any) => {
            const qty = Number(p.positionAmt);
            const stops = protective.filter((o: any) => o.symbol === p.symbol && o.side === (qty > 0 ? 'SELL' : 'BUY') && (o.closePosition === true || o.closePosition === 'true' || Number(o.quantity) >= Math.abs(qty)));
            // Only recognize close-all or reduce-only protection, never an order that could reverse exposure.
            const valid = stops.filter((o: any) => o.closePosition === true || o.closePosition === 'true' || o.reduceOnly === true || o.reduceOnly === 'true');
            const stop = valid.sort((a: any, b: any) => qty > 0 ? Number(b.triggerPrice) - Number(a.triggerPrice) : Number(a.triggerPrice) - Number(b.triggerPrice))[0];
            return { symbol: p.symbol, qty, entry: Number(p.entryPrice), mark: Number(p.markPrice), breakEven: Number(p.breakEvenPrice || p.entryPrice), stop: stop ? Number(stop.triggerPrice) : undefined, stopId: stop ? String(stop.algoId) : undefined };
        });
        const os: Order[] = orders.map((o: any) => ({ id: String(o.orderId), clientId: o.clientOrderId, symbol: o.symbol, side: o.side, qty: Number(o.origQty) - Number(o.executedQty), price: Number(o.price), protective: !!o.reduceOnly }));
        for (const o of Array.isArray(algos) ? algos : algos.orders ?? [])
            os.push({ id: String(o.algoId), symbol: o.symbol, side: o.side, qty: Number(o.quantity ?? 0), price: Number(o.triggerPrice ?? 0), protective: o.closePosition === true || o.closePosition === 'true' || o.reduceOnly === true || o.reduceOnly === 'true', algo: true, stopLoss: ['STOP_MARKET','STOP'].includes(o.orderType??o.type) });
        return { wallet: Number(a.totalWalletBalance), equity: Number(a.totalMarginBalance), positions: ps, orders: os, at: Date.now(), mode: this.mode, connected: true };
    }
    async filters(symbol: string) { const info = await this.request('/fapi/v1/exchangeInfo', {}, 'GET', false); const s = info.symbols.find((s: any) => s.symbol === symbol); if (!s)
        throw new Error('Unknown demo symbol'); return s.filters as any[]; }
    async validate(t: Ticket) {
        const f = await this.filters(t.symbol);
        const lot = f.find(x => x.filterType === 'LOT_SIZE'), price = f.find(x => x.filterType === 'PRICE_FILTER'), notional = f.find(x => x.filterType === 'MIN_NOTIONAL');
        if (lot && (!new Decimal(t.qty).mod(lot.stepSize).eq(0) || t.qty < Number(lot.minQty) || t.qty > Number(lot.maxQty)))
            throw new Error(`Quantity must match ${lot.stepSize} steps and symbol limits`);
        if (price && (!new Decimal(t.entry).mod(price.tickSize).eq(0) || !new Decimal(t.stop).mod(price.tickSize).eq(0)))
            throw new Error(`Entry and stop must match ${price.tickSize} price increments`);
        if (notional && t.qty * t.entry < Number(notional.notional))
            throw new Error('Order below the symbol minimum notional');
    }
    async place(t: Ticket, id: string) {
        await this.validate(t);
        // Use a resting, post-only LIMIT entry: crossing the market is rejected.
        const o = await this.request('/fapi/v1/order', { symbol: t.symbol, side: t.side, type: 'LIMIT', timeInForce: 'GTX', quantity: t.qty, price: t.entry, newClientOrderId: `rv${id.replaceAll('-', '')}` }, 'POST');
        try {
            // Close-all stops are GTE on Binance demo and require an existing position.
            // A quantity-bound reduce-only stop can protect a still-resting entry.
            await this.request('/fapi/v1/algoOrder', { symbol: t.symbol, side: t.side === 'BUY' ? 'SELL' : 'BUY', algoType: 'CONDITIONAL', type: 'STOP_MARKET', triggerPrice: t.stop, timeInForce: 'GTC', quantity: t.qty, reduceOnly: true, workingType: 'MARK_PRICE', clientAlgoId: `rs${id.replaceAll('-', '')}` }, 'POST');
        }
        catch (error) {
            try {
                await this.request('/fapi/v1/order', { symbol: t.symbol, orderId: o.orderId }, 'DELETE');
            }
            catch { }
            throw new UncertainExecution(`Entry submitted, protective stop failed (${error instanceof Error ? error.message : 'provider rejection'}). Cancellation attempted; inspect exchange positions immediately.`);
        }
        return `Demo limit entry accepted (#${o.orderId}); protective stop accepted. Entry may still be pending.`;
    }
    async cancel(o: Order) { const result = await this.request(o.algo ? '/fapi/v1/algoOrder' : '/fapi/v1/order', { symbol: o.symbol, [o.algo ? 'algoId' : 'orderId']: o.id }, 'DELETE'); if (!o.algo && result.status !== 'CANCELED')
        throw new UncertainExecution('Cancellation not confirmed; order may have filled'); return `Cancelled ${o.symbol} order ${o.id}`; }
    async close(p: Position, id: string) { const o = await this.request('/fapi/v1/order', { symbol: p.symbol, side: p.qty > 0 ? 'SELL' : 'BUY', type: 'MARKET', quantity: Math.abs(p.qty), reduceOnly: true, newClientOrderId: `rv${id.replaceAll('-', '')}`, newOrderRespType: 'RESULT' }, 'POST'); if (o.status !== 'FILLED')
        throw new UncertainExecution('Close submitted; fill not yet confirmed'); return `Closed ${p.symbol} (${o.executedQty})`; }
    async breakeven(p: Position, id: string) {
        if (!p.stopId)
            throw new Error('No existing protective stop to replace');
        const filters = await this.filters(p.symbol), tick = filters.find(f => f.filterType === 'PRICE_FILTER').tickSize;
        const trigger = new Decimal(p.breakEven).div(tick).toDecimalPlaces(0, p.qty > 0 ? Decimal.ROUND_CEIL : Decimal.ROUND_FLOOR).mul(tick).toNumber();
        if (p.qty > 0 ? trigger >= p.mark : trigger <= p.mark)
            throw new Error('Break-even stop would trigger immediately');
        await this.request('/fapi/v1/algoOrder', { symbol: p.symbol, side: p.qty > 0 ? 'SELL' : 'BUY', algoType: 'CONDITIONAL', type: 'STOP_MARKET', triggerPrice: trigger, closePosition: true, workingType: 'MARK_PRICE', clientAlgoId: `rb${id.replaceAll('-', '')}` }, 'POST');
        await this.request('/fapi/v1/algoOrder', { symbol: p.symbol, algoId: p.stopId }, 'DELETE');
        return `Stop moved to ${trigger}. Funding and execution costs may affect final P/L.`;
    }
    async fills(since: number, symbols: string[]): Promise<Fill[]> {
        const all: Fill[] = [];
        for (const symbol of [...new Set(symbols)]) {
            let fromId: number | undefined;
            for (let page = 0; page < 20; page++) {
                const rows = await this.request('/fapi/v1/userTrades', fromId === undefined ? { symbol, startTime: since, limit: 1000 } : { symbol, fromId, limit: 1000 });
                for (const row of rows) {
                    if (row.commissionAsset !== 'USDT' && Number(row.commission) !== 0)
                        throw new Error('Non-USDT fees need conversion before counting session losses');
                    all.push({ id: `${symbol}:${row.id}`, orderId: `${symbol}:${row.orderId}`, symbol, side: row.side, qty: Number(row.qty), realized: Number(row.realizedPnl), fee: Number(row.commission), at: row.time });
                }
                if (rows.length < 1000)
                    break;
                fromId = Number(rows.at(-1).id) + 1;
                if (page === 19)
                    throw new Error('Fill history exceeds reconciliation limit');
            }
        }
        return all.sort((a, b) => a.at - b.at || a.id.localeCompare(b.id));
    }
    async start(refresh: () => void) {
        await this.syncTime();
        this.stopped = false;
        const connect = (url: string) => { if (this.stopped)
            return; const ws = new WebSocket(url, { lookup: demoLookup, handshakeTimeout: 8000 }); this.sockets.push(ws); ws.on('message', () => refresh()); ws.on('error', () => { }); ws.on('close', () => { this.sockets = this.sockets.filter(s => s !== ws); if (!this.stopped)
            this.timers.push(setTimeout(() => connect(url), 3000)); }); };
        const data = await this.request('/fapi/v1/listenKey', {}, 'POST', false);
        this.listenKey = data.listenKey;
        connect(`wss://demo-fstream.binance.com/private/ws/${this.listenKey}`);
        connect('wss://demo-fstream.binance.com/market/ws/!markPrice@arr@1s');
        this.timers.push(setInterval(() => { void this.request('/fapi/v1/listenKey', {}, 'PUT', false).catch(() => { }); }, 30 * 60 * 1000));
    }
    stop() { this.stopped = true; this.timers.forEach(clearInterval); this.sockets.forEach(s => s.close()); }
}
export class Paper implements Exchange {
    mode = 'paper' as const;
    account: Account = { wallet: 10000, equity: 10000, positions: [], orders: [], at: Date.now(), connected: true, mode: 'paper' };
    constructor(initial?: Account) { if (initial)
        this.account = { ...initial, mode: 'paper', connected: true }; }
    async read() { this.account.at = Date.now(); this.account.equity = this.account.wallet + this.account.positions.reduce((s, p) => s + p.qty * (p.mark - p.entry), 0); return structuredClone(this.account); }
    async place(t: Ticket, id: string) { this.account.orders.push({ id, symbol: t.symbol, side: t.side, qty: t.qty, price: t.entry, stop: t.stop, protective: false }); return 'Paper limit entry accepted; awaiting a paper fill'; }
    async cancel(o: Order) { if (!this.account.orders.some(x => x.id === o.id))
        throw new Error('Order already filled or cancelled'); this.account.orders = this.account.orders.filter(x => x.id !== o.id); return `Cancelled paper ${o.symbol} order`; }
    async close(p: Position, _id: string) { const current = this.account.positions.find(x => x.symbol === p.symbol); if (!current)
        throw new Error('Position already closed'); this.account.wallet += current.qty * (current.mark - current.entry) - Math.abs(current.qty) * current.mark * .0005; this.account.positions = this.account.positions.filter(x => x !== current); return `Closed paper ${p.symbol} position`; }
    async breakeven(p: Position, _id: string) { const current = this.account.positions.find(x => x.symbol === p.symbol); if (!current)
        throw new Error('Position no longer open'); if (p.qty > 0 ? p.breakEven >= p.mark : p.breakEven <= p.mark)
        throw new Error('Break-even stop would trigger immediately'); current.stop = p.breakEven; return `Paper stop moved to ${p.breakEven}`; }
    seed() { this.account = { wallet: 10000, equity: 9690, positions: [{ symbol: 'BTCUSDT', qty: .1, entry: 65000, mark: 61900, stop: 61000, stopId: 'paper-stop', breakEven: 65065 }], orders: [{ id: randomUUID(), symbol: 'ETHUSDT', side: 'BUY', qty: 1, price: 2400, stop: 2160, protective: false }], mode: 'paper', at: Date.now(), connected: true }; }
    fill() { const o = this.account.orders.find(o => !o.protective); if (!o)
        throw new Error('No pending paper entry'); if (this.account.positions.some(p => p.symbol === o.symbol))
        throw new Error('Paper fill supports one position per symbol'); this.account.orders = this.account.orders.filter(x => x !== o); this.account.wallet -= o.qty * o.price * .0005; this.account.positions.push({ symbol: o.symbol, qty: o.side === 'BUY' ? o.qty : -o.qty, entry: o.price, mark: o.price, stop: o.stop, stopId: `paper-${o.id}`, entryFee: o.qty * o.price * .0005, breakEven: o.price * (o.side === 'BUY' ? 1.001 : .999) }); return o; }
}
