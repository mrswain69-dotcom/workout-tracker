import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  createUserClient,
  json,
} from "../_shared/stravaProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PROVIDERS = new Set(["strava", "garmin", "apple_health", "health_connect", "google_fit_legacy"]);
const BOOLEAN_KEYS = [
  "activity_data_enabled",
  "performance_metrics_enabled",
  "heart_rate_enabled",
  "route_location_enabled",
  "health_recovery_enabled",
  "include_private_activities",
] as const;

const DEFAULTS = Object.freeze({
  activity_data_enabled: true,
  performance_metrics_enabled: true,
  heart_rate_enabled: false,
  route_location_enabled: false,
  health_recovery_enabled: false,
  include_private_activities: false,
  initial_import_days: 90,
  auto_log_window_days: 2,
  unmatched_activity_action: "ask",
});

function sanitisePatch(value: unknown) {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const result: Record<string, boolean | number | string> = {};
  for (const key of BOOLEAN_KEYS) {
    if (typeof source[key] === "boolean") result[key] = source[key] as boolean;
  }
  if (source.initial_import_days !== undefined) {
    const days = Number(source.initial_import_days);
    if ([0, 7, 30, 90, 365].includes(days)) result.initial_import_days = days;
  }
  if (source.auto_log_window_days !== undefined) {
    const days = Number(source.auto_log_window_days);
    if (Number.isInteger(days) && days >= 0 && days <= 3) result.auto_log_window_days = days;
  }
  if (source.unmatched_activity_action !== undefined) {
    const action = String(source.unmatched_activity_action || "").trim().toLowerCase();
    if (["ask", "automatic", "never"].includes(action)) result.unmatched_activity_action = action;
  }
  return result;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Authentication required" }, 401, corsHeaders);

    const userClient = createUserClient(jwt);
    const adminClient = createAdminClient();
    if (!userClient || !adminClient) return json({ error: "Connection settings service unavailable" }, 503, corsHeaders);

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) return json({ error: "Authentication required" }, 401, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    const provider = typeof body?.provider === "string" ? body.provider.trim() : "";
    const patch = sanitisePatch(body?.preferences);
    if (!profileId || !PROVIDERS.has(provider)) {
      return json({ error: "Athlete profile and supported provider are required" }, 400, corsHeaders);
    }

    const { data: profile, error: profileError } = await userClient
      .from("profiles")
      .select("id,family_id,archived")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError || !profile || profile.archived) {
      return json({ error: "Athlete profile is not available" }, 404, corsHeaders);
    }

    const { data: existing, error: existingError } = await adminClient
      .from("external_connection_preferences")
      .select("activity_data_enabled,performance_metrics_enabled,heart_rate_enabled,route_location_enabled,health_recovery_enabled,include_private_activities,initial_import_days,auto_log_window_days,unmatched_activity_action")
      .eq("profile_id", profileId)
      .eq("provider", provider)
      .maybeSingle();
    if (existingError) throw existingError;

    const next = { ...DEFAULTS, ...(existing || {}), ...patch };
    const { data: preference, error: preferenceError } = await adminClient
      .from("external_connection_preferences")
      .upsert({
        family_id: profile.family_id,
        profile_id: profileId,
        provider,
        ...next,
      }, { onConflict: "profile_id,provider" })
      .select("id,family_id,profile_id,provider,activity_data_enabled,performance_metrics_enabled,heart_rate_enabled,route_location_enabled,health_recovery_enabled,include_private_activities,initial_import_days,auto_log_window_days,unmatched_activity_action,created_at,updated_at")
      .single();
    if (preferenceError) throw preferenceError;

    const scrub: Record<string, null> = {};
    if (!next.heart_rate_enabled) {
      scrub.average_heart_rate_bpm = null;
      scrub.max_heart_rate_bpm = null;
    }
    if (!next.performance_metrics_enabled) {
      scrub.elevation_gain_m = null;
      scrub.calories_kcal = null;
    }
    if (Object.keys(scrub).length) {
      const { error: scrubError } = await adminClient
        .from("external_activity_observations")
        .update(scrub)
        .eq("profile_id", profileId)
        .eq("provider", provider);
      if (scrubError) throw scrubError;
    }

    return json({ preferences: preference, scrubbedOptionalStreams: Object.keys(scrub) }, 200, corsHeaders);
  } catch (error) {
    console.error("External connection preference update failed", error);
    return json({ error: "Could not update connection preferences" }, 500, corsHeaders);
  }
});
