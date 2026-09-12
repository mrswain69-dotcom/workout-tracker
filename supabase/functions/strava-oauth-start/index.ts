import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  STRAVA_AUTHORIZE_URL,
  createAdminClient,
  createUserClient,
  json,
  randomUrlSafe,
  sha256Hex,
  stravaAppConfig,
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
    const config = stravaAppConfig();
    if (!userClient || !adminClient || !config.clientId || !config.oauthCallbackUrl) {
      return json({ error: "Strava connection is not configured yet" }, 503, corsHeaders);
    }

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) return json({ error: "Authentication required" }, 401, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    const includePrivate = body?.includePrivate === true;
    if (!profileId) return json({ error: "Athlete profile is required" }, 400, corsHeaders);

    // Exact-athlete ownership is proven through normal profile RLS before the
    // privileged client may create any OAuth state.
    const { data: ownedProfile, error: profileError } = await userClient
      .from("profiles")
      .select("id,family_id")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError || !ownedProfile) return json({ error: "Athlete profile not available" }, 403, corsHeaders);

    const state = randomUrlSafe(32);
    const stateHash = await sha256Hex(state);
    const scopes = [includePrivate ? "activity:read_all" : "activity:read"];
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    const { error: stateError } = await adminClient.from("strava_oauth_states").insert({
      state_hash: stateHash,
      family_id: ownedProfile.family_id,
      profile_id: ownedProfile.id,
      requested_scopes: scopes,
      expires_at: expiresAt,
    });
    if (stateError) {
      console.error("Strava OAuth state creation failed", stateError);
      return json({ error: "Could not start Strava connection" }, 500, corsHeaders);
    }

    const authorize = new URL(STRAVA_AUTHORIZE_URL);
    authorize.searchParams.set("client_id", config.clientId);
    authorize.searchParams.set("redirect_uri", config.oauthCallbackUrl);
    authorize.searchParams.set("response_type", "code");
    authorize.searchParams.set("approval_prompt", "auto");
    authorize.searchParams.set("scope", scopes.join(","));
    authorize.searchParams.set("state", state);

    return json(
      {
        authorizeUrl: authorize.toString(),
        provider: "strava",
        scopes,
        expiresAt,
      },
      200,
      corsHeaders
    );
  } catch (error) {
    console.error("Strava OAuth start failed", error);
    return json({ error: "Could not start Strava connection" }, 500, corsHeaders);
  }
});
