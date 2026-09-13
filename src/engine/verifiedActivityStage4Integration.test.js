import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Verification Integration Stage 4 UI contract", () => {
  it("keeps Connected Sources inside the existing lazy Progress surface rather than adding primary navigation", () => {
    const section = read("src/components/progress/AssessmentAnalysisSection.jsx");
    const dashboard = read("src/components/progress/ProgressDashboard.jsx");
    const app = read("src/App.jsx");

    expect(section).toContain('import VerifiedActivitySection from "./VerifiedActivitySection.jsx"');
    expect(section).toContain("<VerifiedActivitySection");
    expect(dashboard).toContain('lazy(() => import("./AssessmentAnalysisSection.jsx"))');
    expect(app).not.toContain('import VerifiedActivitySection from "./components/progress/VerifiedActivitySection.jsx"');
    expect(app).not.toMatch(/(?:verification|connections|strava|garmin)["']\s*,\s*(?:"|')?(?:Progress|Rewards|Log)/i);
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

  it("states the reward-neutral contract in the visible verification UI", () => {
    const component = read("src/components/progress/VerifiedActivitySection.jsx");

    expect(component).toContain("does not duplicate workouts or XP");
    expect(component).toContain("0 bonus XP · evidence only");
    expect(component).not.toMatch(/grantXp|awardXp|xpDelta\s*[:=]\s*[1-9]/i);
  });

  it("keeps future provider availability truthful rather than presenting fake live connections", () => {
    const component = read("src/components/progress/VerifiedActivitySection.jsx");

    expect(component).toContain('id: "garmin"');
    expect(component).toContain('state: "planned"');
    expect(component).toContain('id: "apple_health"');
    expect(component).toContain('state: "native"');
    expect(component).toContain('id: "health_connect"');
    expect(component).toContain("Native app bridge");
  });
});
