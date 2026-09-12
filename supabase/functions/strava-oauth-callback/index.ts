import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  STRAVA_TOKEN_URL,
  cleanScopes,
  createAdminClient,
  fixedAppRedirect,
  hasActivityReadScope,
  importRecentStravaActivities,
  json,
  revokeStravaToken,
  sha256Hex,
  storeStravaTokens,
  stravaAppConfig,
} from "../_shared/stravaProvider.ts";

function redirect(status: string, detail = "") {
  const location = fixedAppRedirect(status, detail);
  if (!location) return json({ provider: "strava", status, detail }, status === "connected" ? 200 : 400);
  return new Response(null, { status: 302, headers: { Location: location, "Cache-Control": "no-store" } });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const adminClient = createAdminClient();
  const config = stravaAppConfig();
  if (!adminClient || !config.clientId || !config.clientSecret || !config.oauthCallbackUrl) {
    return json({ error: "Strava connection is not configured yet" }, 503);
  }

  try {
    const url = new URL(req.url);
    const state = url.searchParams.get("state") || "";
    const code = url.searchParams.get("code") || "";
    const oauthError = url.searchParams.get("error") || "";
    if (!state) return redirect("failed", "missing_state");

    const stateHash = await sha256Hex(state);
    const now = new Date().toISOString();

    // Consume exactly one still-valid state. Replays no longer match after this update.
    const { data: oauthState, error: stateError } = await adminClient
      .from("strava_oauth_states")
      .update({ consumed_at: now })
      .eq("state_hash", stateHash)
      .is("consumed_at", null)
      .gt("expires_at", now)
      .select("id,family_id,profile_id,requested_scopes")
      .maybeSingle();
    if (stateError || !oauthState) return redirect("failed", "invalid_or_expired_state");

    if (oauthError || !code) return redirect("denied", oauthError || "authorization_not_granted");

    const tokenResponse = await fetch(STRAVA_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        grant_type: "authorization_code",
      }),
    });
    const tokenData = await tokenResponse.json().catch(() => ({}));
    if (!tokenResponse.ok) {
      console.error("Strava OAuth token exchange failed", tokenResponse.status);
      return redirect("failed", "token_exchange_failed");
    }

    const accessToken = typeof tokenData?.access_token === "string" ? tokenData.access_token : "";
    const athleteId = tokenData?.athlete?.id === null || tokenData?.athlete?.id === undefined
      ? ""
      : String(tokenData.athlete.id);
    const grantedScopes = cleanScopes(tokenData?.scope);
    if (!accessToken || !athleteId) {
      await revokeStravaToken(accessToken);
      return redirect("failed", "incomplete_token_response");
    }

    const scopeOkay = hasActivityReadScope(grantedScopes);
    const connectionPayload = {
      family_id: oauthState.family_id,
      profile_id: oauthState.profile_id,
      provider: "strava",
      provider_account_id: athleteId,
      status: scopeOkay ? "active" : "error",
      auto_sync_enabled: true,
      scopes: grantedScopes,
      connected_at: scopeOkay ? now : null,
      disconnected_at: null,
      last_error_code: scopeOkay ? null : "missing_activity_read_scope",
    };

    const { data: connection, error: connectionError } = await adminClient
      .from("external_connections")
      .upsert(connectionPayload, { onConflict: "profile_id,provider" })
      .select("id,family_id,profile_id,provider,provider_account_id,status,scopes")
      .single();
    if (connectionError || !connection) {
      console.error("Strava connection persistence failed", connectionError);
      await revokeStravaToken(accessToken);
      return redirect("failed", "connection_persistence_failed");
    }

    if (!scopeOkay) {
      await revokeStravaToken(accessToken);
      return redirect("failed", "activity_read_scope_required");
    }

    try {
      await storeStravaTokens(adminClient, connection.id, tokenData);
    } catch (tokenStoreError) {
      console.error("Strava token persistence failed", tokenStoreError);
      await revokeStravaToken(accessToken);
      await adminClient
        .from("external_connections")
        .update({ status: "error", last_error_code: "token_persistence_failed" })
        .eq("id", connection.id);
      return redirect("failed", "token_persistence_failed");
    }

    EdgeRuntime.waitUntil(
      importRecentStravaActivities(adminClient, connection, accessToken).catch(async (error) => {
        console.error("Strava initial import failed", error);
        await adminClient
          .from("external_connections")
          .update({ last_error_code: "initial_import_failed" })
          .eq("id", connection.id);
      })
    );

    return redirect("connected");
  } catch (error) {
    console.error("Strava OAuth callback failed", error);
    return redirect("failed", "callback_failed");
  }
});
