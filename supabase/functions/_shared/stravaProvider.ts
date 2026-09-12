import { createClient } from "npm:@supabase/supabase-js@2.116.0";

export const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
export const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
export const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
export const STRAVA_API_BASE = Deno.env.get("STRAVA_API_BASE_URL") || "https://www.strava.com/api/v3";

export function platformKey(jsonName: string, singleName: string, legacyName: string) {
  const single = Deno.env.get(singleName);
  if (single) return single;
  const encoded = Deno.env.get(jsonName);
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall through while environments complete key migration.
    }
  }
  return Deno.env.get(legacyName) || "";
}

export function supabaseServerConfig() {
  return {
    url: Deno.env.get("SUPABASE_URL") || "",
    publishableKey: platformKey(
      "SUPABASE_PUBLISHABLE_KEYS",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY"
    ),
    secretKey: platformKey(
      "SUPABASE_SECRET_KEYS",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    ),
  };
}

export function createAdminClient() {
  const config = supabaseServerConfig();
  if (!config.url || !config.secretKey) return null;
  return createClient(config.url, config.secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createUserClient(jwt: string) {
  const config = supabaseServerConfig();
  if (!config.url || !config.publishableKey) return null;
  return createClient(config.url, config.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${jwt}` } },
  });
}

export function stravaAppConfig() {
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  return {
    clientId: Deno.env.get("STRAVA_CLIENT_ID") || "",
    clientSecret: Deno.env.get("STRAVA_CLIENT_SECRET") || "",
    webhookVerifyToken: Deno.env.get("STRAVA_WEBHOOK_VERIFY_TOKEN") || "",
    webhookSigningSecret: Deno.env.get("STRAVA_WEBHOOK_SIGNING_SECRET") || "",
    webhookSubscriptionId: Deno.env.get("STRAVA_WEBHOOK_SUBSCRIPTION_ID") || "",
    oauthCallbackUrl:
      Deno.env.get("STRAVA_OAUTH_CALLBACK_URL") ||
      (supabaseUrl ? `${supabaseUrl}/functions/v1/strava-oauth-callback` : ""),
    appUrl: Deno.env.get("WORKOUT_TRACKER_APP_URL") || "",
  };
}

export function randomUrlSafe(bytes = 32) {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function fixedAppRedirect(status: string, detail = "") {
  const { appUrl } = stravaAppConfig();
  if (!appUrl) return "";
  const url = new URL(appUrl);
  url.searchParams.set("integration", "strava");
  url.searchParams.set("status", status);
  if (detail) url.searchParams.set("detail", detail);
  return url.toString();
}

export function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders },
  });
}

export function cleanScopes(scope: unknown) {
  const list = Array.isArray(scope)
    ? scope
    : typeof scope === "string"
      ? scope.split(/[\s,]+/)
      : [];
  return [...new Set(list.map((item) => String(item).trim()).filter(Boolean))].sort();
}

export function hasActivityReadScope(scopes: string[]) {
  return scopes.includes("activity:read") || scopes.includes("activity:read_all");
}

export function epochToIso(value: unknown) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;
  return new Date(number * 1000).toISOString();
}

function finiteOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function localDateFromStrava(activity: any) {
  const value = typeof activity?.start_date_local === "string" ? activity.start_date_local.slice(0, 10) : "";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

export function normalizeStravaActivity(connection: any, activity: any) {
  const providerActivityId = activity?.id === null || activity?.id === undefined
    ? ""
    : String(activity.id);
  const startedAt = typeof activity?.start_date === "string" ? activity.start_date : "";
  if (!connection?.id || !connection?.family_id || !connection?.profile_id || !providerActivityId || !startedAt) {
    return null;
  }

  return {
    connection_id: connection.id,
    family_id: connection.family_id,
    profile_id: connection.profile_id,
    provider: "strava",
    provider_activity_id: providerActivityId,
    started_at: startedAt,
    local_date_ymd: localDateFromStrava(activity),
    source_timezone: typeof activity?.timezone === "string" && activity.timezone.trim() ? activity.timezone.trim() : null,
    activity_type: String(activity?.sport_type || activity?.type || "unknown").trim().toLowerCase(),
    activity_name: typeof activity?.name === "string" && activity.name.trim() ? activity.name.trim() : null,
    distance_m: finiteOrNull(activity?.distance),
    elapsed_duration_sec: finiteOrNull(activity?.elapsed_time),
    moving_duration_sec: finiteOrNull(activity?.moving_time),
    average_heart_rate_bpm: finiteOrNull(activity?.average_heartrate),
    max_heart_rate_bpm: finiteOrNull(activity?.max_heartrate),
    elevation_gain_m: finiteOrNull(activity?.total_elevation_gain),
    calories_kcal: finiteOrNull(activity?.calories),
    source_created_at: startedAt,
    source_updated_at: new Date().toISOString(),
    source_deleted_at: null,
    imported_at: new Date().toISOString(),
  };
}

export async function storeStravaTokens(adminClient: any, connectionId: string, tokenData: any) {
  const accessToken = typeof tokenData?.access_token === "string" ? tokenData.access_token : "";
  const refreshToken = typeof tokenData?.refresh_token === "string" ? tokenData.refresh_token : "";
  const expiresAt = epochToIso(tokenData?.expires_at);
  if (!accessToken || !refreshToken || !expiresAt) {
    throw new Error("Strava token response is incomplete");
  }

  const [accessResult, refreshResult] = await Promise.all([
    adminClient.from("external_connection_access_tokens").upsert(
      { connection_id: connectionId, access_token: accessToken, expires_at: expiresAt },
      { onConflict: "connection_id" }
    ),
    adminClient.from("external_connection_refresh_tokens").upsert(
      { connection_id: connectionId, refresh_token: refreshToken },
      { onConflict: "connection_id" }
    ),
  ]);
  if (accessResult.error || refreshResult.error) {
    throw accessResult.error || refreshResult.error;
  }
  return { accessToken, refreshToken, expiresAt };
}

export async function refreshStravaAccessToken(adminClient: any, connectionId: string) {
  const { clientId, clientSecret } = stravaAppConfig();
  if (!clientId || !clientSecret) throw new Error("Strava application credentials are not configured");

  const [accessResult, refreshResult] = await Promise.all([
    adminClient
      .from("external_connection_access_tokens")
      .select("access_token,expires_at")
      .eq("connection_id", connectionId)
      .maybeSingle(),
    adminClient
      .from("external_connection_refresh_tokens")
      .select("refresh_token")
      .eq("connection_id", connectionId)
      .maybeSingle(),
  ]);
  if (accessResult.error || refreshResult.error) throw accessResult.error || refreshResult.error;
  if (!accessResult.data || !refreshResult.data?.refresh_token) throw new Error("Strava tokens are unavailable");

  const expiresMs = new Date(accessResult.data.expires_at).getTime();
  if (Number.isFinite(expiresMs) && expiresMs - Date.now() > 60 * 60 * 1000) {
    return String(accessResult.data.access_token);
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: String(refreshResult.data.refresh_token),
  });
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenData = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`Strava token refresh failed (${response.status})`);

  const stored = await storeStravaTokens(adminClient, connectionId, tokenData);
  return stored.accessToken;
}

export async function fetchStravaActivity(accessToken: string, activityId: string) {
  const response = await fetch(`${STRAVA_API_BASE}/activities/${encodeURIComponent(activityId)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`Strava activity fetch failed (${response.status})`);
  return await response.json();
}

export async function upsertStravaObservation(adminClient: any, connection: any, activity: any) {
  const row = normalizeStravaActivity(connection, activity);
  if (!row) throw new Error("Strava activity cannot be normalized");
  const { data, error } = await adminClient
    .from("external_activity_observations")
    .upsert(row, { onConflict: "connection_id,provider_activity_id" })
    .select("id,provider_activity_id")
    .single();
  if (error) throw error;
  return data;
}

export async function markStravaObservationDeleted(adminClient: any, connectionId: string, activityId: string) {
  const { error } = await adminClient
    .from("external_activity_observations")
    .update({ source_deleted_at: new Date().toISOString(), source_updated_at: new Date().toISOString() })
    .eq("connection_id", connectionId)
    .eq("provider_activity_id", String(activityId));
  if (error) throw error;
}

export async function importRecentStravaActivities(adminClient: any, connection: any, accessToken: string) {
  const configuredDays = Number(Deno.env.get("STRAVA_INITIAL_IMPORT_DAYS") || "90");
  const days = Number.isFinite(configuredDays) ? Math.max(1, Math.min(365, Math.trunc(configuredDays))) : 90;
  const after = Math.floor((Date.now() - days * 86400000) / 1000);
  let imported = 0;

  for (let page = 1; page <= 10; page += 1) {
    const url = new URL(`${STRAVA_API_BASE}/athlete/activities`);
    url.searchParams.set("after", String(after));
    url.searchParams.set("page", String(page));
    url.searchParams.set("per_page", "100");
    const response = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) throw new Error(`Strava initial activity import failed (${response.status})`);
    const activities = await response.json();
    if (!Array.isArray(activities) || activities.length === 0) break;
    for (const activity of activities) {
      await upsertStravaObservation(adminClient, connection, activity);
      imported += 1;
    }
    if (activities.length < 100) break;
  }

  await adminClient
    .from("external_connections")
    .update({ last_sync_at: new Date().toISOString(), last_error_code: null })
    .eq("id", connection.id);

  return imported;
}

export async function revokeStravaToken(token: string) {
  const { clientId, clientSecret } = stravaAppConfig();
  if (!clientId || !clientSecret || !token) return;
  const basic = btoa(`${clientId}:${clientSecret}`);
  await fetch(STRAVA_REVOKE_URL, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ token }),
  }).catch(() => null);
}
