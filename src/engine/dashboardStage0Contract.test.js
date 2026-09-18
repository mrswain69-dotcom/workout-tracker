import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../components/dashboard/PerformanceDashboard.jsx", import.meta.url),
  "utf8"
);

describe("Phase 5 dashboard contract", () => {
  it("keeps the dashboard focused on now, weekly performance and actionable routes", () => {
    expect(source).toContain("PERFORMANCE COACH");
    expect(source).toContain("XP this week");
    expect(source).toContain("Weekly performance summary");
    expect(source).toContain("Progress highlights");
    expect(source).toContain("Group activity");
    expect(source).toContain("CONNECTED ACTIVITY");
    expect(source).toContain("Open Today’s Log");
  });

  it("loads connected, group and assessment context without making those primary navigation tabs", () => {
    expect(source).toContain("loadVerifiedActivityData");
    expect(source).toContain("listProfileGroups");
    expect(source).toContain("listAssessmentSchedules");
    expect(source).toContain("buildAssessmentScheduleStatuses");
  });
});
