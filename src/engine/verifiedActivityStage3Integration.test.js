import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

const migrationPath = "supabase/migrations/20260912225045_verification_stage3_matching_metadata.sql";

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
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
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
});
