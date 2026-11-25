import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { makeReview, transcribe, voiceCommand } from '../server/integrations.ts';
import { Paper } from '../server/exchange.ts';
import { Store } from '../server/store.ts';
import { Service } from '../server/service.ts';

const store = new Store(':memory:'), service = new Service(store, new Paper());
await service.refresh();
const receipts: Record<string, unknown>[] = [];
const results = await Promise.allSettled([
    (async () => {
        const transcript = await transcribe(readFileSync('.artifacts/providers/lock-me.pcm'));
        console.log(JSON.stringify({ provider: 'Deepgram', transcript }));
        const action = voiceCommand(service, transcript, true);
        assert.ok('kind' in action); assert.equal(action.kind, 'lock');
        assert.equal(service.lock, null, 'Transcription must not execute without confirmation');
        assert.equal((await service.execute(action.id)).status, 'done');
        assert.ok(service.lock);
        const receipt = { provider: 'Deepgram', passed: true, fixture: 'synthetic speech, PCM16 mono 16kHz', transcript, confirmationRequired: true, lockConfirmed: true };
        receipts.push(receipt); console.log(JSON.stringify(receipt));
    })(),
    (async () => {
        // Separate deterministic session avoids mixing the concurrent voice test's log.
        const reviewStore = new Store(':memory:'), reviewService = new Service(reviewStore, new Paper());
        try {
            await reviewService.refresh();
            reviewStore.log('test', 'Synthetic provider verification session; no exchange trades executed.');
            const action = reviewService.ticket({ symbol: 'BTCUSDT', side: 'BUY', qty: 10, entry: 60000, stop: 59000 });
            assert.equal(action.kind, 'discard'); await reviewService.execute(action.id);
            const review = await makeReview(reviewService);
            const lines = review.split('\n').map(line => line.trim()).filter(Boolean);
            assert.ok(lines.length === 2 || lines.length === 3, 'Review needs Kept/Broke and an optional concrete next step');
            for (const [index, prefix] of ['Kept:', 'Broke:', 'Next session:'].slice(0, lines.length).entries())
                assert.ok(lines[index].startsWith(prefix), `Missing ${prefix} label`);
            assert.equal(reviewStore.get('review'), review);
            const receipt = { provider: 'Anthropic', passed: true, fixture: 'synthetic paper decision log', review, persisted: true };
            receipts.push(receipt); console.log(JSON.stringify(receipt));
        } finally { reviewService.stop(); reviewStore.close(); }
    })(),
]);
for (const [index, result] of results.entries()) {
    if (result.status === 'rejected') {
        process.exitCode = 1;
        const receipt = { provider: index === 0 ? 'Deepgram' : 'Anthropic', passed: false, error: result.reason instanceof Error ? result.reason.message : 'Provider check failed' };
        receipts.push(receipt); console.log(JSON.stringify(receipt));
    }
}
mkdirSync('.artifacts/providers', { recursive: true });
writeFileSync('.artifacts/providers/verification.json', JSON.stringify({ at: new Date().toISOString(), receipts }, null, 2));
service.stop(); store.close();
