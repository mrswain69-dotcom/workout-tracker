import React, { useEffect, useMemo, useState } from "react";
import { buildAssessmentAnalysis } from "../../engine/assessmentAnalysisEngine.js";
import { buildAssessmentAnalysisViewModel } from "../../engine/assessmentAnalysisViewModel.js";
import { loadHistoricalTimelineData } from "../../historicalTimelineDb.js";
import AssessmentAnalysisProgress from "./AssessmentAnalysisProgress.jsx";
import PerformanceAutobiography from "./PerformanceAutobiography.jsx";
import VerifiedActivitySection from "./VerifiedActivitySection.jsx";

export default function AssessmentAnalysisSection({
  completedHistory = null,
  logs = [],
  profileId = "",
  sessionLibrary = {},
  assessmentLibrary = {},
  onOpenAssessments = null,
  timelineApi = loadHistoricalTimelineData,
  verificationApi = null,
}) {
  const [timelineData, setTimelineData] = useState(null);
  const [timelineError, setTimelineError] = useState(null);
  const [verificationData, setVerificationData] = useState(null);

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

  useEffect(() => {
    let cancelled = false;

    async function loadTimeline() {
      if (!profileId) {
        setTimelineData(null);
        setTimelineError(null);
        return;
      }
      const result = await timelineApi(profileId);
      if (cancelled) return;
      setTimelineData(result?.data || null);
      setTimelineError(result?.error || null);
    }

    loadTimeline();
    return () => {
      cancelled = true;
    };
  }, [profileId, timelineApi]);

  useEffect(() => {
    setVerificationData(null);
  }, [profileId]);

  return (
    <>
      <AssessmentAnalysisProgress
        model={model}
        onOpenAssessments={onOpenAssessments}
      />

      {timelineError ? (
        <div className="progress-system-message progress-system-message--error" role="status">
          Long-range milestones could not be loaded. Recorded training history is still available below.
        </div>
      ) : null}

      <VerifiedActivitySection
        profileId={profileId}
        profileName={timelineData?.profile?.name || "Athlete"}
        onDataChange={setVerificationData}
        {...(verificationApi ? { api: verificationApi } : {})}
      />

      <PerformanceAutobiography
        profileId={profileId}
        profileName={timelineData?.profile?.name || "Athlete"}
        logs={logs}
        assessmentRuns={completedHistory?.runs || []}
        assessmentResults={completedHistory?.results || []}
        timelineData={timelineData}
        verificationData={verificationData}
        referenceDate={timelineData?.referenceDate || ""}
      />
    </>
  );
}
