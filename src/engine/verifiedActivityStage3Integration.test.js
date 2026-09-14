import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migrationPath = "supabase/migrations/20260912225045_verification_stage3_matching_metadata.sql";
const uniquenessMigrationPath = "supabase/migrations/20260913082500_verification_stage3_manual_link_uniqueness.sql";

describe("Verification Integration Stage 3 persistence contract", () => {
  it("preserves provider-local date/timezone and versioned identity metadata", () => {
    const migration = read(migrationPath);

    expect(migration).toContain("add column if not exists local_date_ymd text");
    expect(migration).toContain("add column if not exists source_timezone text");
    expect(migration).toContain("add column if not exists identity_method text not null default 'single_source'");
    expect(migration).toContain("add column if not exists identity_confidence numeric");
    expect(migration).toContain("add column if not exists match_version text not null default 'verification_match_v1'");
    expect(migration).not.toMatch(/update\s+public\.logs/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.logs/i);
  });

  it("exposes matching metadata only through the read-only verification adapter", () => {
    const source = read("src/verifiedActivityDb.js");

    expect(source).toContain("started_at,local_date_ymd,source_timezone,activity_type");
    expect(source).toContain("status,identity_method,identity_confidence,match_version");
    expect(source).toContain('supabase.functions.invoke("verification-reconcile"');
    expect(source).not.toMatch(/\.from\([^)]*\)\s*\.(?:insert|update|upsert|delete)\s*\(/);
  });

  it("keeps Strava local date/timezone as provider evidence rather than manual log fields", () => {
    const source = read("supabase/functions/_shared/stravaProvider.ts");

    expect(source).toContain("activity?.start_date_local");
    expect(source).toContain("local_date_ymd: localDateFromStrava(activity)");
    expect(source).toContain("source_timezone:");
    expect(source).not.toContain('.from("logs")');
    expect(source).not.toContain("log_json");
  });

  it("keeps matching reward-neutral and separate from the XP engine", () => {
    const matching = read("src/engine/verificationMatchingEngine.js");
    const authority = read("src/engine/verifiedActivityEngine.js");

    expect(matching).not.toMatch(/xpDelta|multiplier|awardXp|grantXp/i);
    expect(authority).toContain('policy: "verification_bonus_not_activated"');
    expect(authority).toContain("multiplier: 1");
    expect(authority).toContain("xpDelta: 0");
  });

  it("prevents two verified identities from claiming the same manual target", () => {
    const migration = read(uniquenessMigrationPath);
    const reconcile = read("supabase/functions/_shared/verificationReconcile.ts");

    expect(migration).toContain("external_activity_links_unique_manual_block");
    expect(migration).toContain("external_activity_links_unique_manual_log");
    expect(migration).toContain("where manual_block_id is not null");
    expect(migration).toContain("where manual_block_id is null");
    expect(migration).not.toMatch(/update\s+public\.logs/i);
    expect(reconcile).toContain("claimedManualTargets");
    expect(reconcile).toContain("availableCandidates");
  });

  it("recomputes derived manual links instead of mutating workout history", () => {
    const reconcile = read("supabase/functions/_shared/verificationReconcile.ts");

    expect(reconcile).toContain('.from("external_activity_links")');
    expect(reconcile).toContain('.delete()');
    expect(reconcile).toContain('.insert({');
    expect(reconcile).toContain('adminClient.from("logs").select("id,profile_id,date_ymd,log_json")');
    expect(reconcile).not.toMatch(/\.from\("logs"\)\.(?:insert|update|upsert|delete)/);
  });

  it("automatically reconciles after initial import and Strava activity webhooks", () => {
    const callback = read("supabase/functions/strava-oauth-callback/index.ts");
    const webhook = read("supabase/functions/strava-webhook/index.ts");

    expect(callback).toContain('import { reconcileVerifiedActivitiesForProfile } from "../_shared/verificationReconcile.ts"');
    expect(callback).toContain("await importRecentStravaActivities");
    expect(callback).toContain("await reconcileVerifiedActivitiesForProfile(adminClient, connection.profile_id)");
    expect(webhook).toContain('import { reconcileVerifiedActivitiesForProfile } from "../_shared/verificationReconcile.ts"');
    expect(webhook.match(/reconcileVerifiedActivitiesForProfile\(adminClient, connection\.profile_id\)/g)?.length).toBeGreaterThanOrEqual(2);
    expect(webhook).not.toMatch(/\.from\("logs"\)\.(?:insert|update|upsert|delete)/);
  });

  it("keeps the direct reconcile endpoint authenticated and exact-profile scoped", () => {
    const endpoint = read("supabase/functions/verification-reconcile/index.ts");

    expect(endpoint).toContain("Authentication required");
    expect(endpoint).toContain('.from("profiles")');
    expect(endpoint).toContain('.eq("id", profileId)');
    expect(endpoint).toContain("reconcileVerifiedActivitiesForProfile(adminClient, ownedProfile.id)");
  });
});