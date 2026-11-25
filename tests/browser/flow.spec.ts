import { test, expect } from '@playwright/test';
test('paper session: reject, confirm, lock, disconnect, and mobile layout', async ({ page, request }) => {
    const base = process.env.TEST_API ?? 'http://127.0.0.1:3001/api';
    const state = await (await request.get(base + '/state')).json();
    expect(state.account.mode).toBe('paper');
    await request.post(base + '/paper/reset', { data: {} });
    const errors: string[] = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto('/');
    await expect(page.locator('#remaining')).toHaveText('$500.00');
    await page.getByText('What do these numbers mean?', { exact: true }).click();
    await expect(page.locator('.explanation')).toContainText('Riskavue does not open trades automatically');
    await expect(page.locator('#limit-help')).toContainText('2 losses in a row');
    await page.screenshot({ path: '.artifacts/friendly/desktop.png', fullPage: true });
    await page.getByRole('button', { name: 'Load $190 scenario', exact: true }).click();
    await expect(page.locator('#remaining')).toHaveText('$190.00');
    await page.locator('#ticket input[name=qty]').fill('0.1');
    await page.locator('#ticket input[name=entry]').fill('60000');
    await page.locator('#ticket input[name=stop]').fill('57600');
    await page.getByRole('button', { name: 'Check against my rules' }).click();
    await expect(page.locator('#confirmation')).toContainText('NOT SENT');
    await page.locator('#confirm').click();
    await expect(page.locator('#notice')).toContainText('No order was sent');
    await page.getByRole('button', { name: 'Record a $50 loss', exact: true }).click();
    await page.getByRole('button', { name: 'Record a $50 loss', exact: true }).click();
    await expect(page.locator('#connection')).toHaveText('Session locked');
    await expect(page.locator('#entries')).toHaveText('Locked');
    await expect(page.locator('#risk-caption')).toContainText('until 00:00 UTC');
    await expect(page.locator('#lock')).toBeDisabled();
    await page.getByRole('button', { name: 'Disconnect feed', exact: true }).click();
    await expect(page.locator('#display')).toContainText('CONNECTION LOST');
    await expect(page.locator('#remaining')).toHaveText('—');
    await page.getByRole('button', { name: 'Reconnect feed', exact: true }).click();
    await page.getByRole('button', { name: 'Reset paper session', exact: true }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: '.artifacts/friendly/mobile.png', fullPage: true });
    expect(errors).toEqual([]);
});
test('safe paper ticket requires confirmation and supports fill and close', async ({ page, request }) => {
    const base = process.env.TEST_API ?? 'http://127.0.0.1:3001/api';
    expect((await (await request.get(base + '/state')).json()).account.mode).toBe('paper');
    await request.post(base + '/paper/reset', { data: {} });
    await page.goto('/');
    await expect(page.locator('#remaining')).toHaveText('$500.00');
    await page.getByRole('button', { name: 'Check against my rules' }).click();
    await expect(page.locator('#confirmation')).toContainText('BUY 0.01 BTCUSDT');
    expect((await (await request.get(base + '/state')).json()).account.orders.length).toBe(0);
    await page.locator('#confirm').click();
    await expect(page.locator('#orders')).toContainText('BTCUSDT');
    await page.getByRole('button', { name: 'Fill pending entry', exact: true }).click();
    await expect(page.locator('#positions')).toContainText('BTCUSDT');
    await expect(page.locator('#entries')).toHaveText('4');
    await page.locator('[data-position="BTCUSDT"][data-kind="close"]').click();
    await expect(page.locator('#confirmation')).toContainText('Close BTCUSDT');
    await page.locator('#confirm').click();
    await expect(page.locator('#positions')).toContainText('No open positions');
    await request.post(base + '/paper/reset', { data: {} });
});

test('trade selectors support keyboard, pointer, and correct form values', async ({ page }) => {
    await page.goto('/');
    const market = page.getByRole('combobox', { name: 'Market', exact: true });
    await market.click();
    await expect(page.getByRole('option', { name: /BTC \/ USDT/ })).toHaveAttribute('aria-selected', 'true');
    await market.press('ArrowDown');
    await market.press('Enter');
    await expect(market).toHaveText('ETH / USDT');
    await expect(market).toHaveAttribute('aria-expanded', 'false');
    await market.click();
    await page.getByRole('option', { name: /SOL \/ USDT/ }).click();
    await expect(market).toHaveText('SOL / USDT');
    const direction = page.getByRole('combobox', { name: 'Direction', exact: true });
    await direction.click();
    await page.getByRole('option', { name: 'Short / sell' }).click();
    expect(await page.locator('#ticket').evaluate(el => Object.fromEntries(new FormData(el as HTMLFormElement)))).toMatchObject({ symbol: 'SOLUSDT', side: 'SELL' });
    await market.click(); await market.press('Escape');
    await expect(market).toHaveAttribute('aria-expanded', 'false');
    await page.setViewportSize({ width: 390, height: 844 });
    await market.click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await direction.click();
    await expect(market).toHaveAttribute('aria-expanded', 'false');
    await direction.press('Tab');
    await expect(direction).toHaveAttribute('aria-expanded', 'false');
});

test('successful pairing replaces the old sign-in warning', async ({ page, request }) => {
    const base = process.env.TEST_API ?? 'http://127.0.0.1:3001/api';
    const snapshot = await (await request.get(base + '/state')).json();
    const pairedToken = 'a'.repeat(64);
    await page.route('**/api/state', route => route.fulfill({ status: route.request().headers().authorization === `Bearer ${pairedToken}` ? 200 : 401, json: route.request().headers().authorization === `Bearer ${pairedToken}` ? snapshot : { error: 'Enter your server access token or pair using Telegram' } }));
    await page.route('**/api/pair/start', route => route.fulfill({ json: { code: '123456', session: 'b'.repeat(48), expiresAt: Date.now() + 300000 } }));
    await page.route('**/api/pair/poll', route => route.fulfill({ json: { paired: true, token: pairedToken } }));
    await page.goto('/');
    await expect(page.locator('#notice')).toContainText('Enter your server access token');
    await page.locator('#pair-settings').click();
    await expect(page.locator('#settings')).not.toBeVisible();
    await expect(page.locator('#pair-code')).toHaveText('/pair 123456');
    await expect(page.locator('#pair-status')).toHaveText('Paired successfully.', { timeout: 10000 });
    await expect(page.locator('#notice')).toHaveText('Paired successfully.');
    await expect(page.locator('#notice')).not.toHaveClass(/error/);
});

test('glasses controls lock and deliberately override without microphone input', async ({ page, request }) => {
    const base = process.env.TEST_API ?? 'http://127.0.0.1:3001/api';
    expect((await (await request.get(base + '/state')).json()).account.mode).toBe('paper');
    await request.post(base + '/paper/reset', { data: {} });
    const voiceRequests: string[] = []; page.on('request', r => { if (r.url().endsWith('/voice')) voiceRequests.push(r.url()); });
    await page.goto('/'); await expect(page.locator('#tap')).toHaveText('Tap for actions');
    await page.locator('#tap').click(); await expect(page.locator('#display')).toContainText('> Lock session');
    await page.locator('#tap').click(); await expect(page.locator('#display')).toContainText('LOCK THIS SESSION?');
    expect((await (await request.get(base + '/state')).json()).lock).toBeNull();
    await page.locator('#tap').click(); await expect(page.locator('#connection')).toHaveText('Session locked');
    await page.locator('#tap').click(); await page.locator('#tap').click();
    for (let i = 0; i < 7; i++) await page.locator('#next').click();
    await expect(page.locator('#display')).toContainText('> Override soft lock');
    await page.locator('#tap').click(); await expect(page.locator('#display')).toContainText('CHOOSE YOUR REASON');
    await page.locator('#tap').click(); await expect(page.locator('#display')).toContainText('Hold 3 seconds');
    await page.locator('#tap').click(); expect((await (await request.get(base + '/state')).json()).lock).toBeTruthy();
    await page.locator('#voice').focus(); await page.keyboard.down('Space'); await page.waitForTimeout(200); await page.keyboard.up('Space');
    expect((await (await request.get(base + '/state')).json()).lock).toBeTruthy();
    await page.keyboard.down('Space'); await page.waitForTimeout(3200); await page.keyboard.up('Space');
    await expect(page.locator('#connection')).toHaveText('Connected');
    expect(voiceRequests).toEqual([]);
});

test('silent menu can cancel an entry and close a position after confirmation', async ({ page, request }) => {
    const base = process.env.TEST_API ?? 'http://127.0.0.1:3001/api';
    expect((await (await request.get(base + '/state')).json()).account.mode).toBe('paper');
    await request.post(base + '/paper/reset', { data: {} }); await request.post(base + '/paper/seed', { data: {} });
    const seeded = await (await request.get(base + '/state')).json();
    for (const a of seeded.actions.filter((a: any) => a.status === 'pending')) await request.post(base + `/actions/${a.id}/dismiss`, { data: {} });
    await page.goto('/'); await expect(page.locator('#tap')).toHaveText('Tap for actions');
    await page.locator('#tap').click(); for (let i = 0; i < 3; i++) await page.locator('#next').click();
    await expect(page.locator('#display')).toContainText('> Cancel pending entry'); await page.locator('#tap').click(); await page.locator('#tap').click();
    await expect(page.locator('#display')).toContainText('Cancel ETHUSDT entry?'); await page.locator('#tap').click();
    await expect.poll(async () => (await (await request.get(base + '/state')).json()).account.orders.length).toBe(0);
    await page.locator('#tap').click(); await page.locator('#tap').click(); await page.locator('#next').click(); await page.locator('#next').click();
    await expect(page.locator('#display')).toContainText('> Manage positions'); await page.locator('#tap').click(); await page.locator('#tap').click();
    await expect(page.locator('#display')).toContainText('> Close position'); await page.locator('#tap').click();
    await expect(page.locator('#display')).toContainText('Close BTCUSDT position?');
    expect((await (await request.get(base + '/state')).json()).account.positions.length).toBe(1);
    await page.locator('#tap').click(); await expect.poll(async () => (await (await request.get(base + '/state')).json()).account.positions.length).toBe(0);
});

test('a trade can be entered and confirmed using only glasses buttons', async ({ page, request }) => {
    const base = process.env.TEST_API ?? 'http://127.0.0.1:3001/api';
    expect((await (await request.get(base + '/state')).json()).account.mode).toBe('paper');
    await request.post(base + '/paper/reset', { data: {} }); await page.goto('/');
    await expect(page.locator('#tap')).toHaveText('Tap for actions');
    async function choose(label: string) {
        for (let i = 0; i < 12; i++) {
            if ((await page.locator('#display').innerText()).split('\n').includes('> ' + label)) { await page.locator('#tap').click(); return; }
            await page.locator('#next').click();
        }
        throw new Error('Missing menu entry: ' + label);
    }
    await page.locator('#tap').click(); await choose('New trade'); await choose('Limit: 0');
    for (const digit of '06000000') { for (let i = 0; i < Number(digit); i++) await page.locator('#next').click(); await page.locator('#tap').click(); }
    await choose('Stop: 0');
    await expect(page.locator('#tap')).toHaveText('Next digit');
    await expect(page.locator('#control-help')).toContainText('Saving does not send a trade');
    for (const digit of '05900000') { for (let i = 0; i < Number(digit); i++) await page.locator('#next').click(); await page.locator('#tap').click(); }
    expect((await (await request.get(base + '/state')).json()).account.orders.length).toBe(0);
    await choose('Check trade against rules');
    await expect(page.locator('#display')).toContainText('CONFIRM');
    expect((await (await request.get(base + '/state')).json()).account.orders.length).toBe(0);
    await page.locator('#tap').click();
    await expect.poll(async () => (await (await request.get(base + '/state')).json()).account.orders.length).toBe(1);
    const order = (await (await request.get(base + '/state')).json()).account.orders[0];
    expect(order).toMatchObject({ symbol: 'BTCUSDT', side: 'BUY', price: 60000, stop: 59000, qty: .001 });
});

test('rules can be edited then left without saving, and silent entry supports back', async ({ page, request }) => {
    const base = process.env.TEST_API ?? 'http://127.0.0.1:3001/api';
    expect((await (await request.get(base + '/state')).json()).account.mode).toBe('paper');
    await request.post(base + '/paper/reset', { data: {} });
    await page.goto('/');
    await page.locator('#edit-rules').click();
    await expect(page.locator('#preset')).toHaveValue('current');
    const initial = await page.locator('[name=maxTrades]').inputValue();
    await page.locator('[name=maxTrades]').fill('9');
    await page.getByRole('button', { name: 'Back without saving' }).click();
    await page.locator('#edit-rules').click();
    await expect(page.locator('[name=maxTrades]')).toHaveValue(initial);
    await page.getByRole('button', { name: 'Back without saving' }).click();
    await page.locator('#tap').click(); await page.locator('#next').click(); await page.locator('#tap').click();
    await page.locator('#next').click(); await page.locator('#next').click(); await page.locator('#tap').click();
    await expect(page.locator('#display')).toContainText('Digit 1 of');
    await page.locator('#tap').click(); await expect(page.locator('#display')).toContainText('Digit 2 of');
    await page.locator('#back').click(); await expect(page.locator('#display')).toContainText('Digit 1 of');
    await page.locator('#back').click(); await expect(page.locator('#display')).toContainText('Quantity: 0.001');
    await page.locator('#voice').focus();
    await page.keyboard.press('Space');
    await expect(page.locator('#display')).toContainText('RISKAVUE / ACTIONS');
    await page.locator('#back').click(); await expect(page.locator('#tap')).toHaveText('Tap for actions');
    expect((await (await request.get(base + '/state')).json()).account.orders).toHaveLength(0);
});
