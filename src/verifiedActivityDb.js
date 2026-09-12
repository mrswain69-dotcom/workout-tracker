import { supabase } from "./supabaseClient";

function unavailable() {
  return { data: null, error: new Error("Supabase not configured") };
}

function emptyData(profileId = "") {
  return {
    profileId,
    connections: [],
    observations: [],
    verifiedActivities: [],
    observationLinks: [],
    manualLinks: [],
  };
}

export async function loadVerifiedActivityData(profileId) {
  if (!supabase) return unavailable();
  if (!profileId) return { data: emptyData(""), error: null };

  const [connections, observations, verifiedActivities, observationLinks, manualLinks] =
    await Promise.all([
      supabase
        .from("external_connections")
        .select(
          "id,family_id,profile_id,provider,provider_account_id,status,auto_sync_enabled,scopes,connected_at,disconnected_at,last_sync_at,last_error_code,created_at,updated_at"
        )
        .eq("profile_id", profileId)
        .order("provider", { ascending: true }),
      supabase
        .from("external_activity_observations")
        .select(
          "id,connection_id,family_id,profile_id,provider,provider_activity_id,started_at,activity_type,activity_name,distance_m,elapsed_duration_sec,moving_duration_sec,average_heart_rate_bpm,max_heart_rate_bpm,elevation_gain_m,calories_kcal,source_created_at,source_updated_at,source_deleted_at,imported_at,created_at,updated_at"
        )
        .eq("profile_id", profileId)
        .order("started_at", { ascending: false }),
      supabase
        .from("verified_activities")
        .select("id,family_id,profile_id,activity_type,started_at,status,created_at,updated_at")
        .eq("profile_id", profileId)
        .order("started_at", { ascending: false }),
      supabase
        .from("verified_activity_observations")
        .select("verified_activity_id,observation_id,family_id,profile_id,linked_at")
        .eq("profile_id", profileId)
        .order("linked_at", { ascending: true }),
      supabase
        .from("external_activity_links")
        .select(
          "id,family_id,profile_id,verified_activity_id,manual_log_id,manual_block_id,match_method,match_confidence,created_at,updated_at"
        )
        .eq("profile_id", profileId)
        .order("created_at", { ascending: true }),
    ]);

  const results = [connections, observations, verifiedActivities, observationLinks, manualLinks];
  const failed = results.find((result) => result?.error);
  if (failed?.error) return { data: null, error: failed.error };

  return {
    data: {
      profileId,
      connections: connections.data || [],
      observations: observations.data || [],
      verifiedActivities: verifiedActivities.data || [],
      observationLinks: observationLinks.data || [],
      manualLinks: manualLinks.data || [],
    },
    error: null,
  };
}
