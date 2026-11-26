import { test } from 'node:test';
import assert from 'node:assert/strict';
import { display } from '../shared/display.ts';
import { Store } from '../server/store.ts';
import { Service } from '../server/service.ts';
import { Paper } from '../server/exchange.ts';

test('glance overview keeps columns aligned, preserves cents, and fits the text frame', async () => {
    const store = new Store(':memory:'), service = new Service(store, new Paper());
    try {
        await service.refresh();
        const state = service.snapshot(); state.risk!.remaining = 249.98;
        const text = display(state, 'session');
        assert.match(text, /LOSS ALLOWANCE\s+\$249.98/);
        assert.match(text, /TRADES LEFT\s+5 \/ 5/);
        assert.match(text, /LOSSES IN A ROW\s+0 \/ 2/);
        assert.equal(text.split('\n').length, 10);
        assert.ok(text.split('\n').every(line => line.length <= 40));
        assert.match(text, /Estimated since app start/);
        state.rules.lossMode = 'total'; state.baseline!.losses = 1; state.baseline!.streak = 0;
        assert.match(display(state, 'session'), /LOSSES THIS SESSION\s+1 \/ 2/);
    } finally { store.close(); }
});
test('locked glance preserves the actual entry-limit reason and hides remaining trade slots', async () => {
    const store = new Store(':memory:'), service = new Service(store, new Paper());
    try {
        await service.refresh(); await service.lockNow('Your rule: 5 entries per day', false);
        const text = display(service.snapshot(), 'session');
        assert.match(text, /SESSION LOCKED/);
        assert.match(text, /5 entries per day/);
        assert.doesNotMatch(text, /TRADES LEFT|losses in a row/);
        assert.match(text, /Protective stops kept/);
        assert.ok(text.split('\n').length <= 10);
    } finally { store.close(); }
});
