import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadline, telegramStatus, actionText } from '../shared/session-text.ts';
import { display } from '../shared/display.ts';
import { Service } from '../server/service.ts';
import { Store } from '../server/store.ts';
import { Paper } from '../server/exchange.ts';

test('deadline shows reset time, correct seasonal UTC offset, and countdown', () => {
    const now = Date.parse('2026-11-25T09:37:00Z'), until = Date.parse('2026-11-26T00:00:00Z');
    assert.equal(deadline(until, 'UTC', now).full, '00:00 UTC (in 14h 23m)');
    assert.equal(deadline(until, 'Europe/Prague', now).time, '01:00 UTC+1');
    assert.equal(deadline(Date.parse('2026-07-01T00:00Z'), 'Europe/Prague', now).time, '02:00 UTC+2');
});
test('locked Telegram and G2 status prioritize the deadline and omit available entries', async () => {
    const store = new Store(':memory:'), service = new Service(store, new Paper());
    try {
        await service.refresh(); await service.lockNow('You requested a session lock', false);
        const state = service.snapshot();
        const text = telegramStatus(state);
        assert.match(text, /^LOCKED/); assert.match(text, /Until 00:00 UTC \(in \d+h \d+m\)/);
        assert.match(text, /\$500.00 to floor · protective stops kept/);
        assert.doesNotMatch(text, /entries (left|available)/);
        const g2 = display(state, 'session');
        assert.match(g2, /^SESSION LOCKED/); assert.match(g2, /Until 00:00 UTC/);
        assert.ok(g2.split('\n').length <= 11); assert.ok(g2.length < 460);
        state.stale = true;
        assert.doesNotMatch(telegramStatus(state), /\$500/);
        assert.match(telegramStatus(state), /LOCKED/);
    } finally { store.close(); }
});
test('repeat lock request does not prompt, extend, warn, or downgrade a hard lock', async () => {
    const store = new Store(':memory:'), service = new Service(store, new Paper());
    try {
        await service.refresh();
        const pending = service.propose('lock', 'Lock?', '');
        assert.match(actionText(pending), /\?/); assert.doesNotMatch(actionText(pending), /stops kept|SESSION LOCKED/);
        await service.lockNow('Equity reached your loss floor', true);
        const original = structuredClone(service.lock);
        let warnings = 0; service.on('warning', () => warnings++);
        const result = await service.execute(pending.id);
        assert.match(result.result!, /Already locked until/);
        assert.doesNotMatch(actionText(result), /\?/);
        const duplicate = service.propose('lock', 'Lock?', '');
        assert.equal(duplicate.status, 'done'); assert.match(duplicate.result!, /Already locked/);
        assert.deepEqual(service.lock, original); assert.equal(warnings, 0);
        assert.equal(store.decisions().filter(d => d.kind === 'lock').length, 1);
    } finally { store.close(); }
});
test('manual lock confirmation produces one result without a duplicate warning', async () => {
    const store = new Store(':memory:'), service = new Service(store, new Paper());
    try {
        await service.refresh(); let warnings = 0; service.on('warning', () => warnings++);
        const action = service.propose('lock', 'Lock?', '');
        const result = await service.execute(action.id);
        assert.match(actionText(result), /^LOCKED/); assert.match(actionText(result), /until 00:00 UTC/);
        assert.doesNotMatch(actionText(result), /\?/); assert.equal(warnings, 0);
        const before = structuredClone(service.lock);
        await service.lockNow('Manual again', false); assert.deepEqual(service.lock, before);
        await service.lockNow('Equity reached your loss floor', true);
        assert.equal(service.lock?.hard, true); assert.equal(service.lock?.until, before?.until);
    } finally { store.close(); }
});
