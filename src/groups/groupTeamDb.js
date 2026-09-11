import { supabase } from "../supabaseClient";

function unavailable() {
  return { data: null, error: new Error("Supabase not configured") };
}

export async function loadGroupTeamPrBoard(groupId, membershipId, referenceDate = null) {
  if (!supabase) return unavailable();
  if (!groupId || !membershipId) {
    return { data: null, error: new Error("Group membership is required") };
  }
  const body = { groupId, membershipId };
  if (referenceDate) body.referenceDate = referenceDate;
  const { data, error } = await supabase.functions.invoke("group-team-pr-board", { body });
  return { data: data || null, error };
}
