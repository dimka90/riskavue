import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Decimal } from 'decimal.js';
import { Binance } from '../server/exchange.ts';
import { demoDispatcher } from '../server/demo-dns.ts';
import { Store } from '../server/store.ts';
import { Service } from '../server/service.ts';
import { defaultRules } from '../server/rules.ts';

if (!process.argv.includes('--execute-demo')) throw new Error('This test places and cleans up DEMO orders. Pass --execute-demo explicitly.');
const key = process.env.BINANCE_API_KEY, secret = process.env.BINANCE_API_SECRET ?? process.env.BINANCE_SECRET_KEY;
if (!key || !secret) throw new Error('Binance demo credentials missing');
const exchange = new Binance(key, secret), store = new Store(':memory:'), service = new Service(store, exchange);
const receipts: Record<string, unknown>[] = [];
const ids = new Set<string>();
let mayHavePlaced = false;
function record(step: string, details: Record<string, unknown> = {}) {
    const row = { at: new Date().toISOString(), step, ...details };
    receipts.push(row); console.log(JSON.stringify(row));
}
try {
    await exchange.syncTime();
    const initial = await exchange.read();
    assert.equal(initial.positions.length, 0, 'Use an empty demo account for this test');
    assert.equal(initial.orders.length, 0, 'Existing demo orders must not be disturbed');
    service.rules = { ...defaultRules, initialBalance: initial.wallet };
    await service.refresh();
    assert.equal(service.snapshot().stale, false, service.account.error ?? 'Account snapshot expired during initialization');
    const filters = await exchange.filters('BTCUSDT');
    const ticker = await exchange.request('/fapi/v1/ticker/bookTicker', { symbol: 'BTCUSDT' }, 'GET', false);
    const tick = filters.find(f => f.filterType === 'PRICE_FILTER').tickSize;
    const lot = filters.find(f => f.filterType === 'LOT_SIZE');
    const minimum = Number(filters.find(f => f.filterType === 'MIN_NOTIONAL')?.notional ?? 100);
    const round = (n: number) => new Decimal(n).div(tick).floor().mul(tick).toNumber();
    const entry = round(Number(ticker.bidPrice) * .98), stop = round(entry * .98);
    const qty = new Decimal(Math.max(minimum * 1.1 / entry, Number(lot.minQty))).div(lot.stepSize).ceil().mul(lot.stepSize).toNumber();
    assert.ok(qty * entry < 200, 'Keep demo test notional under 200 USDT');
    const ticket = { symbol: 'BTCUSDT', side: 'BUY' as const, qty, entry, stop };
    await service.refresh();
    const rejected = service.ticket({ ...ticket, qty: 10 });
    assert.equal(rejected.kind, 'discard');
    assert.equal((await service.execute(rejected.id)).status, 'done');
    assert.equal((await exchange.read()).orders.length, 0);
    record('oversized-ticket-rejected', { exchangeOrders: 0 });
    await service.refresh();
    const accepted = service.ticket(ticket);
    assert.equal(accepted.kind, 'place'); ids.add(accepted.id.replaceAll('-', ''));
    assert.equal((await exchange.read()).orders.length, 0);
    record('allowed-ticket-awaits-confirmation', { ticket });
    mayHavePlaced = true;
    const result = await service.execute(accepted.id);
    assert.equal(result.status, 'done', result.result);
    await service.refresh();
    const pending = service.account.orders.find(o => !o.protective && o.clientId === `rv${accepted.id.replaceAll('-', '')}`);
    assert.ok(pending, 'Resting entry must be visible on Binance');
    assert.ok(service.account.orders.some(o => o.protective && o.stopLoss && o.price === stop));
    record('entry-and-protective-stop-confirmed', { orderId: pending.id, result: result.result });
    const repeated = await service.execute(accepted.id);
    assert.equal(repeated.status, 'done');
    assert.equal((await exchange.read()).orders.filter(o => !o.protective).length, 1);
    record('repeated-confirmation-did-not-duplicate-order');
    const cancel = service.propose('cancel', 'Cancel demo test entry', '', { orderId: pending.id });
    const cancelled = await service.execute(cancel.id);
    assert.equal(cancelled.status, 'done', cancelled.result);
    assert.equal((await exchange.read()).orders.filter(o => !o.protective).length, 0);
    record('cancellation-confirmed', { result: cancelled.result });
} catch (error) {
    process.exitCode = 1;
    record('failed', { error: error instanceof Error ? error.message : 'Demo test failed' });
} finally {
    try {
        if (mayHavePlaced) {
            // Reconcile first. Never resubmit an entry after an uncertain response.
            let account = await exchange.read();
            for (const order of account.orders.filter(o => o.clientId && [...ids].some(id => o.clientId === `rv${id}`)))
                await exchange.cancel(order);
            account = await exchange.read();
            for (const position of account.positions.filter(p => p.symbol === 'BTCUSDT'))
                await exchange.close(position, randomUUID());
            const algos = await exchange.request('/fapi/v1/openAlgoOrders');
            for (const algo of Array.isArray(algos) ? algos : algos.orders ?? []) {
                if ([...ids].some(id => algo.clientAlgoId === `rs${id}`))
                    await exchange.request('/fapi/v1/algoOrder', { symbol: algo.symbol, algoId: algo.algoId }, 'DELETE');
            }
            account = await exchange.read();
            assert.equal(account.positions.length, 0); assert.equal(account.orders.length, 0);
            record('cleanup-confirmed', { positions: 0, orders: 0 });
        }
    } catch (error) { process.exitCode = 1; record('cleanup-needs-attention', { error: error instanceof Error ? error.message : 'Check demo account' }); }
    mkdirSync('.artifacts', { recursive: true });
    writeFileSync('.artifacts/binance-verification.json', JSON.stringify(receipts, null, 2));
    service.stop(); store.close(); await demoDispatcher.close();
}
