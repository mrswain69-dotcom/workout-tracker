import { describe, expect, it } from "vitest";
import {
  buildActivityCalendarDay,
  buildRecentActivityCalendarDays,
} from "./activityCalendarEngine.js";

describe("activityCalendarEngine", () => {
  it("uses the requested status priority and colours", () => {
    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-01",
      log: { meta: { streakSaved: true }, blocks: [{ typeId: "cardio", cancelled: true }] },
      completed: false,
    }).kind).toBe("streak-saver");

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-02",
      recoveryMode: "illness",
      completed: true,
    })).toMatchObject({ kind: "illness", icon: "✓", completed: true });

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-03",
      log: { blocks: [{ typeId: "strength", cancelled: true }, { typeId: "cardio", cancelled: true }] },
    }).kind).toBe("cancelled");

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-04",
      hasPlanSchedule: true,
      plannedBlocks: [],
    })).toMatchObject({ kind: "none", icon: "–", completed: false });

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-04",
      log: { blocks: [{ typeId: "recovery", recoveryDone: true }] },
      completed: true,
    })).toMatchObject({ kind: "rest", icon: "○", completed: true });

    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-05",
      plannedBlocks: [{ typeId: "strength" }],
      hasPlanSchedule: true,
      completed: true,
    }).kind).toBe("complete");
  });

  it("keeps empty or incomplete days colourless", () => {
    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-05",
      plannedBlocks: [{ typeId: "strength" }],
      hasPlanSchedule: true,
      completed: false,
    }).kind).toBe("none");
  });

  it('shows Xander’s recorded strength work as partial while a planned Session is unfinished', () => {
    const log = { blocks: [
      { typeId: 'strength', sets: { press: [{ reps: 12 }, { reps: 12 }] } },
      { typeId: 'strength', cancelled: true },
      { typeId: 'session', session: { movements: [{ name: 'Football skills' }] } },
      { typeId: 'tasks', tasksDone: {} },
    ] };
    expect(buildActivityCalendarDay({ dateYmd: '2026-10-12', log }))
      .toMatchObject({ kind: 'partial', icon: '◐', completed: false });
    expect(buildActivityCalendarDay({ log, completed: true }))
      .toMatchObject({ kind: 'complete', icon: '✓', completed: true });
  });

  it.each([
    { typeId: 'strength', sets: { squat: [{ timeSeconds: 30 }] } },
    { typeId: 'cardio', cardio: { durationMin: 15 } },
    { typeId: 'cardio', cardio: { distanceKm: 2 } },
    { typeId: 'duration', duration: { minutes: 8 } },
    { typeId: 'session', session: { movements: [{ completed: true }] } },
    { typeId: 'session', session: { actualDurationSec: 60 } },
  ])('recognises actual physical activity without promoting it to full completion: %j', (block) => {
    expect(buildActivityCalendarDay({ log: { blocks: [block] } }))
      .toMatchObject({ kind: 'partial', completed: false });
  });

  it.each([
    { blocks: [{ typeId: 'strength', sets: { squat: [{ reps: '', weight: 40 }, { reps: 0 }] } }] },
    { blocks: [{ typeId: 'session', session: { movements: [{ name: 'Planned skill' }] } }] },
    { blocks: [{ typeId: 'cardio', cardio: { durationMin: 0 } }] },
    { blocks: [{ typeId: 'strength', suspendedByRecoveryMode: true, sets: { squat: [{ reps: 12 }] } }] },
    { blocks: [{ typeId: 'tasks', tasksDone: { reading: true } }] },
    { meta: { badgeClaims: [{ xp: 500 }] }, blocks: [] },
    { blocks: [{ typeId: 'strength', cancelled: true, sets: { squat: [{ reps: 12 }] } }, { typeId: 'cardio' }] },
  ])('does not turn empty, excluded or reward-only logs green: %j', (log) => {
    expect(buildActivityCalendarDay({ log }).kind).toBe('none');
  });

  it('preserves special-day priority when activity has been recorded', () => {
    const log = { blocks: [{ typeId: 'strength', sets: { squat: [{ reps: 12 }] } }] };
    expect(buildActivityCalendarDay({ log, recoveryMode: 'illness' }).kind).toBe('illness');
    expect(buildActivityCalendarDay({ log: { ...log, meta: { streakSaved: true } } }).kind).toBe('streak-saver');
    expect(buildActivityCalendarDay({ log: { blocks: [{ ...log.blocks[0], cancelled: true }] } }).kind).toBe('cancelled');
  });

  it("builds an ordered history that always ends today", () => {
    const days = buildRecentActivityCalendarDays("2026-10-05", 7, (dateYmd) => ({ dateYmd }));
    expect(days).toHaveLength(7);
    expect(days[0].dateYmd).toBe("2026-09-29");
    expect(days.at(-1).dateYmd).toBe("2026-10-05");
  });

  it("shows recorded recovery blue even when it does not qualify as a completed streak day", () => {
    expect(buildActivityCalendarDay({
      dateYmd: "2026-10-04",
      log: { blocks: [{ typeId: "recovery", recoveryDone: true, recoveryMode: "light" }] },
      completed: false,
    })).toMatchObject({ kind: "rest", icon: "○", completed: false });
    expect(buildActivityCalendarDay({ log: { blocks: [{ typeId: "recovery" }] } }))
      .toMatchObject({ kind: "rest", icon: "○" });
    expect(buildActivityCalendarDay({ log: { blocks: [{ typeId: "recovery", cancelled: true }] } }).kind).toBe("cancelled");
    expect(buildActivityCalendarDay({ log: { blocks: [{ typeId: "recovery" }, { typeId: "strength" }] } }).kind).toBe("none");
  });
});
