import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JudgeSession } from '../server/judge.ts';

test('judge path runs real risk checks, remains locked, and never submits an order or calls a provider', async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = async () => { throw new Error('Judge must never call external providers'); };
    const judge = new JudgeSession();
    let submitted = 0;
    judge.paper.place = async () => { submitted++; throw new Error('No paper orders expected on rejection path'); };
    try {
        assert.equal((await judge.load()).remaining, 190);
        const rejected = await judge.step('reject');
        assert.match(rejected.message, /NOT SENT/); assert.equal(rejected.orders, 0);
        assert.match((await judge.step('discard')).message, /No order was sent/);
        assert.equal((await judge.step('tilt')).locked, true);
        const until = judge.service.lock!.until;
        const tapped = await judge.step('tap');
        assert.equal(tapped.locked, true); assert.equal(judge.service.lock!.until, until);
        assert.match((await judge.step('status')).statusText, /^LOCKED/);
        const reviewed = await judge.step('review');
        assert.equal(reviewed.review.split('\n').length, 3);
        assert.equal(reviewed.orders, 0); assert.equal(submitted, 0); assert.equal(reviewed.next, null);
    } finally { judge.close(); globalThis.fetch = originalFetch; }
});
test('judge sessions are isolated and reject skipped or duplicate steps', async () => {
    const first = new JudgeSession(), second = new JudgeSession();
    try {
        await first.load(); await second.load();
        await assert.rejects(first.step('tilt'), /numbered steps/);
        const results = await Promise.allSettled([first.step('reject'), first.step('reject')]);
        assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
        await first.step('discard'); await first.step('tilt');
        assert.equal(first.service.snapshot().lock !== null, true);
        assert.equal(second.result().locked, false); assert.equal(second.result().remaining, 190);
        assert.equal(second.result().phase, 0);
    } finally { first.close(); second.close(); }
});
