import React, { useEffect, useMemo, useState } from "react";
import { loadSessionLibrary } from "../../db.js";
import { loadAssessmentLibrary } from "../../assessmentDb.js";
import {
  listAssessmentRuns,
  loadCompletedAssessmentHistory,
} from "../../assessmentRunDb.js";
import { listAssessmentSchedules } from "../../assessmentScheduleDb.js";
import { buildAssessmentScheduleStatuses } from "../../engine/assessmentScheduleEngine.js";
import { buildAssessmentProgress } from "../../engine/progressAssessmentEngine.js";
import { buildDevelopmentTrendsFromAssessmentProgress } from "../../engine/progressDevelopmentTrendEngine.js";
import { buildTrainingProgress } from "../../engine/progressTrainingEngine.js";
import { buildProgressViewModel } from "../../engine/progressViewModel.js";
import "./ProgressDashboard.css";

const DEFAULT_DB_API = Object.freeze({
  loadSessionLibrary,
  loadAssessmentLibrary,
  listAssessmentRuns,
  loadCompletedAssessmentHistory,
  listAssessmentSchedules,
});

function todayYmd() {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function emptyRemoteData() {
  return {
    sessionLibrary: {
      templates: [],
    },
    assessmentLibrary: {
      developmentTags: [],
      testDevelopmentTags: [],
    },
    completedHistory: {
      runs: [],
      results: [],
    },
    assessmentRuns: [],
    schedules: [],
  };
}

function resultError(...results) {
  return results.find((result) => result?.error)?.error || null;
}

function statusLabel(state) {
  const labels = {
    no_sessions: "No Sessions yet",
    partial_only: "Session started",
    one_session: "First Session logged",
    established: "History active",
    no_baseline: "No baseline yet",
    baseline_established: "Baseline set",
    comparison_available: "Comparison ready",
    trend_ready: "Trend ready",
  };
  return labels[state] || "Building";
}

function stateTone(state) {
  if (
    state === "established" ||
    state === "comparison_available" ||
    state === "trend_ready"
  ) {
    return "positive";
  }
  if (
    state === "partial_only" ||
    state === "one_session" ||
    state === "baseline_established"
  ) {
    return "building";
  }
  return "empty";
}

function ProgressStateChip({ label, state }) {
  return (
    <div className={`progress-state-chip progress-state-chip--${stateTone(state)}`}>
      <span className="progress-state-chip__label">{label}</span>
      <span className="progress-state-chip__value">{statusLabel(state)}</span>
    </div>
  );
}

function MetricCard({ label, value, note = "" }) {
  return (
    <div className="progress-metric-card">
      <div className="progress-metric-card__label">{label}</div>
      <div className="progress-metric-card__value">{value}</div>
      {note ? <div className="progress-metric-card__note">{note}</div> : null}
    </div>
  );
}

function SectionHeading({ kicker, title, children }) {
  return (
    <div className="progress-section-heading">
      <div>
        <div className="progress-section-heading__kicker">{kicker}</div>
        <h3>{title}</h3>
      </div>
      {children ? <div className="progress-section-heading__action">{children}</div> : null}
    </div>
  );
}

function formatMinutes(minutes) {
  const value = Math.max(0, Number(minutes) || 0);
  if (value < 60) return `${Math.round(value)} min`;
  const hours = Math.floor(value / 60);
  const remainder = Math.round(value % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function SessionBalance({ rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    return (
      <div className="progress-empty-block">
        Session definitions are not available right now.
      </div>
    );
  }

  return (
    <div className="progress-balance-grid">
      {safeRows.map((row) => (
        <div
          className={`progress-balance-item${row.historicalOnly ? " progress-balance-item--historical" : ""}`}
          key={row.templateId || `${row.displayCode}-${row.name}`}
        >
          <div className="progress-balance-item__code">
            {row.displayCode || "—"}
          </div>
          <div className="progress-balance-item__body">
            <div className="progress-balance-item__name">{row.name || "Session"}</div>
            <div className="progress-balance-item__meta">
              {row.count || 0} completed · last 4 weeks
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function AssessmentSnapshot({ model }) {
  const assessment = model.assessment;
  const hasBaseline = assessment.completedCount > 0;
  const hasComparison = assessment.completedCount > 1;

  return (
    <div className="progress-assessment-grid">
      <MetricCard
        label="Completed benchmarks"
        value={assessment.completedCount}
        note={hasBaseline ? "Genuine completed history" : "First result sets baseline"}
      />
      <MetricCard
        label="Latest benchmark"
        value={assessment.latestDateLabel || "—"}
        note={hasBaseline ? "Completed Assessment" : "No completed Assessment yet"}
      />
      <MetricCard
        label="New PBs · latest"
        value={hasComparison ? assessment.latestPbCount : "—"}
        note={hasComparison ? "Genuine PB events" : "Available after a comparison"}
      />
    </div>
  );
}

export default function ProgressDashboard({
  familyId,
  profileId,
  profileName = "Athlete",
  logs = [],
  currentStreak = 0,
  currentXp = 0,
  referenceDate = null,
  onOpenAssessments = null,
  dbApi = DEFAULT_DB_API,
}) {
  const [remoteData, setRemoteData] = useState(() => emptyRemoteData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const resolvedReferenceDate = referenceDate || todayYmd();

  useEffect(() => {
    let cancelled = false;

    async function loadProgressData() {
      if (!familyId || !profileId) {
        if (!cancelled) {
          setRemoteData(emptyRemoteData());
          setError(null);
          setLoading(false);
        }
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const [
          sessionLibraryResult,
          assessmentLibraryResult,
          completedHistoryResult,
          assessmentRunsResult,
          schedulesResult,
        ] = await Promise.all([
          dbApi.loadSessionLibrary(familyId),
          dbApi.loadAssessmentLibrary(familyId),
          dbApi.loadCompletedAssessmentHistory(familyId, profileId),
          dbApi.listAssessmentRuns(familyId, { profileId, limit: 500 }),
          dbApi.listAssessmentSchedules(familyId, { profileId, activeOnly: true }),
        ]);

        if (cancelled) return;

        const errorValue = resultError(
          sessionLibraryResult,
          assessmentLibraryResult,
          completedHistoryResult,
          assessmentRunsResult,
          schedulesResult
        );

        setRemoteData({
          sessionLibrary: sessionLibraryResult?.data || { templates: [] },
          assessmentLibrary:
            assessmentLibraryResult?.data || {
              developmentTags: [],
              testDevelopmentTags: [],
            },
          completedHistory:
            completedHistoryResult?.data || { runs: [], results: [] },
          assessmentRuns: assessmentRunsResult?.data || [],
          schedules: schedulesResult?.data || [],
        });
        setError(errorValue);
      } catch (loadError) {
        if (!cancelled) {
          setRemoteData(emptyRemoteData());
          setError(loadError);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProgressData();
    return () => {
      cancelled = true;
    };
  }, [familyId, profileId, refreshKey, dbApi]);

  const trainingProgress = useMemo(
    () =>
      buildTrainingProgress({
        logs,
        profileId,
        sessionTemplates: remoteData.sessionLibrary?.templates || [],
        selectedDate: resolvedReferenceDate,
      }),
    [logs, profileId, remoteData.sessionLibrary, resolvedReferenceDate]
  );

  const assessmentProgress = useMemo(
    () =>
      buildAssessmentProgress({
        runs: remoteData.completedHistory?.runs || [],
        results: remoteData.completedHistory?.results || [],
        profileId,
      }),
    [remoteData.completedHistory, profileId]
  );

  const developmentTrends = useMemo(
    () =>
      buildDevelopmentTrendsFromAssessmentProgress({
        assessmentProgress,
        developmentTags: remoteData.assessmentLibrary?.developmentTags || [],
        testDevelopmentTags:
          remoteData.assessmentLibrary?.testDevelopmentTags || [],
      }),
    [assessmentProgress, remoteData.assessmentLibrary]
  );

  const assessmentScheduleStatuses = useMemo(
    () =>
      buildAssessmentScheduleStatuses({
        schedules: remoteData.schedules || [],
        runs: remoteData.assessmentRuns || [],
        todayYmd: resolvedReferenceDate,
      }),
    [remoteData.schedules, remoteData.assessmentRuns, resolvedReferenceDate]
  );

  const model = useMemo(
    () =>
      buildProgressViewModel({
        trainingProgress,
        assessmentProgress,
        developmentTrends,
        assessmentScheduleStatuses,
        currentStreak,
        currentXp,
        profileName,
      }),
    [
      trainingProgress,
      assessmentProgress,
      developmentTrends,
      assessmentScheduleStatuses,
      currentStreak,
      currentXp,
      profileName,
    ]
  );

  return (
    <section className="progress-dashboard" aria-label="Progress dashboard">
      <div className="progress-hero">
        <div>
          <div className="progress-hero__eyebrow">PERFORMANCE PROGRESS</div>
          <h2>{model.profileName} · Progress</h2>
          <p>
            Training, benchmark history and development direction in one place.
            Every number comes from genuine recorded activity.
          </p>
        </div>
        <div className="progress-hero__date">Through {resolvedReferenceDate}</div>
      </div>

      <div className="progress-state-grid" aria-label="Progress data readiness">
        <ProgressStateChip label="Training" state={model.states.training} />
        <ProgressStateChip label="Assessments" state={model.states.assessment} />
        <ProgressStateChip label="Development" state={model.states.development} />
      </div>

      {loading ? (
        <div className="progress-system-message" role="status">
          Loading Progress data…
        </div>
      ) : null}

      {error ? (
        <div className="progress-system-message progress-system-message--error" role="alert">
          <div>
            <strong>Some Progress data could not be loaded.</strong>
            <span> Existing workout statistics remain available below.</span>
          </div>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="progress-section">
        <SectionHeading kicker="TRAINING" title="Training progress" />
        <p className="progress-section-copy">{model.training.message}</p>

        <div className="progress-metric-grid">
          <MetricCard label="Sessions · this week" value={model.training.sessionsThisWeek} />
          <MetricCard label="Sessions · this month" value={model.training.sessionsThisMonth} />
          <MetricCard label="Current streak" value={`${model.training.currentStreak}d`} />
          <MetricCard label="XP" value={model.training.currentXp.toLocaleString("en-GB")} />
          <MetricCard
            label="Training time · 4 weeks"
            value={formatMinutes(model.training.trainingMinutes28)}
          />
          <MetricCard
            label="Recorded executions · 4 weeks"
            value={model.training.recordedExecutions28}
            note="Explicit recorded values only"
          />
        </div>
      </div>

      <div className="progress-section">
        <SectionHeading kicker="BALANCE" title="Session balance" />
        <p className="progress-section-copy">
          Completed structured Sessions across the rolling last 4 weeks. Legacy
          workouts are never reclassified as Session A/B/C.
        </p>
        <SessionBalance rows={model.training.sessionBalance} />
      </div>

      <div className="progress-section">
        <SectionHeading kicker="ASSESSMENTS" title="Benchmark progress">
          {typeof onOpenAssessments === "function" ? (
            <button
              type="button"
              className="progress-link-button"
              onClick={onOpenAssessments}
            >
              Open Assess
            </button>
          ) : null}
        </SectionHeading>
        <p className="progress-section-copy">{model.assessment.message}</p>

        <AssessmentSnapshot model={model} />

        <div
          className={`progress-schedule progress-schedule--${model.assessment.schedule.state}`}
        >
          <div className="progress-schedule__label">Assessment schedule</div>
          <div className="progress-schedule__title">{model.assessment.schedule.title}</div>
          <div className="progress-schedule__detail">{model.assessment.schedule.detail}</div>
        </div>
      </div>

      <div className="progress-section">
        <SectionHeading kicker="DEVELOPMENT" title="Development trends" />
        <p className="progress-section-copy">{model.development.message}</p>
        <div className="progress-development-summary">
          <MetricCard
            label="Development areas"
            value={model.development.trendCount}
            note="Shared Development Tags"
          />
          <MetricCard
            label="Comparison-ready areas"
            value={model.development.comparisonReadyCount}
            note="Compatible benchmark history"
          />
          <div className="progress-development-summary__note">
            Detailed Test charts and Development Trend rows build on this shell
            once benchmark history exists.
          </div>
        </div>
      </div>

      <div className="progress-legacy-bridge">
        <strong>More training history below</strong>
        <span>
          Existing workout, exercise and cardio statistics remain available while
          the Progress area expands.
        </span>
      </div>
    </section>
  );
}
