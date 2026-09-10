from pathlib import Path


def replace_once(path_string, old, new, label):
    path = Path(path_string)
    text = path.read_text(encoding="utf-8")
    if new in text:
        print(f"{label}: already applied")
        return
    if old not in text:
        raise SystemExit(f"{label}: expected anchor not found")
    path.write_text(text.replace(old, new, 1), encoding="utf-8")
    print(f"{label}: applied")


# Initial guarded Progress integration (idempotent on reruns).
path = Path("src/components/progress/ProgressDashboard.jsx")
text = path.read_text(encoding="utf-8")

import_anchor = 'import { buildProgressViewModel } from "../../engine/progressViewModel.js";\n'
import_block = '''import { buildProgressViewModel } from "../../engine/progressViewModel.js";\nimport { buildAssessmentAnalysis } from "../../engine/assessmentAnalysisEngine.js";\nimport { buildAssessmentAnalysisViewModel } from "../../engine/assessmentAnalysisViewModel.js";\nimport AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx";\n'''
if 'buildAssessmentAnalysis } from "../../engine/assessmentAnalysisEngine.js"' not in text:
    if import_anchor not in text:
        raise SystemExit("Stage 5 import anchor not found")
    text = text.replace(import_anchor, import_block, 1)

memo_anchor = '''  const assessmentScheduleStatuses = useMemo(\n    () =>\n      buildAssessmentScheduleStatuses({\n'''
memo_block = '''  const assessmentAnalysis = useMemo(\n    () =>\n      buildAssessmentAnalysis({\n        runs: remoteData.completedHistory?.runs || [],\n        results: remoteData.completedHistory?.results || [],\n        logs,\n        profileId,\n        sessionLibrary: remoteData.sessionLibrary || {},\n        assessmentLibrary: remoteData.assessmentLibrary || {},\n      }),\n    [\n      remoteData.completedHistory,\n      remoteData.sessionLibrary,\n      remoteData.assessmentLibrary,\n      logs,\n      profileId,\n    ]\n  );\n\n  const assessmentAnalysisModel = useMemo(\n    () => buildAssessmentAnalysisViewModel(assessmentAnalysis),\n    [assessmentAnalysis]\n  );\n\n  const assessmentScheduleStatuses = useMemo(\n    () =>\n      buildAssessmentScheduleStatuses({\n'''
if 'const assessmentAnalysis = useMemo(' not in text:
    if memo_anchor not in text:
        raise SystemExit("Stage 5 memo anchor not found")
    text = text.replace(memo_anchor, memo_block, 1)

render_anchor = '''        <DevelopmentTrendDetails developmentTrends={developmentTrends} />\n      </div>\n\n      <div className="progress-legacy-bridge">\n'''
render_block = '''        <DevelopmentTrendDetails developmentTrends={developmentTrends} />\n      </div>\n\n      <AssessmentAnalysisProgress\n        model={assessmentAnalysisModel}\n        onOpenAssessments={onOpenAssessments}\n      />\n\n      <div className="progress-legacy-bridge">\n'''
if '<AssessmentAnalysisProgress' not in text:
    if render_anchor not in text:
        raise SystemExit("Stage 5 render anchor not found")
    text = text.replace(render_anchor, render_block, 1)

path.write_text(text, encoding="utf-8")
print("Phase 4 Stage 5 Progress integration present")

# Avoid duplicating the state-specific empty title in the section heading.
replace_once(
    "src/components/progress/AssessmentAnalysisProgress.jsx",
    "          <h3>{model.title}</h3>",
    "          <h3>Assessment Analysis</h3>",
    "Analysis section heading",
)

# Direct component tests: duplicate labels are intentional across summary + detail.
replace_once(
    "src/components/progress/AssessmentAnalysisProgress.test.jsx",
    '    expect(screen.getByText("High detail")).toBeTruthy();',
    '    expect(screen.getAllByText("High detail")).toHaveLength(2);',
    "High-detail assertion scope",
)
replace_once(
    "src/components/progress/AssessmentAnalysisProgress.test.jsx",
    '    expect(screen.getByText("Improved")).toBeTruthy();',
    '    expect(screen.getAllByText("Improved")).toHaveLength(2);',
    "Improved assertion scope",
)

# Stage 4 callback remains valid now that Stage 5 intentionally adds another Assess CTA.
replace_once(
    "src/components/progress/ProgressDashboard.test.jsx",
    '''    await waitFor(() => expect(screen.getByText("Open Assess")).toBeTruthy());\n    fireEvent.click(screen.getByText("Open Assess"));\n    expect(openAssess).toHaveBeenCalledTimes(1);''',
    '''    await waitFor(() =>\n      expect(screen.getAllByRole("button", { name: "Open Assess" }).length).toBeGreaterThan(0)\n    );\n    fireEvent.click(screen.getAllByRole("button", { name: "Open Assess" })[0]);\n    expect(openAssess).toHaveBeenCalledTimes(1);''',
    "Stage 4 Assess callback assertion",
)

# Full-dashboard Stage 5 assertions are scoped to the new Analysis section so
# existing Assessment Progress labels can coexist without making tests ambiguous.
replace_once(
    "src/components/progress/ProgressDashboardPhase4Stage5.test.jsx",
    'import { cleanup, render, screen, waitFor } from "@testing-library/react";',
    'import { cleanup, render, screen, waitFor, within } from "@testing-library/react";',
    "Stage 5 within import",
)
replace_once(
    "src/components/progress/ProgressDashboardPhase4Stage5.test.jsx",
    '''    expect(screen.getByLabelText("Assessment Analysis")).toBeTruthy();\n    expect(screen.getByLabelText("Assessment comparison period")).toBeTruthy();\n    expect(screen.getByText("1 Aug 2026")).toBeTruthy();\n    expect(screen.getByText("1 Sept 2026")).toBeTruthy();\n    expect(screen.getByText("Observed Consistency")).toBeTruthy();\n    expect(screen.getByText("POSSIBLE NEXT FOCUS")).toBeTruthy();\n    expect(screen.getByText("Session B · Receiving")).toBeTruthy();\n    expect(screen.getByText("Outside-foot receive")).toBeTruthy();\n    expect(screen.getByText(/does not establish that training caused the result/)).toBeTruthy();''',
    '''    const analysis = screen.getByLabelText("Assessment Analysis");\n    const analysisScreen = within(analysis);\n    const comparison = analysisScreen.getByLabelText("Assessment comparison period");\n    expect(comparison).toBeTruthy();\n    expect(within(comparison).getByText("1 Aug 2026")).toBeTruthy();\n    expect(within(comparison).getByText("1 Sept 2026")).toBeTruthy();\n    expect(analysisScreen.getByText("Observed Consistency")).toBeTruthy();\n    expect(analysisScreen.getByText("POSSIBLE NEXT FOCUS")).toBeTruthy();\n    expect(analysisScreen.getByText("Session B · Receiving")).toBeTruthy();\n    expect(analysisScreen.getByText("Outside-foot receive")).toBeTruthy();\n    expect(analysisScreen.getByText(/does not establish that training caused the result/)).toBeTruthy();''',
    "Ready Analysis dashboard assertions",
)
replace_once(
    "src/components/progress/ProgressDashboardPhase4Stage5.test.jsx",
    '''    expect(screen.getByLabelText("Assessment Analysis")).toBeTruthy();\n    expect(screen.getByText("Build your Assessment baseline")).toBeTruthy();\n    expect(screen.queryByText("Observed Consistency")).toBeNull();\n    expect(screen.queryByText("POSSIBLE NEXT FOCUS")).toBeNull();''',
    '''    const analysis = screen.getByLabelText("Assessment Analysis");\n    const analysisScreen = within(analysis);\n    expect(analysisScreen.getByText("Build your Assessment baseline")).toBeTruthy();\n    expect(analysisScreen.queryByText("Observed Consistency")).toBeNull();\n    expect(analysisScreen.queryByText("POSSIBLE NEXT FOCUS")).toBeNull();''',
    "Empty Analysis dashboard assertions",
)
