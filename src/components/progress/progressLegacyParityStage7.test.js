import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");
const dashboardSource = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/ProgressDashboard.jsx"),
  "utf8"
);

describe("Progress legacy Stats retirement", () => {
  it("retires the duplicate legacy Stats layout after the new Dashboard absorbs its useful headlines", () => {
    expect(appSource).not.toContain("progressLegacyStats");
    expect(appSource).toContain("summaryStats={stats}");
    expect(appSource).toContain("recordStats={records}");
    expect(dashboardSource).toContain('label="Most active day"');
    expect(dashboardSource).toContain('label="Most active week"');
    expect(dashboardSource).toContain('label="Best cardio speed"');
    expect(dashboardSource).toContain('label="Best cardio distance"');
  });

  it("keeps block-type trend charts in the new Dashboard without mixing their units", () => {
    expect(dashboardSource).toContain('title="Strength sets"');
    expect(dashboardSource).toContain('title="Cardio time"');
    expect(dashboardSource).toContain('title="Duration activity"');
    expect(dashboardSource).toContain('title="Structured Sessions"');
    expect(dashboardSource).toContain("does not combine unrelated activity measures");
  });
});
