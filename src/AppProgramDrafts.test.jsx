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
  it('restores an unfinished draft after remount and keeps the active plan visible until resumed', async () => {
    await startDraft();
    fireEvent.change(screen.getByPlaceholderText('e.g. Four-week pre-season'), { target: { value: 'Later programme' } });
    cleanup();
    render(<App />);
    await screen.findByRole('button', { name: 'New blank Program' });
    expect(screen.getByPlaceholderText('e.g. Four-week pre-season').value).toBe('Test program');
    fireEvent.click(screen.getByRole('button', { name: 'Resume draft' }));
    await screen.findByText('Draft programme');
    expect(screen.getByPlaceholderText('e.g. Four-week pre-season').value).toBe('Later programme');
    expect(db.upsertProfilePlan).not.toHaveBeenCalled();
  });
});
