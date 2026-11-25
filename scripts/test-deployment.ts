import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const dir = mkdtempSync(join(tmpdir(), 'riskavue-container-'));
const name = `riskavue-check-${randomBytes(4).toString('hex')}`;
const token = randomBytes(32).toString('hex');
const env = join(dir, 'server.env');
writeFileSync(env, `APP_TOKEN=${token}\nEXCHANGE_MODE=paper\nAPP_ORIGIN=http://127.0.0.1:3004\n`, { mode: 0o600 });
const docker = (...args: string[]) => execFileSync('docker', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const base = 'http://127.0.0.1:3004';
const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
async function ready() {
    for (let i = 0; i < 30; i++) {
        try { if ((await fetch(base + '/api/health', { signal: AbortSignal.timeout(1000) })).ok) return; } catch {}
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    throw new Error('Container did not become healthy');
}
try {
    docker('run', '-d', '--name', name, '--env-file', env, '-p', '127.0.0.1:3004:3001', 'riskavue:verification');
    await ready();
    assert.equal((await fetch(base + '/api/state')).status, 401);
    assert.equal((await fetch(base + '/api/state', { headers })).status, 200);
    assert.equal((await fetch(base + '/api/state', { headers: { ...headers, Origin: 'https://untrusted.invalid' } })).status, 403);
    const action = await (await fetch(base + '/api/action', { method: 'POST', headers, body: JSON.stringify({ kind: 'lock' }) })).json();
    const result = await (await fetch(base + `/api/actions/${action.id}/confirm`, { method: 'POST', headers, body: '{}' })).json();
    assert.equal(result.status, 'done');
    docker('restart', name); await ready();
    const state = await (await fetch(base + '/api/state', { headers })).json();
    assert.ok(state.lock, 'Lock must survive a server restart');
    assert.equal((await fetch(base)).status, 200);
    console.log('PASS: deployment image serves UI, enforces token/origin checks, and preserves the session lock across restart.');
} finally {
    try { docker('rm', '-f', name); } catch {}
    rmSync(dir, { recursive: true, force: true });
}
