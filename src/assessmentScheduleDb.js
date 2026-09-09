import { supabase } from "./supabaseClient";

function positiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(1, Math.round(n));
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export async function listAssessmentSchedules(
  familyId,
  { profileId = null, activeOnly = true } = {}
) {
  let query = supabase
    .from("assessment_schedules")
    .select("*")
    .eq("family_id", familyId)
    .order("start_date", { ascending: true })
    .order("created_at", { ascending: true });

  if (profileId) query = query.eq("profile_id", profileId);
  if (activeOnly) query = query.eq("active", true);

  const { data, error } = await query;
  return { data: data || [], error };
}

export async function createAssessmentSchedule(familyId, schedule = {}) {
  const { data, error } = await supabase
    .from("assessment_schedules")
    .insert({
      family_id: familyId,
      profile_id: schedule.profileId,
      assessment_template_id: schedule.assessmentTemplateId,
      start_date: schedule.startDate,
      cadence_days: positiveInt(schedule.cadenceDays, 28),
      window_days: positiveInt(schedule.windowDays, 7),
      workflow_config: jsonObject(schedule.workflowConfig),
      active: schedule.active !== false,
    })
    .select("*")
    .single();

  return { data, error };
}

export async function updateAssessmentSchedule(scheduleId, patch = {}) {
  const payload = {};
  if (patch.startDate !== undefined) payload.start_date = patch.startDate;
  if (patch.cadenceDays !== undefined) {
    payload.cadence_days = positiveInt(patch.cadenceDays, 28);
  }
  if (patch.windowDays !== undefined) {
    payload.window_days = positiveInt(patch.windowDays, 7);
  }
  if (patch.workflowConfig !== undefined) {
    payload.workflow_config = jsonObject(patch.workflowConfig);
  }
  if (patch.active !== undefined) payload.active = !!patch.active;

  const { data, error } = await supabase
    .from("assessment_schedules")
    .update(payload)
    .eq("id", scheduleId)
    .select("*")
    .single();

  return { data, error };
}
