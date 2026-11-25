import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SilentControls } from '../app/src/silent-controls.ts';
import { Store } from '../server/store.ts';
import { Service } from '../server/service.ts';
import { Paper } from '../server/exchange.ts';
async function fixture() {
    const store = new Store(':memory:'), paper = new Paper(), service = new Service(store, paper); await service.refresh();
    const calls: { path: string; body: any }[] = [], selected: any[] = [], views: string[] = [];
    const controls = new SilentControls({ state: () => service.snapshot(), draw: () => {}, select: a => selected.push(a), view: p => views.push(p), api: async <T>(path: string, body?: any) => { calls.push({ path, body }); return { id: 'pending-test', status: 'pending' } as T; } });
    function choose(label: string) { for (let i = 0; i < 20; i++) { if (controls.text().split('\n').some(line => line === '> ' + label)) return controls.tap(); controls.move(1); } throw new Error('Missing menu item: ' + label); }
    return { store, paper, service, controls, calls, selected, views, choose };
}
test('silent lock requests confirmation without executing it', async () => {
    const f = await fixture(); try { f.controls.open(); await f.choose('Lock session'); assert.deepEqual(f.calls, [{ path: '/action', body: { kind: 'lock' } }]); assert.equal(f.selected.length, 1); assert.equal(f.service.lock, null); } finally { f.store.close(); }
});
test('silent position actions target the selected position', async () => {
    const f = await fixture(); try { f.paper.seed(); await f.service.refresh(); f.controls.open(); await f.choose('Manage positions'); await f.choose('BTCUSDT LONG'); await f.choose('Move stop to break-even'); assert.deepEqual(f.calls.at(-1)?.body, { kind: 'breakeven', symbol: 'BTCUSDT' }); f.controls.open(); await f.choose('Manage positions'); await f.choose('BTCUSDT LONG'); await f.choose('Close position'); assert.deepEqual(f.calls.at(-1)?.body, { kind: 'close', symbol: 'BTCUSDT' }); } finally { f.store.close(); }
});
test('silent cancellation never lists protective orders', async () => {
    const f = await fixture(); try { f.paper.seed(); f.paper.account.orders.push({ id: 'protective', symbol: 'BTCUSDT', side: 'SELL', qty: .1, price: 61000, protective: true }); await f.service.refresh(); f.controls.open(); await f.choose('Cancel pending entry'); assert.doesNotMatch(f.controls.text(), /BTCUSDT/); await f.choose('ETHUSDT BUY 1'); assert.equal(f.calls.at(-1)?.body.orderId, f.paper.account.orders[0].id); } finally { f.store.close(); }
});
test('silent close-all and review use their existing endpoints', async () => {
    const f = await fixture(); try { f.controls.open(); await f.choose('Close all positions'); assert.deepEqual(f.calls.at(-1)?.body, { kind: 'close-all' }); f.controls.open(); await f.choose('Session review'); await f.choose('Generate review'); assert.equal(f.calls.at(-1)?.path, '/review'); assert.equal(f.views.at(-1), 'review'); } finally { f.store.close(); }
});
test('silent trade editor changes digits and checks without placing an order', async () => {
    const f = await fixture(); try {
        f.controls.open(); await f.choose('New trade'); await f.choose('Market: BTCUSDT'); await f.choose('ETHUSDT'); await f.choose('Direction: BUY');
        await f.choose('Limit: 0');
        for (const digit of '00002400') { for (let i = 0; i < Number(digit); i++) f.controls.move(1); await f.controls.tap(); }
        await f.choose('Stop: 0');
        for (const digit of '00002500') { for (let i = 0; i < Number(digit); i++) f.controls.move(1); await f.controls.tap(); }
        assert.equal(f.calls.length, 0); await f.choose('Check trade against rules');
        assert.deepEqual(f.calls[0], { path: '/ticket', body: { symbol: 'ETHUSDT', side: 'SELL', qty: .001, entry: 24, stop: 25 } });
    } finally { f.store.close(); }
});
test('soft override has a selected reason; hard locks offer no override', async () => {
    const f = await fixture(); try { await f.service.lockNow('You requested a session lock', false); f.controls.open(); await f.choose('Override soft lock'); await f.choose('I requested this lock by mistake'); assert.deepEqual(f.calls.at(-1), { path: '/override', body: { reason: 'I requested this lock by mistake' } }); await f.service.lockNow('Daily limit', true); f.controls.open(); for (let i = 0; i < 10; i++) { assert.doesNotMatch(f.controls.text(), /> Override/); f.controls.move(1); } } finally { f.store.close(); }
});
