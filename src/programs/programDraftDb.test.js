import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('./trainingProgramDb.js', () => ({ listOwnedTrainingPrograms: vi.fn(), saveTrainingProgram: vi.fn() }));
import { listOwnedTrainingPrograms, saveTrainingProgram } from './trainingProgramDb.js';
import { saveProgramDraft } from './programDraftDb.js';
import { createProgramDraft } from './programDrafts.js';
const plan = { activityTypes: [], meta: { xp: 100 }, program: { name: 'Next season', startDate: '2026-10-05', phases: [{ name: 'Build', weeks: [{ name: 'Week 1', blocksByWeekday: {} }] }] } };
beforeEach(() => { vi.clearAllMocks(); saveTrainingProgram.mockResolvedValue({ data: { program_id: 'p1', version_id: 'v2', version_no: 2 } }); });
describe('draft library persistence', () => {
  it('saves a new undated programme through the existing owner-checked API', async () => {
    const saved = await saveProgramDraft(createProgramDraft(plan), 'family', 'profile');
    expect(saved.id).toBe('p1');
    expect(listOwnedTrainingPrograms).not.toHaveBeenCalled();
    const args = saveTrainingProgram.mock.calls[0][0];
    expect(args).toMatchObject({ programId: null, familyId: 'family', creatorProfileId: 'profile', title: 'Next season' });
    expect(args.content.program.startDate).toBe('');
    expect(args.content.meta).toBeUndefined();
  });
  it('appends edited content while retaining latest catalogue metadata', async () => {
    const source = { id: 'p1', title: 'Preparation', current_version_id: 'v1', status: 'active' };
    listOwnedTrainingPrograms.mockResolvedValue({ data: [{ ...source, description: 'New description', sport: 'football', tags: ['skills'] }] });
    await saveProgramDraft(createProgramDraft(plan, source), 'family', 'profile');
    expect(saveTrainingProgram).toHaveBeenCalledWith(expect.objectContaining({ programId: 'p1', description: 'New description', sport: 'football', tags: ['skills'] }));
  });
  it('refuses a superseded or archived programme and propagates failures for retry', async () => {
    const source = { id: 'p1', current_version_id: 'v1' };
    listOwnedTrainingPrograms.mockResolvedValue({ data: [{ ...source, current_version_id: 'v2', status: 'active' }] });
    await expect(saveProgramDraft(createProgramDraft(plan, source), 'f', 'p')).rejects.toThrow('newer version');
    expect(saveTrainingProgram).not.toHaveBeenCalled();
    listOwnedTrainingPrograms.mockResolvedValue({ data: [{ ...source, status: 'archived' }] });
    await expect(saveProgramDraft(createProgramDraft(plan, source), 'f', 'p')).rejects.toThrow('no longer editable');
    saveTrainingProgram.mockResolvedValue({ error: new Error('Disconnected') });
    await expect(saveProgramDraft(createProgramDraft(plan), 'f', 'p')).rejects.toThrow('Disconnected');
  });
});
