import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Decimal } from 'decimal.js';
import { Binance } from '../server/exchange.ts';
import { demoDispatcher } from '../server/demo-dns.ts';
import { Store } from '../server/store.ts';
import { Service } from '../server/service.ts';

if (!process.argv.includes('--execute-demo')) throw new Error('Requires --execute-demo; uses fake-money Binance demo only.');
const key = process.env.BINANCE_API_KEY, secret = process.env.BINANCE_API_SECRET ?? process.env.BINANCE_SECRET_KEY;
assert.ok(key && secret, 'Demo credentials required');
const exchange = new Binance(key, secret), store = new Store(':memory:'), service = new Service(store, exchange);
const rows: Record<string, unknown>[] = [];
const fixture = `rf${randomUUID().replaceAll('-', '')}`;
let submitted = false, replacementId = '', oldStopId = '', inspecting = false;
function record(step: string, details: Record<string, unknown> = {}) {
    const row = { at: new Date().toISOString(), step, ...details }; rows.push(row); console.log(JSON.stringify(row));
}
const request = exchange.request.bind(exchange);
exchange.request = async (...args: Parameters<typeof exchange.request>) => {
    const [path, params, method] = args;
    if (inspecting && path === '/fapi/v1/algoOrder' && method === 'DELETE' && String(params?.algoId) === oldStopId) {
        const raw = await request('/fapi/v1/openAlgoOrders');
        const orders = Array.isArray(raw) ? raw : raw.orders ?? [];
        assert.ok(orders.some((o: any) => String(o.algoId) === oldStopId), 'Old stop must remain until replacement accepted');
        assert.ok(orders.some((o: any) => o.clientAlgoId === replacementId), 'Replacement must be visible before old stop is removed');
        record('both-stops-visible-before-removal');
    }
    return request(...args);
};
try {
    await exchange.syncTime();
    const initial = await exchange.read();
    assert.equal(initial.positions.length, 0); assert.equal(initial.orders.length, 0);
    const filters = await exchange.filters('BTCUSDT');
    const tick = filters.find(f => f.filterType === 'PRICE_FILTER').tickSize;
    const lot = filters.find(f => f.filterType === 'MARKET_LOT_SIZE') ?? filters.find(f => f.filterType === 'LOT_SIZE');
    const book = await request('/fapi/v1/ticker/bookTicker', { symbol: 'BTCUSDT' }, 'GET', false);
    const mark = Number((await request('/fapi/v1/premiumIndex', { symbol: 'BTCUSDT' }, 'GET', false)).markPrice);
    const buy = mark > (Number(book.bidPrice) + Number(book.askPrice)) / 2;
    const price = Number(buy ? book.askPrice : book.bidPrice);
    const qty = new Decimal(Math.max(110 / price, Number(lot.minQty))).div(lot.stepSize).ceil().mul(lot.stepSize).toNumber();
    assert.ok(qty * price < 200);
    submitted = true;
    const fill = await request('/fapi/v1/order', { symbol: 'BTCUSDT', side: buy ? 'BUY' : 'SELL', type: 'MARKET', quantity: qty, newClientOrderId: fixture, newOrderRespType: 'RESULT' }, 'POST');
    assert.equal(fill.status, 'FILLED');
    const stop = new Decimal(mark * (buy ? .99 : 1.01)).div(tick).floor().mul(tick).toNumber();
    const protection = await request('/fapi/v1/algoOrder', { symbol: 'BTCUSDT', side: buy ? 'SELL' : 'BUY', algoType: 'CONDITIONAL', type: 'STOP_MARKET', triggerPrice: stop, closePosition: true, workingType: 'MARK_PRICE', clientAlgoId: fixture }, 'POST');
    oldStopId = String(protection.algoId);
    record('demo-position-protected', { side: buy ? 'BUY' : 'SELL', qty, stop });
    const deadline = Date.now() + 600000;
    let ready = false, lastReport = 0;
    while (Date.now() < deadline) {
        await service.refresh();
        const p = service.account.positions.find(p => p.symbol === 'BTCUSDT');
        assert.ok(p, 'Fixture position must remain open');
        if (Date.now() - lastReport > 15000) { record('waiting-for-valid-trigger', { mark: p.mark, breakEven: p.breakEven }); lastReport = Date.now(); }
        const trigger = new Decimal(p.breakEven).div(tick).toDecimalPlaces(0, p.qty > 0 ? Decimal.ROUND_CEIL : Decimal.ROUND_FLOOR).mul(tick).toNumber();
        // Leave room for movement while the exchange processes the replacement.
        if (p.qty > 0 ? p.mark > trigger * 1.0002 : p.mark < trigger * .9998) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 3000));
    }
    assert.ok(ready, 'Market did not reach a valid break-even trigger within ten minutes');
    const action = service.propose('breakeven', 'Move demo stop to break-even?', 'Confirm replacement', { symbol: 'BTCUSDT' });
    replacementId = `rb${action.id.replaceAll('-', '')}`; inspecting = true;
    const result = await service.execute(action.id);
    inspecting = false;
    assert.equal(result.status, 'done', result.result);
    const finalOrders = await request('/fapi/v1/openAlgoOrders');
    const orders = Array.isArray(finalOrders) ? finalOrders : finalOrders.orders ?? [];
    assert.ok(!orders.some((o: any) => String(o.algoId) === oldStopId));
    assert.ok(orders.some((o: any) => o.clientAlgoId === replacementId));
    record('break-even-replacement-verified', { result: result.result });
} catch (error) {
    process.exitCode = 1; record('failed', { error: error instanceof Error ? error.message : 'Test failed' });
} finally {
    inspecting = false;
    try {
        if (submitted) {
            for (const p of (await exchange.read()).positions.filter(p => p.symbol === 'BTCUSDT')) await exchange.close(p, randomUUID());
            const raw = await request('/fapi/v1/openAlgoOrders');
            for (const o of Array.isArray(raw) ? raw : raw.orders ?? []) {
                if (o.clientAlgoId === fixture || o.clientAlgoId === replacementId) await request('/fapi/v1/algoOrder', { symbol: o.symbol, algoId: o.algoId }, 'DELETE');
            }
            const final = await exchange.read();
            assert.equal(final.positions.length, 0); assert.equal(final.orders.length, 0);
            record('cleanup-confirmed', { positions: 0, orders: 0 });
        }
    } catch (error) { process.exitCode = 1; record('cleanup-needs-attention', { error: error instanceof Error ? error.message : 'Inspect demo account' }); }
    mkdirSync('.artifacts', { recursive: true });
    writeFileSync('.artifacts/binance-breakeven-verification.json', JSON.stringify(rows, null, 2));
    service.stop(); store.close(); await demoDispatcher.close();
}
