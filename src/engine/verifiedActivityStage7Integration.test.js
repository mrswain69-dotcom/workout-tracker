import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

describe("Verification Integrations Stage 7 provenance hardening", () => {
  it("persists provider-neutral provenance without changing manual Workout Tracker logs", () => {
    const migration = read("supabase/migrations/20260914093000_verification_stage7_source_provenance.sql");

    expect(migration).toContain("source_manual_entry boolean not null default false");
    expect(migration).toContain("source_device_name text");
    expect(migration).toContain("source_external_id text");
    expect(migration).toContain("source_upload_id text");
    expect(migration).toContain("public.external_activity_observations");
    expect(migration).not.toContain("public.logs");
  });

  it("maps Strava manual, device and upload provenance into observations server-side", () => {
    const provider = read("supabase/functions/_shared/stravaProvider.ts");

    expect(provider).toContain("source_manual_entry: activity?.manual === true");
    expect(provider).toContain("source_device_name:");
    expect(provider).toContain("activity?.device_name");
    expect(provider).toContain("source_external_id:");
    expect(provider).toContain("activity?.external_id");
    expect(provider).toContain("source_upload_id:");
    expect(provider).toContain("activity?.upload_id");
    expect(provider).not.toContain('.from("logs")');
  });

  it("keeps provenance readable in the private athlete adapter without exposing provider credentials", () => {
    const adapter = read("src/verifiedActivityDb.js");

    expect(adapter).toContain("source_manual_entry");
    expect(adapter).toContain("source_device_name");
    expect(adapter).toContain("source_external_id");
    expect(adapter).toContain("source_upload_id");
    expect(adapter).not.toContain("client_secret");
    expect(adapter).not.toContain("access_token");
    expect(adapter).not.toContain("refresh_token");
  });

  it("never promotes a provider-manual entry into verified cardio or plan completion authority", () => {
    const cardio = read("src/engine/verifiedCardioEvidenceEngine.js");
    const plan = read("src/engine/verifiedPlanCompletionEngine.js");

    expect(cardio).toContain("row.source_manual_entry !== true");
    expect(cardio).toContain('verificationLevel: "device_or_file"');
    expect(cardio).toContain('"provider_recorded"');
    expect(cardio).toContain('authority: "verified_evidence_only"');
    expect(cardio).toContain("rewardXp: 0");
    expect(plan).toContain("row?.source_manual_entry === true");
    expect(plan).toContain('verificationLevel === "provider_manual"');
    expect(plan).toContain("row?.verificationEligible === false");
    expect(plan).toContain("rewardXp: 0");
  });

  it("uses truthful Connected Sources language for synced versus verification-eligible activity", () => {
    const ui = read("src/components/progress/VerifiedActivitySection.jsx");

    expect(ui).toContain("Synced activities");
    expect(ui).toContain("Manual provider entry · not verification eligible");
    expect(ui).toContain("Device/file evidence");
    expect(ui).toContain("Provider-recorded evidence");
    expect(ui).toContain("Provider-manual entries remain visible as synced activity");
    expect(ui).toContain("0 bonus XP · evidence only");
  });

  it("keeps rewards, improvement and Group callers isolated from private provider provenance", () => {
    const xp = read("src/engine/xpEngine.js");
    const improvement = read("src/engine/groupImprovementEngine.js");

    expect(xp).not.toContain("source_manual_entry");
    expect(xp).not.toContain("external_activity_observations");
    expect(improvement).not.toContain("source_manual_entry");
    expect(improvement).not.toContain("external_activity_observations");

    for (const file of [
      "supabase/functions/group-consistency-leaderboard/index.ts",
      "supabase/functions/group-seasons-awards/index.ts",
      "supabase/functions/group-challenges/index.ts",
    ]) {
      const source = read(file);
      expect(source).not.toContain("source_manual_entry");
      expect(source).not.toContain("external_activity_observations");
      expect(source).not.toContain("verified_activities");
    }
  });

  it("keeps the reusable Stage 6 plan policy byte-identical in every Group Edge bundle", () => {
    const sourcePolicy = read("src/engine/verifiedPlanCompletionEngine.js");
    for (const directory of [
      "supabase/functions/group-consistency-leaderboard",
      "supabase/functions/group-seasons-awards",
      "supabase/functions/group-challenges",
    ]) {
      expect(read(`${directory}/verifiedPlanCompletionEngine.js`)).toBe(sourcePolicy);
    }
  });
});
