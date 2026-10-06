import { supabase } from "../supabaseClient";

const missing = (data = []) => ({ data, error: new Error("Supabase not configured") });
export const localWorkflowDate = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
export async function listProgramNotifications(familyId, profileId) {
  if (!supabase) return missing();
  return supabase.from("training_program_notifications").select("id,assignment_id,client_connection_id,profile_id,title,kind,audience,created_at,read_at")
    .eq("family_id", familyId).or(`profile_id.eq.${profileId},profile_id.is.null`).order("created_at", { ascending: false }).limit(50);
}
export async function readProgramNotification(id) {
  if (!supabase) return missing(false);
  return supabase.rpc("training_program_read_notification", { p_notification_id: id });
}
export async function listRecipientProgramControls(profileId) {
  if (!supabase) return missing();
  return supabase.rpc("training_program_recipient_controls", { p_profile_id: profileId });
}
export async function setProgramReporting(id, adherence, assessments) {
  if (!supabase) return missing(false);
  return supabase.rpc("training_program_set_reporting", { p_assignment_id: id, p_share_adherence: adherence, p_share_assessments: assessments });
}
export async function setProgramPermissions(id, canEdit, canCopy) {
  if (!supabase) return missing(false);
  return supabase.rpc("training_program_set_permissions", { p_assignment_id: id, p_can_edit: canEdit, p_can_copy: canCopy });
}
export async function getProgramCoachReport(id, days = 28) {
  if (!supabase) return missing(null);
  return supabase.rpc("training_program_coach_report", { p_assignment_id: id, p_reference_date: localWorkflowDate(), p_days: days });
}
export async function listProgramCheckpoints(familyId, profileId) {
  if (!supabase) return missing();
  return supabase.rpc("training_program_due_checkpoints", { p_profile_id: profileId, p_reference_date: localWorkflowDate() });
}
