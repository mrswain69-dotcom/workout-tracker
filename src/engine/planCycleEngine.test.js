import { describe, expect, it } from "vitest";
import {
  addProgramAssessment,
  addProgramPhase,
  duplicateProgramWeek,
  ensurePlanProgram,
  extractShareablePlanContent,
  flattenProgramWeeks,
  getPlanProgramWeekIndex,
  normaliseProgramStartDate,
  planHasAnyCycleBlocks,
  prepareImportedPlanContent,
  removeProgramPhase,
  removeProgramWeek,
  resolvePlanForDate,
  setPlanProgramWeek,
  updatePlanProgramSettings,
} from "./planCycleEngine.js";

const blankDays = () => ({ Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] });
const legacy = () => ({
  version: 3,
  meta: { avatarId: "private-avatar", claimedRewards: ["reward-1"] },
  activityTypes: [{ id: "duration", kind: "custom" }],
  blocksByWeekday: { ...blankDays(), Mon: [{ id: "monday", typeId: "duration" }] },
});

describe("planCycleEngine Program model", () => {
  it("converts an existing weekly plan into a one-week Program without losing IDs", () => {
    const result = ensurePlanProgram(legacy(), { startDate: "2026-10-01" });
    expect(result.program.startDate).toBe("2026-09-28");
    expect(result.program.phases).toHaveLength(1);
    expect(result.program.phases[0].weeks[0].blocksByWeekday.Mon[0].id).toBe("monday");
    expect(result.meta.avatarId).toBe("private-avatar");
    expect(result.cycle).toBeUndefined();
  });

  it("migrates unfinished cycle documents into one phase", () => {
    const result = ensurePlanProgram({
      cycle: {
        name: "Two week plan",
        startDate: "2026-10-05",
        repeatMode: "hold",
        weeks: [
          { name: "Base", blocksByWeekday: blankDays() },
          { name: "Build", blocksByWeekday: blankDays() },
        ],
      },
    });
    expect(result.program.name).toBe("Two week plan");
    expect(result.program.completionMode).toBe("hold");
    expect(result.program.phases[0].weeks.map((week) => week.name)).toEqual(["Base", "Build"]);
  });

  it("normalises Program starts to Monday", () => {
    expect(normaliseProgramStartDate("2026-10-01")).toBe("2026-09-28");
    expect(normaliseProgramStartDate("2026-10-05")).toBe("2026-10-05");
  });

  it("resolves weeks across phase boundaries and repeating Programs", () => {
    let plan = ensurePlanProgram(legacy(), { startDate: "2026-10-05" });
    plan = addProgramPhase(plan, (prefix) => `${prefix}-second`);
    plan = setPlanProgramWeek(plan, 1, {
      blocksByWeekday: { ...blankDays(), Tue: [{ id: "phase-two", typeId: "cardio" }] },
    });
    expect(flattenProgramWeeks(plan)).toHaveLength(2);
    expect(getPlanProgramWeekIndex(plan, "2026-10-12").index).toBe(1);
    expect(resolvePlanForDate(plan, "2026-10-12").programResolution).toMatchObject({
      phaseIndex: 1,
      weekIndex: 1,
    });
    expect(resolvePlanForDate(plan, "2026-10-12").blocksByWeekday.Tue[0].id).toBe("phase-two");
    expect(getPlanProgramWeekIndex(plan, "2026-10-19")).toMatchObject({ index: 0, cycleNumber: 2 });
  });

  it("supports run-once and hold-final-week endings", () => {
    let plan = ensurePlanProgram(legacy(), { startDate: "2026-10-05" });
    plan = updatePlanProgramSettings(plan, { completionMode: "once" });
    expect(getPlanProgramWeekIndex(plan, "2026-10-12").status).toBe("finished");
    expect(resolvePlanForDate(plan, "2026-10-12").blocksByWeekday.Mon).toEqual([]);
    plan = updatePlanProgramSettings(plan, { completionMode: "hold" });
    expect(getPlanProgramWeekIndex(plan, "2026-10-12")).toMatchObject({ index: 0, status: "holding" });
  });

  it("supports optional phase assessment checkpoints", () => {
    let plan = ensurePlanProgram(legacy());
    plan = addProgramAssessment(plan, 0, {
      title: "Baseline mobility",
      timing: "before",
      assessmentTemplateId: "mobility-1",
      required: true,
    }, () => "assessment-new");
    expect(plan.program.phases[0].assessments[0]).toEqual({
      id: "assessment-new",
      title: "Baseline mobility",
      timing: "before",
      assessmentTemplateId: "mobility-1",
      required: true,
    });
  });

  it("duplicates a week with fresh block, movement, and task IDs", () => {
    const ids = ["block-new", "movement-new", "task-new", "week-new"];
    const plan = ensurePlanProgram({
      blocksByWeekday: {
        ...blankDays(),
        Mon: [{ id: "b1", typeId: "strength", movements: [{ id: "m1" }], tasks: [{ id: "t1" }] }],
      },
    });
    const duplicated = duplicateProgramWeek(plan, 0, () => ids.shift());
    const copy = duplicated.program.phases[0].weeks[1].blocksByWeekday.Mon[0];
    expect(copy.id).not.toBe("b1");
    expect(copy.movements[0].id).not.toBe("m1");
    expect(copy.tasks[0].id).not.toBe("t1");
  });

  it("never exports or imports another profile's private metadata", () => {
    const exported = extractShareablePlanContent(legacy());
    expect(exported.meta).toBeUndefined();
    const imported = prepareImportedPlanContent(exported, {
      startDate: "2026-10-05",
      existingMeta: { avatarId: "recipient-avatar", claimedRewards: ["mine"] },
      source: { programId: "program-1", version: 2 },
    });
    expect(imported.meta.avatarId).toBe("recipient-avatar");
    expect(imported.meta.claimedRewards).toEqual(["mine"]);
    expect(imported.meta.activeProgramSource).toEqual({ programId: "program-1", version: 2 });
    expect(imported.meta.activePlanSource).toBeUndefined();
  });

  it("adds and removes phases and weeks while keeping at least one week", () => {
    let plan = ensurePlanProgram({ blocksByWeekday: blankDays() });
    expect(planHasAnyCycleBlocks(plan)).toBe(false);
    plan = addProgramPhase(plan, (prefix) => `${prefix}-2`);
    plan = setPlanProgramWeek(plan, 1, {
      name: "Peak week",
      blocksByWeekday: { ...blankDays(), Fri: [{ id: "peak", typeId: "session" }] },
    });
    expect(planHasAnyCycleBlocks(plan)).toBe(true);
    plan = removeProgramWeek(plan, 0);
    expect(flattenProgramWeeks(plan)).toHaveLength(1);
    expect(flattenProgramWeeks(plan)[0].week.blocksByWeekday.Fri[0].id).toBe("peak");
    plan = removeProgramPhase(plan, 0);
    expect(plan.program.phases).toHaveLength(1);
  });
});
