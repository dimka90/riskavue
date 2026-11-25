import type { Action, Snapshot } from './types.ts';

export function deadline(until: number, timezone: string, now = Date.now()) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', timeZoneName: 'shortOffset' }).formatToParts(until);
    const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
    const minutes = Math.max(0, Math.ceil((until - now) / 60000));
    const time = `${part('hour')}:${part('minute')} ${part('timeZoneName').replace('GMT', 'UTC')}`;
    const remaining = minutes ? `${Math.floor(minutes / 60)}h ${minutes % 60}m` : 'less than 1m';
    return { time, remaining, full: `${time} (in ${remaining})` };
}

export function lockedText(s: Snapshot, already = false, now = Date.now()) {
    if (!s.lock) return 'Session open.';
    return `${already ? 'Already locked' : 'LOCKED · new trades through Riskavue blocked'} until ${deadline(s.lock.until, s.rules.timezone, now).full}.\nProtective stops kept.`;
}

export function telegramStatus(s: Snapshot, now = Date.now()) {
    const mode = s.account.mode === 'paper' ? 'PAPER DEMO' : 'BINANCE DEMO';
    const locked = s.lock && s.lock.until > now;
    const stale = s.stale || now - s.account.at > 5000;
    const value = s.risk ? `$${s.risk.remaining.toFixed(2)} to floor` : 'Waiting for account data';
    const scope = s.baseline?.estimated ? '\nFloor estimated since app start.' : '';
    if (locked) return `LOCKED · new trades blocked\nUntil ${deadline(s.lock!.until, s.rules.timezone, now).full}\n\n${stale ? 'Connection lost · balance hidden' : value} · protective stops kept\n${s.lock!.reason}\n\n${mode} · applies to Riskavue entries${scope}`;
    if (stale) return `CONNECTION LOST\nBalance hidden · actions paused\n\n${mode}`;
    return `SESSION OPEN · ${mode}\n\n${value}\n${Math.max(0, s.rules.maxTrades - (s.baseline?.trades ?? 0))} entries available\nReset ${deadline(s.resetAt, s.rules.timezone, now).full}${scope}`;
}

export function actionText(a: Action) {
    if (a.status === 'pending') return `${a.title}\n\n${a.detail}`;
    if (a.status === 'running') return 'Working…\nWaiting for confirmation.';
    // A completed action reports what happened, without repeating the original question.
    return a.result ?? (a.status === 'dismissed' ? 'Dismissed. Nothing sent.' : 'Action complete.');
}
