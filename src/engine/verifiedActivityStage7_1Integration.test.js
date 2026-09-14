import fs from "node:fs";
import { describe, expect, it } from "vitest";

function read(path) { return fs.readFileSync(path, "utf8"); }

describe("Verification Integrations Stage 7.1 connection management architecture", () => {
  it("moves provider management to Settings and makes athlete assignment explicit", () => {
    const app = read("src/App.jsx");
    const settings = read("src/components/settings/ConnectionsSettings.jsx");
    expect(app).toContain('["connections", "Connections"]');
    expect(app).toContain("<ConnectionsSettings");
    expect(settings).toContain('aria-label="Athlete for connected apps"');
    expect(settings).toContain("Connect the Strava account you authorise to ${selectedName}?");
    expect(settings).toContain("startStravaConnection(selectedProfile.id");
  });

  it("keeps Progress evidence read-only and removes provider management from Assessment Analysis", () => {
    const progress = read("src/components/progress/ProgressDashboard.jsx");
    const analysis = read("src/components/progress/AssessmentAnalysisSection.jsx");
    const evidence = read("src/components/progress/VerifiedActivityEvidenceSection.jsx");
    expect(progress).toContain("VerifiedActivityEvidenceSection");
    expect(analysis).not.toContain("VerifiedActivitySection");
    expect(analysis).toContain("verificationData = null");
    expect(evidence).not.toContain("startStravaConnection");
    expect(evidence).not.toContain("disconnectStravaConnection");
  });

  it("keeps stream preference writes server-authority and scrubs disabled optional data", () => {
    const migration = read("supabase/migrations/20260914133500_verification_stage7_1_connection_preferences.sql");
    const edge = read("supabase/functions/external-connection-preferences/index.ts");
    const adapter = read("src/connectionSettingsDb.js");
    expect(migration).toContain("create table if not exists public.external_connection_preferences");
    expect(migration).toContain("grant select on table public.external_connection_preferences to authenticated");
    expect(adapter).toContain('supabase.functions.invoke("external-connection-preferences"');
    expect(edge).toContain("scrub.average_heart_rate_bpm = null");
    expect(edge).toContain("scrub.elevation_gain_m = null");
  });

  it("persists provider account labels and applies stream preferences before Strava observations are stored", () => {
    const callback = read("supabase/functions/strava-oauth-callback/index.ts");
    const provider = read("supabase/functions/_shared/stravaProvider.ts");
    expect(callback).toContain("provider_account_label");
    expect(provider).toContain("loadExternalConnectionPreferences");
    expect(provider).toContain("preferences.heart_rate_enabled");
    expect(provider).toContain("preferences.performance_metrics_enabled");
  });
});
