import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Historical Timeline Stage 5 integration contract", () => {
  it("keeps private historical authority behind an authenticated own-profile Edge Function", () => {
    const source = read("supabase/functions/historical-timeline-data/index.ts");

    expect(source).toContain("userClient.auth.getUser(jwt)");
    expect(source).toContain('.from("profiles")');
    expect(source).toContain('.select("id,family_id,name,birth_date")');
    expect(source).toContain('.eq("id", profileId)');
    expect(source).toContain('adminClient\n        .from("profile_consistency_schedule_snapshots")'.replace("\\n", "\n"));
    expect(source).toContain('.eq("profile_id", profileId)');
    expect(source).toContain('adminClient\n        .from("group_memberships")'.replace("\\n", "\n"));
    expect(source).toContain('.eq("family_id", ownedProfile.family_id)');
    expect(source).toContain('.from("group_progress_awards")');
    expect(source).toContain('.in("membership_id", membershipIds)');

    expect(source).not.toMatch(/adminClient\s*\.from\("profiles"\)/);
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
  });

  it("uses the Edge Function from the browser rather than granting direct snapshot access", () => {
    const source = read("src/historicalTimelineDb.js");
    expect(source).toContain('supabase.functions.invoke("historical-timeline-data"');
    expect(source).not.toContain('from("profile_consistency_schedule_snapshots")');
    expect(source).not.toContain('from("group_progress_awards")');
  });

  it("places the autobiography inside the existing Progress content instead of adding primary navigation", () => {
    const section = read("src/components/progress/AssessmentAnalysisSection.jsx");
    const app = read("src/App.jsx");

    expect(section).toContain('import PerformanceAutobiography from "./PerformanceAutobiography.jsx"');
    expect(section).toContain("<PerformanceAutobiography");
    expect(section).toContain('profileName={timelineData?.profile?.name || "Athlete"}');
    expect(app).toContain('<ProgressDashboard');
    expect(app).toContain('{tab === "stats" && (');
    expect(app).not.toMatch(/\{\s*id:\s*["']timeline["']/i);
    expect(app).not.toMatch(/\{\s*id:\s*["']history["']/i);
  });

  it("keeps the visible autobiography derived-only and preserves the three-year integrity language", () => {
    const ui = read("src/components/progress/PerformanceAutobiography.jsx");
    const engine = read("src/engine/historicalMilestoneEngine.js");

    expect(ui).toContain("Performance Autobiography");
    expect(ui).toContain("Unlock the true age timeline");
    expect(ui).toContain("View evidence");
    expect(ui).toContain("Three years of real history unlocks the full career view");
    expect(engine).toContain("universalPercentage: null");
    expect(engine).toContain('state: "metric_specific_only"');
  });
});
