import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const origin = process.env.TEST_URL ?? 'http://127.0.0.1:3002';
const browser = await chromium.launch({ headless: false, executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
    const context = await browser.newContext({ permissions: ['microphone'], viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    const state = await (await page.request.get(`${origin}/api/state`)).json();
    assert.equal(state.account.mode, 'paper');
    assert.ok(!state.lock, 'Use a fresh paper session');
    await page.goto(origin);
    await page.locator('#voice').scrollIntoViewIfNeeded();
    console.log('Ready: hold “Hold to speak”, say “lock me”, then release. Wait for the confirmation before tapping Confirm.');
    const response = await page.waitForResponse(r => r.url().endsWith('/api/voice') && r.request().method() === 'POST', { timeout: 300000 });
    assert.ok(response.ok(), 'Voice endpoint must succeed');
    const body = await response.json();
    assert.equal(body.result.kind, 'lock');
    const pending = await (await page.request.get(`${origin}/api/state`)).json();
    assert.ok(!pending.lock, 'Speech alone must not lock the session');
    console.log('PASS: physical microphone → transcription → pending lock; waiting for your confirmation.');
    await page.waitForFunction(() => document.querySelector('#connection')?.textContent === 'Session locked', undefined, { timeout: 180000 });
    mkdirSync('.artifacts/providers', { recursive: true });
    await page.screenshot({ path: '.artifacts/providers/live-microphone.png' });
    writeFileSync('.artifacts/providers/live-microphone.json', JSON.stringify({ at: new Date().toISOString(), passed: true, input: 'physical browser microphone', transcript: body.text, confirmationRequired: true, lockConfirmed: true }, null, 2));
    console.log('PASS: physical browser microphone and explicit confirmation verified. G2 microphone remains a separate device check.');
} finally { await browser.close(); }
