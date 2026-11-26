import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Store } from '../server/store.ts';
import { Paper } from '../server/exchange.ts';
import { Service } from '../server/service.ts';
import { display } from '../shared/display.ts';
async function setup() { const store = new Store(':memory:'), paper = new Paper(), service = new Service(store, paper); await service.refresh(); return { store, paper, service }; }
test('first demo connection uses actual starting balance without overriding saved rules', async () => {
    const store = new Store(':memory:'), paper = new Paper();
    paper.account.wallet = 5000;
    const exchange = { mode: 'binance' as const, read: () => paper.read(), place: paper.place.bind(paper), cancel: paper.cancel.bind(paper), close: paper.close.bind(paper), breakeven: paper.breakeven.bind(paper) };
    const service = new Service(store, exchange);
    await service.refresh();
    assert.equal(service.rules.initialBalance, 5000);
    assert.equal(service.snapshot().risk?.remaining, 250);
    assert.equal(service.lock, null);
    store.set('rules', { ...service.rules, initialBalance: 4500 });
    store.set('baseline', null);
    const restarted = new Service(store, exchange); await restarted.refresh();
    assert.equal(restarted.rules.initialBalance, 4500);
    store.close();
});
test('R1 stale account hides balance and blocks action', async () => { const { service, store } = await setup(); service.account.at = Date.now() - 16000; assert.match(display(service.snapshot(), 'session'), /CONNECTION LOST/); assert.throws(() => service.ticket({ symbol: 'BTCUSDT', side: 'BUY', qty: .01, entry: 60000, stop: 59000 }), /Fresh/); store.close(); });
test('slow history reconciliation does not publish an already-stale account', async () => {
    const originalNow = Date.now;
    let now = originalNow(); Date.now = () => now;
    const store = new Store(':memory:'), paper = new Paper();
    const exchange = { mode: 'paper' as const, read: () => paper.read(), place: paper.place.bind(paper), cancel: paper.cancel.bind(paper), close: paper.close.bind(paper), breakeven: paper.breakeven.bind(paper), fills: async () => { now += 6000; return []; } };
    try {
        const service = new Service(store, exchange);
        await service.refresh();
        now += 5000; await service.refresh();
        assert.equal(service.snapshot().stale, false);
        assert.equal(service.ticket({ symbol: 'BTCUSDT', side: 'BUY', qty: .01, entry: 60000, stop: 59000 }).kind, 'place');
    } finally { Date.now = originalNow; store.close(); }
});
test('R2 concurrent repeated confirmations execute once', async () => { const { service, paper, store } = await setup(); let calls = 0; paper.place = async () => { calls++; await new Promise(r => setTimeout(r, 10)); return 'Accepted'; }; const a = service.ticket({ symbol: 'BTCUSDT', side: 'BUY', qty: .01, entry: 60000, stop: 59000 }); const [x, y] = await Promise.all([service.execute(a.id), service.execute(a.id)]); assert.equal(calls, 1); assert.equal(x.status, 'done'); assert.equal(y.status, 'done'); store.close(); });
test('R3 exchange rejection cannot produce success', async () => { const { service, paper, store } = await setup(); paper.account.orders = [{ id: 'x', symbol: 'BTCUSDT', side: 'BUY', qty: 1, price: 100, protective: false }]; await service.refresh(); paper.cancel = async () => { throw new Error('Rejected'); }; const a = service.propose('cancel', 'Cancel', '', { orderId: 'x' }); assert.equal((await service.execute(a.id)).status, 'failed'); store.close(); });
test('R4 lock and baseline survive restart', async () => { const dir = mkdtempSync(join(tmpdir(), 'rv-')); const file = join(dir, 'state.sqlite'); let store = new Store(file); const service = new Service(store, new Paper()); await service.refresh(); await service.lockNow('Manual', false); const captured = service.baseline?.capturedAt; store.close(); store = new Store(file); const restarted = new Service(store, new Paper()); await restarted.refresh(); assert.equal(restarted.lock?.reason, 'Manual'); assert.equal(restarted.baseline?.capturedAt, captured); store.close(); rmSync(dir, { recursive: true }); });
test('R5 mid-day baseline is explicitly estimated', async () => { const { service, store } = await setup(); assert.equal(service.baseline?.estimated, true); assert.match(display(service.snapshot(), 'session'), /Estimated/); store.close(); });
test('locks cancel entries while preserving protective orders', async () => { const { service, paper, store } = await setup(); paper.account.orders = [{ id: 'entry', symbol: 'BTCUSDT', side: 'BUY', qty: 1, price: 100, protective: false }, { id: 'stop', symbol: 'BTCUSDT', side: 'SELL', qty: 1, price: 90, protective: true }]; await service.refresh(); await service.lockNow('Manual', false); assert.deepEqual(paper.account.orders.map(o => o.id), ['stop']); store.close(); });
test('hard lock cannot be overridden', async () => { const { service, store } = await setup(); await service.lockNow('Breach', true); const a = service.propose('override', 'Override', '', { reason: 'news', voiceVerified: true }); assert.equal((await service.execute(a.id)).status, 'failed'); assert.ok(service.lock); store.close(); });
test('risk is rechecked at confirmation after account changes', async () => { const { service, paper, store } = await setup(); const a = service.ticket({ symbol: 'BTCUSDT', side: 'BUY', qty: .01, entry: 60000, stop: 59000 }); paper.account.wallet = 9510; assert.equal((await service.execute(a.id)).status, 'failed'); assert.equal(paper.account.orders.length, 0); store.close(); });
test('expired confirmation does not execute', async () => { const { service, paper, store } = await setup(); const a = service.propose('close-all', 'Close', '', {}, -1); assert.equal((await service.execute(a.id)).status, 'dismissed'); store.close(); });
test('partial pending order already filled gives an honest outcome', async () => { const { service, store } = await setup(); const a = service.propose('cancel', 'Cancel', '', { orderId: 'gone' }); const result = await service.execute(a.id); assert.equal(result.status, 'failed'); assert.match(result.result!, /may have filled/); store.close(); });
test('crash between claiming and dispatch never restores a pending action', async () => {
 const dir=mkdtempSync(join(tmpdir(),'rv-claim-')),file=join(dir,'state.sqlite');let store=new Store(file);const service=new Service(store,new Paper());const a=service.propose('lock','Lock','');assert.equal(store.claim(a.id),true);store.close();store=new Store(file);assert.equal(store.action(a.id)?.status,'unknown');store.close();rmSync(dir,{recursive:true});
});

test('silent override requires a delay and never overrides hard locks', async () => {
    const { service, store } = await setup();
    try {
        await service.lockNow('You requested a session lock', false);
        const early = service.propose('override', 'Override?', 'Reviewed', { reason: 'Reviewed my limits', inputMethod: 'touch' });
        assert.equal((await service.execute(early.id)).status, 'failed'); assert.ok(service.lock);
        const ready = service.propose('override', 'Override?', 'Reviewed', { reason: 'Reviewed my limits', inputMethod: 'touch' });
        ready.createdAt -= 4000; store.saveAction(ready);
        assert.equal((await service.execute(ready.id, { heldMs: 3000 })).status, 'done'); assert.equal(service.lock, null);
        await service.lockNow('Hard limit reached', true);
        const hard = service.propose('override', 'Override?', 'Reviewed', { reason: 'Reviewed my limits', inputMethod: 'touch' });
        hard.createdAt -= 4000; store.saveAction(hard);
        assert.equal((await service.execute(hard.id, { heldMs: 3000 })).status, 'failed'); assert.ok(service.snapshot().lock?.hard);
    } finally { store.close(); }
});
