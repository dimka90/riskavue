import type { Snapshot, Action, Ticket } from '../../shared/types.ts';
import type { Page } from '../../shared/display.ts';

type Item = { label: string; detail?: string; run: () => void | Promise<void> };
type Host = { state: () => Snapshot | undefined; api: <T = any>(path: string, body?: unknown) => Promise<T>; select: (action: Action) => void; view: (page: Page) => void; draw: () => void };
export class SilentControls {
    private items: Item[] = [];
    private index = 0;
    private heading = '';
    private message = '';
    private edit?: { field: 'qty' | 'entry' | 'stop'; digits: string[]; index: number; decimals: number };
    private busy = false;
    private ticket: Ticket = { symbol: 'BTCUSDT', side: 'BUY', qty: .001, entry: 0, stop: 0 };
    active = false;
    constructor(private host: Host) {}
    close() { this.active = false; this.edit = undefined; this.host.draw(); }
    private menu(heading: string, items: Item[]) { this.heading = heading; this.items = items; this.index = 0; this.edit = undefined; this.message = ''; this.active = true; this.host.draw(); }
    private back(run: () => void = () => this.open()): Item { return { label: 'Back', run }; }
    open() {
        const s = this.host.state(); if (!s) return;
        this.menu('ACTIONS', [
            { label: s.lock ? 'Why am I locked?' : 'Lock session', detail: s.lock ? 'See the reason and reset time' : 'Block new entries until reset', run: () => s.lock ? this.showLock() : this.propose('lock') },
            { label: 'New trade', detail: 'Set a ticket using swipes and taps', run: () => this.trade() },
            { label: 'Manage positions', detail: 'Close or move a protective stop', run: () => this.positions() },
            { label: 'Cancel pending entry', detail: 'Protective stops are not listed', run: () => this.orders() },
            { label: 'Close all positions', detail: 'Request a separate confirmation', run: () => this.propose('close-all') },
            { label: 'Session review', detail: 'Read or generate a review', run: () => this.review() },
            { label: 'Your rules', run: () => { this.close(); this.host.view('rules'); } },
            ...(s.lock && !s.lock.hard ? [{ label: 'Override soft lock', detail: 'Reason and deliberate hold required', run: () => this.override() }] : []),
            { label: 'Back to session', run: () => { this.close(); this.host.view('session'); } },
        ]);
    }
    move(delta: number) {
        if (this.busy) return;
        if (this.edit) { const e = this.edit; e.digits[e.index] = String((Number(e.digits[e.index]) + delta + 10) % 10); }
        else this.index = (this.index + delta + this.items.length) % this.items.length;
        this.message = ''; this.host.draw();
    }
    async tap() {
        if (this.busy) return;
        if (this.edit) {
            const e = this.edit;
            if (++e.index < e.digits.length) { this.host.draw(); return; }
            this.ticket[e.field] = Number(e.digits.join('')) / 10 ** e.decimals;
            this.trade(); return;
        }
        this.busy = true; this.host.draw();
        try { await this.items[this.index]?.run(); }
        catch (error) { this.message = error instanceof Error ? error.message : 'Request failed. Try again.'; }
        finally { this.busy = false; this.host.draw(); }
    }
    buttonLabel() { return this.edit ? this.edit.index === this.edit.digits.length - 1 ? 'Save number' : 'Next digit' : 'Tap to select'; }
    helpText() { return this.edit ? 'Use the arrows to change the highlighted digit, then tap to move right. Saving a number does not send a trade.' : 'Use the arrows to highlight an option, then tap to select it. Trades and locks require a separate confirmation.'; }
    text() {
        if (this.edit) {
            const e = this.edit, parts = e.digits.map((d, i) => i === e.index ? `[${d}]` : ` ${d} `);
            parts.splice(parts.length - e.decimals, 0, '.');
            return `NEW TRADE / ${e.field === 'qty' ? 'QUANTITY' : e.field === 'entry' ? 'LIMIT PRICE' : 'STOP PRICE'}\n\n${this.ticket.symbol} / ${this.ticket.side}\n\n${parts.join('')}\nDigit ${e.index + 1} of ${e.digits.length}\n\nSwipe = change digit / tap = next\nFinal digit saves; no order sent.`;
        }
        const start = Math.max(0, Math.min(this.index - 1, this.items.length - 3));
        const rows = this.items.slice(start, start + 3).map((item, i) => `${start + i === this.index ? '>' : ' '} ${item.label}`);
        return `RISKAVUE / ${this.heading}\n${this.index + 1} of ${this.items.length}\n\n${rows.join('\n')}\n\n${this.busy ? 'Working...' : this.message ? this.message.slice(0, 70) : this.items[this.index]?.detail ?? 'Voice is optional.'}\nSwipe = choose / tap = select`;
    }
    private async propose(kind: string, payload: Record<string, unknown> = {}) {
        const a = await this.host.api<Action>('/action', { kind, ...payload }); this.close(); this.host.select(a);
    }
    private showLock() {
        const s = this.host.state();
        this.menu('LOCK DETAILS', [{ label: 'Read lock status', detail: s?.lock?.reason ?? 'Your session is open', run: () => { this.close(); this.host.view('session'); } }, ...(s?.lock && !s.lock.hard ? [{ label: 'Override soft lock', detail: 'Reason and hold required', run: () => this.override() }] : []), this.back()]);
    }
    private positions() {
        const positions = this.host.state()?.account.positions ?? [];
        this.menu('POSITIONS', [...positions.map(p => ({ label: `${p.symbol} ${p.qty > 0 ? 'LONG' : 'SHORT'}`, detail: `Qty ${Math.abs(p.qty)} / stop ${p.stop ?? 'unknown'}`, run: () => this.menu(p.symbol, [{ label: 'Close position', detail: 'Requires confirmation', run: () => this.propose('close', { symbol: p.symbol }) }, { label: 'Move stop to break-even', detail: 'Old stop stays until replacement', run: () => this.propose('breakeven', { symbol: p.symbol }) }, this.back(() => this.positions())]) })), this.back()]);
        if (!positions.length) { this.message = 'No open positions.'; this.host.draw(); }
    }
    private orders() {
        const orders = (this.host.state()?.account.orders ?? []).filter(o => !o.protective);
        this.menu('PENDING ENTRIES', [...orders.map(o => ({ label: `${o.symbol} ${o.side} ${o.qty}`, detail: `Limit ${o.price} / ID ${o.id.slice(-6)}`, run: () => this.propose('cancel', { orderId: o.id }) })), this.back()]);
        if (!orders.length) { this.message = 'No pending entries.'; this.host.draw(); }
    }
    private review() {
        this.menu('SESSION REVIEW', [{ label: 'Read latest review', run: () => { this.close(); this.host.view('review'); } }, { label: 'Generate review', detail: 'Uses your recorded decisions', run: async () => { await this.host.api('/review', {}); this.close(); this.host.view('review'); } }, this.back()]);
    }
    private override() {
        this.menu('CHOOSE YOUR REASON', ['I requested this lock by mistake', 'I have reviewed my plan and limits'].map<Item>(reason => ({ label: reason, detail: 'Then hold to confirm; never a single tap', run: async () => { const a = await this.host.api<Action>('/override', { reason }); this.close(); this.host.select(a); } })).concat([this.back()]));
    }
    private trade() {
        const t = this.ticket;
        this.menu('NEW TRADE', [
            { label: `Market: ${t.symbol}`, run: () => this.menu('MARKET', ['BTCUSDT', 'ETHUSDT', 'SOLUSDT'].map(symbol => ({ label: symbol, run: () => { t.symbol = symbol; this.trade(); } })).concat([this.back(() => this.trade())])) },
            { label: `Direction: ${t.side}`, run: () => { t.side = t.side === 'BUY' ? 'SELL' : 'BUY'; this.trade(); } },
            ...(['qty', 'entry', 'stop'] as const).map(field => ({ label: `${field === 'qty' ? 'Quantity' : field === 'entry' ? 'Limit' : 'Stop'}: ${t[field]}`, detail: 'Edit digits with swipes and taps', run: () => { const decimals = field === 'qty' ? 4 : 2; this.edit = { field, decimals, digits: Math.round(t[field] * 10 ** decimals).toString().padStart(field === 'qty' ? 7 : 8, '0').split(''), index: 0 }; this.host.draw(); } })),
            { label: 'Check trade against rules', detail: `${t.side} ${t.qty} ${t.symbol} / ${t.entry} stop ${t.stop}`, run: async () => { const a = await this.host.api<Action>('/ticket', t); this.close(); this.host.select(a); } },
            this.back(),
        ]);
    }
}
