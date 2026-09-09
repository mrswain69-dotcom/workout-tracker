import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./supabaseClient", () => ({
  supabase: { from: mock.from },
}));

import {
  createAssessmentSchedule,
  listAssessmentSchedules,
  updateAssessmentSchedule,
} from "./assessmentScheduleDb.js";

function mutationChain(resultData = { id: "schedule-1" }) {
  const result = { data: resultData, error: null };
  const chain = {
    insert: vi.fn(),
    update: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => result),
  };
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  return chain;
}

function listChain(data = []) {
  const chain = {
    data,
    error: null,
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  return chain;
}

beforeEach(() => mock.from.mockReset());

describe("Assessment schedule DB adapter", () => {
  it("reads active schedules scoped to family and profile", async () => {
    const chain = listChain([{ id: "s1" }]);
    mock.from.mockReturnValue(chain);

    const result = await listAssessmentSchedules("f1", { profileId: "p1" });

    expect(mock.from).toHaveBeenCalledWith("assessment_schedules");
    expect(chain.eq).toHaveBeenCalledWith("family_id", "f1");
    expect(chain.eq).toHaveBeenCalledWith("profile_id", "p1");
    expect(chain.eq).toHaveBeenCalledWith("active", true);
    expect(result.data).toEqual([{ id: "s1" }]);
  });

  it("maps the generic schedule contract into database columns", async () => {
    const chain = mutationChain();
    mock.from.mockReturnValue(chain);

    await createAssessmentSchedule("f1", {
      profileId: "p1",
      assessmentTemplateId: "a1",
      startDate: "2026-09-21",
      cadenceDays: 28,
      windowDays: 7,
      workflowConfig: { allowSplitAcrossDays: true },
    });

    expect(chain.insert).toHaveBeenCalledWith({
      family_id: "f1",
      profile_id: "p1",
      assessment_template_id: "a1",
      start_date: "2026-09-21",
      cadence_days: 28,
      window_days: 7,
      workflow_config: { allowSplitAcrossDays: true },
      active: true,
    });
  });

  it("soft-disables schedules instead of exposing a delete path", async () => {
    const chain = mutationChain();
    mock.from.mockReturnValue(chain);

    await updateAssessmentSchedule("s1", { active: false });

    expect(chain.update).toHaveBeenCalledWith({ active: false });
    expect(chain.eq).toHaveBeenCalledWith("id", "s1");
  });
});
