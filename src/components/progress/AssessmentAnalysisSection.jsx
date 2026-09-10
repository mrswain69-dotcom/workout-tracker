import React, { useMemo } from "react";
import { buildAssessmentAnalysis } from "../../engine/assessmentAnalysisEngine.js";
import { buildAssessmentAnalysisViewModel } from "../../engine/assessmentAnalysisViewModel.js";
import AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx";

export default function AssessmentAnalysisSection({
  completedHistory = null,
  logs = [],
  profileId = "",
  sessionLibrary = {},
  assessmentLibrary = {},
  onOpenAssessments = null,
}) {
  const analysis = useMemo(
    () =>
      buildAssessmentAnalysis({
        runs: completedHistory?.runs || [],
        results: completedHistory?.results || [],
        logs,
        profileId,
        sessionLibrary: sessionLibrary || {},
        assessmentLibrary: assessmentLibrary || {},
      }),
    [completedHistory, logs, profileId, sessionLibrary, assessmentLibrary]
  );

  const model = useMemo(
    () => buildAssessmentAnalysisViewModel(analysis),
    [analysis]
  );

  return (
    <AssessmentAnalysisProgress
      model={model}
      onOpenAssessments={onOpenAssessments}
    />
  );
}
