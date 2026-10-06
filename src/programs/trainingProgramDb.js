import { supabase } from "../supabaseClient";

function localDateYmd() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

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

export async function listOwnedTrainingPrograms(familyId, includeArchived = false) {
  if (!supabase) return unavailable([]);
  if (!familyId) return { data: [], error: null };
  let query = supabase
    .from("training_programs")
    .select("id,owner_family_id,creator_profile_id,title,description,purpose,sport,difficulty,age_band,equipment,tags,status,creator_role,current_version_no,current_version_id,week_count,phase_count,access_model,marketplace_status,legacy_plan_template_id,created_at,updated_at")
    .eq("owner_family_id", familyId)
    .order("updated_at", { ascending: false });
  if (!includeArchived) query = query.eq("status", "active");
  const { data, error } = await query;
  if (error) return { data: [], error };
  return attachCurrentVersions(data || []);
}

export async function importLegacyTrainingProgramTemplate({
  templateId,
  creatorProfileId,
  content,
}) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_import_legacy_template", {
    p_template_id: templateId,
    p_creator_profile_id: creatorProfileId || null,
    p_content: content,
  });
  return { data: firstRow(data), error };
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

export async function assignTrainingProgramToMembers({
  programId,
  membershipIds,
  startDate,
  completionMode = "repeat",
  recipientCanEdit = true,
  recipientCanCopy = true,
  message = "",
}) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_assign_members_with_permissions", {
    p_program_id: programId,
    p_membership_ids: [...new Set((membershipIds || []).filter(Boolean))],
    p_start_date: startDate,
    p_completion_mode: completionMode,
    p_recipient_can_edit: !!recipientCanEdit,
    p_recipient_can_copy: !!recipientCanCopy,
    p_message: message,
  });
  return { data, error };
}

export async function listManagedTrainingProgramAssignments(familyId) {
  if (!supabase) return unavailable([]);
  if (!familyId) return { data: [], error: null };

  const { data: assignments, error } = await supabase
    .from("training_program_assignments")
    .select("id,program_id,version_id,target_profile_id,target_membership_id,client_connection_id,status,start_date,completion_mode,recipient_can_edit,recipient_can_copy,share_adherence,share_assessments,message,adoption_mode,undone_at,removed_at,replaces_assignment_id,replacement_adoption_mode,created_at,responded_at")
    .eq("assigned_by_family_id", familyId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error || !(assignments || []).length) return { data: [], error };

  const programIds = [...new Set(assignments.map((row) => row.program_id).filter(Boolean))];
  const versionIds = [...new Set(assignments.map((row) => row.version_id).filter(Boolean))];
  const membershipIds = [...new Set(assignments.map((row) => row.target_membership_id).filter(Boolean))];
  const connectionIds = [...new Set(assignments.map((row) => row.client_connection_id).filter(Boolean))];
  const [programResult, versionResult, directoryResult, stateResult, clientResult] = await Promise.all([
    supabase
      .from("training_programs")
      .select("id,title")
      .in("id", programIds),
    supabase
      .from("training_program_versions")
      .select("id,version_no")
      .in("id", versionIds),
    membershipIds.length
      ? supabase
          .from("group_member_directory")
          .select("membership_id,group_id,nickname")
          .in("membership_id", membershipIds)
      : Promise.resolve({ data: [], error: null }),
    supabase.rpc("training_program_assignment_states", { p_family_id: familyId, p_reference_date: localDateYmd() }),
    connectionIds.length ? supabase.from("training_program_client_connections").select("id,client_name").in("id", connectionIds) : Promise.resolve({ data: [], error: null }),
  ]);
  const relatedError = programResult.error || versionResult.error || directoryResult.error || stateResult.error || clientResult.error;
  if (relatedError) return { data: [], error: relatedError };

  const programs = new Map((programResult.data || []).map((row) => [row.id, row]));
  const versions = new Map((versionResult.data || []).map((row) => [row.id, row]));
  const recipients = new Map((directoryResult.data || []).map((row) => [row.membership_id, row]));
  const clients = new Map((clientResult.data || []).map((row) => [row.id, { nickname: row.client_name }]));
  const states = new Map((stateResult.data || []).map((row) => [row.assignment_id, row.active_state]));

  return {
    data: assignments.map((assignment) => ({
      ...assignment,
      active_state: states.get(assignment.id) || assignment.status,
      program: programs.get(assignment.program_id) || null,
      version: versions.get(assignment.version_id) || null,
      recipient: clients.get(assignment.client_connection_id) || recipients.get(assignment.target_membership_id) || null,
    })),
    error: null,
  };
}

export async function revokeTrainingProgramAssignment(assignmentId) {
  if (!supabase) return unavailable(false);
  const { data, error } = await supabase.rpc("training_program_revoke_assignment", {
    p_assignment_id: assignmentId,
  });
  return { data, error };
}

export async function rescheduleTrainingProgramAssignment({ assignmentId, startDate, completionMode, message = "" }) {
  if (!supabase) return unavailable(false);
  return supabase.rpc("training_program_reschedule_assignment", {
    p_assignment_id: assignmentId, p_start_date: startDate,
    p_completion_mode: completionMode, p_message: message,
  });
}

export async function offerTrainingProgramReplacement({ assignmentId, programId = null, startDate, completionMode, message = "" }) {
  if (!supabase) return unavailable();
  return supabase.rpc("training_program_offer_replacement", {
    p_assignment_id: assignmentId, p_program_id: programId, p_start_date: startDate,
    p_completion_mode: completionMode, p_message: message,
  });
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
    .select("id,program_id,version_id,target_profile_id,target_membership_id,client_connection_id,status,start_date,completion_mode,recipient_can_edit,recipient_can_copy,share_adherence,share_assessments,message,replaces_assignment_id,replacement_adoption_mode,created_at")
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

export async function acceptTrainingProgramAssignment(
  assignmentId,
  profileId,
  { adoptionMode = "replace", preparedPlan = null, shareAdherence = false, shareAssessments = false } = {}
) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_accept_with_sharing", {
    p_assignment_id: assignmentId,
    p_profile_id: profileId,
    p_adoption_mode: adoptionMode,
    p_prepared_plan: preparedPlan,
    p_share_adherence: !!shareAdherence,
    p_share_assessments: !!shareAssessments,
  });
  return { data, error };
}

export async function undoTrainingProgramAssignment(assignmentId, profileId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_undo_assignment", {
    p_assignment_id: assignmentId,
    p_profile_id: profileId,
  });
  return { data, error };
}

export async function removeTrainingProgramAddOn(assignmentId, profileId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("training_program_remove_add_on", {
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
