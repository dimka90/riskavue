import { Decimal } from 'decimal.js';
import { Temporal } from '@js-temporal/polyfill';
import { z } from 'zod';
import type { Account, Baseline, Risk, Rules, Ticket, Preset } from '../shared/types.ts';
const D = (v: number) => new Decimal(v);
export const rulesSchema = z.object({
    name: z.string().min(1).max(80), initialBalance: z.number().positive().max(1e9), dailyPct: z.number().positive().max(.5), maxPct: z.number().positive().max(.9),
    dailyBasis: z.enum(['balance', 'equity', 'higher']), dailyAllowanceBasis: z.enum(['initial', 'day']), maxMode: z.enum(['static', 'trailing', 'capped']), maxLossAmount: z.number().positive().optional(), touchBreach: z.boolean(),
    timezone: z.string().refine(v => { try {
        Temporal.Now.zonedDateTimeISO(v);
        return true;
    }
    catch {
        return false;
    } }, 'Invalid time zone'),
    resetHour: z.number().int().min(0).max(23), resetMinute: z.number().int().min(0).max(59), bufferPct: z.number().min(0).max(1), maxTrades: z.number().int().min(1).max(1000), maxLosses: z.number().int().min(1).max(1000), lossMode: z.enum(['total', 'consecutive']), feeRate: z.number().min(0).max(.02), slippageRate: z.number().min(0).max(.05)
});
export const ticketSchema = z.object({ symbol: z.enum(['BTCUSDT', 'ETHUSDT', 'SOLUSDT']), side: z.enum(['BUY', 'SELL']), qty: z.number().positive().max(10000), entry: z.number().positive(), stop: z.number().positive() }).superRefine((t, c) => { if (t.side === 'BUY' ? t.stop >= t.entry : t.stop <= t.entry)
    c.addIssue({ code: 'custom', message: 'Stop must be below a long entry or above a short entry' }); });
export const defaultRules: Rules = { name: 'Custom session', initialBalance: 10000, dailyPct: .05, maxPct: .1, dailyBasis: 'balance', dailyAllowanceBasis: 'initial', maxMode: 'static', touchBreach: false, timezone: 'UTC', resetHour: 0, resetMinute: 0, bufferPct: .2, maxTrades: 5, maxLosses: 2, lossMode: 'consecutive', feeRate: .0005, slippageRate: .0005 };
export const presets: Preset[] = [
    { id: 'custom', name: 'Custom', description: 'Your own limits, enforced only on trades through Riskavue.', rules: defaultRules },
    { id: 'ftmo', name: 'FTMO 2-Step style', description: '5% daily from midnight balance; 10% static max. Risk model only, not an FTMO connection.', source: 'https://ftmo.com/en/trading-objectives/', checked: '2026-11-24', rules: { ...defaultRules, name: 'FTMO 2-Step style', timezone: 'Europe/Prague' } },
    { id: 'hyro', name: 'HyroTrader Two-Step daily style', description: '5% daily from midnight equity. Overall 10% static is a CUSTOM assumption: confirm before use.', source: 'https://www.hyrotrader.com/faq/rules/how-is-the-5-daily-drawdown-calculated/', checked: '2026-11-24', rules: { ...defaultRules, name: 'HyroTrader daily / custom max', dailyBasis: 'equity' } },
    { id: 'the5ers', name: 'The5ers High Stakes style', description: '5%/10% example tier; current tiers vary (daily 3–5%, max 8–10%). Confirm your tier and server zone; UTC is a placeholder.', source: 'https://the5ers.com/faqs/what-is-the-drawdown-rule-for-high-stakes/', checked: '2026-11-24', rules: { ...defaultRules, name: 'The5ers style / confirm zone', dailyBasis: 'higher', dailyAllowanceBasis: 'day' } },
    { id: 'topstep', name: 'Topstep $50K Combine style', description: '$2,000 trailing max capped at $50,000; touch breaches. Personal daily $1,000 rule included.', source: 'https://help.topstep.com/en/articles/8284204-what-is-the-maximum-loss-limit', checked: '2026-11-24', rules: { ...defaultRules, name: 'Topstep Combine style', initialBalance: 50000, dailyPct: .02, maxPct: .04, maxLossAmount: 2000, maxMode: 'capped', touchBreach: true, timezone: 'America/Chicago', resetHour: 17 } }
];
export function tradingDay(now: number, r: Rules) {
    const t = Temporal.Instant.fromEpochMilliseconds(now).toZonedDateTimeISO(r.timezone);
    let start = t.with({ hour: r.resetHour, minute: r.resetMinute, second: 0, millisecond: 0, microsecond: 0, nanosecond: 0 });
    if (Temporal.ZonedDateTime.compare(t, start) < 0)
        start = start.subtract({ days: 1 });
    return { day: start.toPlainDate().toString(), startAt: start.epochMilliseconds, resetAt: start.add({ days: 1 }).epochMilliseconds };
}
export function riskFor(a: Account, b: Baseline, r: Rules): Risk {
    const base = r.dailyBasis === 'balance' ? b.balance : r.dailyBasis === 'equity' ? b.equity : Math.max(b.balance, b.equity);
    const dailyAllowance = D(r.dailyAllowanceBasis === 'initial' ? r.initialBalance : base).mul(r.dailyPct).toNumber();
    const dailyFloor = D(base).minus(dailyAllowance).toNumber();
    const allowance = r.maxLossAmount ?? D(r.initialBalance).mul(r.maxPct).toNumber();
    const high = Math.max(r.initialBalance, b.highBalance);
    const maxFloor = r.maxMode === 'static' ? D(r.initialBalance).minus(allowance).toNumber() : r.maxMode === 'capped' ? Math.min(r.initialBalance, D(high).minus(allowance).toNumber()) : D(high).minus(allowance).toNumber();
    const floor = Math.max(dailyFloor, maxFloor), remaining = D(a.equity).minus(floor).toNumber(), buffer = D(dailyAllowance).mul(r.bufferPct).toNumber();
    const unknown: string[] = [];
    let open = D(0), pending = D(0);
    for (const p of a.positions) {
        if (!p.stop) {
            unknown.push(`No stop on ${p.symbol}`);
            continue;
        }
        const distance = Math.max(0, p.qty > 0 ? p.mark - p.stop : p.stop - p.mark);
        open = open.plus(D(Math.abs(p.qty)).mul(distance)).plus(D(Math.abs(p.qty) * p.mark).mul(r.feeRate + r.slippageRate));
    }
    for (const o of a.orders.filter(o => !o.protective)) {
        if (!o.stop) {
            unknown.push(`No stop for pending ${o.symbol}`);
            continue;
        }
        pending = pending.plus(tradeRisk({ symbol: o.symbol, qty: o.qty, entry: o.price, stop: o.stop, side: o.side }, r));
    }
    return { dailyFloor, maxFloor, floor, remaining, dailyAllowance, buffer, breached: r.touchBreach ? a.equity <= floor : a.equity < floor, warning: remaining <= buffer, openRisk: unknown.some(x => x.startsWith('No stop on')) ? null : open.toNumber(), pendingRisk: unknown.some(x => x.startsWith('No stop for')) ? null : pending.toNumber(), unknown };
}
export function tradeRisk(t: Ticket, r: Rules) { return D(t.qty).mul(D(t.entry).minus(t.stop).abs()).plus(D(t.qty).mul(t.entry).mul(2 * r.feeRate + r.slippageRate)).toNumber(); }
export function checkTrade(t: Ticket, a: Account, b: Baseline, r: Rules) {
    const risk = riskFor(a, b, r), loss = tradeRisk(t, r);
    if (risk.openRisk === null || risk.pendingRisk === null)
        return { allowed: false, loss, worstCase: null, reason: risk.unknown.join('; ') };
    const worstCase = D(a.equity).minus(risk.openRisk).minus(risk.pendingRisk).minus(loss).toNumber();
    const limit = D(risk.floor).plus(risk.buffer).toNumber();
    const allowed = r.touchBreach ? worstCase > limit : worstCase >= limit;
    return { allowed, loss, worstCase, reason: allowed ? 'Within your configured limits' : `Would leave $${(worstCase - risk.floor).toFixed(2)} to floor; your buffer is $${risk.buffer.toFixed(2)}` };
}
