import { supabase } from "./supabaseClient";

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function positiveInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function finiteNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

// -------- Assessment Library: templates --------
export async function listAssessmentTemplates(
  familyId,
  { includeArchived = false } = {}
) {
  let query = supabase
    .from("assessment_templates")
    .select("*")
    .eq("family_id", familyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createAssessmentTemplate(familyId, template = {}) {
  const { data, error } = await supabase
    .from("assessment_templates")
    .insert({
      family_id: familyId,
      name: template.name || "",
      category: template.category || "",
      description: template.description || "",
      version: positiveInt(template.version, 1),
      sort_order: finiteNumber(template.sortOrder, 0),
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateAssessmentTemplate(templateId, patch = {}) {
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.category !== undefined) payload.category = patch.category;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.version !== undefined) payload.version = positiveInt(patch.version, 1);
  if (patch.sortOrder !== undefined) payload.sort_order = finiteNumber(patch.sortOrder, 0);
  if (patch.archived !== undefined) payload.archived = !!patch.archived;

  const { data, error } = await supabase
    .from("assessment_templates")
    .update(payload)
    .eq("id", templateId)
    .select("*")
    .single();

  return { data, error };
}

export async function archiveAssessmentTemplate(templateId, archived = true) {
  return updateAssessmentTemplate(templateId, { archived });
}

// -------- Assessment Library: canonical Tests --------
export async function listTests(familyId, { includeArchived = false } = {}) {
  let query = supabase
    .from("tests")
    .select("*")
    .eq("family_id", familyId)
    .order("name", { ascending: true })
    .order("created_at", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createTest(familyId, test = {}) {
  const { data, error } = await supabase
    .from("tests")
    .insert({
      family_id: familyId,
      name: test.name || "",
      description: test.description || "",
      version: positiveInt(test.version, 1),
      metric_type: test.metricType || "numeric",
      unit: test.unit || "",
      scoring_direction: test.scoringDirection || "higher",
      attempt_count: positiveInt(test.attemptCount, 1),
      result_strategy: test.resultStrategy || "single",
      side_mode: test.sideMode || "none",
      allow_negative: !!test.allowNegative,
      pb_eligible: test.pbEligible !== false,
      metric_config: jsonObject(test.metricConfig),
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateTest(testId, patch = {}) {
  const payload = {};
  if (patch.name !== undefined) payload.name = patch.name;
  if (patch.description !== undefined) payload.description = patch.description;
  if (patch.version !== undefined) payload.version = positiveInt(patch.version, 1);
  if (patch.metricType !== undefined) payload.metric_type = patch.metricType;
  if (patch.unit !== undefined) payload.unit = patch.unit;
  if (patch.scoringDirection !== undefined) payload.scoring_direction = patch.scoringDirection;
  if (patch.attemptCount !== undefined) payload.attempt_count = positiveInt(patch.attemptCount, 1);
  if (patch.resultStrategy !== undefined) payload.result_strategy = patch.resultStrategy;
  if (patch.sideMode !== undefined) payload.side_mode = patch.sideMode;
  if (patch.allowNegative !== undefined) payload.allow_negative = !!patch.allowNegative;
  if (patch.pbEligible !== undefined) payload.pb_eligible = patch.pbEligible !== false;
  if (patch.metricConfig !== undefined) payload.metric_config = jsonObject(patch.metricConfig);
  if (patch.archived !== undefined) payload.archived = !!patch.archived;

  const { data, error } = await supabase
    .from("tests")
    .update(payload)
    .eq("id", testId)
    .select("*")
    .single();

  return { data, error };
}

export async function archiveTest(testId, archived = true) {
  return updateTest(testId, { archived });
}

// -------- Assessment Library: ordered Tests inside templates --------
export async function listAssessmentTemplateTests(
  familyId,
  { assessmentTemplateId = null, testId = null } = {}
) {
  let query = supabase
    .from("assessment_template_tests")
    .select("*")
    .eq("family_id", familyId)
    .order("assessment_template_id", { ascending: true })
    .order("position", { ascending: true });

  if (assessmentTemplateId) {
    query = query.eq("assessment_template_id", assessmentTemplateId);
  }
  if (testId) query = query.eq("test_id", testId);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createAssessmentTemplateTest(familyId, definition = {}) {
  const { data, error } = await supabase
    .from("assessment_template_tests")
    .insert({
      family_id: familyId,
      assessment_template_id: definition.assessmentTemplateId,
      test_id: definition.testId,
      position: positiveInt(definition.position, 1),
      section_label: definition.sectionLabel || "",
      display_label: definition.displayLabel || "",
      instructions: definition.instructions || "",
      protocol_text: definition.protocolText || "",
      config_override: jsonObject(definition.configOverride),
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateAssessmentTemplateTest(templateTestId, patch = {}) {
  const payload = {};
  if (patch.assessmentTemplateId !== undefined) {
    payload.assessment_template_id = patch.assessmentTemplateId;
  }
  if (patch.testId !== undefined) payload.test_id = patch.testId;
  if (patch.position !== undefined) payload.position = positiveInt(patch.position, 1);
  if (patch.sectionLabel !== undefined) payload.section_label = patch.sectionLabel;
  if (patch.displayLabel !== undefined) payload.display_label = patch.displayLabel;
  if (patch.instructions !== undefined) payload.instructions = patch.instructions;
  if (patch.protocolText !== undefined) payload.protocol_text = patch.protocolText;
  if (patch.configOverride !== undefined) {
    payload.config_override = jsonObject(patch.configOverride);
  }

  const { data, error } = await supabase
    .from("assessment_template_tests")
    .update(payload)
    .eq("id", templateTestId)
    .select("*")
    .single();

  return { data, error };
}

export async function deleteAssessmentTemplateTest(templateTestId) {
  const { error } = await supabase
    .from("assessment_template_tests")
    .delete()
    .eq("id", templateTestId);

  return { error };
}

// -------- Assessment Library: shared Development Tags --------
export async function listAssessmentDevelopmentTags(
  familyId,
  { includeArchived = false } = {}
) {
  let query = supabase
    .from("development_tags")
    .select("*")
    .eq("family_id", familyId)
    .order("name", { ascending: true });

  if (!includeArchived) query = query.eq("archived", false);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function listTestDevelopmentTags(
  familyId,
  { testId = null, developmentTagId = null } = {}
) {
  let query = supabase
    .from("test_development_tags")
    .select("*")
    .eq("family_id", familyId)
    .order("created_at", { ascending: true });

  if (testId) query = query.eq("test_id", testId);
  if (developmentTagId) query = query.eq("development_tag_id", developmentTagId);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function addTestDevelopmentTag(familyId, testId, developmentTagId) {
  const { data, error } = await supabase
    .from("test_development_tags")
    .upsert(
      {
        family_id: familyId,
        test_id: testId,
        development_tag_id: developmentTagId,
      },
      { onConflict: "test_id,development_tag_id" }
    )
    .select("*")
    .single();

  return { data, error };
}

export async function removeTestDevelopmentTag(testId, developmentTagId) {
  const { error } = await supabase
    .from("test_development_tags")
    .delete()
    .eq("test_id", testId)
    .eq("development_tag_id", developmentTagId);

  return { error };
}

// Definitions only. Historical Assessment runs/results are deliberately not
// part of the editable library and are handled by later Phase 2 stages.
export async function loadAssessmentLibrary(
  familyId,
  { includeArchived = false } = {}
) {
  const [
    templatesResult,
    testsResult,
    templateTestsResult,
    developmentTagsResult,
    testDevelopmentTagsResult,
  ] = await Promise.all([
    listAssessmentTemplates(familyId, { includeArchived }),
    listTests(familyId, { includeArchived }),
    listAssessmentTemplateTests(familyId),
    listAssessmentDevelopmentTags(familyId, { includeArchived }),
    listTestDevelopmentTags(familyId),
  ]);

  const error =
    templatesResult.error ||
    testsResult.error ||
    templateTestsResult.error ||
    developmentTagsResult.error ||
    testDevelopmentTagsResult.error ||
    null;

  return {
    data: {
      templates: templatesResult.data || [],
      tests: testsResult.data || [],
      templateTests: templateTestsResult.data || [],
      developmentTags: developmentTagsResult.data || [],
      testDevelopmentTags: testDevelopmentTagsResult.data || [],
    },
    error,
  };
}
