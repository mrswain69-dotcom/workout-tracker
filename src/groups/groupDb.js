import { supabase } from "../supabaseClient";

function unavailable() {
  return { data: null, error: new Error("Supabase not configured") };
}

function firstRow(data) {
  return Array.isArray(data) ? data[0] || null : data || null;
}

export async function listProfileGroups(profileId) {
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };
  if (!profileId) return { data: [], error: null };

  const { data: memberships, error: membershipError } = await supabase
    .from("group_memberships")
    .select("id,group_id,role,nickname,avatar_id,avatar_frame,avatar_frames_enabled,joined_at")
    .eq("profile_id", profileId)
    .eq("status", "active")
    .order("joined_at", { ascending: true });

  if (membershipError) return { data: [], error: membershipError };
  const rows = memberships || [];
  if (!rows.length) return { data: [], error: null };

  const groupIds = [...new Set(rows.map((row) => row.group_id).filter(Boolean))];
  const { data: groups, error: groupError } = await supabase
    .from("groups")
    .select("id,name,description,group_type,status,max_members,competition_start_date,xp_history_scope,created_at,updated_at")
    .in("id", groupIds)
    .eq("status", "active");

  if (groupError) return { data: [], error: groupError };
  const byId = new Map((groups || []).map((group) => [group.id, group]));

  return {
    data: rows
      .map((membership) => {
        const group = byId.get(membership.group_id);
        return group ? { ...group, membership } : null;
      })
      .filter(Boolean),
    error: null,
  };
}

export async function listGroupDirectory(groupId) {
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };
  if (!groupId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("group_member_directory")
    .select("membership_id,group_id,nickname,role,avatar_id,avatar_frame,avatar_frames_enabled,joined_at,updated_at")
    .eq("group_id", groupId)
    .order("joined_at", { ascending: true });
  return { data: data || [], error };
}

export async function listGroupInvites(groupId) {
  if (!supabase) return { data: [], error: new Error("Supabase not configured") };
  if (!groupId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("group_invites")
    .select("id,group_id,code_hint,expires_at,max_uses,use_count,revoked_at,created_at")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function createGroup({ profileId, name, nickname, description = "", groupType = "private" }) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_create", {
    p_profile_id: profileId,
    p_name: name,
    p_nickname: nickname || null,
    p_description: description,
    p_group_type: groupType,
  });
  return { data: firstRow(data), error };
}

export async function createGroupInvite(groupId, { expiresInDays = 7, maxUses = 1 } = {}) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_create_invite", {
    p_group_id: groupId,
    p_expires_in_days: expiresInDays,
    p_max_uses: maxUses,
  });
  return { data: firstRow(data), error };
}

export async function previewGroupInvite(inviteCode) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_preview_invite", {
    p_invite_code: inviteCode,
  });
  return { data: firstRow(data), error };
}

export async function joinGroup({ profileId, inviteCode, nickname }) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_join", {
    p_profile_id: profileId,
    p_invite_code: inviteCode,
    p_nickname: nickname || null,
  });
  return { data: firstRow(data), error };
}

export async function updateGroupNickname(groupId, profileId, nickname) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_update_nickname", {
    p_group_id: groupId,
    p_profile_id: profileId,
    p_nickname: nickname,
  });
  return { data, error };
}

export async function leaveGroup(groupId, profileId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_leave", {
    p_group_id: groupId,
    p_profile_id: profileId,
  });
  return { data, error };
}

export async function updateGroupDetails(groupId, { name = null, description = null, groupType = null } = {}) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_update_details", {
    p_group_id: groupId,
    p_name: name,
    p_description: description,
    p_group_type: groupType,
  });
  return { data, error };
}

export async function setGroupMemberRole(groupId, membershipId, role) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_set_member_role", {
    p_group_id: groupId,
    p_membership_id: membershipId,
    p_role: role,
  });
  return { data, error };
}

export async function removeGroupMember(groupId, membershipId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_remove_member", {
    p_group_id: groupId,
    p_membership_id: membershipId,
  });
  return { data, error };
}

export async function revokeGroupInvite(inviteId) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_revoke_invite", {
    p_invite_id: inviteId,
  });
  return { data, error };
}


export async function updateGroupXpHistoryScope(groupId, scope) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.rpc("group_update_xp_history_scope", {
    p_group_id: groupId,
    p_scope: scope,
  });
  return { data: firstRow(data), error };
}

export async function loadGroupXpLeaderboard(groupId, membershipId, referenceDate = null) {
  if (!supabase) return unavailable();
  if (!groupId || !membershipId) return { data: null, error: new Error("Group membership is required") };
  const body = { groupId, membershipId };
  if (referenceDate) body.referenceDate = referenceDate;
  const { data, error } = await supabase.functions.invoke("group-xp-leaderboard", { body });
  return { data: data || null, error };
}
