import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { Paper } from './exchange.ts';
import { Service } from './service.ts';
import { Store } from './store.ts';
import { tradingDay } from './rules.ts';
import { display } from '../shared/display.ts';
import { telegramStatus } from '../shared/session-text.ts';

const steps = ['reject', 'discard', 'tilt', 'tap', 'status', 'review'] as const;
export class JudgeSession {
    readonly store = new Store(':memory:');
    readonly paper = new Paper();
    readonly service = new Service(this.store, this.paper);
    phase = 0;
    actionId?: string;
    message = '';
    statusText = '';
    review = '';
    touched = Date.now();
    private serial: Promise<unknown> = Promise.resolve();
    async load() {
        this.paper.account.wallet = 9690;
        this.service.baseline = { day: tradingDay(Date.now(), this.service.rules).day, balance: 10000, equity: 10000, highBalance: 10000, estimated: false, capturedAt: Date.now(), trades: 0, losses: 0, streak: 0 };
        this.store.set('baseline', this.service.baseline);
        await this.service.refresh();
        this.message = '$190 loss allowance. Synthetic paper account; no orders submitted.';
        return this.result();
    }
    step(name: typeof steps[number]) {
        const task = this.serial.then(async () => {
            if (steps[this.phase] !== name) throw new Error('Follow the numbered steps, or restart the walkthrough.');
            await this.service.refresh();
            if (name === 'reject') {
                const action = this.service.ticket({ symbol: 'BTCUSDT', side: 'BUY', qty: .1, entry: 60000, stop: 57600 });
                this.actionId = action.id;
                this.message = `${action.title}\n${action.detail}\nPaper orders: ${this.paper.account.orders.length}`;
            } else if (name === 'discard') {
                const result = await this.service.execute(this.actionId!);
                this.message = result.result!;
                this.actionId = undefined;
            } else if (name === 'tilt') {
                for (let i = 0; i < 2; i++) {
                    this.paper.account.wallet -= 50;
                    this.service.recordClose(randomUUID(), -50);
                }
                await this.service.refresh();
                this.message = 'Two synthetic losses recorded. New Riskavue entries are now locked.';
            } else if (name === 'tap') {
                const action = this.service.ticket({ symbol: 'BTCUSDT', side: 'BUY', qty: .001, entry: 60000, stop: 59000 });
                await this.service.execute(action.id);
                this.message = 'STILL LOCKED\nA tap did not unlock the session. A new ticket was blocked.\nPaper orders: ' + this.paper.account.orders.length;
            } else if (name === 'status') {
                this.statusText = telegramStatus(this.service.snapshot());
                this.message = 'The same /status formatter used by the Telegram bot. Preview only; no message sent.';
            } else {
                this.review = 'Kept: Oversized entry blocked; the two-loss lock stayed active.\nBroke: No rule violations recorded in this paper walkthrough.\nNext session: Set your loss and trade limits before your first entry.';
                this.message = 'Deterministic three-line review of this walkthrough. No AI API called.';
            }
            this.phase++;
            this.touched = Date.now();
            return this.result();
        });
        this.serial = task.catch(() => {});
        return task;
    }
    result() {
        const snapshot = this.service.snapshot();
        return { phase: this.phase, next: steps[this.phase] ?? null, message: this.message, mode: 'paper', remaining: snapshot.risk?.remaining, locked: !!snapshot.lock, orders: this.paper.account.orders.length, display: display(snapshot, 'session', this.actionId ? this.store.action(this.actionId) : undefined), statusText: this.statusText, review: this.review };
    }
    close() { this.store.close(); }
}

export function judgeRouter() {
    const router = Router(), sessions = new Map<string, JudgeSession>();
    // Bounded, short-lived paper accounts; no live service or credentials are passed in.
    router.use((_req, _res, next) => {
        for (const [id, session] of sessions) if (Date.now() - session.touched > 10 * 60000) { session.close(); sessions.delete(id); }
        next();
    });
    router.post('/start', async (_req, res) => {
        if (sessions.size >= 64) { res.status(429).json({ error: 'Judge demo is busy. Please try again shortly.' }); return; }
        const id = randomUUID(), session = new JudgeSession();
        sessions.set(id, session);
        try { res.json({ id, ...await session.load() }); }
        catch (e) { session.close(); sessions.delete(id); throw e; }
    });
    router.post('/:id/step', async (req, res) => {
        const { step } = z.object({ step: z.enum(steps) }).strict().parse(req.body);
        const session = sessions.get(String(req.params.id));
        if (!session) { res.status(404).json({ error: 'Walkthrough expired. Load the scenario again.' }); return; }
        res.json(await session.step(step));
    });
    return router;
}
