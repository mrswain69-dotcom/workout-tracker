import fs from "node:fs";
import { describe, expect, it } from "vitest";

const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");
const hubCss = fs.readFileSync(new URL("./GroupHub.css", import.meta.url), "utf8");
const groupDb = fs.readFileSync(new URL("./groupDb.js", import.meta.url), "utf8");
const stage0 = fs.readFileSync(new URL("../../docs/group-team-ecosystem-stage0.md", import.meta.url), "utf8");

const normalizeCss = (value) =>
  value.replace(/\s*([:;{},])\s*/g, "$1").replace(/\s+/g, " ").trim();

const normalizedStyles = normalizeCss(styles);
const normalizedHubCss = normalizeCss(hubCss);

describe("Group Stage 9 navigation and release integration contract", () => {
  it("uses the Phase 5 compact primary navigation without making Groups a text tab", () => {
    expect(app).toContain('["dashboard", "Dashboard"]');
    expect(app).toContain('["log", "Log"]');
    expect(app).toContain('["stats", "Progress"]');
    expect(app).toContain('["rewards", "Rewards"]');
    expect(app).toContain('className="groupHeaderButton"');
    expect(app).toContain('aria-label="Open Groups"');
    expect(app).not.toContain('["groups", "Groups"]');
  });

  it("keeps setup destinations inside Settings while preserving direct Assessment CTAs", () => {
    expect(app).toContain('["settings", "plan", "assessments", "connections", "appsettings"].includes(tab)');
    expect(app).toContain('["settings", "People"]');
    expect(app).toContain('["plan", "Plan"]');
    expect(app).toContain('["assessments", "Assessments"]');
    expect(app).toContain('["connections", "Connections"]');
    expect(app).toContain('["appsettings", "App"]');
    expect(app).toContain('aria-label="Open Settings"');
    expect(app).toContain('onOpenAssessments={() => setTab("assessments")}');
  });

  it("keeps primary and Settings targets touch-safe without separate setup shortcuts", () => {
    expect(normalizedStyles).toContain("@media(max-width:760px){");
    expect(normalizedStyles).toContain(".primaryNavTabs .btn{min-height:44px}");
    expect(normalizedStyles).toContain(".manageTab{flex:0 0 auto;min-width:108px;min-height:44px");
    expect(normalizedHubCss).toContain(".groupHeaderButton{width:44px;height:44px;min-width:44px");
    expect(app).not.toContain("setupTabsDesktop");
  });

  it("keeps the Group shell full-screen and horizontally safe on mobile", () => {
    expect(normalizedHubCss).toContain("@media(max-width:760px){.groupHubBackdrop{padding:0}.groupHubShell{width:100%;height:100%;max-height:none;border-radius:0;border:0}");
    expect(normalizedHubCss).toContain(".groupHubTabs{display:flex;gap:8px;padding:14px 22px;border-bottom:1px solid rgba(255,255,255,.08);overflow:auto}");
  });

  it("retains the Stage 0 decision to defer Training/Performance Progress tabs until truthful Training parity exists", () => {
    expect(stage0).toMatch(/Progress should gain two internal sub-tabs:[\s\S]*\*\*Training\*\*[\s\S]*\*\*Performance\*\*[\s\S]*Do \*\*not\*\* add these tabs[\s\S]*legacy Stats replacement[\s\S]*Training[\s\S]*not an empty or misleading destination/i);
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
