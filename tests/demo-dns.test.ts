import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDemoResolver } from '../server/demo-dns.ts';
const host = 'demo-fapi.binance.com';
test('DNS recovery is scoped to demo hosts', async () => {
    const resolve = createDemoResolver();
    await assert.rejects(resolve('fapi.binance.com'), /limited/);
});
test('healthy local DNS does not contact public resolver', async () => {
    const resolve = createDemoResolver(async () => '1.2.3.4', async () => { throw new Error('Unexpected public lookup'); });
    assert.deepEqual(await resolve(host), ['1.2.3.4']);
});
test('DNS failure recovers once for concurrent requests and honors TTL', async () => {
    let calls = 0, time = 0;
    const resolve = createDemoResolver(async () => { throw new Error('ENOTFOUND'); }, async () => {
        calls++; return [{ address: '1.2.3.4', ttl: 2 }];
    }, () => time);
    await Promise.all([resolve(host), resolve(host), resolve(host)]);
    assert.equal(calls, 1);
    time = 1999; await resolve(host); assert.equal(calls, 1);
    time = 2001; await resolve(host); assert.equal(calls, 2);
});
test('hung local DNS falls back without waiting indefinitely', async () => {
    const resolve = createDemoResolver(() => new Promise(() => {}), async () => [{ address: '1.2.3.4', ttl: 1 }], Date.now, 5);
    assert.deepEqual(await resolve(host), ['1.2.3.4']);
});
test('invalid DNS responses fail closed', async () => {
    const resolve = createDemoResolver(async () => { throw new Error(); }, async () => [{ address: 'not-an-ip', ttl: 3 }]);
    await assert.rejects(resolve(host), /valid/);
});
