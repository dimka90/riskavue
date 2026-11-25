import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
const app = process.env.TEST_URL ?? 'http://127.0.0.1:3006';
const sim = process.env.SIMULATOR_URL ?? 'http://127.0.0.1:9903';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
async function api(path: string, body?: unknown) { const r = await fetch(app + '/api' + path, { method: body === undefined ? 'GET' : 'POST', headers: { 'content-type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) }); assert.ok(r.ok); return r.json(); }
async function input(action: string) { const r = await fetch(sim + '/api/input', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action }) }); assert.ok(r.ok); await wait(700); }
assert.equal((await api('/state')).account.mode, 'paper');
await api('/paper/reset', {}); await wait(1500);
const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
    const page = await browser.newPage({ viewport: { width: 576, height: 288 } });
    mkdirSync('.artifacts/silent-controls', { recursive: true });
    async function capture(name: string) {
        const r = await fetch(sim + '/api/screenshot/glasses'); assert.ok(r.ok);
        const src = 'data:image/png;base64,' + Buffer.from(await r.arrayBuffer()).toString('base64');
        await page.setContent(`<body style="margin:0;background:black"><img style="display:block" src="${src}"></body>`);
        await page.screenshot({ path: `.artifacts/silent-controls/${name}.png` });
    }
    await input('click'); await capture('menu');
    await input('click'); assert.equal((await api('/state')).lock, null); await capture('lock-confirmation');
    await input('click'); assert.ok((await api('/state')).lock); await capture('locked');
    await input('click'); await input('click');
    for (let i = 0; i < 7; i++) await input('down');
    await input('click'); await input('click'); await capture('override');
    await input('click'); assert.ok((await api('/state')).lock, 'A tap cannot override');
    await input('long_press'); await wait(3200); await input('long_press_release');
    assert.equal((await api('/state')).lock, null);
    assert.equal((await api('/state')).account.orders.length, 0);
    writeFileSync('.artifacts/silent-controls/simulator.json', JSON.stringify({ at: new Date().toISOString(), passed: true, menuTap: true, lockConfirmed: true, tapCannotOverride: true, silentHoldOverride: true, orders: 0 }, null, 2));
    console.log('PASS: official G2 input opens menu, confirms lock, rejects tap override and accepts silent deliberate hold.');
} finally { await browser.close(); }
