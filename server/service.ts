import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { deadline, lockedText } from '../shared/session-text.ts';
import type { Account, Action, ActionKind, Baseline, Lock, Rules, Snapshot, Ticket } from '../shared/types.ts';
import { applyFill, initialInventory, type Inventory } from './ledger.ts';
import { Store } from './store.ts';
import { type Exchange, Paper, UncertainExecution } from './exchange.ts';
import { checkTrade, defaultRules, riskFor, rulesSchema, ticketSchema, tradingDay } from './rules.ts';
export class Service extends EventEmitter {
    account: Account;
    rules: Rules;
    baseline: Baseline | null;
    lock: Lock | null;
    review = '';
    activeUntil = 0;
    busy = false;
    stopped = false;
    timer?: NodeJS.Timeout;
    serial: Promise<unknown> = Promise.resolve();
    lastStreamRefresh = 0;
    lastFillSync = 0;
    lastAttemptAt = 0;
    constructor(public store: Store, public exchange: Exchange, public integrations: Record<string, boolean> = {}) {
        super();
        this.rules = store.get<Rules>('rules') ?? defaultRules;
        this.baseline = store.get<Baseline>('baseline') ?? null;
        this.lock = store.get<Lock>('lock') ?? null;
        this.review = store.get<string>('review') ?? '';
        this.account = { wallet: 0, equity: 0, positions: [], orders: [], at: 0, mode: exchange.mode, connected: false };
    }
    snapshot(): Snapshot { const now = Date.now(); return { account: this.account, baseline: this.baseline, rules: this.rules, risk: this.baseline ? riskFor(this.account, this.baseline, this.rules) : null, lock: this.lock && this.lock.until > now ? this.lock : null, actions: this.store.actions(), decisions: this.store.decisions(), resetAt: tradingDay(now, this.rules).resetAt, stale: !this.account.connected || now - this.account.at > 5000, integrations: this.integrations, review: this.review, glassesActive: this.activeUntil > now }; }
    publish() { this.emit('state', this.snapshot()); }
    async start() { await this.refresh(); if (this.exchange.start)
        void this.exchange.start(() => { if (Date.now() - this.lastAttemptAt > 1800) {
            this.lastStreamRefresh = Date.now();
            void this.refresh();
        } }).catch(() => { this.store.log('connection', 'Live stream unavailable; REST reconciliation remains active'); }); this.timer = setInterval(() => { if(Date.now()-this.lastAttemptAt>1800)void this.refresh(); }, 2000); }
    stop() { this.stopped = true; if (this.timer)
        clearInterval(this.timer); this.exchange.stop?.(); }
    async refresh() {
        if (this.busy || this.stopped)
            return;
        this.busy = true;
        this.lastAttemptAt = Date.now();
        try {
            const previous = this.account;
            // Fetch slower history before the live snapshot, so history latency cannot
            // make a newly published account stale before the user can act on it.
            if (this.baseline && this.exchange.fills && Date.now() - this.lastFillSync > 4000)
                await this.reconcileFills();
            this.account = await this.exchange.read();
            // A new demo account may start with $5,000 rather than the paper $10,000.
            // Never overwrite rules the user already saved.
            if (this.exchange.mode === 'binance' && !this.baseline && !this.store.get<Rules>('rules')) {
                if (!(this.account.wallet > 0)) throw new Error('Fund the demo account before starting a session');
                this.rules = { ...this.rules, initialBalance: this.account.wallet };
                this.store.set('rules', this.rules);
            }
            // Recover stops for Riskavue's pending entries from the durable action record.
            for (const o of this.account.orders) {
                const a = this.store.actions().find(a => a.kind === 'place' && a.status === 'done' && `rv${a.id.replaceAll('-', '')}` === String(o.clientId));
                if (a) { const expected=(a.payload.ticket as Ticket).stop; if(this.account.orders.some(p=>p.algo&&p.stopLoss&&p.protective&&p.symbol===o.symbol&&p.side!==o.side&&p.price===expected))o.stop=expected; }
            }
            const day = tradingDay(Date.now(), this.rules);
            if (!this.baseline || this.baseline.day !== day.day) {
                const contiguous = previous.connected && day.startAt >= previous.at && Date.now() - previous.at <= 5000;
                this.baseline = { day: day.day, balance: contiguous ? previous.wallet : this.account.wallet, equity: contiguous ? previous.equity : this.account.equity, highBalance: Math.max(this.rules.initialBalance, this.baseline?.highBalance ?? 0, contiguous ? previous.wallet : this.account.wallet), estimated: !contiguous, capturedAt: Date.now(), trades: 0, losses: 0, streak: 0 };
                this.store.set('baseline', this.baseline);
                this.store.log('baseline', contiguous ? 'Trading-day baseline captured at rollover' : 'Day start unknown. Using balance/equity since app start; floor is estimated.');
            }
            if (this.lock && this.lock.until <= Date.now()) {
                this.lock = null;
                this.store.set('lock', null);
            }
            if (this.exchange instanceof Paper)
                this.store.set('paper', this.exchange.account);
            if (this.exchange.fills && !this.store.get('ledger'))
                await this.reconcileFills();
            await this.evaluate();
        }
        catch (e) {
            this.account = { ...this.account, connected: false, error: e instanceof Error ? e.message : 'Account refresh failed' };
        }
        finally {
            this.busy = false;
            this.publish();
        }
    }
    async reconcileFills() {
        if (!this.exchange.fills || !this.baseline)
            return;
        let ledger = this.store.get<{
            since: number;
            inventory: Record<string, Inventory>;
            symbols: string[];
        }>('ledger');
        if (!ledger) {
            ledger = { since: this.account.at, inventory: initialInventory(this.account.positions), symbols: ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', ...this.account.positions.map(p => p.symbol)] };
            this.store.set('ledger', ledger);
            this.store.log('history', 'Entry and loss counts track fills since connection; earlier daily activity is unknown.');
            return;
        }
        ledger.symbols = [...new Set([...ledger.symbols, ...this.account.positions.map(p => p.symbol), ...this.account.orders.map(o => o.symbol)])];
        const fills = await this.exchange.fills(ledger.since, ledger.symbols);
        for (const fill of fills) {
            this.store.db.exec('BEGIN IMMEDIATE');
            try {
                if (this.store.once(`fill:${fill.id}`)) {
                    const result = applyFill(ledger.inventory[fill.symbol] ?? { qty: 0, net: 0, cycle: 0 }, fill);
                    ledger.inventory[fill.symbol] = result.inventory;
                    if (fill.at >= tradingDay(Date.now(), this.rules).startAt) {
                        if (result.opening)
                            this.recordEntry(fill.orderId);
                        if (result.completed)
                            this.recordClose(`${fill.symbol}:${result.inventory.cycle}`, result.pnl!);
                    }
                    ledger.since = Math.max(ledger.since, fill.at);
                    this.store.set('ledger', ledger);
                }
                this.store.db.exec('COMMIT');
            }
            catch (e) {
                this.store.db.exec('ROLLBACK');
                throw e;
            }
        }
        this.lastFillSync = Date.now();
    }
    async evaluate() {
        if (!this.baseline)
            return;
        const r = riskFor(this.account, this.baseline, this.rules);
        if (r.breached && !this.lock?.hard)
            await this.lockNow('Equity reached your loss floor', true);
        const count = this.rules.lossMode === 'total' ? this.baseline.losses : this.baseline.streak;
        const waived = this.store.get<{
            day: string;
            losses: number;
            trades: number;
        }>('soft-waiver');
        const waiver = waived?.day === this.baseline.day ? waived : undefined;
        if (!this.lock && count >= this.rules.maxLosses && count > (waiver?.losses ?? -1))
            await this.lockNow(`Your rule: stop after ${this.rules.maxLosses} ${this.rules.lossMode} losses`, false);
        if (!this.lock && this.baseline.trades >= this.rules.maxTrades && this.baseline.trades > (waiver?.trades ?? -1))
            await this.lockNow(`Your rule: ${this.rules.maxTrades} entries per day`, false);
        if (r.warning && this.store.once(`warn:${this.baseline.day}`)) {
            this.store.log('warning', `$${r.remaining.toFixed(2)} to floor`);
            this.emit('warning', `Riskavue: $${r.remaining.toFixed(2)} to floor. Your buffer is $${r.buffer.toFixed(2)}.`);
        }
        for (const p of this.account.positions) {
            const unitRisk = Math.abs(p.entry - (p.stop ?? p.entry));
            const profit = p.qty * (p.mark - p.entry);
            if (p.stop && unitRisk > 0 && profit >= Math.abs(p.qty) * unitRisk && this.store.once(`be:${this.baseline.day}:${p.symbol}:${p.entry}:${p.stop}`))
                this.propose('breakeven', `${p.symbol} reached +1R`, 'Move the protective stop to break-even? Tap to confirm.', { symbol: p.symbol });
            if (!p.stop && this.store.once(`unprotected:${this.baseline.day}:${p.symbol}:${p.entry}`))
                this.propose('close', `${p.symbol}: already filled`, 'No protective stop found. Tap to close the position; this fill cannot be undone.', { symbol: p.symbol });
        }
        for (const o of this.account.orders.filter(o => !o.protective)) {
            const existing = this.store.actions().some(a => a.kind === 'cancel' && a.payload.orderId === o.id && a.status === 'pending' && a.expiresAt > Date.now());
            if (!existing && !this.lock)
                this.propose('cancel', `Pending ${o.symbol} entry`, o.stop ? `Pending entry with stop ${o.stop}. Tap to cancel.` : 'Stop unknown. Tap to cancel the remaining order.', { orderId: o.id, symbol: o.symbol }, 60000);
        }
    }
    propose(kind: ActionKind, title: string, detail: string, payload: Record<string, unknown> = {}, ttl = 60000) {
        const a: Action = { id: randomUUID(), kind, title, detail, payload, status: 'pending', createdAt: Date.now(), expiresAt: Date.now() + ttl };
        if (kind === 'lock') {
            if (this.snapshot().lock) {
                a.status = 'done'; a.result = lockedText(this.snapshot(), true);
                this.store.saveAction(a);
                return a;
            }
            a.title = 'Lock new trades through Riskavue?';
            a.detail = `Until ${deadline(tradingDay(Date.now(), this.rules).resetAt, this.rules.timezone).full}.\nPending entries will be cancelled. Protective stops will stay.\nConfirm to lock; dismiss to keep trading.`;
        }
        this.store.saveAction(a);
        this.store.log('proposed', title);
        this.emit('action', a);
        this.publish();
        return a;
    }
    ticket(raw: unknown) {
        const ticket = ticketSchema.parse(raw);
        const s = this.snapshot();
        if (s.stale || !this.baseline)
            throw new Error('Fresh account data required');
        if (s.lock)
            return this.propose('discard', 'Trade blocked · session locked', lockedText(s), { ticket });
        const check = checkTrade(ticket, this.account, this.baseline, this.rules);
        if (!check.allowed)
            return this.propose('discard', `Estimated risk $${check.loss.toFixed(2)} · NOT SENT`, check.reason, { ticket });
        return this.propose('place', `${ticket.side} ${ticket.qty} ${ticket.symbol}`, `Limit ${ticket.entry}; stop ${ticket.stop}. Estimated risk $${check.loss.toFixed(2)}. Tap to submit.`, { ticket }, 30000);
    }
    async lockNow(reason: string, hard: boolean, notify = true) {
        const active = this.lock && this.lock.until > Date.now() ? this.lock : null;
        if (active && (active.hard || !hard)) return false;
        this.lock = { reason, hard, until: active?.until ?? tradingDay(Date.now(), this.rules).resetAt };
        this.store.set('lock', this.lock);
        this.store.log('lock', reason);
        for (const o of this.account.orders.filter(o => !o.protective)) {
            try {
                const result = await this.exchange.cancel(o);
                this.store.log('cancel', result);
            }
            catch (e) {
                this.store.log('cancel-failed', e instanceof Error ? e.message : 'Cancel failed');
            }
        }
        if (notify) this.emit('warning', `${lockedText(this.snapshot())}\n${reason}`);
        return true;
    }
    execute(id: string): Promise<Action> { const task = this.serial.then(() => this.perform(id)); this.serial = task.catch(() => { }); return task; }
    async perform(id: string) {
        let a = this.store.action(id);
        if (!a)
            throw new Error('Action not found');
        if (a.status !== 'pending')
            return a;
        if (a.expiresAt < Date.now()) {
            a = { ...a, status: 'dismissed', result: 'Confirmation expired; request a fresh action' };
            this.store.saveAction(a);
            return a;
        }
        if (!this.store.claim(id))
            return this.store.action(id)!;
        a = { ...a, status: 'running' };
        this.store.saveAction(a);
        this.publish();
        try {
            let result = '';
            if (a.kind === 'discard')
                result = 'Discarded. No order was sent.';
            else if (a.kind === 'lock') {
                const changed = await this.lockNow('You requested a session lock', false, false);
                result = lockedText(this.snapshot(), !changed);
            }
            else if (a.kind === 'override') {
                if (!this.lock || this.lock.hard)
                    throw new Error('Hard locks cannot be overridden');
                if (typeof a.payload.reason !== 'string' || a.payload.reason.length < 3 || a.payload.voiceVerified !== true)
                    throw new Error('Hold and speak a reason first');
                this.store.log('override', a.payload.reason);
                this.lock = null;
                this.store.set('lock', null);
                // Keep the audit counters intact; the next additional loss/entry can lock again.
                if (this.baseline)
                    this.store.set('soft-waiver', { day: this.baseline.day, losses: this.rules.lossMode === 'total' ? this.baseline.losses : this.baseline.streak, trades: this.baseline.trades });
                result = 'Soft lock overridden; spoken reason recorded';
            }
            else {
                if (this.snapshot().stale)
                    throw new Error('Connection lost. Action not sent.');
                this.account = await this.exchange.read();
                if (a.kind === 'place') {
                    if (this.lock && this.lock.until > Date.now())
                        throw new Error(lockedText(this.snapshot(), true));
                    if (!this.baseline)
                        throw new Error('No session baseline');
                    const t = ticketSchema.parse(a.payload.ticket);
                    const check = checkTrade(t, this.account, this.baseline, this.rules);
                    if (!check.allowed)
                        throw new Error(`Risk changed: ${check.reason}`);
                    if (this.account.positions.some(p => p.symbol === t.symbol) || this.account.orders.some(o => !o.protective && o.symbol === t.symbol))
                        throw new Error('One entry or position per symbol is supported; close/cancel it first');
                    result = await this.exchange.place(t, a.id);
                }
                else if (a.kind === 'cancel') {
                    const o = this.account.orders.find(o => o.id === a!.payload.orderId);
                    if (!o)
                        throw new Error('Order no longer pending; it may have filled. Check positions.');
                    if (o.protective)
                        throw new Error('Protective stops are preserved');
                    result = await this.exchange.cancel(o);
                }
                else if (a.kind === 'close' || a.kind === 'breakeven') {
                    const p = this.account.positions.find(p => p.symbol === a!.payload.symbol);
                    if (!p)
                        throw new Error('Position no longer open');
                    if (a.kind === 'close') {
                        result = await this.exchange.close(p, a.id);
                        if (this.exchange instanceof Paper)
                            this.recordClose(a.id, p.qty * (p.mark - p.entry) - Math.abs(p.qty) * p.mark * .0005 - (p.entryFee ?? 0));
                    }
                    else
                        result = await this.exchange.breakeven(p, a.id);
                }
                else if (a.kind === 'close-all') {
                    const results: string[] = [];
                    for (const p of this.account.positions) {
                        results.push(await this.exchange.close(p, randomUUID()));
                        if (this.exchange instanceof Paper)
                            this.recordClose(`${a.id}:${p.symbol}`, p.qty * (p.mark - p.entry) - Math.abs(p.qty) * p.mark * .0005 - (p.entryFee ?? 0));
                    }
                    result = results.join('; ') || 'No positions open';
                }
            }
            a = { ...a, status: 'done', result };
            this.store.log('executed', result);
        }
        catch (e) {
            a = { ...a, status: e instanceof UncertainExecution ? 'unknown' : 'failed', result: e instanceof Error ? e.message : 'Action failed' };
            this.store.log(a.status, a.result!);
        }
        this.store.saveAction(a);
        await this.refresh();
        this.publish();
        this.emit('action-result', a);
        return a;
    }
    dismiss(id: string) { const a = this.store.action(id); if (!a || a.status !== 'pending')
        return a; a.status = 'dismissed'; a.result = 'Dismissed; no exchange action'; this.store.saveAction(a); this.publish(); return a; }
    recordEntry(id: string) { if (!this.baseline || !this.store.once(`entry:${id}`))
        return; this.baseline.trades++; this.store.set('baseline', this.baseline); }
    recordClose(id: string, pnl: number) { if (!this.baseline || !this.store.once(`close:${id}`))
        return; if (pnl < 0) {
        this.baseline.losses++;
        this.baseline.streak++;
    }
    else
        this.baseline.streak = 0; this.store.set('baseline', this.baseline); this.store.log('trade', `Closed trade net P/L: $${pnl.toFixed(2)}`); }
    setRules(raw: unknown) { const rules = rulesSchema.parse(raw); if (this.lock && this.lock.until > Date.now())
        throw new Error('Rules cannot change during a lock'); if (this.account.positions.length || this.account.orders.some(o => !o.protective))
        throw new Error('Close positions and cancel entries before starting a new rule session'); this.rules = rules; this.baseline = null; this.store.set('rules', rules); this.store.set('baseline', null); this.store.log('rules', `Started new rule session: ${rules.name}`); return this.refresh(); }
}
