import 'dotenv/config';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
const mode = process.env.EXCHANGE_MODE ?? 'paper';
if (!['paper', 'binance'].includes(mode))
    throw new Error('EXCHANGE_MODE must be paper or binance (demo only)');
export const config = { mode: mode as 'paper' | 'binance', port: Number(process.env.PORT ?? 3001), host: process.env.HOST ?? '127.0.0.1', origin: process.env.APP_ORIGIN ?? 'http://localhost:5173', db: resolve(process.env.DATA_DIR ?? 'data', `${mode}.sqlite`), token: process.env.APP_TOKEN ?? '', binanceKey: process.env.BINANCE_API_KEY ?? '', binanceSecret: process.env.BINANCE_API_SECRET ?? process.env.BINANCE_SECRET_KEY ?? '', telegram: process.env.TELEGRAM_BOT_TOKEN ?? '', owner: process.env.TELEGRAM_OWNER_ID ?? '', deepgram: process.env.DEEPGRAM_API_KEY ?? '', anthropic: process.env.ANTHROPIC_API_KEY ?? '', claudeModel: process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-5' };
mkdirSync(resolve(process.env.DATA_DIR ?? 'data'), { recursive: true });
if (config.host !== '127.0.0.1' && !config.token)
    throw new Error('Set APP_TOKEN before exposing the server beyond localhost');
if (mode === 'binance' && (!config.binanceKey || !config.binanceSecret))
    throw new Error('Binance demo credentials missing');
