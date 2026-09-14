import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migrationPath =
  "supabase/migrations/20260912223027_verification_stage1_external_activity_foundation.sql";

describe("Verification Integration Stage 1 persistence contract", () => {
  it("creates a separate additive external activity persistence layer", () => {
    const migration = read(migrationPath);

    for (const table of [
      "external_connections",
      "external_activity_observations",
      "verified_activities",
      "verified_activity_observations",
      "external_activity_links",
    ]) {
      expect(migration).toContain(`create table public.${table}`);
      expect(migration).toContain(`alter table public.${table} enable row level security`);
    }

    expect(migration).not.toMatch(/update\s+public\.logs/i);
    expect(migration).not.toMatch(/update\s+public\.profiles/i);
    expect(migration).not.toMatch(/insert\s+into\s+public\.logs/i);
    expect(migration).not.toContain("plan_json");
  });

  it("keeps provider credentials out of browser-readable tables", () => {
    const migration = read(migrationPath).toLowerCase();

    expect(migration).not.toContain("access_token");
    expect(migration).not.toContain("refresh_token");
    expect(migration).not.toContain("client_secret");
    expect(migration).not.toContain("authorization_code");
  });

  it("keeps the browser read-only while preserving own-family RLS", () => {
    const migration = read(migrationPath);

    expect(migration).toContain("revoke all on table public.external_connections from anon, authenticated");
    expect(migration).toContain("grant select on table public.external_connections to authenticated");
    expect(migration).toContain("grant select on table public.external_activity_observations to authenticated");
    expect(migration).toContain("grant select on table public.verified_activities to authenticated");
    expect(migration).toContain("grant select on table public.verified_activity_observations to authenticated");
    expect(migration).toContain("grant select on table public.external_activity_links to authenticated");
    expect(migration).toMatch(/owner_user_id\s*=\s*\(select auth\.uid\(\)\)/);

    expect(migration).not.toMatch(/grant\s+(insert|update|delete|all).*to authenticated/i);
  });

  it("enforces one provider observation per physical verified activity", () => {
    const migration = read(migrationPath);

    expect(migration).toContain(
      "observation_id uuid not null unique references public.external_activity_observations(id) on delete cascade"
    );
    expect(migration).toContain("Verified activity and observation must belong to the same athlete");
    expect(migration).toContain("Verification link must join evidence and manual history for the same athlete");
  });

  it("provides a read-only client adapter and no client-side verified-data writes", () => {
    const source = read("src/verifiedActivityDb.js");

    expect(source).toContain('.from("external_connections")');
    expect(source).toContain('.from("external_activity_observations")');
    expect(source).toContain('.from("verified_activities")');
    expect(source).toContain('.from("verified_activity_observations")');
    expect(source).toContain('.from("external_activity_links")');
    expect(source).toContain('.eq("profile_id", profileId)');

    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
    expect(source.toLowerCase()).not.toContain("access_token");
    expect(source.toLowerCase()).not.toContain("refresh_token");
  });
});
