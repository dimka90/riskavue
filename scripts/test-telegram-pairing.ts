import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const browser = await chromium.launch({ headless: true, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
    const page = await browser.newPage();
    await page.goto(process.env.TEST_URL ?? 'http://127.0.0.1:3001');
    await page.locator('#pair').click();
    await page.waitForFunction(() => /^\/pair \d{6}$/.test(document.querySelector('#pair-code')?.textContent ?? ''));
    const command = await page.locator('#pair-code').innerText();
    assert.match(command, /^\/pair \d{6}$/);
    console.log(JSON.stringify({ sendTo: '@RiskavueBot', command, expiresInMinutes: 5 }));
    await page.waitForFunction(() => document.querySelector('#pair-status')?.textContent === 'Paired successfully.', undefined, { timeout: 240000 });
    const token = await page.evaluate(() => sessionStorage.getItem('riskavue-token'));
    assert.ok(token && token.length === 64);
    // Check that the server issued this exact browser token, without printing it.
    const db = new DatabaseSync(process.env.TEST_DB ?? '/tmp/riskavue-telegram-check/paper.sqlite', { readOnly: true });
    try {
        const row = db.prepare('SELECT value FROM state WHERE key=?').get(`session:${createHash('sha256').update(token).digest('hex')}`) as { value: string } | undefined;
        assert.ok(row && JSON.parse(row.value) > Date.now(), 'Server must recognize the issued token');
    } finally { db.close(); }
    mkdirSync('.artifacts/telegram', { recursive: true });
    // The pairing code is now consumed; tokens stay out of screenshots and receipts.
    await page.locator('#pair-code').evaluate(el => { el.textContent = 'Pairing complete'; });
    await page.screenshot({ path: '.artifacts/telegram/paired.png' });
    writeFileSync('.artifacts/telegram/pairing.json', JSON.stringify({ at: new Date().toISOString(), passed: true, browserPaired: true, serverTokenVerified: true }, null, 2));
    console.log('PASS: Telegram owner paired the browser; issued session token verified server-side.');
} finally { await browser.close(); }
