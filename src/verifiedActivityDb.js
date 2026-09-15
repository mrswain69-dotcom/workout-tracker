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

export async function startStravaConnection(profileId, { includePrivate = false } = {}) {
  if (!supabase) return unavailable();
  if (!profileId) return { data: null, error: new Error("Athlete profile is required") };

  const { data, error } = await supabase.functions.invoke("strava-oauth-start", {
    body: { profileId, includePrivate: includePrivate === true },
  });
  return { data: data || null, error: error || null };
}

export async function disconnectStravaConnection(profileId) {
  if (!supabase) return unavailable();
  if (!profileId) return { data: null, error: new Error("Athlete profile is required") };

  const { data, error } = await supabase.functions.invoke("strava-disconnect", {
    body: { profileId },
  });
  return { data: data || null, error: error || null };
}

export async function runVerificationAction(profileId, action, payload = {}) {
  if (!supabase) return unavailable();
  if (!profileId || !action) return { data: null, error: new Error("Athlete profile and verification action are required") };
  const { data, error } = await supabase.functions.invoke("verification-actions", {
    body: { profileId, action, ...(payload || {}) },
  });
  return { data: data || null, error: error || null };
}

export async function runVerificationAutoPopulationAction(profileId, action = "apply", payload = {}) {
  if (!supabase) return unavailable();
  if (!profileId || !action) return { data: null, error: new Error("Athlete profile and auto-population action are required") };
  const { data, error } = await supabase.functions.invoke("verification-auto-populate", {
    body: { profileId, action, ...(payload || {}) },
  });
  return { data: data || null, error: error || null };
}

export function applyRecentVerifiedAutoPopulation(profileId) {
  return runVerificationAutoPopulationAction(profileId, "apply");
}

export function undoVerifiedAutoPopulation(profileId, verifiedActivityId) {
  return runVerificationAutoPopulationAction(profileId, "undo", { verifiedActivityId });
}

export function checkConnectedSources(profileId, provider = "strava") {
  return runVerificationAction(profileId, "manual_sync", { provider });
}

export function loadManualMatchCandidates(profileId, verifiedActivityId) {
  return runVerificationAction(profileId, "match_candidates", { verifiedActivityId });
}

export function confirmManualVerifiedMatch(profileId, verifiedActivityId, { manualLogId, manualBlockId = null } = {}) {
  return runVerificationAction(profileId, "manual_match", { verifiedActivityId, manualLogId, manualBlockId });
}

export function detachVerifiedMatch(profileId, verifiedActivityId) {
  return runVerificationAction(profileId, "detach_match", { verifiedActivityId });
}

export function setVerifiedActivityIgnored(profileId, verifiedActivityId, ignored = true) {
  return runVerificationAction(profileId, ignored ? "ignore_activity" : "unignore_activity", { verifiedActivityId });
}

export function resetVerifiedAutomaticMatching(profileId, verifiedActivityId) {
  return runVerificationAction(profileId, "reset_automatic_matching", { verifiedActivityId });
}

export function purgeProviderData(profileId, provider) {
  return runVerificationAction(profileId, "purge_provider", { provider });
}

export async function reconcileVerifiedActivityData(profileId) {
  if (!supabase) return unavailable();
  if (!profileId) return { data: null, error: new Error("Athlete profile is required") };

  const { data, error } = await supabase.functions.invoke("verification-reconcile", {
    body: { profileId },
  });
  return { data: data || null, error: error || null };
}

export async function loadVerifiedActivityData(profileId) {
  if (!supabase) return unavailable();
  if (!profileId) return { data: emptyData(""), error: null };

  const [connections, observations, verifiedActivities, observationLinks, manualLinks] =
    await Promise.all([
      supabase
        .from("external_connections")
        .select(
          "id,family_id,profile_id,provider,provider_account_id,provider_account_label,status,auto_sync_enabled,scopes,connected_at,disconnected_at,last_sync_at,last_manual_sync_at,last_error_code,created_at,updated_at"
        )
        .eq("profile_id", profileId)
        .order("provider", { ascending: true }),
      supabase
        .from("external_activity_observations")
        .select(
          "id,connection_id,family_id,profile_id,provider,provider_activity_id,started_at,local_date_ymd,source_timezone,activity_type,activity_name,distance_m,elapsed_duration_sec,moving_duration_sec,average_heart_rate_bpm,max_heart_rate_bpm,elevation_gain_m,calories_kcal,source_manual_entry,source_device_name,source_external_id,source_upload_id,source_created_at,source_updated_at,source_deleted_at,imported_at,created_at,updated_at"
        )
        .eq("profile_id", profileId)
        .order("started_at", { ascending: false }),
      supabase
        .from("verified_activities")
        .select(
          "id,family_id,profile_id,activity_type,started_at,status,identity_method,identity_confidence,match_version,auto_match_suppressed,ignored_at,ignored_by_user_id,created_at,updated_at"
        )
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
          "id,family_id,profile_id,verified_activity_id,manual_log_id,manual_block_id,match_method,match_confidence,date_offset_days,confirmed_at,created_at,updated_at"
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
