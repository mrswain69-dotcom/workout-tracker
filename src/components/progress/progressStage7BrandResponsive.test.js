import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const css = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/ProgressDashboardStage7.css"),
  "utf8"
);
const dashboard = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/ProgressDashboard.jsx"),
  "utf8"
);

describe("Phase 3 Stage 7 brand and responsive contract", () => {
  it("uses the Workout Tracker dark-first Progress palette with semantic accent roles", () => {
    expect(css).toContain("--progress-bg:#0f1117");
    expect(css).toContain("--progress-border:#2a2d36");
    expect(css).toContain("--progress-cyan:#00e5ff");
    expect(css).toContain("--progress-green:#00ff88");
    expect(css).toContain("--progress-gold:#ffd700");
    expect(css).toContain("--progress-red:#ff4d4d");
    expect(css).toContain("progress-assessment-status-card--pb");
    expect(css).toContain("progress-schedule--overdue");
  });

  it("keeps responsive density rules and reduced-motion protection in the Stage 7 layer", () => {
    expect(css).toContain("@media (max-width:980px)");
    expect(css).toContain("@media (max-width:780px)");
    expect(css).toContain("@media (max-width:480px)");
    expect(css).toContain("@media (prefers-reduced-motion:reduce)");
    expect(css).toContain("grid-template-columns:repeat(2,minmax(0,1fr))");
  });

  it("loads Stage 7 styling after the base Progress stylesheet", () => {
    const baseIndex = dashboard.indexOf('import "./ProgressDashboard.css"');
    const stage7Index = dashboard.indexOf('import "./ProgressDashboardStage7.css"');
    expect(baseIndex).toBeGreaterThan(-1);
    expect(stage7Index).toBeGreaterThan(baseIndex);
  });
});
