import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  createUserClient,
  json,
  revokeStravaToken,
} from "../_shared/stravaProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Authentication required" }, 401, corsHeaders);

    const userClient = createUserClient(jwt);
    const adminClient = createAdminClient();
    if (!userClient || !adminClient) return json({ error: "Strava service unavailable" }, 503, corsHeaders);

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) return json({ error: "Authentication required" }, 401, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId) return json({ error: "Athlete profile is required" }, 400, corsHeaders);

    // Ownership is resolved with the authenticated/RLS client before token authority is touched.
    const { data: connection, error: connectionError } = await userClient
      .from("external_connections")
      .select("id,profile_id,provider,status")
      .eq("profile_id", profileId)
      .eq("provider", "strava")
      .maybeSingle();
    if (connectionError || !connection) return json({ error: "Strava connection not available" }, 404, corsHeaders);

    const { data: accessRow } = await adminClient
      .from("external_connection_access_tokens")
      .select("access_token")
      .eq("connection_id", connection.id)
      .maybeSingle();
    const { data: refreshRow } = await adminClient
      .from("external_connection_refresh_tokens")
      .select("refresh_token")
      .eq("connection_id", connection.id)
      .maybeSingle();

    // Current Strava revoke invalidates the linked token family. Prefer refresh token
    // if present so all associated access tokens are invalidated together.
    await revokeStravaToken(String(refreshRow?.refresh_token || accessRow?.access_token || ""));

    const disconnectedAt = new Date().toISOString();
    const [connectionResult] = await Promise.all([
      adminClient
        .from("external_connections")
        .update({ status: "disconnected", disconnected_at: disconnectedAt, last_error_code: null })
        .eq("id", connection.id),
      adminClient.from("external_connection_access_tokens").delete().eq("connection_id", connection.id),
      adminClient.from("external_connection_refresh_tokens").delete().eq("connection_id", connection.id),
    ]);
    if (connectionResult.error) throw connectionResult.error;

    return json({ provider: "strava", status: "disconnected" }, 200, corsHeaders);
  } catch (error) {
    console.error("Strava disconnect failed", error);
    return json({ error: "Could not disconnect Strava" }, 500, corsHeaders);
  }
});
