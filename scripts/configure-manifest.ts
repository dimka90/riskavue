import 'dotenv/config';
import { readFileSync, writeFileSync } from 'node:fs';
const origin = new URL(process.env.APP_ORIGIN || 'http://localhost:5173').origin;
const manifest = JSON.parse(readFileSync('app/app.json', 'utf8'));
manifest.permissions.find((p: any) => p.name === 'network').whitelist = [origin, origin.replace(/^http/, 'ws')];
writeFileSync('app/app.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(`Manifest network origins set for ${origin}`);
