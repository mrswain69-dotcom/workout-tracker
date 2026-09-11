import fs from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");

describe("Phase 3 Stage 4 App integration contract", () => {
  it("keeps the existing stats destination as visible Progress within the Stage 9 navigation contract", () => {
    expect(appSource).toContain('["log", "stats", "rewards"]');
    expect(appSource).toContain('["plan", "assessments"]');
    expect(appSource).toContain('t === "stats" ? "Progress"');
    expect(appSource).not.toContain('["log", "stats", "progress"');
  });

  it("mounts ProgressDashboard inside the existing stats route before legacy Stats", () => {
    const statsRoute = appSource.indexOf('{tab === "stats" && (');
    const progressShell = appSource.indexOf("<ProgressDashboard", statsRoute);
    const legacyStats = appSource.indexOf('className="grid2cols progressLegacyStats"', statsRoute);

    expect(statsRoute).toBeGreaterThanOrEqual(0);
    expect(progressShell).toBeGreaterThan(statsRoute);
    expect(legacyStats).toBeGreaterThan(progressShell);
    expect(appSource).toContain('<div className="h2">Highlights</div>');
  });

  it("keeps the Assessment bridge and live app state wiring explicit", () => {
    expect(appSource).toContain("familyId={family?.id}");
    expect(appSource).toContain("profileId={activeProfileId}");
    expect(appSource).toContain("logs={allLogs}");
    expect(appSource).toContain("currentStreak={stats.streak}");
    expect(appSource).toContain("currentXp={xp}");
    expect(appSource).toContain('onOpenAssessments={() => setTab("assessments")}');
  });
});
