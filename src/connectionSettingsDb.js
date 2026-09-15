import { supabase } from "./supabaseClient";

export const DEFAULT_CONNECTION_PREFERENCES = Object.freeze({
  activity_data_enabled: true,
  performance_metrics_enabled: true,
  heart_rate_enabled: false,
  route_location_enabled: false,
  health_recovery_enabled: false,
  include_private_activities: false,
  initial_import_days: 90,
  auto_log_window_days: 2,
});

function unavailable() {
  return { data: null, error: new Error("Supabase not configured") };
}

export async function loadConnectionSettingsData(profileIds = []) {
  if (!supabase) return unavailable();
  const ids = [...new Set((profileIds || []).filter(Boolean))];
  if (!ids.length) return { data: { connections: [], preferences: [] }, error: null };

  const [connections, preferences] = await Promise.all([
    supabase
      .from("external_connections")
      .select("id,family_id,profile_id,provider,provider_account_id,provider_account_label,status,auto_sync_enabled,scopes,connected_at,disconnected_at,last_sync_at,last_manual_sync_at,last_error_code")
      .in("profile_id", ids)
      .order("provider", { ascending: true }),
    supabase
      .from("external_connection_preferences")
      .select("id,family_id,profile_id,provider,activity_data_enabled,performance_metrics_enabled,heart_rate_enabled,route_location_enabled,health_recovery_enabled,include_private_activities,initial_import_days,auto_log_window_days,updated_at")
      .in("profile_id", ids)
      .order("provider", { ascending: true }),
  ]);

  const failed = [connections, preferences].find((result) => result?.error);
  if (failed?.error) return { data: null, error: failed.error };
  return {
    data: {
      connections: connections.data || [],
      preferences: preferences.data || [],
    },
    error: null,
  };
}

export async function updateConnectionPreferences(profileId, provider, preferences) {
  if (!supabase) return unavailable();
  if (!profileId || !provider) return { data: null, error: new Error("Athlete profile and provider are required") };
  const { data, error } = await supabase.functions.invoke("external-connection-preferences", {
    body: { profileId, provider, preferences },
  });
  return { data: data || null, error: error || null };
}
