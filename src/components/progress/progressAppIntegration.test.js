import fs from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(new URL("../../App.jsx", import.meta.url), "utf8");

describe("Phase 3 Stage 4 App integration contract", () => {
  it("keeps the existing stats destination as visible Progress within the Phase 5 navigation contract", () => {
    expect(appSource).toContain('["dashboard", "Dashboard"]');
    expect(appSource).toContain('["stats", "Progress"]');
    expect(appSource).toContain('["rewards", "Rewards"]');
    expect(appSource).not.toContain('["progress", "Progress"]');
  });

  it("mounts ProgressDashboard as the single Progress surface and retires legacy Stats", () => {
    const statsRoute = appSource.indexOf('{tab === "stats" && (');
    const progressShell = appSource.indexOf("<ProgressDashboard", statsRoute);

    expect(statsRoute).toBeGreaterThanOrEqual(0);
    expect(progressShell).toBeGreaterThan(statsRoute);
    expect(appSource).not.toContain("progressLegacyStats");
    expect(appSource).toContain("summaryStats={stats}");
    expect(appSource).toContain("recordStats={records}");
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
