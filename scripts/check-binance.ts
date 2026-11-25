import 'dotenv/config';
import { Binance } from '../server/exchange.ts';
const key = process.env.BINANCE_API_KEY, secret = process.env.BINANCE_API_SECRET ?? process.env.BINANCE_SECRET_KEY;
if (!key || !secret)
    throw new Error('Set Binance demo credentials in .env');
const exchange = new Binance(key, secret);
try {
    await exchange.syncTime();
    const a = await exchange.read();
    console.log(JSON.stringify({ mode: a.mode, connected: a.connected, wallet: a.wallet, equity: a.equity, positions: a.positions.length, pendingOrders: a.orders.length, readOnlyCheck: true }, null, 2));
}
catch (e) {
    console.error(e instanceof Error ? e.message : 'Demo connection failed');
    process.exitCode = 1;
}
