import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const descriptions: Record<string, string> = {
    'oversized-ticket-rejected': 'Oversized ticket rejected; exchange orders: 0.',
    'allowed-ticket-awaits-confirmation': 'Allowed ticket stayed unsent until confirmation.',
    'entry-and-protective-stop-confirmed': 'Demo entry and protective stop accepted.',
    'repeated-confirmation-did-not-duplicate-order': 'Repeated confirmation did not create another order.',
    'cancellation-confirmed': 'Cancellation confirmed.',
    'outside-demo-fixture-filled': 'Outside demo fixture filled before Riskavue could block it.',
    'watcher-proposed-close': 'Watcher reported “already filled” and proposed a close.',
    'reduce-only-close-filled': 'Confirmed reduce-only close filled.',
    'cleanup-confirmed': 'Cleanup confirmed: 0 positions and 0 orders.'
};
const files = ['binance-verification.json', 'binance-close-verification.json'];
const runs = files.map(file => {
    const raw = readFileSync(`.artifacts/${file}`, 'utf8');
    const entries: Record<string, unknown>[] = JSON.parse(raw);
    const events = entries.map(entry => {
        const step = String(entry.step), at = String(entry.at);
        if (!descriptions[step] || !/^\d{4}-\d{2}-\d{2}T.*Z$/.test(at) || !Number.isFinite(Date.parse(at))) throw new Error('Unexpected evidence format');
        if (step === 'oversized-ticket-rejected' && entry.exchangeOrders !== 0) throw new Error('Nonzero orders on rejected ticket');
        if (step === 'cleanup-confirmed' && (entry.positions !== 0 || entry.orders !== 0)) throw new Error('Account not clean');
        const order = entry.orderId === undefined ? undefined : String(entry.orderId);
        if (order && !/^\d+$/.test(order)) throw new Error('Invalid order number');
        // Only these public fields survive. Never copy arbitrary provider messages or account IDs.
        return { at, step, description: descriptions[step], ...(order ? { order } : {}) };
    });
    return { source: file, sha256: createHash('sha256').update(raw).digest('hex'), events };
});
writeFileSync('app/src/proof.json', JSON.stringify({ environment: 'Binance Futures Demo', runs }, null, 2) + '\n');
console.log('Wrote allowlisted proof from two recorded demo runs. No exchange requests made.');
