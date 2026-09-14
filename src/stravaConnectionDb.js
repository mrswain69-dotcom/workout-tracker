import { supabase } from "./supabaseClient";

function unavailable() {
  return { data: null, error: new Error("Supabase not configured") };
}

export async function startStravaConnection(profileId, { includePrivate = false } = {}) {
  if (!supabase) return unavailable();
  if (!profileId) return { data: null, error: new Error("Athlete profile is required") };

  const { data, error } = await supabase.functions.invoke("strava-oauth-start", {
    body: { profileId, includePrivate: includePrivate === true },
  });
  return { data: data || null, error };
}

export async function disconnectStrava(profileId) {
  if (!supabase) return unavailable();
  if (!profileId) return { data: null, error: new Error("Athlete profile is required") };

  const { data, error } = await supabase.functions.invoke("strava-disconnect", {
    body: { profileId },
  });
  return { data: data || null, error };
}
