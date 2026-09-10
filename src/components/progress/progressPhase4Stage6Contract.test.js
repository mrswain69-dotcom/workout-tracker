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
const css = fs.readFileSync(
  path.join(process.cwd(), "src/components/progress/AssessmentAnalysisProgress.css"),
  "utf8"
);

describe("Phase 4 Stage 6 integration contract", () => {
  it("lazy-loads the complete Assessment Analysis slice instead of keeping it in the eager Progress bundle", () => {
    expect(dashboard).toContain('lazy(() => import("./AssessmentAnalysisSection.jsx"))');
    expect((dashboard.match(/const AssessmentAnalysisSection = lazy/g) || [])).toHaveLength(1);
    expect(dashboard).toContain("<Suspense");
    expect(dashboard).toContain("Loading Assessment Analysis…");
    expect(dashboard).not.toContain('from "../../engine/assessmentAnalysisEngine.js"');
    expect(dashboard).not.toContain('from "../../engine/assessmentAnalysisViewModel.js"');
    expect(dashboard).not.toContain('import AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx"');
    expect(dashboard).not.toContain("const assessmentAnalysis = useMemo(");
    expect(dashboard).not.toContain("const assessmentAnalysisModel = useMemo(");

    expect(section).toContain('from "../../engine/assessmentAnalysisEngine.js"');
    expect(section).toContain('from "../../engine/assessmentAnalysisViewModel.js"');
    expect(section).toContain('import AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx"');
  });

  it("passes the existing Progress sources through the lazy boundary without adding another database fetch", () => {
    expect(dashboard).toContain("completedHistory={remoteData.completedHistory}");
    expect(dashboard).toContain("sessionLibrary={remoteData.sessionLibrary}");
    expect(dashboard).toContain("assessmentLibrary={remoteData.assessmentLibrary}");
    expect(dashboard).toContain("logs={logs}");
    expect(section).not.toMatch(/loadSessionLibrary|loadAssessmentLibrary|loadCompletedAssessmentHistory|listAssessmentRuns|listAssessmentSchedules/);
  });

  it("hardens disclosure touch targets and long real-world labels for narrow screens", () => {
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("@media (max-width: 480px)");
  });
});
