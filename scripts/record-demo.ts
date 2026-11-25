import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const base = process.env.TEST_URL ?? 'http://127.0.0.1:3001';
const sim = process.env.SIMULATOR_URL ?? 'http://127.0.0.1:9900';
async function api(path: string, body?: unknown) {
    const response = await fetch(base + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });
    assert.ok(response.ok, `API ${path} failed`); return response.json();
}
async function input(action: string) {
    const r = await fetch(sim + '/api/input', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) });
    assert.ok(r.ok);
}
const wait = (ms: number) => new Promise(r => setTimeout(r, ms));
assert.equal((await api('/state')).account.mode, 'paper');
await api('/paper/reset', {});
// Run immediately after test:simulator, which leaves the glasses on Rules.
await input('down'); await wait(500); await input('down'); await wait(700);
mkdirSync('.artifacts/video', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: '.artifacts/video', size: { width: 1280, height: 720 } } });
const page = await context.newPage();
const video = page.video()!;
const captions: string[] = [];
await page.setContent(`<body style="margin:0;background:#101412;color:#f1f6f2;font-family:Arial,sans-serif"><main style="padding:46px 70px"><header style="display:flex;justify-content:space-between;align-items:center"><strong style="font-size:32px">riskavue<span style="color:#82ec9a">.</span></strong><span style="color:#a4b3a8;font-size:17px">EVEN G2 · OFFICIAL SIMULATOR · PAPER SESSION</span></header><h1 id="title" style="font-size:36px;margin:36px 0 24px">Your limits. In sight.</h1><div style="display:flex;gap:32px;align-items:center"><div style="background:black;border:1px solid #36543f;border-radius:16px;padding:20px"><img id="g2" width="691" height="346" style="display:block"></div><p id="note" style="font-size:21px;line-height:1.5;max-width:280px;color:#b6c6bc">Actual 576 × 288 glasses framebuffer.</p></div><p id="caption" style="font-size:24px;line-height:1.45;margin-top:24px"></p></main></body>`);
let running = true;
const frames = (async () => {
    while (running) {
        const response = await fetch(sim + '/api/screenshot/glasses', { signal: AbortSignal.timeout(5000) });
        assert.ok(response.ok);
        const src = 'data:image/png;base64,' + Buffer.from(await response.arrayBuffer()).toString('base64');
        await page.locator('#g2').evaluate((element, src) => { (element as HTMLImageElement).src = src; }, src);
        await wait(180);
    }
})();
async function scene(title: string, caption: string, note: string, ms = 9000) {
    captions.push(`${title}\n${caption}\n${note}`);
    await page.locator('#title').evaluate((el, value) => { el.textContent = value; }, title);
    await page.locator('#caption').evaluate((el, value) => { el.textContent = value; }, caption);
    await page.locator('#note').evaluate((el, value) => { el.textContent = value; }, note);
    await wait(ms);
}
try {
    await scene('Your rules, visible in one glance.', 'Riskavue watches the whole account against the trader’s own loss limits.', 'A private display. One number: distance to your floor.');
    await api('/paper/seed', {});
    await scene('An outside pending order needs attention.', 'Riskavue can offer to cancel a pending order placed outside the app.', 'It cannot undo a fill or block orders sent directly to Binance.', 6500);
    await input('click'); await wait(700); await input('click'); await wait(700);
    await scene('$190 left before the loss floor.', 'This labelled paper scenario shows a session approaching its daily limit.', 'Live equity matters, including open P&L.');
    const action = await api('/ticket', { symbol: 'BTCUSDT', side: 'BUY', qty: .1, entry: 60000, stop: 57600 });
    assert.equal(action.kind, 'discard');
    await scene('An oversized trade is stopped before submission.', 'The backend rejects the ticket. The glasses explain why. Tap to discard.', 'The guard applies to trades placed through Riskavue.');
    await input('click'); await wait(700);
    assert.equal((await api('/state')).actions.find((a: any) => a.id === action.id).status, 'done');
    await scene('One tap. No order sent.', 'This confirmation came from the official simulator’s touch input.', 'A completed action cannot execute twice.', 6500);
    await input('click');
    await api('/paper/loss', {}); await api('/paper/loss', {});
    await scene('Two losses trigger the session lock.', 'New entries through Riskavue are locked. Existing protective stops stay in place.', 'A tap cannot undo the lock.');
    await api('/paper/disconnect', {});
    await scene('Lost connection? No reassuring stale balance.', 'Riskavue replaces the number with a connection warning and blocks new orders.', 'Account freshness is checked again before an action.');
    await api('/paper/reconnect', {}); await api('/paper/reset', {});
    const receipts = JSON.parse(readFileSync('.artifacts/binance-verification.json', 'utf8')) as { step: string }[];
    const verified = ['entry-and-protective-stop-confirmed', 'cancellation-confirmed', 'cleanup-confirmed'].every(step => receipts.some(r => r.step === step));
    await scene('Riskavue · Your limits. In sight.', verified ? 'Separately verified on Binance Demo: reject → confirm entry + stop → cancel → clean account.' : 'Core paper and G2 flow shown. Binance execution verification remains in progress.', 'Verified separately: Telegram pairing, Deepgram transcription, and Claude review. Physical G2 microphone testing remains.', 9500);
    await page.screenshot({ path: '.artifacts/video/end-card.png' });
} finally {
    running = false; await frames; await context.close();
    const path = await video.path(); renameSync(path, '.artifacts/riskavue-core-demo.webm');
    writeFileSync('.artifacts/video/transcript.txt', captions.join('\n\n'));
    await browser.close();
}
console.log('Recorded .artifacts/riskavue-core-demo.webm (captioned simulator demo; provider evidence is reported separately).');
