import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeReview, voiceCommand } from '../server/integrations.ts';
import { Store } from '../server/store.ts';
import { Paper } from '../server/exchange.ts';
import { Service } from '../server/service.ts';

test('review labels tolerate Markdown without inventing or dropping review content', () => {
    assert.equal(normalizeReview('**Kept:** Daily rule.\n\n**Broke**: No violations recorded.\n- Next session: Check baseline.'), 'Kept: Daily rule.\nBroke: No violations recorded.\nNext session: Check baseline.');
});
test('malformed or extra review lines are rejected', () => {
    assert.throws(() => normalizeReview('Kept: Rule.\nNext session: Unknown.'), /unexpected/);
    assert.throws(() => normalizeReview('Kept: Rule.\nBroke: Unknown.\nNext session: Unknown.\nExtra claim.'), /unexpected/);
});
test('review allows omitting a suggestion but does not display Unknown placeholders', () => {
    assert.equal(normalizeReview('Kept: You requested a lock.\nBroke: No rule violations recorded.'), 'Kept: You requested a lock.\nBroke: No rule violations recorded.');
    assert.throws(() => normalizeReview('Kept: A lock.\nBroke: Unknown.'), /unexpected/);
});
test('misheard voice commands cannot create an action; a valid lock still needs confirmation', async () => {
    const store = new Store(':memory:'), service = new Service(store, new Paper());
    try {
        await service.refresh();
        assert.throws(() => voiceCommand(service, 'Lot me.', true), /Say/);
        assert.equal(store.actions().length, 0);
        const action = voiceCommand(service, 'Lock me.', true);
        assert.ok('kind' in action); assert.equal(action.kind, 'lock');
        assert.equal(service.lock, null);
        assert.equal((await service.execute(action.id)).status, 'done');
        assert.ok(service.lock);
    } finally { service.stop(); store.close(); }
});
