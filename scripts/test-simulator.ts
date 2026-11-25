import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const app = process.env.TEST_URL ?? 'http://127.0.0.1:3001', sim = process.env.SIMULATOR_URL ?? 'http://127.0.0.1:9898';
async function api(path: string, body?: unknown) { const r = await fetch(app + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(10000) }); if (!r.ok)
    throw new Error(await r.text()); return r.json(); }
async function input(action: string) { const r = await fetch(sim + '/api/input', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(10000) }); assert.ok(r.ok); }
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const state = await api('/state');
assert.equal(state.account.mode, 'paper', 'Simulator tests must never change Binance state');
await api('/paper/reset', {});
await sleep(1000);
const action = await api('/ticket', { symbol: 'BTCUSDT', side: 'BUY', qty: 1, entry: 60000, stop: 59000 });
assert.equal(action.kind, 'discard');
await sleep(1500);
await input('click');
await sleep(1000);
const result = await api('/state');
assert.equal(result.actions.find((a: any) => a.id === action.id).status, 'done');
assert.equal(result.account.orders.length, 0);
console.log('PASS: actual G2 tap discarded oversized ticket, no exchange order');
await input('down');
await sleep(700);
await input('down');
await sleep(700);
const bytes = Buffer.from(await (await fetch(sim + '/api/screenshot/glasses', { signal: AbortSignal.timeout(10000) })).arrayBuffer());
mkdirSync('.artifacts', { recursive: true });
writeFileSync('.artifacts/g2-raw.png', bytes);
const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const p = await browser.newPage({ viewport: { width: 576, height: 288 } });
await p.setContent(`<body style="margin:0;background:black"><img style="display:block" src="data:image/png;base64,${bytes.toString('base64')}"></body>`);
await p.screenshot({ path: '.artifacts/g2-rules.png' });
await browser.close();
console.log('PASS: simulator input and alpha-preserving screenshot captured');
