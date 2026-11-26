import type { Action, Snapshot } from './types.ts';
import { deadline } from './session-text.ts';
export type Page = 'session' | 'positions' | 'rules' | 'review';
const rule = '-'.repeat(40);
function row(label: string, value: string) { return label + ' '.repeat(Math.max(2, 40 - label.length - value.length)) + value; }
function screen(title: string, lines: string[], footer = 'Tap: actions  /  Swipe: views') { return [title, rule, ...lines, rule, footer].join('\n'); }

export function display(s: Snapshot, page: Page, action?: Action, now = Date.now()) {
    const prefix = s.account.mode === 'paper' ? 'PAPER DEMO' : 'BINANCE DEMO';
    if (s.stale || now - s.account.at > 5000)
        return screen(`RISKAVUE / ${prefix}`, ['CONNECTION LOST', '', 'Waiting for fresh account data.', 'Balance hidden. Actions paused.', '', 'Check your server connection.'], 'Reconnect before taking action');
    if (action) {
        if (action.kind === 'lock' && action.status === 'done' && s.lock && s.lock.until > now)
            return display(s, 'session', undefined, now);
        if (action.status !== 'pending')
            return `${prefix} / ${action.status === 'done' ? 'DONE' : action.status.toUpperCase()}\n\n${action.result ?? 'Working...'}\n\nTap = back to session`.slice(0, 460);
        if (action.kind === 'override' && action.payload.inputMethod === 'touch' && action.status === 'pending')
            return `OVERRIDE SOFT LOCK?\n\n${action.detail}\n\nReason will be recorded.\nHold 3 seconds, then release.\nSwipe = dismiss / tap does not unlock`;
        if (action.kind === 'lock' && action.expiresAt >= now) {
            const end = deadline(s.resetAt, s.rules.timezone, now);
            return `LOCK THIS SESSION? / ${prefix}\n\nBlock new Riskavue trades\nuntil ${end.time} (in ${end.remaining})\n\nCancel pending entries.\nKeep protective stops.\n\nTap = lock / swipe = dismiss`;
        }
        return `${prefix} / CONFIRM\n\n${action.title}\n${action.detail}\n\n${action.expiresAt < now ? 'EXPIRED · request a new action' : `TAP = ${action.kind === 'discard' ? 'discard' : 'confirm'} / swipe = dismiss`}`.slice(0, 460);
    }
    if (s.lock && s.lock.until > now && page === 'session') {
        const end = deadline(s.lock.until, s.rules.timezone, now);
        const reason = s.lock.hard ? 'Hard limit / override unavailable' : s.lock.reason === 'You requested a session lock' ? 'You requested this lock' : s.lock.reason.replace('Your rule: stop after ', '').replace('Your rule: ', '').replace('consecutive losses', 'losses in a row');
        return screen(`SESSION LOCKED / ${prefix}`, ['New Riskavue trades blocked', `Until ${end.time} (in ${end.remaining})`, 'Protective stops kept', reason, row('LOSS ALLOWANCE', `$${s.risk?.remaining.toFixed(2) ?? '—'}`), s.baseline?.estimated ? 'Estimated since app start' : 'Tracked from session start']);
    }
    if (page === 'positions')
        return `${prefix} / POSITIONS\n\n${s.account.positions.map(p => `${p.symbol} ${p.qty > 0 ? 'LONG' : 'SHORT'} ${Math.abs(p.qty)}\nStop ${p.stop ?? 'UNKNOWN'} | P/L $${(p.qty * (p.mark - p.entry)).toFixed(2)}`).join('\n') || 'No open positions'}\n\nSwipe to change view.`;
    if (page === 'rules')
        return screen(`YOUR RULES / ${prefix}`, [row('DAILY LOSS LIMIT', `${s.rules.dailyPct * 100}%`), row('OVERALL LOSS LIMIT', `${s.rules.maxPct * 100}%`), row('TRADES PER SESSION', String(s.rules.maxTrades)), row(s.rules.lossMode === 'consecutive' ? 'LOSSES IN A ROW' : 'LOSSES PER SESSION', `${s.rules.maxLosses} = lock`), 'Edit rules in the companion.', 'Applies to Riskavue entries only.']);
    if (page === 'review')
        return `${prefix} / SESSION REVIEW\n\n${s.review || 'Tap for actions, then Session review.'}`.slice(0, 460);
    const remaining = s.risk?.remaining;
    const end = deadline(s.resetAt, s.rules.timezone, now);
    const losses = s.rules.lossMode === 'consecutive' ? s.baseline?.streak : s.baseline?.losses;
    return screen(`RISKAVUE / ${prefix}`, [
        row('LOSS ALLOWANCE', remaining === undefined ? '—' : `$${remaining.toFixed(2)}`),
        row('TRADES LEFT', `${Math.max(0, s.rules.maxTrades - (s.baseline?.trades ?? 0))} / ${s.rules.maxTrades}`),
        row(s.rules.lossMode === 'consecutive' ? 'LOSSES IN A ROW' : 'LOSSES THIS SESSION', `${losses ?? 0} / ${s.rules.maxLosses}`),
        row('RESET', `${end.time} / ${end.remaining}`),
        s.risk?.unknown[0] ?? (s.risk?.warning ? 'LOW ALLOWANCE / inside warning buffer' : 'Within your configured limits'),
        s.baseline?.estimated ? 'Estimated since app start' : 'Tracked from session start'
    ]);
}
