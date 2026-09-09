import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("./supabaseClient", () => ({
  supabase: {
    from: mock.from,
  },
}));

import {
  addTestDevelopmentTag,
  createAssessmentTemplateTest,
  createTest,
  loadAssessmentLibrary,
  updateAssessmentTemplate,
} from "./assessmentDb.js";

function mutationChain(resultData = { id: "row-1" }) {
  const result = { data: resultData, error: null };
  const chain = {
    insert: vi.fn(),
    update: vi.fn(),
    upsert: vi.fn(),
    delete: vi.fn(),
    select: vi.fn(),
    eq: vi.fn(),
    single: vi.fn(async () => result),
  };
  chain.insert.mockReturnValue(chain);
  chain.update.mockReturnValue(chain);
  chain.upsert.mockReturnValue(chain);
  chain.delete.mockReturnValue(chain);
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

beforeEach(() => {
  mock.from.mockReset();
});

describe("Assessment DB write adapters", () => {
  it("maps canonical Test editor fields to the Stage 1 snake_case columns", async () => {
    const chain = mutationChain({ id: "test-1" });
    mock.from.mockReturnValue(chain);

    await createTest("family-1", {
      name: "10 m acceleration",
      description: "Standing start",
      version: 2,
      metricType: "numeric",
      unit: "s",
      scoringDirection: "lower",
      attemptCount: 3,
      resultStrategy: "best",
      sideMode: "none",
      allowNegative: false,
      pbEligible: true,
      metricConfig: { decimalPlaces: 2 },
    });

    expect(mock.from).toHaveBeenCalledWith("tests");
    expect(chain.insert).toHaveBeenCalledWith({
      family_id: "family-1",
      name: "10 m acceleration",
      description: "Standing start",
      version: 2,
      metric_type: "numeric",
      unit: "s",
      scoring_direction: "lower",
      attempt_count: 3,
      result_strategy: "best",
      side_mode: "none",
      allow_negative: false,
      pb_eligible: true,
      metric_config: { decimalPlaces: 2 },
    });
  });

  it("maps ordered Assessment membership including protocol and override config", async () => {
    const chain = mutationChain({ id: "membership-1" });
    mock.from.mockReturnValue(chain);

    await createAssessmentTemplateTest("family-1", {
      assessmentTemplateId: "assessment-1",
      testId: "test-1",
      position: 2,
      sectionLabel: "Athletic",
      displayLabel: "10 m sprint",
      instructions: "Three maximal efforts",
      protocolText: "Best of three",
      configOverride: { attemptCount: 2 },
    });

    expect(mock.from).toHaveBeenCalledWith("assessment_template_tests");
    expect(chain.insert).toHaveBeenCalledWith({
      family_id: "family-1",
      assessment_template_id: "assessment-1",
      test_id: "test-1",
      position: 2,
      section_label: "Athletic",
      display_label: "10 m sprint",
      instructions: "Three maximal efforts",
      protocol_text: "Best of three",
      config_override: { attemptCount: 2 },
    });
  });

  it("updates editable Assessment metadata without exposing an accidental delete path", async () => {
    const chain = mutationChain({ id: "assessment-1" });
    mock.from.mockReturnValue(chain);

    await updateAssessmentTemplate("assessment-1", {
      name: "Monthly Benchmark v2",
      version: 4,
      archived: true,
    });

    expect(chain.update).toHaveBeenCalledWith({
      name: "Monthly Benchmark v2",
      version: 4,
      archived: true,
    });
    expect(chain.eq).toHaveBeenCalledWith("id", "assessment-1");
  });

  it("upserts shared Test/Development-Tag links on the composite key", async () => {
    const chain = mutationChain({
      family_id: "family-1",
      test_id: "test-1",
      development_tag_id: "tag-1",
    });
    mock.from.mockReturnValue(chain);

    await addTestDevelopmentTag("family-1", "test-1", "tag-1");

    expect(mock.from).toHaveBeenCalledWith("test_development_tags");
    expect(chain.upsert).toHaveBeenCalledWith(
      {
        family_id: "family-1",
        test_id: "test-1",
        development_tag_id: "tag-1",
      },
      { onConflict: "test_id,development_tag_id" }
    );
  });
});

describe("loadAssessmentLibrary", () => {
  it("assembles only editable definitions and shared Development Tags", async () => {
    const tableData = {
      assessment_templates: [{ id: "assessment-1" }],
      tests: [{ id: "test-1" }],
      assessment_template_tests: [{ id: "membership-1" }],
      development_tags: [{ id: "tag-1" }],
      test_development_tags: [{ test_id: "test-1", development_tag_id: "tag-1" }],
    };

    mock.from.mockImplementation((table) => listChain(tableData[table] || []));

    const result = await loadAssessmentLibrary("family-1");

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      templates: [{ id: "assessment-1" }],
      tests: [{ id: "test-1" }],
      templateTests: [{ id: "membership-1" }],
      developmentTags: [{ id: "tag-1" }],
      testDevelopmentTags: [{ test_id: "test-1", development_tag_id: "tag-1" }],
    });
    expect(mock.from.mock.calls.map(([table]) => table)).toEqual([
      "assessment_templates",
      "tests",
      "assessment_template_tests",
      "development_tags",
      "test_development_tags",
    ]);
    expect(mock.from.mock.calls.map(([table]) => table)).not.toContain("assessment_runs");
    expect(mock.from.mock.calls.map(([table]) => table)).not.toContain("assessment_test_results");
  });
});
