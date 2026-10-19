import { describe, expect, it } from 'vitest';
import { applyRecommendedRecoveryDay } from './recommendedRecoveryDay.js';
import { buildActivityCalendarDay } from './activityCalendarEngine.js';
const strength = { id: 'lift', typeId: 'strength', sets: {} };
const recovery = { id: 'rest', typeId: 'recovery', isExtra: true, systemRecommended: true, recoveryDone: false };

describe('recommended recovery replaces only unstarted planned training', () => {
  it('pauses the date snapshot without editing the weekly Plan or recording training', () => {
    const log = { blocks: [strength, recovery] };
    const next = applyRecommendedRecoveryDay(log);
    expect(next.blocks[0].suspendedByRecoveryMode).toBe(true);
    expect(strength.suspendedByRecoveryMode).toBeUndefined();
    expect(next.blocks[1].recoveryDone).toBe(false);
    expect(buildActivityCalendarDay({ log: next }).completed).toBe(false);
    const done = applyRecommendedRecoveryDay({ ...next, blocks: next.blocks.map(b => b.id === 'rest' ? { ...b, recoveryDone: true } : b) });
    expect(buildActivityCalendarDay({ log: done, completed: true })).toMatchObject({ kind: 'rest', completed: true });
  });
  it('retains recorded results, one-day training extras and tasks', () => {
    const recorded = { ...strength, sets: { squat: [{ reps: 10, weight: 20 }] } };
    const extra = { ...strength, id: 'extra', isExtra: true };
    const tasks = { id: 'tasks', typeId: 'tasks' };
    const next = applyRecommendedRecoveryDay({ blocks: [recorded, extra, tasks, recovery] });
    expect(next.blocks.slice(0, 3)).toEqual([recorded, extra, tasks]);
  });
  it('restores planned training when recommended recovery is removed or cancelled', () => {
    const next = applyRecommendedRecoveryDay({ blocks: [strength, recovery] });
    for (const blocks of [next.blocks.filter(b => b.id !== 'rest'), next.blocks.map(b => b.id === 'rest' ? { ...b, cancelled: true } : b)]) {
      expect(applyRecommendedRecoveryDay({ blocks }).blocks[0].suspendedByRecoveryMode).toBe(false);
    }
  });
  it('leaves manual recovery and injury or illness pauses unchanged', () => {
    const manual = { ...recovery, systemRecommended: false };
    expect(applyRecommendedRecoveryDay({ blocks: [strength, manual] }).blocks[0]).toBe(strength);
    const paused = { ...strength, suspendedByRecoveryMode: true, suspendedByRecoveryReason: 'injury' };
    expect(applyRecommendedRecoveryDay({ blocks: [paused, recovery] }).blocks[0]).toBe(paused);
  });
});


describe('Sessions on recommended recovery days', () => {
  it('keeps planned Sessions active while strength and cardio stay paused', () => {
    const session = { id: 'skills', typeId: 'session', sessionTemplateId: 'skills' };
    const cardio = { id: 'run', typeId: 'cardio' };
    const next = applyRecommendedRecoveryDay({ blocks: [strength, cardio, session, recovery] });
    expect(next.blocks[0].suspendedByRecoveryMode).toBe(true);
    expect(next.blocks[1].suspendedByRecoveryMode).toBe(true);
    expect(next.blocks[2]).toBe(session);
  });
  it('unpauses Sessions saved before the exemption without losing results', () => {
    const session = { id: 'skills', typeId: 'session', suspendedByRecommendedRecovery: true,
      suspendedByRecoveryMode: true, suspendedByRecoveryReason: 'recommended-recovery',
      session: { movements: [{ id: 'touch', result: 12 }] } };
    const next = applyRecommendedRecoveryDay({ blocks: [session, recovery] });
    expect(next.blocks[0].suspendedByRecoveryMode).toBe(false);
    expect(next.blocks[0].suspendedByRecommendedRecovery).toBe(false);
    expect(next.blocks[0].session).toBe(session.session);
  });
  it('keeps injury and illness Session pauses in place', () => {
    for (const mode of ['injury', 'illness']) {
      const session = { id: 'skills', typeId: 'session', suspendedByRecoveryMode: true,
        suspendedByRecoveryReason: mode };
      expect(applyRecommendedRecoveryDay({ meta: { profileRecoveryMode: mode }, blocks: [session, recovery] }).blocks[0]).toBe(session);
    }
  });
});
