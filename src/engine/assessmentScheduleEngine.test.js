import { describe, expect, it } from "vitest";
import {
  addAssessmentDays,
  assessmentDaysBetween,
  buildAssessmentScheduleStatus,
  buildAssessmentScheduleStatuses,
  normaliseAssessmentSchedule,
} from "./assessmentScheduleEngine.js";

const schedule = {
  id: "s1",
  family_id: "f1",
  profile_id: "p1",
  assessment_template_id: "a1",
  start_date: "2026-09-21",
  cadence_days: 28,
  window_days: 7,
  workflow_config: { guidance: ["Keep conditions consistent."] },
  active: true,
};

function run(date, status = "completed", overrides = {}) {
  return {
    id: `${status}-${date}`,
    profile_id: "p1",
    assessment_template_id: "a1",
    date_ymd: date,
    status,
    started_at: `${date}T18:00:00Z`,
    ...overrides,
  };
}

describe("Assessment schedule date helpers", () => {
  it("uses stable UTC date arithmetic", () => {
    expect(addAssessmentDays("2026-09-21", 28)).toBe("2026-10-19");
    expect(assessmentDaysBetween("2026-09-21", "2026-09-27")).toBe(6);
  });

  it("normalises snake_case rows and clamps the due window to the cadence", () => {
    expect(normaliseAssessmentSchedule({ ...schedule, window_days: 40 })).toMatchObject({
      profileId: "p1",
      assessmentTemplateId: "a1",
      cadenceDays: 28,
      windowDays: 28,
      active: true,
    });
  });
});

describe("buildAssessmentScheduleStatus", () => {
  it("shows the first benchmark as upcoming before its start week", () => {
    const status = buildAssessmentScheduleStatus(schedule, [], "2026-09-09");
    expect(status.state).toBe("upcoming");
    expect(status.cycleStartYmd).toBe("2026-09-21");
    expect(status.cycleEndYmd).toBe("2026-09-27");
    expect(status.daysUntilCycle).toBe(12);
  });

  it("marks an uncompleted benchmark due throughout its configured week", () => {
    const status = buildAssessmentScheduleStatus(schedule, [], "2026-09-24");
    expect(status.state).toBe("due");
    expect(status.cycleStartYmd).toBe("2026-09-21");
    expect(status.cycleEndYmd).toBe("2026-09-27");
  });

  it("marks the current cycle overdue after the recommended window", () => {
    const status = buildAssessmentScheduleStatus(schedule, [], "2026-10-01");
    expect(status.state).toBe("overdue");
    expect(status.daysPastWindow).toBe(4);
  });

  it("treats a completed run anywhere before the next cycle as completing this cycle", () => {
    const status = buildAssessmentScheduleStatus(
      schedule,
      [run("2026-10-01")],
      "2026-10-01"
    );
    expect(status.state).toBe("completed");
    expect(status.completedRun.date_ymd).toBe("2026-10-01");
    expect(status.nextCycleStartYmd).toBe("2026-10-19");
  });

  it("starts a fresh independent cycle after 28 days", () => {
    const status = buildAssessmentScheduleStatus(
      schedule,
      [run("2026-09-24")],
      "2026-10-19"
    );
    expect(status.state).toBe("due");
    expect(status.cycleStartYmd).toBe("2026-10-19");
    expect(status.cycleEndYmd).toBe("2026-10-25");
  });

  it("prioritises a resumable in-progress run over due/completed messaging", () => {
    const status = buildAssessmentScheduleStatus(
      schedule,
      [run("2026-09-22", "completed"), run("2026-09-24", "in_progress")],
      "2026-09-24"
    );
    expect(status.state).toBe("in_progress");
    expect(status.inProgressRun.status).toBe("in_progress");
  });

  it("does not let another profile or Assessment satisfy this schedule", () => {
    const status = buildAssessmentScheduleStatus(
      schedule,
      [
        run("2026-09-23", "completed", { profile_id: "p2" }),
        run("2026-09-23", "completed", { assessment_template_id: "a2" }),
      ],
      "2026-09-23"
    );
    expect(status.state).toBe("due");
  });
});

describe("buildAssessmentScheduleStatuses", () => {
  it("orders resumable/overdue work ahead of upcoming or completed schedules", () => {
    const statuses = buildAssessmentScheduleStatuses({
      schedules: [
        schedule,
        { ...schedule, id: "s2", assessment_template_id: "a2", start_date: "2026-10-20" },
        { ...schedule, id: "s3", assessment_template_id: "a3", start_date: "2026-09-01", window_days: 3 },
      ],
      runs: [],
      todayYmd: "2026-09-24",
    });
    expect(statuses.map((item) => item.state)).toEqual([
      "overdue",
      "due",
      "upcoming",
    ]);
  });
});
