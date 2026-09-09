import { supabase } from "./supabaseClient";

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function positiveInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function finiteOrNull(value) {
  if (value === "" || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export async function listAssessmentRuns(
  familyId,
  {
    profileId = null,
    assessmentTemplateId = null,
    status = null,
    limit = 100,
  } = {}
) {
  let query = supabase
    .from("assessment_runs")
    .select("*")
    .eq("family_id", familyId)
    .order("date_ymd", { ascending: false })
    .order("started_at", { ascending: false })
    .limit(Math.max(1, Math.min(500, Number(limit) || 100)));

  if (profileId) query = query.eq("profile_id", profileId);
  if (assessmentTemplateId) {
    query = query.eq("assessment_template_id", assessmentTemplateId);
  }
  if (status) query = query.eq("status", status);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function getAssessmentRun(familyId, runId) {
  const { data, error } = await supabase
    .from("assessment_runs")
    .select("*")
    .eq("family_id", familyId)
    .eq("id", runId)
    .single();

  return { data, error };
}

export async function createAssessmentRun(familyId, run = {}) {
  const { data, error } = await supabase
    .from("assessment_runs")
    .insert({
      family_id: familyId,
      profile_id: run.profileId,
      assessment_template_id: run.assessmentTemplateId,
      date_ymd: run.dateYmd,
      status: run.status || "in_progress",
      started_at: run.startedAt || new Date().toISOString(),
      completed_at: run.completedAt || null,
      template_version: positiveInt(run.templateVersion, 1),
      template_snapshot: jsonObject(run.templateSnapshot),
      notes: run.notes || "",
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateAssessmentRun(runId, patch = {}) {
  const payload = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.completedAt !== undefined) payload.completed_at = patch.completedAt;
  if (patch.notes !== undefined) payload.notes = patch.notes || "";

  const { data, error } = await supabase
    .from("assessment_runs")
    .update(payload)
    .eq("id", runId)
    .select("*")
    .single();

  return { data, error };
}

export async function listAssessmentTestResults(
  familyId,
  { assessmentRunId = null, testId = null } = {}
) {
  let query = supabase
    .from("assessment_test_results")
    .select("*")
    .eq("family_id", familyId)
    .order("assessment_run_id", { ascending: true })
    .order("position", { ascending: true });

  if (assessmentRunId) query = query.eq("assessment_run_id", assessmentRunId);
  if (testId) query = query.eq("test_id", testId);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createAssessmentTestResult(familyId, result = {}) {
  const { data, error } = await supabase
    .from("assessment_test_results")
    .insert({
      family_id: familyId,
      assessment_run_id: result.assessmentRunId,
      test_id: result.testId,
      assessment_template_test_id: result.assessmentTemplateTestId || null,
      position: positiveInt(result.position, 1),
      section_label_snapshot: result.sectionLabelSnapshot || "",
      test_name_snapshot: result.testNameSnapshot || "",
      metric_snapshot: jsonObject(result.metricSnapshot),
      result_data: jsonObject(result.resultData),
      retained_result: jsonObject(result.retainedResult),
      comparable_value: finiteOrNull(result.comparableValue),
      comparable_dimensions: jsonObject(result.comparableDimensions),
      is_valid: !!result.isValid,
      notes: result.notes || "",
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateAssessmentTestResult(resultId, patch = {}) {
  const payload = {};
  if (patch.resultData !== undefined) payload.result_data = jsonObject(patch.resultData);
  if (patch.retainedResult !== undefined) {
    payload.retained_result = jsonObject(patch.retainedResult);
  }
  if (patch.comparableValue !== undefined) {
    payload.comparable_value = finiteOrNull(patch.comparableValue);
  }
  if (patch.comparableDimensions !== undefined) {
    payload.comparable_dimensions = jsonObject(patch.comparableDimensions);
  }
  if (patch.isValid !== undefined) payload.is_valid = !!patch.isValid;
  if (patch.notes !== undefined) payload.notes = patch.notes || "";

  const { data, error } = await supabase
    .from("assessment_test_results")
    .update(payload)
    .eq("id", resultId)
    .select("*")
    .single();

  return { data, error };
}
