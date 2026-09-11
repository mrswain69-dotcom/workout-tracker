import fs from "node:fs";
import { describe, expect, it } from "vitest";

const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const hubCss = fs.readFileSync(new URL("./GroupHub.css", import.meta.url), "utf8");
const groupDb = fs.readFileSync(new URL("./groupDb.js", import.meta.url), "utf8");
const stage0 = fs.readFileSync(new URL("../../docs/group-team-ecosystem-stage0.md", import.meta.url), "utf8");

describe("Group Stage 9 navigation and release integration contract", () => {
  it("uses the locked compact primary navigation without making Groups a sixth text tab", () => {
    expect(app).toContain('["log", "stats", "rewards"].map((t) => (');
    expect(app).toContain('className="groupHeaderButton"');
    expect(app).toContain('aria-label="Open Groups"');
    expect(app).not.toContain('["log", "stats", "groups"');
    expect(app).not.toContain('["log", "stats", "plan", "assessments", "rewards"].map');
  });

  it("keeps Plan and Assessments in one management surface while preserving direct Assessment CTAs", () => {
    expect(app).toContain('["settings", "plan", "assessments"].includes(tab)');
    expect(app).toContain('["settings", "General"]');
    expect(app).toContain('["plan", "Plan"]');
    expect(app).toContain('["assessments", "Assessments"]');
    expect(app).toContain('aria-label="Manage Workout Tracker"');
    expect(app).toContain('onOpenAssessments={() => setTab("assessments")}');
  });

  it("hides setup shortcuts on mobile and keeps every primary/manage target at least 44px tall", () => {
    expect(styles).toContain(".setupTabsDesktop{display:contents}");
    expect(styles).toMatch(/@media\(max-width:760px\)[\s\S]*?\.setupTabsDesktop\{display:none\}/);
    expect(styles).toContain(".primaryNavTabs .btn{min-height:44px}");
    expect(styles).toContain(".manageTab{flex:1 1 0;min-height:44px");
    expect(hubCss).toContain(".groupHeaderButton{width:44px;height:44px;min-width:44px");
  });

  it("keeps the Group shell full-screen and horizontally safe on mobile", () => {
    expect(hubCss).toMatch(/@media\(max-width:760px\)[\s\S]*?\.groupHubBackdrop\{padding:0\}/);
    expect(hubCss).toMatch(/@media\(max-width:760px\)[\s\S]*?\.groupHubShell\{width:100%;height:100%;max-height:none;border-radius:0;border:0\}/);
    expect(hubCss).toContain(".groupHubTabs{display:flex;gap:8px;padding:14px 22px;border-bottom:1px solid rgba(255,255,255,.08);overflow:auto}");
  });

  it("retains the Stage 0 decision to defer Training/Performance Progress tabs until truthful Training parity exists", () => {
    expect(stage0).toContain("do **not** introduce Progress `Training | Performance` tabs until the legacy Stats revamp has truthful Training content");
    expect(app).not.toContain('["training", "performance"]');
    expect(app).not.toContain('["Training", "Performance"]');
  });

  it("keeps browser Group reads on the deliberately safe surface instead of cross-family private profiles/logs", () => {
    expect(groupDb).toContain('.from("group_member_directory")');
    expect(groupDb).not.toContain('.from("logs")');
    expect(groupDb).not.toContain('.from("assessment_runs")');
    expect(groupDb).not.toContain('.from("assessment_test_results")');
    expect(groupDb).not.toMatch(/\.from\("profiles"\)[\s\S]*?\.select/);
  });

  it("keeps every protected scorer behind authenticated Edge Functions rather than browser-authored scores", () => {
    for (const slug of [
      "group-xp-leaderboard",
      "group-consistency-leaderboard",
      "group-improvement-leaderboard",
      "group-seasons-awards",
    ]) {
      expect(groupDb).toContain(`supabase.functions.invoke("${slug}"`);
    }
  });
});
