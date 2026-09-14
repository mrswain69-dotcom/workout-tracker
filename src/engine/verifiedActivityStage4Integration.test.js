import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Verification Integration Stage 4 UI contract", () => {
  it("keeps provider management in Settings while Progress remains the read-only evidence surface", () => {
    const settings = read("src/components/settings/ConnectionsSettings.jsx");
    const evidence = read("src/components/progress/VerifiedActivityEvidenceSection.jsx");
    const dashboard = read("src/components/progress/ProgressDashboard.jsx");
    const analysis = read("src/components/progress/AssessmentAnalysisSection.jsx");
    const app = read("src/App.jsx");

    expect(app).toContain('["connections", "Connections"]');
    expect(app).toContain("<ConnectionsSettings");
    expect(settings).toContain('aria-label="Athlete for connected apps"');
    expect(settings).toContain("startStravaConnection(selectedProfile.id");
    expect(dashboard).toContain('import VerifiedActivityEvidenceSection from "./VerifiedActivityEvidenceSection.jsx"');
    expect(dashboard).toContain("<VerifiedActivityEvidenceSection");
    expect(analysis).not.toContain("VerifiedActivitySection");
    expect(evidence).not.toContain("startStravaConnection");
    expect(evidence).not.toContain("disconnectStravaConnection");
  });

  it("keeps browser persistence read-only while connection actions go through authenticated Edge Functions", () => {
    const db = read("src/verifiedActivityDb.js");

    expect(db).toContain('supabase.functions.invoke("strava-oauth-start"');
    expect(db).toContain('supabase.functions.invoke("strava-disconnect"');
    expect(db).toContain('supabase.functions.invoke("verification-reconcile"');
    expect(db).toContain('.from("external_connections")');
    expect(db).toContain('.from("external_activity_observations")');
    expect(db).toContain('.from("verified_activities")');
    expect(db).not.toMatch(/\.from\([^)]*\)\s*\.(?:insert|update|upsert|delete)\s*\(/);
    expect(db).not.toContain('.from("logs")');
  });

  it("states the reward-neutral contract in the visible Progress evidence UI", () => {
    const evidence = read("src/components/progress/VerifiedActivityEvidenceSection.jsx");

    expect(evidence).toContain("Provider evidence stays separate from manual workout history and rewards.");
    expect(evidence).toContain("0 bonus XP · evidence only");
    expect(evidence).toContain("Evidence only · PB authority unchanged");
    expect(evidence).not.toMatch(/grantXp|awardXp|xpDelta\s*[:=]\s*[1-9]/i);
  });

  it("keeps future provider availability truthful rather than presenting fake live connections", () => {
    const settings = read("src/components/settings/ConnectionsSettings.jsx");

    expect(settings).toContain('id: "garmin"');
    expect(settings).toContain('status: "Provider access paused"');
    expect(settings).toContain('id: "apple_health"');
    expect(settings).toContain('status: "Native bridge planned"');
    expect(settings).toContain('id: "health_connect"');
    expect(settings).toContain("Future Android connection");
  });
});