import { describe, expect, it, vi } from "vitest";
import {
  activeAssessmentsUsingTest,
  assessmentDefinitionChanged,
  assessmentDefinitionFingerprint,
  getAssessmentDefinition,
  getTestDevelopmentTagIds,
  normaliseAssessmentLibrary,
  persistAssessmentDefinition,
  persistCanonicalTest,
  testDefinitionChanged,
  testDefinitionFingerprint,
  toEditorAssessmentTemplate,
  toEditorTemplateTest,
  toEditorTest,
  validatePersistableAssessmentDefinition,
  validatePersistableTest,
} from "./assessmentLibraryController.js";

function libraryFixture() {
  return {
    templates: [
      { id: "a2", name: "Speed Benchmark", sort_order: 2, version: 1 },
      { id: "a1", name: "Monthly Benchmark", sort_order: 1, version: 3 },
      { id: "a3", name: "Archived", sort_order: 3, version: 1, archived: true },
    ],
    tests: [
      {
        id: "test2",
        name: "Standing broad jump",
        metric_type: "numeric",
        unit: "cm",
        scoring_direction: "higher",
        attempt_count: 3,
        result_strategy: "best",
      },
      {
        id: "test1",
        name: "10 m acceleration",
        metric_type: "numeric",
        unit: "s",
        scoring_direction: "lower",
        attempt_count: 3,
        result_strategy: "best",
        metric_config: { decimalPlaces: 2, fixedDecimals: true },
      },
      {
        id: "test3",
        name: "Calf raises",
        metric_type: "numeric",
        unit: "reps",
        side_mode: "separate",
      },
    ],
    templateTests: [
      {
        id: "at2",
        assessment_template_id: "a1",
        test_id: "test2",
        position: 2,
        section_label: "Athletic",
        display_label: "Broad jump",
        protocol_text: "Best of three",
      },
      {
        id: "at1",
        assessment_template_id: "a1",
        test_id: "test1",
        position: 1,
        section_label: "Athletic",
        display_label: "10 m sprint",
      },
      {
        id: "at3",
        assessment_template_id: "a2",
        test_id: "test1",
        position: 1,
      },
      {
        id: "at4",
        assessment_template_id: "a3",
        test_id: "test1",
        position: 1,
      },
    ],
    developmentTags: [
      { id: "tag2", name: "Speed" },
      { id: "tag1", name: "Football" },
    ],
    testDevelopmentTags: [
      { family_id: "f1", test_id: "test1", development_tag_id: "tag2" },
      { family_id: "f1", test_id: "test1", development_tag_id: "tag1" },
    ],
  };
}

function assessmentDefinitionFixture() {
  return {
    template: {
      id: "a1",
      name: "Monthly Benchmark",
      category: "Football",
      description: "Athletic and technical benchmark",
      version: 3,
      sortOrder: 7,
    },
    templateTests: [
      {
        id: "at1",
        assessmentTemplateId: "a1",
        testId: "test1",
        position: 1,
        sectionLabel: "Athletic",
        displayLabel: "10 m sprint",
        instructions: "Three maximal efforts",
        protocolText: "Best of three",
        configOverride: {},
      },
      {
        id: "at2",
        assessmentTemplateId: "a1",
        testId: "test2",
        position: 2,
        sectionLabel: "Athletic",
        displayLabel: "Broad jump",
        instructions: "Stick the landing",
        protocolText: "Best of three",
        configOverride: {},
      },
    ],
  };
}

function testFixture() {
  return {
    id: "test1",
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
    metricConfig: { decimalPlaces: 2, fixedDecimals: true },
  };
}

function mockDb() {
  return {
    createAssessmentTemplate: vi.fn(async (_familyId, template) => ({
      data: { ...template, id: "new-assessment" },
      error: null,
    })),
    updateAssessmentTemplate: vi.fn(async (id, patch) => ({
      data: { id, ...patch },
      error: null,
    })),
    createAssessmentTemplateTest: vi.fn(async (_familyId, row) => ({
      data: { ...row, id: `new-row-${row.position}` },
      error: null,
    })),
    updateAssessmentTemplateTest: vi.fn(async (id, patch) => ({
      data: { id, ...patch },
      error: null,
    })),
    deleteAssessmentTemplateTest: vi.fn(async () => ({ error: null })),
    createTest: vi.fn(async (_familyId, test) => ({
      data: { ...test, id: "new-test" },
      error: null,
    })),
    updateTest: vi.fn(async (id, patch) => ({
      data: { id, ...patch },
      error: null,
    })),
    addTestDevelopmentTag: vi.fn(async (familyId, testId, developmentTagId) => ({
      data: { family_id: familyId, test_id: testId, development_tag_id: developmentTagId },
      error: null,
    })),
    removeTestDevelopmentTag: vi.fn(async () => ({ error: null })),
  };
}

describe("Assessment Library normalisation", () => {
  it("sorts templates, Tests, ordered membership and shared Development Tags", () => {
    const safe = normaliseAssessmentLibrary(libraryFixture());
    expect(safe.templates.map((item) => item.id)).toEqual(["a1", "a2", "a3"]);
    expect(safe.tests.map((item) => item.id)).toEqual(["test1", "test3", "test2"]);
    expect(safe.templateTests.filter((row) => row.assessment_template_id === "a1").map((row) => row.id)).toEqual(["at1", "at2"]);
    expect(safe.developmentTags.map((tag) => tag.id)).toEqual(["tag1", "tag2"]);
  });

  it("maps snake_case rows into the Assessment editor contracts", () => {
    expect(
      toEditorAssessmentTemplate({
        id: "a1",
        family_id: "f1",
        name: "Benchmark",
        sort_order: 4,
        version: 2,
      })
    ).toEqual(
      expect.objectContaining({
        id: "a1",
        familyId: "f1",
        name: "Benchmark",
        sortOrder: 4,
        version: 2,
      })
    );

    expect(
      toEditorTest({
        id: "test1",
        metric_type: "numeric",
        unit: "s",
        scoring_direction: "lower",
        attempt_count: 3,
        result_strategy: "best",
        side_mode: "none",
        metric_config: { decimalPlaces: 2 },
      })
    ).toEqual(
      expect.objectContaining({
        id: "test1",
        metricType: "numeric",
        unit: "s",
        scoringDirection: "lower",
        attemptCount: 3,
        resultStrategy: "best",
        sideMode: "none",
        metricConfig: expect.objectContaining({ decimalPlaces: 2 }),
      })
    );

    expect(
      toEditorTemplateTest({
        id: "at1",
        assessment_template_id: "a1",
        test_id: "test1",
        position: 2,
        section_label: "Athletic",
        protocol_text: "Best of three",
        config_override: { attemptCount: 2 },
      })
    ).toEqual(
      expect.objectContaining({
        assessmentTemplateId: "a1",
        testId: "test1",
        position: 2,
        sectionLabel: "Athletic",
        protocolText: "Best of three",
        configOverride: { attemptCount: 2 },
      })
    );
  });

  it("builds an editable Assessment definition in position order", () => {
    const definition = getAssessmentDefinition(libraryFixture(), "a1");
    expect(definition.template).toEqual(
      expect.objectContaining({ id: "a1", name: "Monthly Benchmark", version: 3 })
    );
    expect(definition.templateTests.map((row) => row.id)).toEqual(["at1", "at2"]);
  });

  it("returns exact shared Development Tag ids for a canonical Test", () => {
    expect(getTestDevelopmentTagIds(libraryFixture(), "test1")).toEqual(["tag1", "tag2"]);
  });

  it("reports only active Assessments using a canonical Test", () => {
    expect(activeAssessmentsUsingTest(libraryFixture(), "test1").map((item) => item.id)).toEqual(["a1", "a2"]);
  });
});

describe("Assessment definition fingerprints and validation", () => {
  it("ignores ids, version and library sort order but detects meaningful changes", () => {
    const original = assessmentDefinitionFixture();
    const cosmetic = {
      template: { ...original.template, id: "other", version: 99, sortOrder: 1 },
      templateTests: original.templateTests.map((row, index) => ({
        ...row,
        id: `other-${index}`,
      })),
    };
    expect(assessmentDefinitionFingerprint(cosmetic)).toBe(
      assessmentDefinitionFingerprint(original)
    );
    expect(assessmentDefinitionChanged(cosmetic, original)).toBe(false);

    const changed = {
      ...original,
      templateTests: original.templateTests.map((row, index) =>
        index === 0 ? { ...row, protocolText: "Average of three" } : row
      ),
    };
    expect(assessmentDefinitionChanged(changed, original)).toBe(true);
  });

  it("requires an Assessment name and at least one selected Test", () => {
    expect(
      validatePersistableAssessmentDefinition({
        template: { name: "" },
        templateTests: [{ testId: "" }],
      })
    ).toEqual(
      expect.objectContaining({
        valid: false,
        errors: [
          "Assessment name is required.",
          "Test 1 must select a library Test.",
        ],
      })
    );
  });

  it("normalises canonical Test fingerprints and validates metric rules", () => {
    const original = testFixture();
    expect(
      testDefinitionFingerprint({
        ...original,
        id: "different",
        version: 99,
        metric_config: original.metricConfig,
      })
    ).toBe(testDefinitionFingerprint(original));
    expect(testDefinitionChanged({ ...original, unit: "ms" }, original)).toBe(true);

    const validation = validatePersistableTest({
      name: "Receiving",
      metricType: "attempts_successes",
      resultStrategy: "average",
    });
    expect(validation.valid).toBe(false);
    expect(validation.errors[0]).toMatch(/cannot use the average result strategy/i);
  });
});

describe("persistAssessmentDefinition", () => {
  it("creates a new Assessment and its ordered Test rows at version 1", async () => {
    const db = mockDb();
    const saved = await persistAssessmentDefinition({
      familyId: "f1",
      definition: {
        template: { name: "Benchmark", category: "Football", version: 8 },
        templateTests: [
          { testId: "test1", position: 1, sectionLabel: "Athletic" },
          { testId: "test2", position: 2, sectionLabel: "Athletic" },
        ],
      },
      db,
    });

    expect(db.createAssessmentTemplate).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ name: "Benchmark", version: 1 })
    );
    expect(db.createAssessmentTemplateTest).toHaveBeenCalledTimes(2);
    expect(db.createAssessmentTemplateTest).toHaveBeenNthCalledWith(
      1,
      "f1",
      expect.objectContaining({ assessmentTemplateId: "new-assessment", testId: "test1", position: 1 })
    );
    expect(saved).toEqual(expect.objectContaining({ changed: true, created: true }));
  });

  it("does not write when an existing Assessment definition is unchanged", async () => {
    const db = mockDb();
    const original = assessmentDefinitionFixture();
    const saved = await persistAssessmentDefinition({
      familyId: "f1",
      definition: assessmentDefinitionFixture(),
      originalDefinition: original,
      db,
    });

    expect(saved.changed).toBe(false);
    expect(db.updateAssessmentTemplate).not.toHaveBeenCalled();
    expect(db.updateAssessmentTemplateTest).not.toHaveBeenCalled();
  });

  it("safely reorders retained rows, removes obsolete rows, adds new rows and bumps version once", async () => {
    const db = mockDb();
    const original = assessmentDefinitionFixture();
    const next = {
      template: { ...original.template, name: "Benchmark Plus" },
      templateTests: [
        { ...original.templateTests[1], position: 1 },
        { testId: "test3", position: 2, sectionLabel: "Athletic", displayLabel: "Calf raises" },
      ],
    };

    const saved = await persistAssessmentDefinition({
      familyId: "f1",
      definition: next,
      originalDefinition: original,
      db,
    });

    expect(db.updateAssessmentTemplateTest).toHaveBeenNthCalledWith(
      1,
      "at2",
      { position: 100001 }
    );
    expect(db.deleteAssessmentTemplateTest).toHaveBeenCalledWith("at1");
    expect(db.updateAssessmentTemplateTest).toHaveBeenCalledWith(
      "at2",
      expect.objectContaining({ position: 1, testId: "test2" })
    );
    expect(db.createAssessmentTemplateTest).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ assessmentTemplateId: "a1", testId: "test3", position: 2 })
    );
    expect(db.updateAssessmentTemplate).toHaveBeenCalledWith(
      "a1",
      expect.objectContaining({ name: "Benchmark Plus", version: 4 })
    );
    expect(saved).toEqual(expect.objectContaining({ changed: true, created: false }));
  });

  it("rejects retained membership rows that do not belong to the original definition", async () => {
    const db = mockDb();
    const original = assessmentDefinitionFixture();
    await expect(
      persistAssessmentDefinition({
        familyId: "f1",
        definition: {
          ...original,
          templateTests: [
            { ...original.templateTests[0], id: "foreign-row", displayLabel: "Changed" },
          ],
        },
        originalDefinition: original,
        db,
      })
    ).rejects.toThrow(/does not belong to this Assessment definition/);
    expect(db.updateAssessmentTemplateTest).not.toHaveBeenCalled();
  });
});

describe("persistCanonicalTest", () => {
  it("creates a canonical Test at version 1 and attaches exact Development Tags", async () => {
    const db = mockDb();
    const saved = await persistCanonicalTest({
      familyId: "f1",
      test: { ...testFixture(), id: "", version: 9 },
      developmentTagIds: ["tag2", "tag1", "tag2"],
      db,
    });

    expect(db.createTest).toHaveBeenCalledWith(
      "f1",
      expect.objectContaining({ name: "10 m acceleration", version: 1 })
    );
    expect(db.addTestDevelopmentTag).toHaveBeenCalledTimes(2);
    expect(db.addTestDevelopmentTag).toHaveBeenNthCalledWith(1, "f1", "new-test", "tag1");
    expect(db.addTestDevelopmentTag).toHaveBeenNthCalledWith(2, "f1", "new-test", "tag2");
    expect(saved.developmentTagIds).toEqual(["tag1", "tag2"]);
  });

  it("bumps Test version once for a definition edit and synchronises tag changes", async () => {
    const db = mockDb();
    const original = testFixture();
    const saved = await persistCanonicalTest({
      familyId: "f1",
      test: { ...original, description: "Standing start from timing gate" },
      originalTest: original,
      developmentTagIds: ["tag2", "tag3"],
      originalDevelopmentTagIds: ["tag1", "tag2"],
      db,
    });

    expect(db.updateTest).toHaveBeenCalledWith(
      "test1",
      expect.objectContaining({ version: 3, description: "Standing start from timing gate" })
    );
    expect(db.removeTestDevelopmentTag).toHaveBeenCalledWith("test1", "tag1");
    expect(db.addTestDevelopmentTag).toHaveBeenCalledWith("f1", "test1", "tag3");
    expect(saved).toEqual(
      expect.objectContaining({ changed: true, definitionChanged: true, tagsChanged: true })
    );
  });

  it("can edit only Development Tags without bumping the Test definition version", async () => {
    const db = mockDb();
    const original = testFixture();
    const saved = await persistCanonicalTest({
      familyId: "f1",
      test: testFixture(),
      originalTest: original,
      developmentTagIds: ["tag1", "tag2"],
      originalDevelopmentTagIds: ["tag1"],
      db,
    });

    expect(db.updateTest).not.toHaveBeenCalled();
    expect(db.addTestDevelopmentTag).toHaveBeenCalledWith("f1", "test1", "tag2");
    expect(saved).toEqual(
      expect.objectContaining({ changed: true, definitionChanged: false, tagsChanged: true })
    );
  });

  it("performs no writes when neither Test definition nor tag links changed", async () => {
    const db = mockDb();
    const saved = await persistCanonicalTest({
      familyId: "f1",
      test: testFixture(),
      originalTest: testFixture(),
      developmentTagIds: ["tag1"],
      originalDevelopmentTagIds: ["tag1"],
      db,
    });

    expect(saved.changed).toBe(false);
    expect(db.updateTest).not.toHaveBeenCalled();
    expect(db.addTestDevelopmentTag).not.toHaveBeenCalled();
    expect(db.removeTestDevelopmentTag).not.toHaveBeenCalled();
  });
});
