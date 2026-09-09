import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ from: vi.fn() }));

vi.mock("./supabaseClient", () => ({
  supabase: { from: mock.from },
}));

import {
  createAssessmentRun,
  createAssessmentTestResult,
  getAssessmentRun,
  listAssessmentRuns,
  listAssessmentTestResults,
  updateAssessmentRun,
  updateAssessmentTestResult,
} from "./assessmentRunDb.js";

function mutationChain(resultData = { id: "row-1" }) {
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
    limit: vi.fn(),
  };
  chain.select.mockReturnValue(chain);
  chain.eq.mockReturnValue(chain);
  chain.order.mockReturnValue(chain);
  chain.limit.mockReturnValue(chain);
  return chain;
}

beforeEach(() => mock.from.mockReset());

describe("Assessment run DB adapters", () => {
  it("lists only requested family/profile/status history in newest-first order", async () => {
    const chain = listChain([{ id: "run-1" }]);
    mock.from.mockReturnValue(chain);

    const result = await listAssessmentRuns("f1", {
      profileId: "p1",
      assessmentTemplateId: "a1",
      status: "in_progress",
      limit: 25,
    });

    expect(result.data).toEqual([{ id: "run-1" }]);
    expect(mock.from).toHaveBeenCalledWith("assessment_runs");
    expect(chain.eq).toHaveBeenCalledWith("family_id", "f1");
    expect(chain.eq).toHaveBeenCalledWith("profile_id", "p1");
    expect(chain.eq).toHaveBeenCalledWith("assessment_template_id", "a1");
    expect(chain.eq).toHaveBeenCalledWith("status", "in_progress");
    expect(chain.order).toHaveBeenNthCalledWith(1, "date_ymd", { ascending: false });
    expect(chain.order).toHaveBeenNthCalledWith(2, "started_at", { ascending: false });
    expect(chain.limit).toHaveBeenCalledWith(25);
  });

  it("loads a run by both family and run identity", async () => {
    const chain = mutationChain({ id: "run-1" });
    mock.from.mockReturnValue(chain);
    await getAssessmentRun("f1", "run-1");
    expect(chain.eq).toHaveBeenNthCalledWith(1, "family_id", "f1");
    expect(chain.eq).toHaveBeenNthCalledWith(2, "id", "run-1");
  });

  it("creates an immutable run anchor with the Template snapshot", async () => {
    const chain = mutationChain({ id: "run-1" });
    mock.from.mockReturnValue(chain);
    const snapshot = { schemaVersion: 1, template: { id: "a1", version: 4 } };

    await createAssessmentRun("f1", {
      profileId: "p1",
      assessmentTemplateId: "a1",
      dateYmd: "2026-09-09",
      status: "in_progress",
      startedAt: "2026-09-09T18:00:00.000Z",
      templateVersion: 4,
      templateSnapshot: snapshot,
      notes: "Dry surface",
    });

    expect(chain.insert).toHaveBeenCalledWith({
      family_id: "f1",
      profile_id: "p1",
      assessment_template_id: "a1",
      date_ymd: "2026-09-09",
      status: "in_progress",
      started_at: "2026-09-09T18:00:00.000Z",
      completed_at: null,
      template_version: 4,
      template_snapshot: snapshot,
      notes: "Dry surface",
    });
  });

  it("only exposes status/completion/notes as run update fields", async () => {
    const chain = mutationChain({ id: "run-1" });
    mock.from.mockReturnValue(chain);
    await updateAssessmentRun("run-1", {
      status: "completed",
      completedAt: "2026-09-09T18:30:00.000Z",
      notes: "Complete",
      templateSnapshot: { should: "not update" },
      templateVersion: 99,
      profileId: "other-profile",
    });

    expect(chain.update).toHaveBeenCalledWith({
      status: "completed",
      completed_at: "2026-09-09T18:30:00.000Z",
      notes: "Complete",
    });
  });

  it("lists Test results by run or canonical Test", async () => {
    const chain = listChain([{ id: "result-1" }]);
    mock.from.mockReturnValue(chain);
    await listAssessmentTestResults("f1", {
      assessmentRunId: "run-1",
      testId: "test-1",
    });
    expect(mock.from).toHaveBeenCalledWith("assessment_test_results");
    expect(chain.eq).toHaveBeenCalledWith("family_id", "f1");
    expect(chain.eq).toHaveBeenCalledWith("assessment_run_id", "run-1");
    expect(chain.eq).toHaveBeenCalledWith("test_id", "test-1");
    expect(chain.order).toHaveBeenNthCalledWith(1, "assessment_run_id", { ascending: true });
    expect(chain.order).toHaveBeenNthCalledWith(2, "position", { ascending: true });
  });

  it("creates a historical Test row with frozen snapshots and raw/retained result objects", async () => {
    const chain = mutationChain({ id: "result-1" });
    mock.from.mockReturnValue(chain);
    await createAssessmentTestResult("f1", {
      assessmentRunId: "run-1",
      testId: "test-1",
      assessmentTemplateTestId: "row-1",
      position: 2,
      sectionLabelSnapshot: "Athletic",
      testNameSnapshot: "10m Sprint",
      metricSnapshot: { metricType: "time", unit: "s" },
      resultData: { overall: { attempts: [2.1, 2.04] } },
      retainedResult: { overall: 2.04 },
      comparableValue: 2.04,
      comparableDimensions: { overall: 2.04 },
      isValid: true,
      notes: "Good start",
    });

    expect(chain.insert).toHaveBeenCalledWith({
      family_id: "f1",
      assessment_run_id: "run-1",
      test_id: "test-1",
      assessment_template_test_id: "row-1",
      position: 2,
      section_label_snapshot: "Athletic",
      test_name_snapshot: "10m Sprint",
      metric_snapshot: { metricType: "time", unit: "s" },
      result_data: { overall: { attempts: [2.1, 2.04] } },
      retained_result: { overall: 2.04 },
      comparable_value: 2.04,
      comparable_dimensions: { overall: 2.04 },
      is_valid: true,
      notes: "Good start",
    });
  });

  it("updates only mutable Test result data and never historical identity snapshots", async () => {
    const chain = mutationChain({ id: "result-1" });
    mock.from.mockReturnValue(chain);
    await updateAssessmentTestResult("result-1", {
      resultData: { overall: { attempts: [2.0] } },
      retainedResult: { overall: 2 },
      comparableValue: 2,
      comparableDimensions: { overall: 2 },
      isValid: true,
      notes: "Corrected entry",
      testNameSnapshot: "Must not change",
      metricSnapshot: { must: "not change" },
      testId: "other-test",
    });

    expect(chain.update).toHaveBeenCalledWith({
      result_data: { overall: { attempts: [2.0] } },
      retained_result: { overall: 2 },
      comparable_value: 2,
      comparable_dimensions: { overall: 2 },
      is_valid: true,
      notes: "Corrected entry",
    });
  });
});
