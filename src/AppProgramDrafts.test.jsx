// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import * as db from "./db.js";

vi.mock("./db.js", async (importOriginal) => {
  const original = await importOriginal();
  const block = { id: "strength", typeId: "strength", label: "Shoulders and Triceps", movements: [{ id: "press", name: "Shoulder Press", sets: 3, trackWeight: true, reps: "12" }] };
  const blocksByWeekday = Object.fromEntries(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => [day, [block]]));
  const plan = {
    version: 5,
    blocksByWeekday,
    program: {
      version: 1,
      name: "Test program",
      startDate: "2026-09-28",
      completionMode: "repeat",
      phases: [{ id: "phase", name: "Main phase", weeks: [{ id: "week", name: "Week 1", blocksByWeekday }] }],
    },
  };
  return {
    ...original,
    isSupabaseReady: () => true,
    getSession: async () => ({ session: { user: { id: "user" } } }),
    getOrCreateFamily: async () => ({ family: { id: "family", welcome_email_sent_at: "2026-10-01" } }),
    listProfiles: vi.fn(async () => ({ data: [{ id: "paul", name: "Paul", age_group: "adult" }] })),
    listProfileRecoveryPeriods: async () => ({ data: [] }),
    getProfilePlan: vi.fn(async () => ({ data: { plan_json: plan } })),
    listProfileStreakScheduleSnapshots: vi.fn(async () => ({ data: [] })),
    listLogs: vi.fn(async () => ({ data: [] })),
    getLog: vi.fn(async () => ({ data: null })),
    upsertProfilePlan: vi.fn(async () => ({ data: true })),
    upsertLog: vi.fn(async (_family, _profile, _date, log) => ({ data: { log_json: log } })),
  };
});

vi.mock('./programs/trainingProgramDb.js', async (original) => ({
  ...await original(),
  saveTrainingProgram: vi.fn(async () => ({ data: { program_id: 'saved', version_id: 'v1', version_no: 1 }, error: null })),
  listOwnedTrainingPrograms: vi.fn(async () => ({ data: [], error: null })),
}));
import { saveTrainingProgram } from './programs/trainingProgramDb.js';

beforeEach(() => {
  vi.clearAllMocks(); localStorage.clear(); sessionStorage.clear(); window.scrollTo = vi.fn();
  sessionStorage.setItem('wt_log_navigation_v1', JSON.stringify({ tab: 'log', date: '2026-10-01' }));
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
async function startDraft() {
  render(<App />);
  await screen.findByText('Shoulder Press');
  fireEvent.click(screen.getByRole('button', { name: 'Open Settings', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'Plan', exact: true }));
  fireEvent.click(screen.getByRole('button', { name: 'New blank Program' }));
  await screen.findByText('Draft programme');
}
describe('actual draft programme builder', () => {
  it('creates and edits weeks, phases and blocks without writing the active profile plan', async () => {
    await startDraft();
    expect(document.querySelector('input[type="date"]')).toBeNull();
    fireEvent.change(screen.getByPlaceholderText('e.g. Four-week pre-season'), { target: { value: 'Future season' } });
    fireEvent.blur(screen.getByPlaceholderText('e.g. Four-week pre-season'));
    fireEvent.click(screen.getByRole('button', { name: '+ Cardio block' }));
    fireEvent.click(screen.getByRole('button', { name: /Duplicate week/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Add phase' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save to My Programs' }));
    await screen.findByText('Saved to My Programs. Choose a start date when you apply the programme.');
    expect(saveTrainingProgram).toHaveBeenCalledOnce();
    const content = saveTrainingProgram.mock.calls[0][0].content;
    expect(content.program.name).toBe('Future season');
    expect(content.program.startDate).toBe('');
    expect(content.program.phases).toHaveLength(2);
    expect(content.program.phases[0].weeks).toHaveLength(2);
    expect(content.program.phases[0].weeks[0].blocksByWeekday.Mon[0].typeId).toBe('cardio');
    expect(content.meta).toBeUndefined();
    expect(db.upsertProfilePlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Back to active plan' }));
    expect(screen.getByPlaceholderText('e.g. Four-week pre-season').value).toBe('Test program');
    fireEvent.click(screen.getByRole('button', { name: 'Log', exact: true }));
    await screen.findByText('Shoulder Press');
    expect(db.upsertProfilePlan).not.toHaveBeenCalled();
  });
  it('keeps spaces and the caret while editing programme, phase and week text', async () => {
    await startDraft();
    const edits = [
      ['Programme name', 'Future season'],
      ['Current phase', 'Base phase'],
      ['Phase focus (optional)', 'Build strong habits'],
      ['Week name', 'Opening week'],
      ['Focus (optional)', 'Easy movement first'],
    ];
    for (const [label, text] of edits) {
      const input = screen.getByLabelText(label);
      fireEvent.focus(input);
      fireEvent.change(input, { target: { value: '' } });
      for (let i = 1; i <= text.length; i++) {
        fireEvent.change(input, { target: { value: text.slice(0, i) } });
        expect(input.value).toBe(text.slice(0, i));
      }
      input.setSelectionRange(2, 2);
      const modified = text.slice(0, 2) + 'X' + text.slice(2);
      fireEvent.change(input, { target: { value: modified, selectionStart: 3, selectionEnd: 3 } });
      expect(input.selectionStart).toBe(3);
      const twiceModified = modified.slice(0, 3) + 'Y' + modified.slice(3);
      fireEvent.change(input, { target: { value: twiceModified, selectionStart: 4, selectionEnd: 4 } });
      expect(input.value).toBe(twiceModified);
      expect(input.selectionStart).toBe(4);
      fireEvent.blur(input);
    }
    expect(db.upsertProfilePlan).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Save to My Programs' }));
    await screen.findByText('Saved to My Programs. Choose a start date when you apply the programme.');
    const content = saveTrainingProgram.mock.calls[0][0].content;
    expect(content.program.name).toBe('FuXYture season');
    expect(content.program.phases[0].name).toBe('BaXYse phase');
    expect(content.program.phases[0].focus).toBe('BuXYild strong habits');
    expect(content.program.phases[0].weeks[0].name).toBe('OpXYening week');
    expect(content.program.phases[0].weeks[0].focus).toBe('EaXYsy movement first');
  });
  it('buffers active plan typing until blur, then saves the complete name once', async () => {
    render(<App />);
    await screen.findByText('Shoulder Press');
    fireEvent.click(screen.getByRole('button', { name: 'Open Settings', exact: true }));
    fireEvent.click(screen.getByRole('button', { name: 'Plan', exact: true }));
    const input = screen.getByLabelText('Programme name');
    fireEvent.focus(input);
    for (const text of ['My', 'My ', 'My training', 'My training plan']) {
      fireEvent.change(input, { target: { value: text } });
      expect(input.value).toBe(text);
    }
    expect(db.upsertProfilePlan).not.toHaveBeenCalled();
    fireEvent.blur(input);
    await waitFor(() => expect(db.upsertProfilePlan).toHaveBeenCalledOnce());
    expect(db.upsertProfilePlan.mock.calls[0][2].program.name).toBe('My training plan');
  });
  it('commits block names, movements, multi-line notes and numeric targets on blur', async () => {
    await startDraft();
    fireEvent.click(screen.getByRole('button', { name: '+ Strength / HIIT / Box block' }));
    const name = screen.getByPlaceholderText('e.g. Upper body');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Upper body ' } });
    expect(name.value).toBe('Upper body ');
    fireEvent.change(name, { target: { value: 'Upper body strength' } });
    fireEvent.blur(name);
    fireEvent.click(screen.getByRole('button', { name: '+ Add movement' }));
    const movement = screen.getAllByPlaceholderText('e.g. Squats')[0];
    fireEvent.focus(movement);
    fireEvent.change(movement, { target: { value: 'Shoulder Press' } });
    fireEvent.blur(movement);
    const notes = screen.getByPlaceholderText('Optional notes, cues, or reminders…');
    fireEvent.focus(notes);
    fireEvent.change(notes, { target: { value: 'Move slowly\nKeep control' } });
    fireEvent.keyDown(notes, { key: 'Enter' });
    expect(notes.value).toBe('Move slowly\nKeep control');
    fireEvent.blur(notes);
    const sets = movement.closest('.movementRow').querySelector('input[type="number"]');
    fireEvent.focus(sets);
    fireEvent.change(sets, { target: { value: '' } });
    expect(sets.value).toBe('');
    fireEvent.change(sets, { target: { value: '12' } });
    fireEvent.blur(sets);
    fireEvent.click(screen.getByRole('button', { name: 'Save to My Programs' }));
    await screen.findByText('Saved to My Programs. Choose a start date when you apply the programme.');
    const block = saveTrainingProgram.mock.calls[0][0].content.program.phases[0].weeks[0].blocksByWeekday.Mon[0];
    expect(block.label).toBe('Upper body strength');
    expect(block.note).toBe('Move slowly\nKeep control');
    expect(block.movements[0].name).toBe('Shoulder Press');
    expect(block.movements[0].sets).toBe(12);
    expect(db.upsertProfilePlan).not.toHaveBeenCalled();
  });
  it('restores an unfinished draft after remount and keeps the active plan visible until resumed', async () => {
    await startDraft();
    fireEvent.change(screen.getByPlaceholderText('e.g. Four-week pre-season'), { target: { value: 'Later programme' } });
    fireEvent.blur(screen.getByPlaceholderText('e.g. Four-week pre-season'));
    cleanup();
    render(<App />);
    await screen.findByRole('button', { name: 'New blank Program' });
    await waitFor(() => expect(screen.getByPlaceholderText('e.g. Four-week pre-season').value).toBe('Test program'));
    fireEvent.click(screen.getByRole('button', { name: 'Resume draft' }));
    await screen.findByText('Draft programme');
    expect(screen.getByPlaceholderText('e.g. Four-week pre-season').value).toBe('Later programme');
    expect(db.upsertProfilePlan).not.toHaveBeenCalled();
  });
});
