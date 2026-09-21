import { supabase } from "./supabaseClient";

export async function listAvatarSelectionPeriods(profileId) {
  if (!supabase || !profileId) return { data: [], error: null };
  const { data, error } = await supabase
    .from("avatar_selection_periods")
    .select("id,profile_id,avatar_id,selected_at,deselected_at")
    .eq("profile_id", profileId)
    .order("selected_at", { ascending: true });
  return { data: data || [], error };
}

export async function setProfileAvatarIdentity(profileId, avatarId) {
  if (!supabase || !profileId || !avatarId) {
    return { data: null, error: new Error("Avatar selection is unavailable") };
  }
  const { data, error } = await supabase.rpc("set_profile_avatar_identity", {
    p_profile_id: profileId,
    p_avatar_id: avatarId,
  });
  return { data, error };
}

export async function loadGroupAvatarIdentityStats(groupId, membershipId) {
  if (!supabase || !groupId || !membershipId) {
    return { data: null, error: null };
  }
  const { data, error } = await supabase.rpc("group_avatar_identity_stats", {
    p_group_id: groupId,
    p_membership_id: membershipId,
  });
  return { data, error };
}

export async function listProfileGroupAwards(profileId) {
  if (!supabase || !profileId) return { data: [], error: null };
  const memberships = await supabase
    .from("group_memberships")
    .select("id")
    .eq("profile_id", profileId)
    .eq("status", "active");
  if (memberships.error) return { data: [], error: memberships.error };
  const membershipIds = (memberships.data || []).map((row) => row.id);
  if (!membershipIds.length) return { data: [], error: null };
  const { data, error } = await supabase
    .from("group_progress_awards")
    .select("id,membership_id,award_type,period_type,period_start,period_end,season_number,rank,awarded_at")
    .in("membership_id", membershipIds)
    .order("awarded_at", { ascending: true });
  return { data: data || [], error };
}
