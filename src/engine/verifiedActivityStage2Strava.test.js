import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migration = () => read("supabase/migrations/20260912223527_verification_stage2_strava_server_authority.sql");
const start = () => read("supabase/functions/strava-oauth-start/index.ts");
const callback = () => read("supabase/functions/strava-oauth-callback/index.ts");
const webhook = () => read("supabase/functions/strava-webhook/index.ts");
const disconnect = () => read("supabase/functions/strava-disconnect/index.ts");
const shared = () => read("supabase/functions/_shared/stravaProvider.ts");

describe("Verification Integration Stage 2 Strava contract", () => {
  it("keeps access and refresh token authority separate and server-only", () => {
    const sql = migration();

    expect(sql).toContain("create table public.external_connection_access_tokens");
    expect(sql).toContain("create table public.external_connection_refresh_tokens");
    expect(sql).toContain("create table public.strava_oauth_states");
    expect(sql).toContain("create table public.strava_webhook_events");
    expect(sql).toContain("revoke all on table public.external_connection_access_tokens from public, anon, authenticated");
    expect(sql).toContain("grant select, insert, update, delete on table public.external_connection_access_tokens to service_role");
    expect(sql).toContain("external_connection_access_tokens_no_client_access");
    expect(sql).toContain("external_connection_refresh_tokens_no_client_access");
    expect(sql).not.toMatch(/grant\s+.*external_connection_(?:access|refresh)_tokens.*authenticated/i);
    expect(sql).not.toMatch(/update\s+public\.logs/i);
  });

  it("proves exact athlete ownership before creating one-time OAuth state and requests read-only activity scope", () => {
    const source = start();
    const ownershipIndex = source.indexOf('.from("profiles")');
    const privilegedStateIndex = source.indexOf('.from("strava_oauth_states").insert');

    expect(source).toContain("userClient.auth.getUser(jwt)");
    expect(source).toContain('.eq("id", profileId)');
    expect(ownershipIndex).toBeGreaterThan(-1);
    expect(privilegedStateIndex).toBeGreaterThan(ownershipIndex);
    expect(source).toContain('includePrivate ? "activity:read_all" : "activity:read"');
    expect(source).not.toContain("activity:write");
    expect(source).toContain("stateHash = await sha256Hex(state)");
    expect(source).not.toContain("state_hash: state,");
  });

  it("consumes OAuth state once, validates granted scope and never returns provider tokens to the browser", () => {
    const source = callback();

    expect(source).toContain('.update({ consumed_at: now })');
    expect(source).toContain('.eq("state_hash", stateHash)');
    expect(source).toContain('.is("consumed_at", null)');
    expect(source).toContain('.gt("expires_at", now)');
    expect(source).toContain("hasActivityReadScope(grantedScopes)");
    expect(source).toContain("storeStravaTokens(adminClient, connection.id, tokenData)");
    expect(source).toContain('return redirect("connected")');
    expect(source).not.toMatch(/return\s+json\([^)]*(?:access_token|refresh_token)/i);
    expect(source).not.toContain("activity:write");
  });

  it("rotates short-lived credentials by always persisting the newest refresh-token response", () => {
    const source = shared();

    expect(source).toContain('grant_type: "refresh_token"');
    expect(source).toContain("refresh_token: String(refreshResult.data.refresh_token)");
    expect(source).toContain("storeStravaTokens(adminClient, connectionId, tokenData)");
    expect(source).toContain('.from("external_connection_access_tokens").upsert');
    expect(source).toContain('.from("external_connection_refresh_tokens").upsert');
    expect(source).toContain("expiresMs - Date.now() > 60 * 60 * 1000");
  });

  it("verifies signed webhooks, persists before acknowledgement work and processes asynchronously", () => {
    const source = webhook();
    const persistIndex = source.indexOf('.from("strava_webhook_events")\n    .insert');
    const backgroundIndex = source.indexOf("EdgeRuntime.waitUntil(processEvent");

    expect(source).toContain('req.headers.get("X-Strava-Signature")');
    expect(source).toContain('new TextEncoder().encode(`${timestamp}.${rawBody}`)');
    expect(source).toContain("Math.abs(Date.now() / 1000 - timestampSeconds) > 300");
    expect(source).toContain('url.searchParams.get("hub.challenge")');
    expect(source).toContain('return json({ "hub.challenge": challenge })');
    expect(persistIndex).toBeGreaterThan(-1);
    expect(backgroundIndex).toBeGreaterThan(persistIndex);
    expect(source).toContain('code === "23505"');
    expect(source).toContain("duplicate: true");
  });

  it("syncs only external evidence and preserves manual Workout Tracker authority on updates, deletes and deauthorization", () => {
    const hook = webhook();
    const helper = shared();
    const disconnectSource = disconnect();

    expect(helper).toContain('.from("external_activity_observations")');
    expect(helper).not.toContain('.from("logs")');
    expect(helper).not.toContain("log_json");
    expect(hook).toContain("markStravaObservationDeleted");
    expect(hook).toContain('status: "disconnected"');
    expect(hook).toContain('.from("external_connection_access_tokens").delete');
    expect(hook).toContain('.from("external_connection_refresh_tokens").delete');
    expect(hook).not.toMatch(/\.from\("external_activity_observations"\)\s*\.delete/);
    expect(hook).not.toContain('.from("logs")');
    expect(disconnectSource).not.toContain('.from("logs")');
    expect(disconnectSource).not.toContain("log_json");
  });

  it("keeps OAuth secrets out of the client adapter", () => {
    const source = read("src/stravaConnectionDb.js").toLowerCase();

    expect(source).toContain('supabase.functions.invoke("strava-oauth-start"');
    expect(source).toContain('supabase.functions.invoke("strava-disconnect"');
    expect(source).not.toContain("access_token");
    expect(source).not.toContain("refresh_token");
    expect(source).not.toContain("client_secret");
  });
});
