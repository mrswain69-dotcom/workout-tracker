import {
  normaliseAssessmentMetricDefinition,
  validateAssessmentMetricDefinition,
} from "../../engine/assessmentMetricEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function finiteInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

function stableObject(value) {
  if (Array.isArray(value)) return value.map(stableObject);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value)
    .sort()
    .reduce((out, key) => {
      out[key] = stableObject(value[key]);
      return out;
    }, {});
}

function uniqueTextIds(values = []) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => cleanText(value)).filter(Boolean))].sort();
}

export function emptyAssessmentLibrary() {
  return {
    templates: [],
    tests: [],
    templateTests: [],
    developmentTags: [],
    testDevelopmentTags: [],
  };
}

export function normaliseAssessmentLibrary(raw = {}) {
  const source = raw && typeof raw === "object" ? raw : {};

  const templates = (Array.isArray(source.templates) ? source.templates : [])
    .slice()
    .sort((a, b) => {
      const order =
        Number(valueOf(a, "sortOrder", "sort_order", 0)) -
        Number(valueOf(b, "sortOrder", "sort_order", 0));
      if (order) return order;
      return cleanText(a?.name).localeCompare(cleanText(b?.name));
    });

  const tests = (Array.isArray(source.tests) ? source.tests : [])
    .slice()
    .sort((a, b) => cleanText(a?.name).localeCompare(cleanText(b?.name)));

  const templateTests = (Array.isArray(source.templateTests) ? source.templateTests : [])
    .slice()
    .sort((a, b) => {
      const templateCompare = cleanText(
        valueOf(a, "assessmentTemplateId", "assessment_template_id")
      ).localeCompare(
        cleanText(valueOf(b, "assessmentTemplateId", "assessment_template_id"))
      );
      if (templateCompare) return templateCompare;
      return Number(a?.position || 0) - Number(b?.position || 0);
    });

  const developmentTags = (Array.isArray(source.developmentTags)
    ? source.developmentTags
    : []
  )
    .slice()
    .sort((a, b) => cleanText(a?.name).localeCompare(cleanText(b?.name)));

  const testDevelopmentTags = (Array.isArray(source.testDevelopmentTags)
    ? source.testDevelopmentTags
    : []
  )
    .slice()
    .sort((a, b) => {
      const testCompare = cleanText(valueOf(a, "testId", "test_id")).localeCompare(
        cleanText(valueOf(b, "testId", "test_id"))
      );
      if (testCompare) return testCompare;
      return cleanText(
        valueOf(a, "developmentTagId", "development_tag_id")
      ).localeCompare(
        cleanText(valueOf(b, "developmentTagId", "development_tag_id"))
      );
    });

  return {
    templates,
    tests,
    templateTests,
    developmentTags,
    testDevelopmentTags,
  };
}

export function toEditorAssessmentTemplate(row = {}) {
  return {
    id: cleanText(row.id, ""),
    familyId: cleanText(valueOf(row, "familyId", "family_id"), ""),
    name: cleanText(row.name, ""),
    category: cleanText(row.category, ""),
    description: cleanText(row.description, ""),
    version: Math.max(1, finiteInt(row.version, 1) || 1),
    sortOrder: Number(valueOf(row, "sortOrder", "sort_order", 0)) || 0,
    archived: !!row.archived,
  };
}

export function toEditorTest(row = {}) {
  const metric = normaliseAssessmentMetricDefinition(row);
  return {
    id: cleanText(row.id, ""),
    familyId: cleanText(valueOf(row, "familyId", "family_id"), ""),
    name: cleanText(row.name, ""),
    description: cleanText(row.description, ""),
    version: Math.max(1, finiteInt(row.version, 1) || 1),
    metricType: metric.metricType,
    unit: metric.unit,
    scoringDirection: metric.scoringDirection,
    attemptCount: metric.attemptCount,
    resultStrategy: metric.resultStrategy,
    sideMode: metric.sideMode,
    allowNegative: metric.allowNegative,
    pbEligible: metric.pbEligible,
    metricConfig: jsonObject(metric.metricConfig),
    archived: !!row.archived,
  };
}

export function toEditorTemplateTest(row = {}) {
  return {
    id: cleanText(row.id, ""),
    assessmentTemplateId: cleanText(
      valueOf(row, "assessmentTemplateId", "assessment_template_id"),
      ""
    ),
    testId: cleanText(valueOf(row, "testId", "test_id"), ""),
    position: Math.max(1, finiteInt(row.position, 1) || 1),
    sectionLabel: cleanText(valueOf(row, "sectionLabel", "section_label"), ""),
    displayLabel: cleanText(valueOf(row, "displayLabel", "display_label"), ""),
    instructions: cleanText(row.instructions, ""),
    protocolText: cleanText(valueOf(row, "protocolText", "protocol_text"), ""),
    configOverride: jsonObject(valueOf(row, "configOverride", "config_override", {})),
  };
}

export function getAssessmentDefinition(library, templateId) {
  const safe = normaliseAssessmentLibrary(library);
  const id = cleanText(templateId);
  const template = safe.templates.find((item) => cleanText(item.id) === id);
  if (!template) return null;

  return {
    template: toEditorAssessmentTemplate(template),
    templateTests: safe.templateTests
      .filter(
        (row) =>
          cleanText(
            valueOf(row, "assessmentTemplateId", "assessment_template_id")
          ) === id
      )
      .map(toEditorTemplateTest)
      .sort((a, b) => a.position - b.position),
  };
}

function assessmentDefinitionComparable(definition = {}) {
  const template = toEditorAssessmentTemplate(definition.template || {});
  const rows = (Array.isArray(definition.templateTests) ? definition.templateTests : [])
    .map(toEditorTemplateTest)
    .sort((a, b) => a.position - b.position)
    .map((row, index) => ({
      testId: row.testId,
      position: index + 1,
      sectionLabel: row.sectionLabel,
      displayLabel: row.displayLabel,
      instructions: row.instructions,
      protocolText: row.protocolText,
      configOverride: row.configOverride,
    }));

  return {
    template: {
      name: template.name,
      category: template.category,
      description: template.description,
    },
    templateTests: rows,
  };
}

export function assessmentDefinitionFingerprint(definition = {}) {
  return JSON.stringify(stableObject(assessmentDefinitionComparable(definition)));
}

export function assessmentDefinitionChanged(nextDefinition, originalDefinition) {
  if (!originalDefinition) return true;
  return (
    assessmentDefinitionFingerprint(nextDefinition) !==
    assessmentDefinitionFingerprint(originalDefinition)
  );
}

export function validatePersistableAssessmentDefinition(definition = {}) {
  const comparable = assessmentDefinitionComparable(definition);
  const errors = [];
  if (!comparable.template.name) errors.push("Assessment name is required.");
  if (!comparable.templateTests.length) errors.push("Add at least one Test.");
  comparable.templateTests.forEach((row, index) => {
    if (!row.testId) errors.push(`Test ${index + 1} must select a library Test.`);
  });
  return { valid: errors.length === 0, errors };
}

function testComparable(test = {}) {
  const editor = toEditorTest(test);
  return {
    name: editor.name,
    description: editor.description,
    metricType: editor.metricType,
    unit: editor.unit,
    scoringDirection: editor.scoringDirection,
    attemptCount: editor.attemptCount,
    resultStrategy: editor.resultStrategy,
    sideMode: editor.sideMode,
    allowNegative: editor.allowNegative,
    pbEligible: editor.pbEligible,
    metricConfig: editor.metricConfig,
  };
}

export function testDefinitionFingerprint(test = {}) {
  return JSON.stringify(stableObject(testComparable(test)));
}

export function testDefinitionChanged(nextTest, originalTest) {
  if (!originalTest) return true;
  return testDefinitionFingerprint(nextTest) !== testDefinitionFingerprint(originalTest);
}

export function validatePersistableTest(test = {}) {
  const editor = toEditorTest(test);
  const errors = [];
  if (!editor.name) errors.push("Test name is required.");
  const metricValidation = validateAssessmentMetricDefinition(editor);
  errors.push(...metricValidation.errors);
  return { valid: errors.length === 0, errors, test: editor };
}

export function getTestDevelopmentTagIds(library, testId) {
  const safe = normaliseAssessmentLibrary(library);
  const id = cleanText(testId);
  return uniqueTextIds(
    safe.testDevelopmentTags
      .filter((row) => cleanText(valueOf(row, "testId", "test_id")) === id)
      .map((row) => valueOf(row, "developmentTagId", "development_tag_id"))
  );
}

export function activeAssessmentsUsingTest(library, testId) {
  const safe = normaliseAssessmentLibrary(library);
  const activeTemplateIds = new Set(
    safe.templates
      .filter((template) => !template.archived)
      .map((template) => cleanText(template.id))
  );
  const usedTemplateIds = new Set(
    safe.templateTests
      .filter(
        (row) =>
          cleanText(valueOf(row, "testId", "test_id")) === cleanText(testId) &&
          activeTemplateIds.has(
            cleanText(
              valueOf(row, "assessmentTemplateId", "assessment_template_id")
            )
          )
      )
      .map((row) =>
        cleanText(valueOf(row, "assessmentTemplateId", "assessment_template_id"))
      )
  );
  return safe.templates.filter((template) => usedTemplateIds.has(cleanText(template.id)));
}

function errorFromResult(result, fallback) {
  if (result?.error) {
    const error =
      result.error instanceof Error
        ? result.error
        : new Error(result.error.message || String(result.error));
    error.message = `${fallback}: ${error.message}`;
    return error;
  }
  return null;
}

async function expectData(promise, fallback) {
  const result = await promise;
  const error = errorFromResult(result, fallback);
  if (error) throw error;
  if (!result?.data) throw new Error(`${fallback}: no row returned`);
  return result.data;
}

async function expectSuccess(promise, fallback) {
  const result = await promise;
  const error = errorFromResult(result, fallback);
  if (error) throw error;
  return result;
}

/**
 * Persist an Assessment Template and its ordered Test membership.
 * Existing rows are staged to temporary positions before reorder so the
 * unique(assessment_template_id, position) constraint cannot be violated.
 */
export async function persistAssessmentDefinition({
  familyId,
  definition,
  originalDefinition = null,
  db,
}) {
  if (!familyId) throw new Error("A family ID is required to save an Assessment.");
  if (!db) throw new Error("An Assessment Library DB API is required.");

  const validation = validatePersistableAssessmentDefinition(definition);
  if (!validation.valid) throw new Error(validation.errors.join(" "));

  const template = toEditorAssessmentTemplate(definition.template);
  const rows = (definition.templateTests || [])
    .map(toEditorTemplateTest)
    .sort((a, b) => a.position - b.position)
    .map((row, index) => ({ ...row, position: index + 1 }));

  const isExisting = !!template.id;
  const changed = assessmentDefinitionChanged(
    { template, templateTests: rows },
    originalDefinition
  );

  if (isExisting && !changed) {
    return { changed: false, template, templateTests: rows };
  }

  if (!isExisting) {
    const createdTemplate = await expectData(
      db.createAssessmentTemplate(familyId, { ...template, version: 1 }),
      "Could not create Assessment"
    );
    const templateId = cleanText(createdTemplate.id);
    const createdRows = [];

    for (const row of rows) {
      createdRows.push(
        await expectData(
          db.createAssessmentTemplateTest(familyId, {
            ...row,
            assessmentTemplateId: templateId,
          }),
          `Could not create Test ${row.position}`
        )
      );
    }

    return {
      changed: true,
      created: true,
      template: createdTemplate,
      templateTests: createdRows,
    };
  }

  const original = originalDefinition || { template, templateTests: [] };
  const originalRows = (original.templateTests || [])
    .map(toEditorTemplateTest)
    .sort((a, b) => a.position - b.position);
  const originalById = new Map(
    originalRows.filter((row) => row.id).map((row) => [row.id, row])
  );
  const desiredExistingIds = new Set(
    rows.filter((row) => row.id).map((row) => row.id)
  );

  for (const row of rows) {
    if (row.id && !originalById.has(row.id)) {
      throw new Error(`Test row ${row.id} does not belong to this Assessment definition.`);
    }
  }

  let stagedIndex = 0;
  for (const row of rows.filter((item) => item.id)) {
    stagedIndex += 1;
    await expectData(
      db.updateAssessmentTemplateTest(row.id, {
        position: 100000 + stagedIndex,
      }),
      `Could not stage Test ${row.position}`
    );
  }

  for (const oldRow of originalRows) {
    if (oldRow.id && !desiredExistingIds.has(oldRow.id)) {
      await expectSuccess(
        db.deleteAssessmentTemplateTest(oldRow.id),
        `Could not remove Test ${oldRow.position}`
      );
    }
  }

  const savedRows = [];
  for (const row of rows) {
    if (row.id) {
      savedRows.push(
        await expectData(
          db.updateAssessmentTemplateTest(row.id, {
            assessmentTemplateId: template.id,
            testId: row.testId,
            position: row.position,
            sectionLabel: row.sectionLabel,
            displayLabel: row.displayLabel,
            instructions: row.instructions,
            protocolText: row.protocolText,
            configOverride: row.configOverride,
          }),
          `Could not save Test ${row.position}`
        )
      );
    } else {
      savedRows.push(
        await expectData(
          db.createAssessmentTemplateTest(familyId, {
            ...row,
            assessmentTemplateId: template.id,
          }),
          `Could not create Test ${row.position}`
        )
      );
    }
  }

  const nextVersion = Math.max(1, Number(template.version) || 1) + 1;
  const savedTemplate = await expectData(
    db.updateAssessmentTemplate(template.id, {
      name: template.name,
      category: template.category,
      description: template.description,
      version: nextVersion,
    }),
    "Could not update Assessment"
  );

  return {
    changed: true,
    created: false,
    template: savedTemplate,
    templateTests: savedRows,
  };
}

async function syncTestDevelopmentTags({
  familyId,
  testId,
  desiredTagIds,
  originalTagIds,
  db,
}) {
  const desired = uniqueTextIds(desiredTagIds);
  const original = uniqueTextIds(originalTagIds);
  const desiredSet = new Set(desired);
  const originalSet = new Set(original);

  for (const tagId of original.filter((id) => !desiredSet.has(id))) {
    await expectSuccess(
      db.removeTestDevelopmentTag(testId, tagId),
      `Could not remove Development Tag ${tagId}`
    );
  }

  for (const tagId of desired.filter((id) => !originalSet.has(id))) {
    await expectData(
      db.addTestDevelopmentTag(familyId, testId, tagId),
      `Could not add Development Tag ${tagId}`
    );
  }

  return desired;
}

/**
 * Persist one canonical reusable Test plus its exact shared Development Tag
 * relationships. Test definition edits bump version once; tag-only edits do
 * not change the metric-definition version.
 */
export async function persistCanonicalTest({
  familyId,
  test,
  originalTest = null,
  developmentTagIds = [],
  originalDevelopmentTagIds = [],
  db,
}) {
  if (!familyId) throw new Error("A family ID is required to save a Test.");
  if (!db) throw new Error("An Assessment Library DB API is required.");

  const validation = validatePersistableTest(test);
  if (!validation.valid) throw new Error(validation.errors.join(" "));

  const editor = validation.test;
  const desiredTags = uniqueTextIds(developmentTagIds);
  const originalTags = uniqueTextIds(originalDevelopmentTagIds);
  const tagsChanged = JSON.stringify(desiredTags) !== JSON.stringify(originalTags);
  const definitionChanged = testDefinitionChanged(editor, originalTest);

  if (editor.id && !definitionChanged && !tagsChanged) {
    return {
      changed: false,
      definitionChanged: false,
      tagsChanged: false,
      test: editor,
      developmentTagIds: desiredTags,
    };
  }

  let savedTest;
  if (!editor.id) {
    savedTest = await expectData(
      db.createTest(familyId, { ...editor, version: 1 }),
      "Could not create Test"
    );
  } else if (definitionChanged) {
    savedTest = await expectData(
      db.updateTest(editor.id, {
        name: editor.name,
        description: editor.description,
        version: Math.max(1, Number(editor.version) || 1) + 1,
        metricType: editor.metricType,
        unit: editor.unit,
        scoringDirection: editor.scoringDirection,
        attemptCount: editor.attemptCount,
        resultStrategy: editor.resultStrategy,
        sideMode: editor.sideMode,
        allowNegative: editor.allowNegative,
        pbEligible: editor.pbEligible,
        metricConfig: editor.metricConfig,
      }),
      "Could not update Test"
    );
  } else {
    savedTest = editor;
  }

  const testId = cleanText(savedTest.id || editor.id);
  const savedTags = await syncTestDevelopmentTags({
    familyId,
    testId,
    desiredTagIds: desiredTags,
    originalTagIds: editor.id ? originalTags : [],
    db,
  });

  return {
    changed: true,
    created: !editor.id,
    definitionChanged: !editor.id || definitionChanged,
    tagsChanged,
    test: savedTest,
    developmentTagIds: savedTags,
  };
}
