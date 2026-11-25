export type Side = 'BUY' | 'SELL';
export interface Rules {
    name: string;
    initialBalance: number;
    dailyPct: number;
    maxPct: number;
    dailyBasis: 'balance' | 'equity' | 'higher';
    dailyAllowanceBasis: 'initial' | 'day';
    maxMode: 'static' | 'trailing' | 'capped';
    maxLossAmount?: number;
    touchBreach: boolean;
    timezone: string;
    resetHour: number;
    resetMinute: number;
    bufferPct: number;
    maxTrades: number;
    maxLosses: number;
    lossMode: 'total' | 'consecutive';
    feeRate: number;
    slippageRate: number;
}
export interface Position {
    symbol: string;
    qty: number;
    entry: number;
    mark: number;
    stop?: number;
    stopId?: string;
    breakEven: number;
    entryFee?: number;
}
export interface Order {
    id: string;
    clientId?: string;
    stopLoss?: boolean;
    symbol: string;
    side: Side;
    qty: number;
    price: number;
    stop?: number;
    protective: boolean;
    algo?: boolean;
}
export interface Account {
    wallet: number;
    equity: number;
    positions: Position[];
    orders: Order[];
    at: number;
    mode: 'paper' | 'binance';
    connected: boolean;
    error?: string;
}
export interface Baseline {
    day: string;
    balance: number;
    equity: number;
    highBalance: number;
    estimated: boolean;
    capturedAt: number;
    trades: number;
    losses: number;
    streak: number;
}
export interface Lock {
    reason: string;
    hard: boolean;
    until: number;
    overridden?: boolean;
}
export interface Ticket {
    symbol: string;
    side: Side;
    qty: number;
    entry: number;
    stop: number;
}
export type ActionKind = 'discard' | 'place' | 'cancel' | 'close' | 'close-all' | 'breakeven' | 'lock' | 'override';
export interface Action {
    id: string;
    kind: ActionKind;
    title: string;
    detail: string;
    payload: Record<string, unknown>;
    status: 'pending' | 'running' | 'done' | 'failed' | 'unknown' | 'dismissed';
    createdAt: number;
    expiresAt: number;
    result?: string;
}
export interface Risk {
    dailyFloor: number;
    maxFloor: number;
    floor: number;
    remaining: number;
    dailyAllowance: number;
    buffer: number;
    breached: boolean;
    warning: boolean;
    openRisk: number | null;
    pendingRisk: number | null;
    unknown: string[];
}
export interface Decision {
    id: number;
    at: number;
    kind: string;
    message: string;
}
export interface Snapshot {
    account: Account;
    baseline: Baseline | null;
    rules: Rules;
    risk: Risk | null;
    lock: Lock | null;
    actions: Action[];
    decisions: Decision[];
    resetAt: number;
    stale: boolean;
    integrations: Record<string, boolean>;
    review: string;
    glassesActive: boolean;
}
export interface Preset {
    id: string;
    name: string;
    description: string;
    source?: string;
    checked?: string;
    rules: Partial<Rules>;
}
