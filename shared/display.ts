import type { Action, Snapshot } from './types.ts';
import { deadline } from './session-text.ts';
export type Page = 'session' | 'positions' | 'rules' | 'review';
export function display(s: Snapshot, page: Page, action?: Action, now = Date.now()) {
    const prefix = s.account.mode === 'paper' ? 'PAPER DEMO' : 'BINANCE DEMO';
    if (s.stale || now - s.account.at > 5000)
        return `${prefix} / RISKAVUE\n\nCONNECTION LOST\nAccount data is stale.\nActions paused until reconnected.`;
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
        return `SESSION LOCKED / ${prefix}\n\nNew Riskavue entries blocked\nUntil ${end.time} (in ${end.remaining})\n\n$${s.risk?.remaining.toFixed(2) ?? '—'} to floor\nProtective stops kept\n${s.lock.hard ? 'Hard limit reached / no override' : s.lock.reason === 'You requested a session lock' ? 'You requested this lock' : s.lock.reason}\n${s.baseline?.estimated ? 'Floor estimated since app start\n' : ''}Tap = actions`;
    }
    if (page === 'positions')
        return `${prefix} / POSITIONS\n\n${s.account.positions.map(p => `${p.symbol} ${p.qty > 0 ? 'LONG' : 'SHORT'} ${Math.abs(p.qty)}\nStop ${p.stop ?? 'UNKNOWN'} | P/L $${(p.qty * (p.mark - p.entry)).toFixed(2)}`).join('\n') || 'No open positions'}\n\nSwipe to change view.`;
    if (page === 'rules')
        return `${prefix} / YOUR RULES\n\n${s.rules.name}\nDaily ${s.rules.dailyPct * 100}% / max ${s.rules.maxPct * 100}%\n${s.rules.maxLosses} ${s.rules.lossMode} losses = lock\n${s.rules.maxTrades} entries per session\n${s.baseline?.estimated ? 'Baseline estimated since app start.' : ''}\nOnly Riskavue entries can be blocked.`;
    if (page === 'review')
        return `${prefix} / SESSION REVIEW\n\n${s.review || 'Tap for actions, then Session review.'}`.slice(0, 460);
    const remaining = s.risk?.remaining;
    const mins = Math.max(0, Math.floor((s.resetAt - now) / 60000));
    return `${prefix} / RISKAVUE\n\n${remaining === undefined ? 'Waiting for account' : `$${remaining.toFixed(0)} to floor`}\n\n${s.rules.maxTrades - (s.baseline?.trades ?? 0)} entries left / resets ${Math.floor(mins / 60)}h ${mins % 60}m\n${s.risk?.unknown[0] ?? (s.risk?.warning ? 'Inside your warning buffer' : 'Within your configured limits')}\n${s.baseline?.estimated ? 'Estimated floor: since app start.' : ''}\n\nTap = actions / swipe = views`;
}
