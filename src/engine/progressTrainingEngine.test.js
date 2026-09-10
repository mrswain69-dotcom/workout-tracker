import { describe, expect, it } from "vitest";
import { buildSessionSnapshot } from "./sessionEngine.js";
import {
  buildMovementTotals,
  buildSessionBalance,
  buildTrainingProgress,
  buildTrainingProgressWindows,
  buildTrainingWindowSummary,
  countStructuredSessionDays,
  mondayWeekStartYmd,
  scopeProgressLogs,
  shiftProgressYmd,
} from "./progressTrainingEngine.js";

function makeLibrary() {
  return {
    programmes: [{ id: "programme-football", name: "Football Skills" }],
    movements: [
      { id: "movement-sole-rolls", name: "Sole Rolls" },
      { id: "movement-first-touch", name: "First Touch Through Gate" },
      { id: "movement-keepy-ups", name: "Weak-Foot Keepy-Uppys" },
    ],
    templates: [
      {
        id: "session-a",
        programme_id: "programme-football",
        display_code: "A",
        name: "Close Control",
        planned_duration_sec: 900,
        version: 1,
        sort_order: 1,
        archived: false,
      },
      {
        id: "session-b",
        programme_id: "programme-football",
        display_code: "B",
        name: "First Touch & Protection",
        planned_duration_sec: 900,
        version: 1,
        sort_order: 2,
        archived: false,
      },
      {
        id: "session-c",
        programme_id: "programme-football",
        display_code: "C",
        name: "Direction & Weak Foot",
        planned_duration_sec: 900,
        version: 1,
        sort_order: 3,
        archived: false,
      },
    ],
    templateMovements: [
      {
        id: "a-sole-rolls",
        session_template_id: "session-a",
        movement_id: "movement-sole-rolls",
        position: 1,
        display_label: "Sole Rolls",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: { countLabel: "clean reps", unit: "reps" },
      },
      {
        id: "b-first-touch",
        session_template_id: "session-b",
        movement_id: "movement-first-touch",
        position: 1,
        display_label: "First Touch Through Gate",
        planned_duration_sec: 150,
        tracking_method: "attempts_successes",
        tracking_config: { sideMode: "separate", unit: "attempts" },
      },
      {
        id: "c-keepy-ups",
        session_template_id: "session-c",
        movement_id: "movement-keepy-ups",
        position: 1,
        display_label: "Weak-Foot Keepy-Uppys",
        planned_duration_sec: 300,
        tracking_method: "best_score",
        tracking_config: { unit: "touches" },
      },
      {
        id: "c-sole-rolls",
        session_template_id: "session-c",
        movement_id: "movement-sole-rolls",
        position: 2,
        display_label: "Sole Rolls at Speed",
        planned_duration_sec: 150,
        tracking_method: "repetitions",
        tracking_config: { countLabel: "clean reps", unit: "reps" },
      },
    ],
  };
}

function snapshotFor(templateId, library = makeLibrary()) {
  const snapshot = buildSessionSnapshot(templateId, library);
  if (!snapshot) throw new Error(`Could not build ${templateId}`);
  return snapshot;
}

function makeSessionLog(date, session, profileId = "profile-wilf") {
  return {
    id: `${profileId}-${date}-${session.templateId}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          id: `block-${date}-${session.templateId}`,
          typeId: "session",
          session,
        },
      ],
    },
  };
}

function makeLegacyLog(date, profileId = "profile-wilf") {
  return {
    id: `legacy-${profileId}-${date}`,
    profile_id: profileId,
    date_ymd: date,
    log_json: {
      date_ymd: date,
      blocks: [
        {
          id: "legacy-strength",
          typeId: "strength",
          completed: true,
          movements: [{ name: "Squat", sets: [{ reps: 10 }] }],
        },
      ],
    },
  };
}

function complete(session, { actualDurationSec = null } = {}) {
  session.completed = true;
  if (actualDurationSec !== null) session.actualDurationSec = actualDurationSec;
  return session;
}

describe("Phase 3 Training Progress time windows", () => {
  it("uses Monday-Sunday, calendar month and an inclusive rolling 28-day window", () => {
    const windows = buildTrainingProgressWindows("2026-09-10");
    expect(windows.week).toMatchObject({
      startDate: "2026-09-07",
      endDate: "2026-09-13",
    });
    expect(windows.month).toMatchObject({
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    });
    expect(windows.recent28).toMatchObject({
      startDate: "2026-08-14",
      endDate: "2026-09-10",
      days: 28,
    });
  });

  it("keeps Sunday inside the Monday-based week", () => {
    expect(mondayWeekStartYmd("2026-09-13")).toBe("2026-09-07");
    expect(shiftProgressYmd("2026-09-13", 1)).toBe("2026-09-14");
  });
});

describe("profile scoping", () => {
  it("keeps only the selected athlete when a profile id is supplied", () => {
    const a = complete(snapshotFor("session-a"));
    const b = complete(snapshotFor("session-b"));
    const rows = [
      makeSessionLog("2026-09-08", a, "profile-wilf"),
      makeSessionLog("2026-09-08", b, "profile-xander"),
    ];

    expect(scopeProgressLogs(rows, "profile-wilf")).toHaveLength(1);
    expect(scopeProgressLogs(rows, "profile-xander")).toHaveLength(1);
    expect(scopeProgressLogs(rows, "profile-missing")).toHaveLength(0);
  });

  it("does not allow another athlete's Sessions to inflate Progress", () => {
    const wilf = complete(snapshotFor("session-a"));
    const xander = complete(snapshotFor("session-b"));
    const progress = buildTrainingProgress({
      logs: [
        makeSessionLog("2026-09-08", wilf, "profile-wilf"),
        makeSessionLog("2026-09-09", xander, "profile-xander"),
      ],
      profileId: "profile-wilf",
      sessionTemplates: makeLibrary().templates,
      selectedDate: "2026-09-10",
    });

    expect(progress.week.completedSessions).toBe(1);
    expect(progress.sessionBalance.find((row) => row.templateId === "session-a")?.count).toBe(1);
    expect(progress.sessionBalance.find((row) => row.templateId === "session-b")?.count).toBe(0);
  });
});

describe("Training Progress empty and early history", () => {
  it("returns deliberate zero state while retaining zero-count active Session balance", () => {
    const library = makeLibrary();
    const progress = buildTrainingProgress({
      logs: [],
      profileId: "profile-wilf",
      sessionTemplates: library.templates,
      selectedDate: "2026-09-10",
    });

    expect(progress.hasStructuredSessionHistory).toBe(false);
    expect(progress.week.completedSessions).toBe(0);
    expect(progress.month.completedSessions).toBe(0);
    expect(progress.lifetime.totalMinutes).toBe(0);
    expect(progress.movementTotals).toEqual([]);
    expect(progress.sessionBalance.map((row) => [row.displayCode, row.count])).toEqual([
      ["A", 0],
      ["B", 0],
      ["C", 0],
    ]);
  });

  it("does not reclassify a legacy workout as a structured Session", () => {
    const progress = buildTrainingProgress({
      logs: [makeLegacyLog("2026-09-08")],
      profileId: "profile-wilf",
      sessionTemplates: makeLibrary().templates,
      selectedDate: "2026-09-10",
    });

    expect(progress.hasStructuredSessionHistory).toBe(false);
    expect(progress.week.completedSessions).toBe(0);
    expect(progress.week.recordedExecutions).toBe(0);
  });
});

describe("Session completion, partial activity and time", () => {
  it("keeps completed Sessions separate from partial Sessions", () => {
    const completed = complete(snapshotFor("session-a"));
    const partial = snapshotFor("session-b");
    partial.actualDurationSec = 300;
    partial.movements[0].result = {
      left: { attempts: 5, successes: 4 },
      right: { attempts: 5, successes: 3 },
    };

    const summary = buildTrainingWindowSummary(
      [
        makeSessionLog("2026-09-08", completed),
        makeSessionLog("2026-09-09", partial),
      ],
      { startDate: "2026-09-07", endDate: "2026-09-13" }
    );

    expect(summary.completedSessions).toBe(1);
    expect(summary.partialSessions).toBe(1);
    expect(summary.activeSessionDays).toBe(2);
    expect(summary.completedSessionDays).toBe(1);
    expect(summary.totalMinutes).toBe(20);
  });

  it("uses the planned duration fallback only for completed Sessions", () => {
    const completed = complete(snapshotFor("session-a"));
    const partial = snapshotFor("session-b");
    partial.movements[0].completed = true;

    const summary = buildTrainingWindowSummary([
      makeSessionLog("2026-09-08", completed),
      makeSessionLog("2026-09-09", partial),
    ]);

    expect(summary.totalMinutes).toBe(15);
    expect(summary.completedSessions).toBe(1);
    expect(summary.partialSessions).toBe(1);
  });

  it("counts a date once even when two Sessions are completed on it", () => {
    const a = complete(snapshotFor("session-a"));
    const b = complete(snapshotFor("session-b"));
    const row = makeSessionLog("2026-09-08", a);
    row.log_json.blocks.push({
      id: "second-session",
      typeId: "session",
      session: b,
    });

    const logs = [row];
    expect(countStructuredSessionDays(logs)).toBe(1);
    expect(buildTrainingWindowSummary(logs).completedSessions).toBe(2);
  });
});

describe("week and month boundaries", () => {
  it("does not leak Sessions across adjacent week boundaries", () => {
    const before = complete(snapshotFor("session-a"));
    const monday = complete(snapshotFor("session-a"));
    const sunday = complete(snapshotFor("session-b"));
    const after = complete(snapshotFor("session-c"));

    const progress = buildTrainingProgress({
      logs: [
        makeSessionLog("2026-09-06", before),
        makeSessionLog("2026-09-07", monday),
        makeSessionLog("2026-09-13", sunday),
        makeSessionLog("2026-09-14", after),
      ],
      profileId: "profile-wilf",
      sessionTemplates: makeLibrary().templates,
      selectedDate: "2026-09-10",
    });

    expect(progress.week.completedSessions).toBe(2);
    expect(progress.month.completedSessions).toBe(4);
  });

  it("uses the current calendar month rather than a rolling month", () => {
    const august = complete(snapshotFor("session-a"));
    const september = complete(snapshotFor("session-b"));
    const progress = buildTrainingProgress({
      logs: [
        makeSessionLog("2026-08-31", august),
        makeSessionLog("2026-09-01", september),
      ],
      profileId: "profile-wilf",
      sessionTemplates: makeLibrary().templates,
      selectedDate: "2026-09-10",
    });

    expect(progress.month.completedSessions).toBe(1);
    expect(progress.lifetime.completedSessions).toBe(2);
  });
});

describe("recorded executions and accuracy", () => {
  it("sums explicit repetitions and keeps attempts/successes visible separately", () => {
    const reps = complete(snapshotFor("session-a"));
    reps.movements[0].completed = true;
    reps.movements[0].result = { overall: { count: 40 } };

    const accuracy = complete(snapshotFor("session-b"));
    accuracy.movements[0].completed = true;
    accuracy.movements[0].result = {
      left: { attempts: 5, successes: 4 },
      right: { attempts: 5, successes: 3 },
    };

    const summary = buildTrainingWindowSummary([
      makeSessionLog("2026-09-08", reps),
      makeSessionLog("2026-09-09", accuracy),
    ]);

    expect(summary.recordedExecutions).toBe(47);
    expect(summary.attempts).toBe(10);
    expect(summary.successes).toBe(7);
    expect(summary.accuracyPct).toBe(70);
  });

  it("does not invent execution volume for completion-only detail", () => {
    const session = complete(snapshotFor("session-a"));
    session.movements[0].completed = true;
    session.movements[0].result = null;

    const summary = buildTrainingWindowSummary([
      makeSessionLog("2026-09-08", session),
    ]);

    expect(summary.completedSessions).toBe(1);
    expect(summary.recordedExecutions).toBe(0);
  });
});

describe("Session Balance", () => {
  it("counts only completed Sessions and keeps unperformed active templates at zero", () => {
    const a = complete(snapshotFor("session-a"));
    const partialB = snapshotFor("session-b");
    partialB.actualDurationSec = 120;

    const balance = buildSessionBalance(
      [
        makeSessionLog("2026-09-08", a),
        makeSessionLog("2026-09-09", partialB),
      ],
      makeLibrary().templates,
      { startDate: "2026-08-14", endDate: "2026-09-10" }
    );

    expect(balance.map((row) => [row.displayCode, row.count])).toEqual([
      ["A", 1],
      ["B", 0],
      ["C", 0],
    ]);
  });

  it("retains completed historical template identity after the live template disappears", () => {
    const historical = complete(snapshotFor("session-c"));
    const liveTemplates = makeLibrary().templates.filter((row) => row.id !== "session-c");
    const balance = buildSessionBalance(
      [makeSessionLog("2026-09-08", historical)],
      liveTemplates,
      { startDate: "2026-08-14", endDate: "2026-09-10" }
    );

    const c = balance.find((row) => row.templateId === "session-c");
    expect(c).toMatchObject({
      displayCode: "C",
      name: "Direction & Weak Foot",
      count: 1,
      active: false,
      historicalOnly: true,
    });
  });

  it("uses the exact rolling 28-day range in the combined Progress model", () => {
    const tooOld = complete(snapshotFor("session-a"));
    const firstDay = complete(snapshotFor("session-b"));
    const lastDay = complete(snapshotFor("session-c"));

    const progress = buildTrainingProgress({
      logs: [
        makeSessionLog("2026-08-13", tooOld),
        makeSessionLog("2026-08-14", firstDay),
        makeSessionLog("2026-09-10", lastDay),
      ],
      profileId: "profile-wilf",
      sessionTemplates: makeLibrary().templates,
      selectedDate: "2026-09-10",
    });

    expect(progress.sessionBalance.map((row) => [row.displayCode, row.count])).toEqual([
      ["A", 0],
      ["B", 1],
      ["C", 1],
    ]);
  });
});

describe("Movement totals", () => {
  it("groups repeated practice by canonical Movement identity across Sessions", () => {
    const a = complete(snapshotFor("session-a"));
    a.movements[0].completed = true;
    a.movements[0].result = { overall: { count: 30 } };

    const c = complete(snapshotFor("session-c"));
    const soleRolls = c.movements.find(
      (movement) => movement.movementId === "movement-sole-rolls"
    );
    soleRolls.completed = true;
    soleRolls.result = { overall: { count: 20 } };

    const totals = buildMovementTotals([
      makeSessionLog("2026-09-08", a),
      makeSessionLog("2026-09-09", c),
    ]);

    const row = totals.find((item) => item.movementId === "movement-sole-rolls");
    expect(row).toMatchObject({
      timesPerformed: 2,
      recordedExecutions: 50,
      lastPerformedDate: "2026-09-09",
    });
    expect(row.measures.executions).toEqual({ kind: "executions", value: 50 });
    expect(row.measures.accuracy).toBeNull();
  });

  it("keeps executions, accuracy and best-score measurements in separate buckets", () => {
    const reps = complete(snapshotFor("session-a"));
    reps.movements[0].completed = true;
    reps.movements[0].result = { overall: { count: 25 } };

    const attempts = complete(snapshotFor("session-b"));
    attempts.movements[0].completed = true;
    attempts.movements[0].result = {
      left: { attempts: 5, successes: 5 },
      right: { attempts: 5, successes: 3 },
    };

    const best = complete(snapshotFor("session-c"));
    best.movements[0].completed = true;
    best.movements[0].result = { overall: { best: 18 } };

    const totals = buildMovementTotals([
      makeSessionLog("2026-09-08", reps),
      makeSessionLog("2026-09-09", attempts),
      makeSessionLog("2026-09-10", best),
    ]);

    expect(
      totals.find((row) => row.movementId === "movement-sole-rolls")?.measures.executions
    ).toEqual({ kind: "executions", value: 25 });

    expect(
      totals.find((row) => row.movementId === "movement-first-touch")?.measures.accuracy
    ).toEqual({
      kind: "attempts_successes",
      attempts: 10,
      successes: 8,
      percentage: 80,
    });

    expect(
      totals.find((row) => row.movementId === "movement-keepy-ups")?.measures.bestScore
    ).toEqual({ kind: "best_score", value: 18 });
  });
});
