import { supabase } from "../supabaseClient";

function unavailable() {
  return { data: null, error: new Error("Supabase not configured") };
}

async function invoke(body) {
  if (!supabase) return unavailable();
  const { data, error } = await supabase.functions.invoke("group-challenges", { body });
  return { data: data || null, error };
}

export async function loadGroupChallenges(groupId, membershipId) {
  if (!groupId || !membershipId) return { data: null, error: new Error("Group membership is required") };
  return invoke({ action: "list", groupId, membershipId });
}

export async function createGroupChallenge(groupId, membershipId, { templateKey, durationDays, startDate } = {}) {
  if (!groupId || !membershipId) return { data: null, error: new Error("Group membership is required") };
  return invoke({ action: "create", groupId, membershipId, templateKey, durationDays, startDate });
}

export async function cancelGroupChallenge(groupId, membershipId, challengeId) {
  if (!groupId || !membershipId || !challengeId) return { data: null, error: new Error("Challenge is required") };
  return invoke({ action: "cancel", groupId, membershipId, challengeId });
}
