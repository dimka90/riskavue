import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, renameSync } from 'node:fs';
import { chromium } from 'playwright';
const origin = process.env.TEST_URL ?? 'http://127.0.0.1:3007';
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Record only the local isolated judge route');
mkdirSync('.artifacts/judge-video', { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, recordVideo: { dir: '.artifacts/judge-video', size: { width: 1280, height: 900 } }, reducedMotion: 'reduce' });
const page = await context.newPage(), video = page.video()!;
const calls: string[] = [], captions: { at: number; seconds: number; text: string }[] = [];
page.on('request', r => { if (r.url().includes('/api/')) calls.push(r.url()); });
const started = Date.now();
async function scene(text: string, seconds: number) {
    await page.locator('#video-caption').evaluate((el, text) => { el.textContent = text; }, text);
    captions.push({ at: (Date.now() - started) / 1000, seconds, text });
    await page.waitForTimeout(seconds * 1000);
}
async function click(step: string, expected: string, target = '#judge-message') {
    await page.locator(`[data-step=${step}]`).click();
    await page.locator(target).filter({ hasText: expected }).waitFor();
}
try {
    await page.goto(origin + '/judge');
    await page.evaluate(() => {
        const caption = document.createElement('div'); caption.id = 'video-caption';
        caption.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:100;background:#101713f5;border-top:2px solid #b6f786;color:#edf2e9;padding:18px 36px;font:20px/1.4 system-ui;min-height:70px';
        document.body.append(caption);
        const label = document.createElement('div'); label.textContent = 'BROWSER WALKTHROUGH • PAPER ONLY';
        label.style.cssText = 'position:fixed;top:0;right:0;z-index:100;background:#25311f;color:#d6f7b5;padding:8px 16px;font:13px system-ui'; document.body.append(label);
    });
    await scene('Tunde is an illustrative trader near his daily limit. Riskavue checks the whole account before its trades leave.', 7);
    await click('start', '$190');
    await page.locator('.judge-grid').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await scene('A separate $190 paper account. Same rule engine, no exchange credentials. No live account is connected.', 6);
    await click('reject', 'NOT SENT');
    await scene('An oversized ticket is NOT SENT. The guard rejects it before submission. Paper orders remain zero.', 7);
    await click('discard', 'No order was sent');
    await scene('Tap to discard. The rejected trade still produces no order.', 4);
    await click('tilt', 'Two synthetic losses');
    await scene('Two synthetic losses trigger the configured tilt lock. New Riskavue entries stop automatically.', 6);
    await click('tap', 'STILL LOCKED');
    await scene('Try another trade and tap: still locked. One tap cannot erase the rule or send a new entry.', 6);
    await click('status', 'LOCKED', '#judge-status');
    await page.locator('#telegram-preview').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await scene('Telegram /status uses this same formatter. This is a paper preview; no Telegram message is sent.', 6);
    await click('review', 'Next session:', '#judge-review');
    await page.locator('#review-preview').evaluate(el => el.scrollIntoView({ block: 'center' }));
    await scene('Three lines explain the session. This judge summary is deterministic; the live app offers Claude reviews.', 6);
    await page.locator('#proof').evaluate(el => el.scrollIntoView({ block: 'start' }));
    await scene('Separate, recorded Binance Demo evidence: rejection, entry #28694211519 plus stop, no duplicate, cancellation and cleanup.', 9);
    await page.locator('#proof details').nth(1).evaluate(el => el.scrollIntoView({ block: 'start' }));
    await scene('An outside Binance order had already filled. Riskavue reported that honestly, then confirmed a reduce-only close. Both runs ended clean.', 9);
    await page.locator('.proof').last().evaluate(el => el.scrollIntoView({ block: 'start' }));
    await scene('A guard for Riskavue entries; a watcher for direct Binance trades. Physical G2 and live microphone testing remain unverified.', 6);
    assert.ok(calls.length === 7 && calls.every(url => url.includes('/api/judge/')), 'Only seven isolated judge calls are allowed');
    await page.screenshot({ path: '.artifacts/judge-video/end-card.png' });
} finally {
    await context.close();
    renameSync(await video.path(), '.artifacts/riskavue-judge-demo.webm');
    writeFileSync('.artifacts/judge-video/transcript.json', JSON.stringify(captions, null, 2));
    writeFileSync('.artifacts/judge-video/verification.json', JSON.stringify({ at: new Date().toISOString(), recordedSeconds: (Date.now() - started) / 1000, apiCalls: calls.length, onlyIsolatedJudgeCalls: calls.every(url => url.includes('/api/judge/')), physicalGlasses: false, audio: false }, null, 2));
    await browser.close();
}
console.log('Recorded captioned browser/paper walkthrough: .artifacts/riskavue-judge-demo.webm');
