import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Decimal } from 'decimal.js';
import { Binance } from '../server/exchange.ts';
import { demoDispatcher } from '../server/demo-dns.ts';
import { Store } from '../server/store.ts';
import { Service } from '../server/service.ts';

if (!process.argv.includes('--execute-demo')) throw new Error('Pass --execute-demo to create and close a small DEMO position.');
const key = process.env.BINANCE_API_KEY, secret = process.env.BINANCE_API_SECRET ?? process.env.BINANCE_SECRET_KEY;
if (!key || !secret) throw new Error('Binance demo credentials missing');
const exchange = new Binance(key, secret), store = new Store(':memory:'), service = new Service(store, exchange);
const receipts: Record<string, unknown>[] = [];
let submitted = false;
function record(step: string, details: Record<string, unknown> = {}) {
    const row = { at: new Date().toISOString(), step, ...details };
    receipts.push(row); console.log(JSON.stringify(row));
}
try {
    await exchange.syncTime();
    const initial = await exchange.read();
    assert.equal(initial.positions.length, 0, 'Requires an empty demo account');
    assert.equal(initial.orders.length, 0, 'Existing orders must not be disturbed');
    await service.refresh();
    assert.equal(service.snapshot().stale, false, service.account.error);
    const filters = await exchange.filters('BTCUSDT');
    const ticker = await exchange.request('/fapi/v1/ticker/bookTicker', { symbol: 'BTCUSDT' }, 'GET', false);
    const lot = filters.find(f => f.filterType === 'MARKET_LOT_SIZE') ?? filters.find(f => f.filterType === 'LOT_SIZE');
    const price = Number(ticker.askPrice);
    const qty = new Decimal(Math.max(110 / price, Number(lot.minQty))).div(lot.stepSize).ceil().mul(lot.stepSize).toNumber();
    assert.ok(qty * price < 200, 'Fixture notional must remain below 200 USDT');
    // A deliberate outside-order fixture exercises the watcher, not the guarded ticket route.
    submitted = true;
    const fill = await exchange.request('/fapi/v1/order', {
        symbol: 'BTCUSDT', side: 'BUY', type: 'MARKET', quantity: qty,
        newClientOrderId: `rf${randomUUID().replaceAll('-', '')}`, newOrderRespType: 'RESULT',
    }, 'POST');
    assert.equal(fill.status, 'FILLED');
    record('outside-demo-fixture-filled', { orderId: String(fill.orderId), qty: fill.executedQty });
    await service.refresh();
    assert.ok(service.account.positions.some(p => p.symbol === 'BTCUSDT'));
    const action = store.actions().find(a => a.kind === 'close' && a.payload.symbol === 'BTCUSDT' && a.status === 'pending');
    assert.ok(action, 'Watcher should propose closing the unprotected position');
    record('watcher-proposed-close', { title: action.title });
    const result = await service.execute(action.id);
    assert.equal(result.status, 'done', result.result);
    assert.equal((await exchange.read()).positions.length, 0);
    record('reduce-only-close-filled', { result: result.result });
} catch (error) {
    process.exitCode = 1;
    record('failed', { error: error instanceof Error ? error.message : 'Demo close test failed' });
} finally {
    try {
        if (submitted) {
            const account = await exchange.read();
            for (const position of account.positions.filter(p => p.symbol === 'BTCUSDT'))
                await exchange.close(position, randomUUID());
            const final = await exchange.read();
            assert.equal(final.positions.length, 0); assert.equal(final.orders.length, 0);
            record('cleanup-confirmed', { positions: 0, orders: 0 });
        }
    } catch (error) {
        process.exitCode = 1;
        record('cleanup-needs-attention', { error: error instanceof Error ? error.message : 'Inspect demo account' });
    }
    mkdirSync('.artifacts', { recursive: true });
    writeFileSync('.artifacts/binance-close-verification.json', JSON.stringify(receipts, null, 2));
    service.stop(); store.close(); await demoDispatcher.close();
}
