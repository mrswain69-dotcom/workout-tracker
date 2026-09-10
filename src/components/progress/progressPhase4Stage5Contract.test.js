import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const dashboard = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/ProgressDashboard.jsx"),
  "utf8"
);
const section = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/AssessmentAnalysisSection.jsx"),
  "utf8"
);
const component = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/AssessmentAnalysisProgress.jsx"),
  "utf8"
);
const css = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/AssessmentAnalysisProgress.css"),
  "utf8"
);

describe("Phase 4 Stage 5 Progress Analysis contract", () => {
  it("builds Analysis from the existing Progress data and renders it between Development Trends and the legacy bridge", () => {
    expect(section).toContain("buildAssessmentAnalysis({");
    expect(section).toContain("sessionLibrary: sessionLibrary || {}");
    expect(section).toContain("assessmentLibrary: assessmentLibrary || {}");
    expect(section).toContain("buildAssessmentAnalysisViewModel(analysis)");

    const developmentIndex = dashboard.indexOf('<DevelopmentTrendDetails developmentTrends={developmentTrends} />');
    const analysisIndex = dashboard.indexOf("<AssessmentAnalysisSection");
    const legacyIndex = dashboard.indexOf('<div className="progress-legacy-bridge">');
    expect(developmentIndex).toBeGreaterThan(-1);
    expect(analysisIndex).toBeGreaterThan(developmentIndex);
    expect(legacyIndex).toBeGreaterThan(analysisIndex);
  });

  it("keeps Test evidence collapsed by default to control Progress information density", () => {
    expect(component).toContain('<details className="analysis-test">');
    expect(component).not.toContain('<details className="analysis-test" open');
    expect(component).toContain("Test-by-Test Analysis");
    expect(component).toContain("Interpretation boundary");
    expect(component).toContain("not an automatic load prescription");
  });

  it("uses the Workout Tracker dark-first semantic palette and responsive/reduced-motion rules", () => {
    expect(css).toContain("background: #0f1117");
    expect(css).toContain("#00e5ff");
    expect(css).toContain("#00ff88");
    expect(css).toContain("#ffd700");
    expect(css).toContain("#ff4d4d");
    expect(css).toContain("#2a2d36");
    expect(css).toContain("@media (max-width: 980px)");
    expect(css).toContain("@media (max-width: 700px)");
    expect(css).toContain("@media (max-width: 480px)");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
  });
});
