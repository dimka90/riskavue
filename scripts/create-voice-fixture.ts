import 'dotenv/config';
import { mkdirSync, writeFileSync } from 'node:fs';
import { Agent } from 'undici';
const key = process.env.DEEPGRAM_API_KEY;
if (!key) throw new Error('DEEPGRAM_API_KEY missing');
const dispatcher = new Agent({ connect: { family: 4, autoSelectFamily: false, timeout: 10000 } });
try {
    const options = { method: 'POST', headers: { authorization: `Token ${key}`, 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Lock me.' }), dispatcher, signal: AbortSignal.timeout(20000) };
    const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&encoding=linear16&sample_rate=16000&container=none', options);
    if (!response.ok) throw new Error(`Speech fixture generation failed (${response.status})`);
    const pcm = Buffer.from(await response.arrayBuffer());
    if (pcm.length < 3200 || pcm.length > 640000 || pcm.length % 2) throw new Error('Invalid PCM fixture');
    mkdirSync('.artifacts/providers', { recursive: true });
    writeFileSync('.artifacts/providers/lock-me.pcm', pcm);
    console.log(`Generated synthetic "Lock me" fixture: ${(pcm.length / 32000).toFixed(2)} seconds. This is not microphone verification.`);
} finally { await dispatcher.close(); }
