import { test } from 'node:test';
import assert from 'node:assert/strict';
import { applyFill, type Fill } from '../server/ledger.ts';
const fill = (overrides: Partial<Fill>): Fill => ({ id: '1', orderId: '1', symbol: 'BTCUSDT', side: 'BUY', qty: 1, realized: 0, fee: 1, at: Date.now(), ...overrides });
test('partial exits produce one completed trade and include entry fees', () => { let x = applyFill({ qty: 0, net: 0, cycle: 0 }, fill({})); assert.equal(x.opening, true); assert.equal(x.completed, false); x = applyFill(x.inventory, fill({ id: '2', side: 'SELL', qty: .5, realized: -10, fee: .5 })); assert.equal(x.completed, false); x = applyFill(x.inventory, fill({ id: '3', side: 'SELL', qty: .5, realized: -10, fee: .5 })); assert.equal(x.completed, true); assert.equal(x.pnl, -22); });
test('position reversal finishes the old cycle and reserves fees for the new one', () => { const x = applyFill({ qty: 1, net: -1, cycle: 0 }, fill({ side: 'SELL', qty: 2, realized: 10, fee: 2 })); assert.equal(x.completed, true); assert.equal(x.opening, true); assert.equal(x.pnl, 8); assert.deepEqual(x.inventory, { qty: -1, net: -1, cycle: 1 }); });
