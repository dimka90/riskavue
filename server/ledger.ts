import type { Position } from '../shared/types.ts';
export interface Fill {
    id: string;
    orderId: string;
    symbol: string;
    side: 'BUY' | 'SELL';
    qty: number;
    realized: number;
    fee: number;
    at: number;
}
export interface Inventory {
    qty: number;
    net: number;
    cycle: number;
}
/** Aggregate fills into position cycles: partial exits are not separate losing trades. */
export function applyFill(inventory: Inventory, fill: Fill) {
    const signed = fill.side === 'BUY' ? fill.qty : -fill.qty;
    const closing = inventory.qty !== 0 && Math.sign(inventory.qty) !== Math.sign(signed);
    const opening = !closing || Math.abs(signed) > Math.abs(inventory.qty);
    const exitQty = closing ? Math.min(Math.abs(inventory.qty), fill.qty) : 0;
    const nextQty = Number((inventory.qty + signed).toFixed(12));
    const closeFee = fill.fee * (exitQty / fill.qty);
    const net = inventory.net + fill.realized - (closing ? closeFee : fill.fee);
    const completed = closing && (nextQty === 0 || Math.sign(nextQty) !== Math.sign(inventory.qty));
    const result: Inventory = { qty: nextQty, net: completed ? (opening ? -(fill.fee - closeFee) : 0) : net, cycle: inventory.cycle + (completed ? 1 : 0) };
    return { inventory: result, opening, completed, pnl: completed ? net : undefined };
}
export function initialInventory(positions: Position[]): Record<string, Inventory> { return Object.fromEntries(positions.map(p => [p.symbol, { qty: p.qty, net: 0, cycle: 0 }])); }
