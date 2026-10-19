import { describe, expect, it } from 'vitest';
import { orderLogBlocks } from './logBlockOrder.js';

const cardio = { id: 'cardio', typeId: 'cardio' };
const session = { id: 'session', typeId: 'session' };

describe('log block order', () => {
  it('follows the plan when a session comes after cardio, including repeated types', () => {
    const secondCardio = { id: 'cardio-2', typeId: 'cardio' };
    const groups = { session: [session], cardio: [cardio, secondCardio] };
    expect(orderLogBlocks([cardio, session, secondCardio], groups).map(x => x.block.id))
      .toEqual(['cardio', 'session', 'cardio-2']);
    expect(groups.cardio).toEqual([cardio, secondCardio]);
  });

  it('retains the frozen session and completed results when positioning it', () => {
    const frozen = { ...session, session: { movements: [{ id: 'drill', result: 12 }] } };
    const result = orderLogBlocks([cardio, session], { session: [frozen], cardio: [cardio] });
    expect(result[1]).toEqual({ kind: 'session', block: frozen });
    expect(result[1].block).toBe(frozen);
  });

  it('keeps one-day extras and snapshot-only blocks once after the planned blocks', () => {
    const extra = { id: 'extra', isExtra: true };
    const result = orderLogBlocks([cardio, session], { session: [session], cardio: [cardio, extra], strength: [extra] });
    expect(result.map(x => x.block.id)).toEqual(['cardio', 'session', 'extra']);
  });

  it('handles an empty plan, missing blocks, and duplicate plan references', () => {
    expect(orderLogBlocks([], { session: [session] }).map(x => x.block)).toEqual([session]);
    expect(orderLogBlocks([null, cardio, cardio, session], { cardio: [cardio] }).map(x => x.block)).toEqual([cardio]);
    expect(orderLogBlocks([], {})).toEqual([]);
  });
});
