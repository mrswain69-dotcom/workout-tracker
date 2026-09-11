import { describe, expect, it } from "vitest";
import {
  buildConsistencyScheduleFromPlan,
  consistencyLogBlockCompletedOnDay,
  getCurrentConsistencyWeekWindow,
  getPreviousCompletedConsistencyWeekWindows,
  rankConsistencyRows,
  scoreConsistencyWindow,
  selectConsistencyScheduleSnapshot,
} from "./consistencyEngine.js";

const at = (ymd, hour = 12) => `${ymd}T${String(hour).padStart(2, "0")}:00:00.000Z`;

function strength(id, ymd) {
  return {
    id,
    typeId: "strength",
    loggedAt: at(ymd),
    sets: { move: [{ reps: 10, weight: 0 }] },
  };
}

function duration(id, ymd) {
  return {
    id,
    typeId: "duration",
    loggedAt: at(ymd),
    duration: { minutes: 20 },
  };
}

function recovery(id, ymd) {
  return { id, typeId: "recovery", loggedAt: at(ymd), recoveryDone: true };
}

function session(id, completedYmd) {
  return {
    id,
    typeId: "session",
    session: { completed: true, completedAt: at(completedYmd) },
  };
}

function snapshot(effectiveDate, schedule) {
  return { effective_date: effectiveDate, schedule_json: schedule };
}

const week = {
  startDate: "2026-09-07",
  endDate: "2026-09-13",
  complete: false,
};

describe("consistencyEngine", () => {
  it("uses Monday-Sunday windows and four completed history weeks", () => {
    expect(getCurrentConsistencyWeekWindow("2026-09-10")).toEqual({
      key: "2026-09-07",
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      complete: false,
    });
    expect(getPreviousCompletedConsistencyWeekWindows("2026-09-10", 4).map((item) => item.startDate)).toEqual([
      "2026-08-31",
      "2026-08-24",
      "2026-08-17",
      "2026-08-10",
    ]);
  });

  it("sanitises plans to performance/recovery blocks and excludes tasks", () => {
    expect(buildConsistencyScheduleFromPlan({
      blocksByWeekday: {
        Mon: [
          { id: "s", typeId: "strength", label: "Private label" },
          { id: "t", typeId: "tasks", tasks: [{ label: "Homework" }] },
        ],
        Sat: [{ id: "task-only", typeId: "tasks" }],
        Sun: [{ id: "r", typeId: "recovery" }],
      },
    })).toEqual({
      Mon: [{ id: "s", typeId: "strength" }],
      Tue: [], Wed: [], Thu: [], Fri: [], Sat: [],
      Sun: [{ id: "r", typeId: "recovery" }],
    });
  });

  it("selects the latest locked schedule effective on or before the day", () => {
    const oldSchedule = { Mon: [{ id: "a", typeId: "strength" }] };
    const newSchedule = { Mon: [{ id: "b", typeId: "strength" }] };
    const snapshots = [snapshot("2026-09-01", oldSchedule), snapshot("2026-09-11", newSchedule)];
    expect(selectConsistencyScheduleSnapshot(snapshots, "2026-09-10")).toEqual({
      effectiveDate: "2026-09-01",
      schedule: oldSchedule,
    });
    expect(selectConsistencyScheduleSnapshot(snapshots, "2026-09-11")).toEqual({
      effectiveDate: "2026-09-11",
      schedule: newSchedule,
    });
  });

  it("requires real same-day block evidence and ignores a Streak Saver", () => {
    expect(consistencyLogBlockCompletedOnDay(strength("s", "2026-09-07"), "2026-09-07")).toBe(true);
    expect(consistencyLogBlockCompletedOnDay(strength("s", "2026-09-08"), "2026-09-07")).toBe(false);

    const schedule = { Mon: [{ id: "s", typeId: "strength" }] };
    const result = scoreConsistencyWindow({
      window: week,
      referenceDate: "2026-09-07",
      scheduleSnapshots: [snapshot("2026-09-07", schedule)],
      logs: [{ date_ymd: "2026-09-07", log: { meta: { streakSaved: true }, blocks: [] } }],
    });
    expect(result.plannedDays).toBe(1);
    expect(result.completedDays).toBe(0);
    expect(result.consistencyPct).toBe(0);
  });

  it("requires every planned performance block on a multi-block day", () => {
    const schedule = {
      Mon: [
        { id: "s", typeId: "strength" },
        { id: "d", typeId: "duration" },
      ],
    };
    const result = scoreConsistencyWindow({
      window: week,
      referenceDate: "2026-09-07",
      scheduleSnapshots: [snapshot("2026-09-07", schedule)],
      logs: [{ date_ymd: "2026-09-07", log: { blocks: [strength("s", "2026-09-07")] } }],
    });
    expect(result.dayResults[0]).toMatchObject({ planned: true, completed: false, expectedBlocks: 2, completedBlocks: 1 });
    expect(result.consistencyPct).toBe(0);
  });

  it("counts task-only days as neither planned nor completed", () => {
    const schedule = { Mon: [], Tue: [] };
    const result = scoreConsistencyWindow({
      window: week,
      referenceDate: "2026-09-08",
      scheduleSnapshots: [snapshot("2026-09-07", schedule)],
      logs: [{
        date_ymd: "2026-09-08",
        log: { blocks: [{ id: "tasks", typeId: "tasks", tasksDone: { read: true } }] },
      }],
    });
    expect(result).toMatchObject({ available: true, reason: "no_planned_days", plannedDays: 0, completedDays: 0, consistencyPct: null });
  });

  it("counts planned recovery and structured Sessions only when completed on their planned date", () => {
    const schedule = {
      Mon: [{ id: "r", typeId: "recovery" }],
      Tue: [{ id: "session", typeId: "session" }],
    };
    const result = scoreConsistencyWindow({
      window: week,
      referenceDate: "2026-09-08",
      scheduleSnapshots: [snapshot("2026-09-07", schedule)],
      logs: [
        { date_ymd: "2026-09-07", log: { blocks: [recovery("r", "2026-09-07")] } },
        { date_ymd: "2026-09-08", log: { blocks: [session("session", "2026-09-09")] } },
      ],
    });
    expect(result).toMatchObject({ plannedDays: 2, completedDays: 1, consistencyPct: 50 });
  });

  it("scores only planned days that are due in the live week", () => {
    const schedule = {
      Mon: [{ id: "m", typeId: "strength" }],
      Thu: [{ id: "th", typeId: "duration" }],
      Fri: [{ id: "f", typeId: "strength" }],
    };
    const result = scoreConsistencyWindow({
      window: week,
      referenceDate: "2026-09-10",
      scheduleSnapshots: [snapshot("2026-09-07", schedule)],
      logs: [
        { date_ymd: "2026-09-07", log: { blocks: [strength("m", "2026-09-07")] } },
        { date_ymd: "2026-09-10", log: { blocks: [duration("th", "2026-09-10")] } },
      ],
    });
    expect(result.dueThrough).toBe("2026-09-10");
    expect(result).toMatchObject({ plannedDays: 2, completedDays: 2, consistencyPct: 100 });
  });

  it("respects Group/member eligibility start dates inside a week", () => {
    const schedule = {
      Mon: [{ id: "m", typeId: "strength" }],
      Thu: [{ id: "th", typeId: "duration" }],
    };
    const result = scoreConsistencyWindow({
      window: week,
      referenceDate: "2026-09-10",
      eligibleFrom: "2026-09-10",
      scheduleSnapshots: [snapshot("2026-09-07", schedule)],
      logs: [{ date_ymd: "2026-09-10", log: { blocks: [duration("th", "2026-09-10")] } }],
    });
    expect(result.eligibleFrom).toBe("2026-09-10");
    expect(result).toMatchObject({ plannedDays: 1, completedDays: 1, consistencyPct: 100 });
  });

  it("fails closed when the locked schedule is unavailable", () => {
    const result = scoreConsistencyWindow({
      window: week,
      referenceDate: "2026-09-10",
      scheduleSnapshots: [],
      logs: [],
    });
    expect(result).toMatchObject({ available: false, reason: "schedule_unavailable", consistencyPct: null });
  });

  it("ranks by percentage only, shares ties, and leaves no-plan rows unranked", () => {
    expect(rankConsistencyRows([
      { membership_id: "b", nickname: "Beta", plannedDays: 5, completedDays: 5, consistencyPct: 100 },
      { membership_id: "a", nickname: "Alpha", plannedDays: 2, completedDays: 2, consistencyPct: 100 },
      { membership_id: "c", nickname: "Charlie", plannedDays: 4, completedDays: 3, consistencyPct: 75 },
      { membership_id: "d", nickname: "Delta", plannedDays: 0, completedDays: 0, consistencyPct: null },
    ]).map((row) => [row.nickname, row.rank])).toEqual([
      ["Alpha", 1],
      ["Beta", 1],
      ["Charlie", 3],
      ["Delta", null],
    ]);
  });
});
