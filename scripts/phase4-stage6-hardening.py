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


# Lazy-load the complete Assessment Analysis slice so its engine/view-model/UI
# do not remain in the initial app chunk.
replace_once(
    "src/components/progress/ProgressDashboard.jsx",
    'import React, { useEffect, useMemo, useState } from "react";',
    'import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";',
    "Progress React lazy imports",
)
replace_once(
    "src/components/progress/ProgressDashboard.jsx",
    '''import { buildProgressViewModel } from "../../engine/progressViewModel.js";\nimport { buildAssessmentAnalysis } from "../../engine/assessmentAnalysisEngine.js";\nimport { buildAssessmentAnalysisViewModel } from "../../engine/assessmentAnalysisViewModel.js";\nimport AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx";\n''',
    '''import { buildProgressViewModel } from "../../engine/progressViewModel.js";\n''',
    "Remove eager Analysis imports",
)
replace_once(
    "src/components/progress/ProgressDashboard.jsx",
    '''const DEFAULT_DB_API = Object.freeze({\n''',
    '''const AssessmentAnalysisSection = lazy(() => import("./AssessmentAnalysisSection.jsx"));\n\nconst DEFAULT_DB_API = Object.freeze({\n''',
    "Lazy Analysis section declaration",
)
replace_once(
    "src/components/progress/ProgressDashboard.jsx",
    '''  const assessmentAnalysis = useMemo(\n    () =>\n      buildAssessmentAnalysis({\n        runs: remoteData.completedHistory?.runs || [],\n        results: remoteData.completedHistory?.results || [],\n        logs,\n        profileId,\n        sessionLibrary: remoteData.sessionLibrary || {},\n        assessmentLibrary: remoteData.assessmentLibrary || {},\n      }),\n    [\n      remoteData.completedHistory,\n      remoteData.sessionLibrary,\n      remoteData.assessmentLibrary,\n      logs,\n      profileId,\n    ]\n  );\n\n  const assessmentAnalysisModel = useMemo(\n    () => buildAssessmentAnalysisViewModel(assessmentAnalysis),\n    [assessmentAnalysis]\n  );\n\n''',
    '''''',
    "Remove eager Analysis memos",
)
replace_once(
    "src/components/progress/ProgressDashboard.jsx",
    '''      <AssessmentAnalysisProgress\n        model={assessmentAnalysisModel}\n        onOpenAssessments={onOpenAssessments}\n      />\n''',
    '''      <Suspense\n        fallback={\n          <div className="progress-system-message" role="status">\n            Loading Assessment Analysis…\n          </div>\n        }\n      >\n        <AssessmentAnalysisSection\n          completedHistory={remoteData.completedHistory}\n          logs={logs}\n          profileId={profileId}\n          sessionLibrary={remoteData.sessionLibrary}\n          assessmentLibrary={remoteData.assessmentLibrary}\n          onOpenAssessments={onOpenAssessments}\n        />\n      </Suspense>\n''',
    "Lazy Analysis render",
)

# Reject impossible calendar dates instead of allowing Date to normalise them.
valid_ymd = '''function isYmd(value) {\n  const text = String(value || "");\n  if (!/^\\d{4}-\\d{2}-\\d{2}$/.test(text)) return false;\n  const date = new Date(`${text}T00:00:00.000Z`);\n  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === text;\n}'''
for path_string in [
    "src/engine/assessmentAnalysisEvidenceEngine.js",
    "src/engine/assessmentAnalysisConsistencyEngine.js",
]:
    replace_once(
        path_string,
        '''function isYmd(value) {\n  return /^\\d{4}-\\d{2}-\\d{2}$/.test(String(value || ""));\n}''',
        valid_ymd,
        f"Calendar-valid YMD in {path_string}",
    )

replace_once(
    "src/engine/assessmentAnalysisViewModel.js",
    '''  const date = new Date(`${text}T00:00:00.000Z`);\n  if (Number.isNaN(date.getTime())) return "";''',
    '''  const date = new Date(`${text}T00:00:00.000Z`);\n  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) return "";''',
    "Calendar-valid display date",
)

# Make possible-focus copy safe even when consumed outside the full UI panel.
replace_once(
    "src/engine/assessmentAnalysisEngine.js",
    '''    return `Possible next focus: ${cleanText(focus.reason, "A related active Session was underrepresented between benchmarks.")}`;''',
    '''    return `Possible next focus: ${cleanText(focus.reason, "A related active Session was underrepresented between benchmarks.")} This reflects recorded Session balance only, not a training prescription.`;''',
    "Standalone non-prescriptive focus narrative",
)

# Mobile/long-label hardening for real-world Test and Session names.
css_path = Path("src/components/progress/AssessmentAnalysisProgress.css")
css = css_path.read_text(encoding="utf-8")
css_marker = '''.analysis-test summary::-webkit-details-marker { display: none; }'''
css_insert = '''.analysis-test summary {\n  min-height: 44px;\n}\n\n.analysis-test__identity strong,\n.analysis-session-row__name strong,\n.analysis-focus strong {\n  overflow-wrap: anywhere;\n}\n\n.analysis-test summary::-webkit-details-marker { display: none; }'''
if "overflow-wrap: anywhere;" not in css:
    if css_marker not in css:
        raise SystemExit("Analysis CSS hardening anchor not found")
    css = css.replace(css_marker, css_insert, 1)
    css_path.write_text(css, encoding="utf-8")
    print("Analysis long-label/touch-target hardening: applied")
else:
    print("Analysis long-label/touch-target hardening: already applied")

# Stage 5 full-dashboard tests must allow the Stage 6 lazy boundary to resolve.
test_path = Path("src/components/progress/ProgressDashboardPhase4Stage5.test.jsx")
test = test_path.read_text(encoding="utf-8")
old = '''    const analysis = screen.getByLabelText("Assessment Analysis");'''
new = '''    await waitFor(() => expect(screen.getByLabelText("Assessment Analysis")).toBeTruthy());\n    const analysis = screen.getByLabelText("Assessment Analysis");'''
occurrences = test.count(old)
if occurrences:
    test = test.replace(old, new)
    test_path.write_text(test, encoding="utf-8")
    print(f"Lazy Analysis Stage 5 waits: applied to {occurrences} assertions")
elif test.count(new) >= 2:
    print("Lazy Analysis Stage 5 waits: already applied")
else:
    raise SystemExit("Stage 5 lazy wait anchors not found")
