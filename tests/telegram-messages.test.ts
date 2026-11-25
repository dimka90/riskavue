import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telegramMessageUpdater } from '../server/telegram-messages.ts';

test('event and callback racing to show the same result send one edit', async () => {
    const edits: string[] = [];
    const update = telegramMessageUpdater(async (_chat, _id, text) => {
        await new Promise(resolve => setTimeout(resolve, 5)); edits.push(text);
    });
    await Promise.all([update('owner', 1, 'Locked'), update('owner', 1, 'Locked')]);
    assert.deepEqual(edits, ['Locked']);
    await update('owner', 2, 'Locked'); assert.equal(edits.length, 2);
});
test('already-applied Telegram edit is success, including after restart', async () => {
    let calls = 0;
    const update = telegramMessageUpdater(async () => {
        calls++; throw { error_code: 400, description: 'Bad Request: message is not modified' };
    });
    await update('owner', 1, 'Locked'); await update('owner', 1, 'Locked');
    assert.equal(calls, 1);
});
test('other Telegram errors are surfaced and do not poison later updates', async () => {
    let calls = 0;
    const error = { error_code: 400, description: 'Bad Request: message to edit not found' };
    const update = telegramMessageUpdater(async () => { if (++calls === 1) throw error; });
    await assert.rejects(update('owner', 1, 'Locked'), e => e === error);
    await update('owner', 1, 'Locked'); assert.equal(calls, 2);
});
