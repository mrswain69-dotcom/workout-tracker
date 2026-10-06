import { supabase } from "../supabaseClient";

const unavailable = () => ({ data: null, error: new Error("Supabase not configured") });
async function rpc(name, args) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc(name, args);
  return { data: Array.isArray(data) ? data[0] || null : data, error };
}

export async function listProgramHistory(programId) {
  if (!supabase) return unavailable();
  return supabase.from("training_program_versions")
    .select("id,version_no,change_note,content_json,created_at")
    .eq("program_id", programId).order("version_no", { ascending: false });
}

export async function listProgramLinks(programId) {
  if (!supabase) return unavailable();
  return supabase.from("training_program_share_links")
    .select("id,share_token,version_id,permission,expires_at,revoked_at,created_at,version:training_program_versions(version_no)")
    .eq("program_id", programId).order("created_at", { ascending: false });
}

export const updateProgramDetails = (program, details) => rpc("training_program_update_details", {
  p_program_id: program.id, p_expected_updated_at: program.updated_at,
  p_title: details.title.trim(), p_description: details.description.trim(),
  p_purpose: details.purpose.trim(), p_sport: details.sport.trim(),
  p_difficulty: details.difficulty, p_age_band: details.age_band,
  p_equipment: details.equipment, p_tags: details.tags,
});

export const restoreArchivedProgram = (programId) => rpc("training_program_restore_archived", { p_program_id: programId });

export const copyProgramVersion = ({ program, versionId, duplicate, title, changeNote }) => rpc("training_program_copy_version", {
  p_program_id: program.id, p_version_id: versionId, p_duplicate: !!duplicate,
  p_title: title || program.title, p_change_note: changeNote,
  p_expected_version_id: program.current_version_id,
});

export const updateProgramLink = (linkId, revoke, expiresInDays = 30) => rpc("training_program_update_link", {
  p_link_id: linkId, p_revoke: !!revoke, p_expires_in_days: Number(expiresInDays),
});

export function commaList(value) {
  return [...new Set(String(value || "").split(",").map((item) => item.trim()).filter(Boolean))];
}
