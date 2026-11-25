import { Resolver } from 'node:dns/promises';
import { isIP, type LookupFunction } from 'node:net';
import { Agent } from 'undici';

const hosts = new Set(['demo-fapi.binance.com', 'demo-fstream.binance.com']);
type Answer = { address: string; ttl: number };
async function localLookup(host: string) {
    // c-ares has bounded DNS timeouts and does not occupy Node's shared worker pool.
    const resolver = new Resolver({ timeout: 500, tries: 1 });
    const addresses = await resolver.resolve4(host);
    if (!addresses.length) throw new Error('No local DNS answer');
    return addresses[0];
}

// Only DNS names go to the resolver. API credentials and signed URLs never do.
async function publicLookup(host: string): Promise<Answer[]> {
    try {
        return await Promise.any(['1.1.1.1', '8.8.8.8'].map(async ip => {
            const resolver = new Resolver({ timeout: 1000, tries: 1 });
            resolver.setServers([ip]);
            const answers = await resolver.resolve4(host, { ttl: true });
            if (!answers.length) throw new Error('No public DNS answer');
            return answers;
        }));
    } catch { /* Networks that block outbound DNS can still use HTTPS below. */ }
    return Promise.any(['https://dns.google/resolve', 'https://cloudflare-dns.com/dns-query'].map(async endpoint => {
        const options = { signal: AbortSignal.timeout(4000), redirect: 'error' as const, headers: { accept: 'application/dns-json' } };
        const response = await fetch(`${endpoint}?name=${encodeURIComponent(host)}&type=A`, options);
        if (!response.ok) throw new Error('Demo DNS resolver unavailable');
        const data = await response.json() as { Status: number; Answer?: { type: number; data: string; TTL: number }[] };
        if (data.Status !== 0) throw new Error('Demo DNS resolution failed');
        const answers = (data.Answer ?? []).filter(a => a.type === 1 && isIP(a.data) === 4)
            .map(a => ({ address: a.data, ttl: a.TTL }));
        if (!answers.length) throw new Error('No demo DNS answer');
        return answers;
    }));
}

export function createDemoResolver(
    local = localLookup,
    remote = publicLookup,
    now = Date.now,
    timeoutMs = 700,
) {
    const cache = new Map<string, { addresses: string[]; expires: number }>();
    const pending = new Map<string, Promise<string[]>>();
    return async (host: string): Promise<string[]> => {
        if (!hosts.has(host)) throw new Error('DNS recovery is limited to Binance demo hosts');
        const cached = cache.get(host);
        if (cached && cached.expires > now()) return cached.addresses;
        const active = pending.get(host);
        if (active) return active;
        const task = (async () => {
            let timer: NodeJS.Timeout | undefined;
            try {
                const address = await Promise.race([local(host), new Promise<never>((_, reject) => {
                    timer = setTimeout(() => reject(new Error('Local DNS timeout')), timeoutMs);
                })]);
                if (isIP(address) !== 4) throw new Error('Invalid local DNS answer');
                cache.set(host, { addresses: [address], expires: now() + 30000 });
                return [address];
            } catch {
                const answers = await remote(host);
                if (!answers.length || answers.some(a => isIP(a.address) !== 4 || !Number.isFinite(a.ttl) || a.ttl < 0))
                    throw new Error('No valid demo DNS answers');
                const addresses = answers.map(a => a.address);
                cache.set(host, { addresses, expires: now() + Math.min(60, ...answers.map(a => a.ttl)) * 1000 });
                return addresses;
            } finally { clearTimeout(timer); }
        })();
        pending.set(host, task);
        try { return await task; } finally { pending.delete(host); }
    };
}

const resolveDemo = createDemoResolver();
export const demoLookup: LookupFunction = (hostname, options, callback) => {
    void resolveDemo(hostname).then(addresses => {
        if (options.all) callback(null, addresses.map(address => ({ address, family: 4 })));
        else callback(null, addresses[0], 4);
    }, error => callback(error, '', 4));
};
// Keep the original hostname for TLS certificate verification and SNI.
export const demoDispatcher = new Agent({ connections: 2, connect: { lookup: demoLookup, autoSelectFamilyAttemptTimeout: 1500 } });
