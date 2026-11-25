import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Pairing, pairingReply } from '../server/integrations.ts';
import { config } from '../server/config.ts';
import { Store } from '../server/store.ts';
import { Service } from '../server/service.ts';
import { Paper } from '../server/exchange.ts';

test('only the configured owner can pair, and codes and exchanges are single-use', () => {
    const oldOwner = config.owner; config.owner = '123456';
    const store = new Store(':memory:'), pairing = new Pairing(new Service(store, new Paper()));
    try {
        const issued = pairing.issue();
        assert.match(issued.code, /^\d{6}$/);
        assert.throws(() => pairing.complete(issued.code, 'other-user'), /Only the configured/);
        assert.deepEqual(pairing.poll(issued.session), { paired: false });
        pairing.complete(issued.code, '123456');
        assert.throws(() => pairing.complete(issued.code, '123456'), /expired or invalid/);
        const redeemed = pairing.poll(issued.session);
        assert.ok(redeemed.paired && redeemed.token);
        assert.equal(pairing.valid(redeemed.token), true);
        assert.equal(pairing.valid('not-issued'), false);
        assert.equal(store.get(`session:${redeemed.token}`), undefined, 'Raw tokens must not be stored');
        assert.deepEqual(pairing.poll(issued.session), { paired: false });
    } finally { config.owner = oldOwner; store.close(); }
});

test('expired codes cannot pair, and expired sessions cannot authenticate', () => {
    const oldOwner = config.owner; config.owner = '123456';
    const originalNow = Date.now; let now = originalNow(); Date.now = () => now;
    const store = new Store(':memory:'), pairing = new Pairing(new Service(store, new Paper()));
    try {
        const expired = pairing.issue(); now += 300001;
        assert.throws(() => pairing.complete(expired.code, '123456'), /expired/);
        const issued = pairing.issue(); pairing.complete(issued.code, '123456');
        const redeemed = pairing.poll(issued.session); assert.ok(redeemed.token);
        now += 7 * 86400000 + 1;
        assert.equal(pairing.valid(redeemed.token), false);
    } finally { Date.now = originalNow; config.owner = oldOwner; store.close(); }
});
test('pairing reads pasted message text without command entities and explains short codes', () => {
    const oldOwner = config.owner; config.owner = '123456';
    const store = new Store(':memory:'), pairing = new Pairing(new Service(store, new Paper()));
    try {
        assert.match(pairingReply(pairing, '/pair 85359', '123456')!, /all six digits/);
        assert.equal(pairingReply(pairing, '/status', '123456'), null);
        const issued = pairing.issue();
        assert.match(pairingReply(pairing, ` /pair ${issued.code} `, '123456')!, /paired/);
        assert.match(pairingReply(pairing, `/pair ${issued.code}`, '123456')!, /expired or invalid/);
    } finally { config.owner = oldOwner; store.close(); }
});
