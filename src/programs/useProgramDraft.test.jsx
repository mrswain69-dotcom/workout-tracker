// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import useProgramDraft from './useProgramDraft.js';
import { createProgramDraft, programDraftKey, readProgramDraft, undatedProgramContent } from './programDrafts.js';
import { duplicateProgramWeek, addProgramPhase } from '../engine/planCycleEngine.js';
const plan = { meta: { xp: 12345, programAddOns: [{ id: 'addon' }] }, activityTypes: [], program: { name: 'Future training', startDate: '2026-10-05', legacyWeeklySchedule: true, phases: [{ id: 'phase', name: 'Build', weeks: [{ id: 'week', name: 'Week 1', blocksByWeekday: { Mon: [{ id: 'run', typeId: 'cardio', label: 'Run' }] } }] }] } };
beforeEach(() => { localStorage.clear(); });
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
describe('isolated programme drafts', () => {
  it('removes dates and profile metadata while preserving weeks and leaving the source untouched', () => {
    const before = JSON.stringify(plan);
    const content = undatedProgramContent(addProgramPhase(duplicateProgramWeek(plan, 0)));
    expect(content.program.startDate).toBe('');
    expect(content.program.legacyWeeklySchedule).toBeUndefined();
    expect(content.meta).toBeUndefined();
    expect(content.program.phases).toHaveLength(2);
    expect(content.program.phases[0].weeks).toHaveLength(2);
    expect(content.program.phases[0].weeks[1].blocksByWeekday.Mon[0].label).toBe('Run');
    expect(JSON.stringify(plan)).toBe(before);
  });
  it('retains edits through closing and refresh without opening the editor automatically', () => {
    const first = renderHook(() => useProgramDraft('family', 'paul'));
    act(() => first.result.current.start(plan));
    act(() => first.result.current.update(duplicateProgramWeek(first.result.current.draft.content, 0)));
    act(() => first.result.current.close());
    expect(first.result.current.editing).toBe(false);
    first.unmount();
    const refreshed = renderHook(() => useProgramDraft('family', 'paul'));
    expect(refreshed.result.current.draft.content.program.phases[0].weeks).toHaveLength(2);
    expect(refreshed.result.current.editing).toBe(false);
    act(() => refreshed.result.current.resume());
    expect(refreshed.result.current.editing).toBe(true);
  });
  it('isolates profile and account changes, including stale callbacks', () => {
    const hook = renderHook(({ family, profile }) => useProgramDraft(family, profile), { initialProps: { family: 'f', profile: 'paul' } });
    act(() => hook.result.current.start(plan));
    const oldUpdate = hook.result.current.update;
    hook.rerender({ family: 'f', profile: 'xander' });
    expect(hook.result.current.draft).toBeNull();
    act(() => oldUpdate(plan));
    expect(localStorage.getItem(programDraftKey('f', 'xander'))).toBeNull();
    hook.rerender({ family: 'other', profile: 'paul' });
    expect(hook.result.current.draft).toBeNull();
    hook.rerender({ family: 'f', profile: 'paul' });
    expect(hook.result.current.draft.content.program.name).toBe('Future training');
    expect(hook.result.current.editing).toBe(false);
  });
  it('retains failed saves and prevents double submission while saving', async () => {
    const hook = renderHook(() => useProgramDraft('f', 'p'));
    act(() => hook.result.current.start(plan));
    await act(async () => { await expect(hook.result.current.save(async () => { throw new Error('Offline'); })).rejects.toThrow('Offline'); });
    expect(hook.result.current.draft.dirty).toBe(true);
    let finish;
    const save = vi.fn(() => new Promise(resolve => { finish = resolve; }));
    let pending;
    act(() => { pending = hook.result.current.save(save); });
    expect(hook.result.current.busy).toBe(true);
    await act(async () => { await hook.result.current.save(save); finish({ id: 'saved' }); await pending; });
    expect(save).toHaveBeenCalledOnce();
    expect(hook.result.current.draft.sourceProgram.id).toBe('saved');
    expect(hook.result.current.draft.dirty).toBe(false);
  });
  it('finishes a pending save only in the original profile draft', async () => {
    const hook = renderHook(({ profile }) => useProgramDraft('f', profile), { initialProps: { profile: 'paul' } });
    act(() => hook.result.current.start(plan));
    let finish, pending;
    act(() => { pending = hook.result.current.save(() => new Promise(resolve => { finish = resolve; })); });
    hook.rerender({ profile: 'xander' });
    act(() => hook.result.current.start({ ...plan, program: { ...plan.program, name: 'Xander' } }));
    act(() => hook.result.current.update({ ...plan, program: { ...plan.program, name: 'Xander edited' } }));
    await act(async () => { finish({ id: 'paul-program' }); await pending; });
    expect(hook.result.current.draft.content.program.name).toBe('Xander edited');
    expect(hook.result.current.draft.dirty).toBe(true);
    expect(readProgramDraft(localStorage, programDraftKey('f', 'paul')).sourceProgram.id).toBe('paul-program');
  });
  it('does not reopen the draft if the user leaves the builder during a save', async () => {
    const hook = renderHook(() => useProgramDraft('f', 'p'));
    act(() => hook.result.current.start(plan));
    let finish, pending;
    act(() => { pending = hook.result.current.save(() => new Promise(resolve => { finish = resolve; })); });
    act(() => hook.result.current.close());
    await act(async () => { finish({ id: 'saved' }); await pending; });
    expect(hook.result.current.editing).toBe(false);
    expect(hook.result.current.draft.dirty).toBe(false);
  });
  it('handles corrupt storage and keeps an in-memory draft if storage fails', () => {
    localStorage.setItem(programDraftKey('f', 'p'), '{bad');
    const hook = renderHook(() => useProgramDraft('f', 'p'));
    expect(hook.result.current.draft).toBeNull();
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota'); });
    act(() => hook.result.current.start(plan));
    expect(hook.result.current.draft).toEqual(createProgramDraft(plan));
    expect(hook.result.current.storageError).toContain('Save it to My Programs');
  });
});
