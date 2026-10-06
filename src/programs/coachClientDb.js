import { supabase } from "../supabaseClient";
const missing = (data = null) => ({ data, error: new Error("Supabase not configured") });
export function readCoachInvite(value = window.location.href) {
  try {
    const token = new URL(value, window.location.origin).searchParams.get("coachInvite") || value.trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ? token : "";
  } catch { return ""; }
}
export function coachInviteUrl(token) {
  const url = new URL(window.location.href);
  url.searchParams.delete("programShare");
  url.searchParams.set("coachInvite", token);
  url.hash = "";
  return url.href;
}
export async function listCoachClientConnections(familyId, profileId) {
  if (!supabase) return missing([]);
  if (!familyId || !profileId) return { data: [], error: null };
  return supabase.from("training_program_client_connections")
    .select("id,coach_family_id,coach_profile_id,coach_name,client_profile_id,client_name,invite_token,status,expires_at,accepted_at,created_at")
    .or(`coach_family_id.eq.${familyId},client_profile_id.eq.${profileId}`).order("created_at", { ascending: false });
}
export async function inviteCoachClient(profileId, coachName, days = 14) {
  if (!supabase) return missing();
  const r = await supabase.rpc("training_program_invite_client", { p_coach_profile_id: profileId, p_coach_name: coachName.trim(), p_expires_in_days: days });
  return { ...r, data: Array.isArray(r.data) ? r.data[0] : r.data };
}
export async function previewCoachInvite(token) {
  if (!supabase) return missing();
  const r = await supabase.rpc("training_program_preview_client_invite", { p_token: token });
  return { ...r, data: Array.isArray(r.data) ? r.data[0] || null : r.data };
}
export async function acceptCoachInvite(token, profileId) {
  if (!supabase) return missing();
  return supabase.rpc("training_program_accept_client_invite", { p_token: token, p_profile_id: profileId });
}
export async function disconnectCoachClient(id) {
  if (!supabase) return missing(false);
  return supabase.rpc("training_program_disconnect_client", { p_connection_id: id });
}
export async function assignProgramToClients({ programId, connectionIds, startDate, completionMode, recipientCanEdit, recipientCanCopy, message }) {
  if (!supabase) return missing(0);
  return supabase.rpc("training_program_assign_clients", { p_program_id: programId, p_connection_ids: connectionIds, p_start_date: startDate, p_completion_mode: completionMode, p_can_edit: recipientCanEdit, p_can_copy: recipientCanCopy, p_message: message });
}
