import { supabase } from "../supabaseClient";

function unavailable(data = null) {
  return { data, error: new Error("Supabase not configured") };
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null;
}

async function attachCurrentVersions(programs = []) {
  const versionIds = [...new Set(programs.map((program) => program?.current_version_id).filter(Boolean))];
  if (!versionIds.length) return { data: programs, error: null };
  const { data: versions, error } = await supabase
    .from("training_program_versions")
    .select("id,program_id,version_no,content_json,change_note,created_at")
    .in("id", versionIds);
  if (error) return { data: [], error };
  const byId = new Map((versions || []).map((version) => [version.id, version]));
  return {
    data: programs.map((program) => ({
      ...program,
      current_version: byId.get(program.current_version_id) || null,
    })),
    error: null,
  };
}

export async function listOwnedTrainingPrograms(familyId) {
  if (!supabase) return unavailable([]);
  if (!familyId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("training_programs")
    .select("id,owner_family_id,creator_profile_id,title,description,purpose,sport,difficulty,age_band,equipment,tags,status,creator_role,current_version_no,current_version_id,week_count,phase_count,access_model,marketplace_status,created_at,updated_at")
    .eq("owner_family_id", familyId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });
  if (error) return { data: [], error };
  return attachCurrentVersions(data || []);
}

export async function saveTrainingProgram({
  programId = null,
  familyId,
  creatorProfileId,
  title,
  description = "",
  purpose = "",
  sport = "",
  difficulty = "all_levels",
  ageBand = "all_ages",
  equipment = [],
  tags = [],
  creatorRole = "community",
  content,
  changeNote = "",
}) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_save", {
    p_program_id: programId,
    p_family_id: familyId,
    p_creator_profile_id: creatorProfileId || null,
    p_title: title,
    p_description: description,
    p_purpose: purpose,
    p_sport: sport,
    p_difficulty: difficulty,
    p_age_band: ageBand,
    p_equipment: equipment,
    p_tags: tags,
    p_creator_role: creatorRole,
    p_content: content,
    p_change_note: changeNote,
  });
  return { data: firstRow(data), error };
}

export async function archiveTrainingProgram(programId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_archive", {
    p_program_id: programId,
  });
  return { data, error };
}

export async function applyOwnedTrainingProgram({ programId, profileId, startDate, completionMode = "repeat" }) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_apply_owned", {
    p_program_id: programId,
    p_profile_id: profileId,
    p_start_date: startDate,
    p_completion_mode: completionMode,
  });
  return { data, error };
}

export async function createTrainingProgramShare(programId, permission = "copy", expiresInDays = 30) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_create_share", {
    p_program_id: programId,
    p_permission: permission,
    p_expires_in_days: expiresInDays,
  });
  return { data: firstRow(data), error };
}

export async function previewTrainingProgramShare(shareToken) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_preview_share", {
    p_share_token: shareToken,
  });
  return { data: firstRow(data), error };
}

export async function acceptTrainingProgramShare({ shareToken, profileId, startDate, completionMode = "repeat" }) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_accept_share", {
    p_share_token: shareToken,
    p_profile_id: profileId,
    p_start_date: startDate,
    p_completion_mode: completionMode,
  });
  return { data, error };
}

export async function assignTrainingProgramToGroup({ programId, groupId, startDate, completionMode = "repeat", message = "" }) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_assign_group", {
    p_program_id: programId,
    p_group_id: groupId,
    p_start_date: startDate,
    p_completion_mode: completionMode,
    p_message: message,
  });
  return { data, error };
}

export async function listTrainingProgramAssignments(profileId) {
  if (!supabase) return unavailable([]);
  if (!profileId) return { data: [], error: null };
  const { data: memberships, error: membershipError } = await supabase
    .from("group_memberships")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (membershipError) return { data: [], error: membershipError };
  const membershipIds = (memberships || []).map((row) => row.id);

  let query = supabase
    .from("training_program_assignments")
    .select("id,program_id,version_id,target_profile_id,target_membership_id,status,start_date,completion_mode,recipient_can_edit,message,created_at")
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const filters = [`target_profile_id.eq.${profileId}`];
  if (membershipIds.length) filters.push(`target_membership_id.in.(${membershipIds.join(",")})`);
  query = query.or(filters.join(","));
  const { data: assignments, error } = await query;
  if (error || !(assignments || []).length) return { data: [], error };

  const programIds = [...new Set(assignments.map((row) => row.program_id))];
  const versionIds = [...new Set(assignments.map((row) => row.version_id))];
  const [{ data: programs, error: programError }, { data: versions, error: versionError }] = await Promise.all([
    supabase
      .from("training_programs")
      .select("id,title,description,purpose,sport,difficulty,week_count,phase_count,creator_role")
      .in("id", programIds),
    supabase
      .from("training_program_versions")
      .select("id,version_no,content_json")
      .in("id", versionIds),
  ]);
  if (programError || versionError) return { data: [], error: programError || versionError };
  const programById = new Map((programs || []).map((row) => [row.id, row]));
  const versionById = new Map((versions || []).map((version) => [version.id, version]));
  return {
    data: assignments.map((assignment) => ({
      ...assignment,
      program: programById.get(assignment.program_id) || null,
      version: versionById.get(assignment.version_id) || null,
    })),
    error: null,
  };
}

export async function acceptTrainingProgramAssignment(assignmentId, profileId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_accept_assignment", {
    p_assignment_id: assignmentId,
    p_profile_id: profileId,
  });
  return { data, error };
}

export async function declineTrainingProgramAssignment(assignmentId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_decline_assignment", {
    p_assignment_id: assignmentId,
  });
  return { data, error };
}

export function buildTrainingProgramShareLink(shareToken) {
  if (typeof window === "undefined" || !shareToken) return "";
  const url = new URL(window.location.href);
  url.search = "";
  url.hash = "";
  url.searchParams.set("programShare", shareToken);
  return url.toString();
}

export function readTrainingProgramShareToken() {
  if (typeof window === "undefined") return "";
  try {
    return new URL(window.location.href).searchParams.get("programShare") || "";
  } catch {
    return "";
  }
}
