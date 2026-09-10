from pathlib import Path

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
print("Phase 4 Stage 5 Progress integration applied")
