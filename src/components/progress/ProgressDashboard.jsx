import React, { Suspense, lazy, useEffect, useMemo, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
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
import {
  buildTrainingProgress,
  mondayWeekStartYmd,
} from "../../engine/progressTrainingEngine.js";
import { buildTrainingRangeViews } from "../../engine/progressTrainingRangeEngine.js";
import { buildTrainingRangeViewModel } from "../../engine/progressTrainingRangeViewModel.js";
import { buildProgressViewModel } from "../../engine/progressViewModel.js";
import {
  AssessmentProgressDetails,
  DevelopmentTrendDetails,
} from "./AssessmentDevelopmentProgress.jsx";
import VerifiedActivityEvidenceSection from "./VerifiedActivityEvidenceSection.jsx";
import "./ProgressDashboard.css";
import "./ProgressDashboardStage7.css";

const AssessmentAnalysisSection = lazy(() => import("./AssessmentAnalysisSection.jsx"));

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

function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("en-GB");
}

function TrainingRangeControl({ model, value, onChange, activeRange }) {
  return (
    <div className="progress-range-toolbar">
      <div className="progress-range-toolbar__copy">
        <div className="progress-range-toolbar__label">Training detail range</div>
        <div className="progress-range-toolbar__date">
          {activeRange?.dateLabel || "Choose a structured-history window"}
        </div>
      </div>
      <div className="progress-range-control" role="group" aria-label="Training detail range">
        {(model?.options || []).map((option) => (
          <button
            type="button"
            key={option.key}
            aria-pressed={value === option.key}
            onClick={() => onChange(option.key)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function RangeChip({ label }) {
  return <span className="progress-range-chip">{label}</span>;
}

function TrainingTrendCharts({ training }) {
  const rows = Array.isArray(training?.trend) ? training.trend : [];
  if (!training?.hasTrendActivity) {
    return (
      <div className="progress-empty-block progress-empty-block--chart">
        Training charts will appear after structured Session activity is recorded in
        {training?.label ? ` ${training.label.toLowerCase()}` : " this range"}.
      </div>
    );
  }

  return (
    <div className="progress-chart-grid">
      <div
        className="progress-chart-card"
        aria-label={training?.key === "recent28" ? "Completed Sessions by 7-day period" : `Completed Sessions by ${training?.trendPeriodLabel || "period"}`}
      >
        <div className="progress-chart-card__title">Completed Sessions</div>
        <div className="progress-chart-card__note">
          {training?.label || "Selected range"} · {training?.trendPeriodLabel || "periods"}
        </div>
        <div className="progress-chart-card__canvas">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2d36" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9aa4b5" }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9aa4b5" }} />
              <Tooltip
                formatter={(value) => [formatNumber(value), "Completed Sessions"]}
                labelFormatter={(label) => String(label || "")}
              />
              <Bar dataKey="completedSessions" fill="#00e5ff" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div
        className="progress-chart-card"
        aria-label={training?.key === "recent28" ? "Training time by 7-day period" : `Training time by ${training?.trendPeriodLabel || "period"}`}
      >
        <div className="progress-chart-card__title">Training time</div>
        <div className="progress-chart-card__note">
          {training?.label || "Selected range"} · actual time where recorded; completed Sessions may use frozen planned-time fallback
        </div>
        <div className="progress-chart-card__canvas">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2d36" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9aa4b5" }} />
              <YAxis tick={{ fontSize: 10, fill: "#9aa4b5" }} />
              <Tooltip
                formatter={(value) => [formatMinutes(value), "Training time"]}
                labelFormatter={(label) => String(label || "")}
              />
              <Bar dataKey="totalMinutes" fill="#00ff88" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function SessionDistribution({ rows, total }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    return (
      <div className="progress-empty-block">
        Session definitions are not available right now.
      </div>
    );
  }

  return (
    <div className="progress-distribution-list" aria-label="Session distribution">
      {safeRows.map((row) => (
        <div
          className={`progress-distribution-item${row.historicalOnly ? " progress-distribution-item--historical" : ""}`}
          key={row.templateId || `${row.displayCode}-${row.name}`}
        >
          <div className="progress-distribution-item__code">
            {row.displayCode || "—"}
          </div>
          <div className="progress-distribution-item__body">
            <div className="progress-distribution-item__topline">
              <div>
                <div className="progress-distribution-item__name">{row.name || "Session"}</div>
                <div className="progress-distribution-item__meta">
                  {row.count || 0} completed · {total > 0 ? `${row.sharePct}% of completed Sessions` : "no completed Sessions yet"}
                  {row.lastCompletedLabel ? ` · last ${row.lastCompletedLabel}` : ""}
                </div>
              </div>
              <div className="progress-distribution-item__count">{row.count || 0}</div>
            </div>
            <div className="progress-distribution-item__track" aria-hidden="true">
              <div
                className="progress-distribution-item__fill"
                style={{ width: `${Math.max(0, Math.min(100, Number(row.sharePct) || 0))}%` }}
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function MovementMeasure({ children }) {
  return <span className="progress-movement-measure">{children}</span>;
}

function MovementTotals({ rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) {
    return (
      <div className="progress-empty-block">
        No structured Movement totals yet. Movement history starts from genuine
        Session results and does not backfill legacy workouts.
      </div>
    );
  }

  return (
    <div className="progress-movement-list" aria-label="Movement totals">
      {safeRows.map((row) => {
        const hasNumericMeasure =
          !!row.measures?.executions ||
          !!row.measures?.accuracy ||
          !!row.measures?.bestScore;
        return (
          <div
            className="progress-movement-row"
            key={row.movementId || `${row.name}-${row.lastPerformedDate}`}
          >
            <div className="progress-movement-row__identity">
              <div className="progress-movement-row__name">{row.name}</div>
              <div className="progress-movement-row__meta">
                {row.timesPerformed} time{row.timesPerformed === 1 ? "" : "s"} performed
                {row.lastPerformedLabel ? ` · last ${row.lastPerformedLabel}` : ""}
              </div>
            </div>
            <div className="progress-movement-row__measures">
              {row.measures?.executions ? (
                <MovementMeasure>
                  {formatNumber(row.measures.executions.value)} recorded executions
                </MovementMeasure>
              ) : null}
              {row.measures?.accuracy ? (
                <MovementMeasure>
                  {formatNumber(row.measures.accuracy.successes)}/{formatNumber(row.measures.accuracy.attempts)} successful
                  {row.measures.accuracy.percentage !== null && row.measures.accuracy.percentage !== undefined
                    ? ` · ${row.measures.accuracy.percentage}%`
                    : ""}
                </MovementMeasure>
              ) : null}
              {row.measures?.bestScore ? (
                <MovementMeasure>
                  Best score {row.measures.bestScore.value}
                </MovementMeasure>
              ) : null}
              {!hasNumericMeasure ? (
                <MovementMeasure>Completion recorded · no numeric total</MovementMeasure>
              ) : null}
            </div>
          </div>
        );
      })}
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


const PROGRESS_VIEWS = [
  ["dashboard", "Dashboard"],
  ["sessions", "Sessions Progress"],
  ["assessments", "Assessments"],
  ["verification", "Activity Verification"],
  ["autobiography", "Autobiography"],
];

function ProgressDisclosure({
  kicker,
  title,
  summary = "",
  children,
  defaultOpen = false,
  action = null,
}) {
  return (
    <details className="progress-disclosure" open={defaultOpen}>
      <summary>
        <div className="progress-disclosure__copy">
          <span>{kicker}</span>
          <strong>{title}</strong>
          {summary ? <small>{summary}</small> : null}
        </div>
        <div className="progress-disclosure__actions">
          {action}
          <span className="progress-disclosure__chevron" aria-hidden="true">⌄</span>
        </div>
      </summary>
      <div className="progress-disclosure__body">{children}</div>
    </details>
  );
}

function logPayload(row) {
  if (row?.log && typeof row.log === "object") return row.log;
  if (row?.log_json && typeof row.log_json === "object") return row.log_json;
  return row && typeof row === "object" ? row : null;
}

function setHasActivity(set) {
  if (!set || typeof set !== "object") return false;
  return ["reps", "weight", "timeSeconds"].some((key) => {
    const value = set[key];
    return value !== "" && value !== null && value !== undefined && Number(value) > 0;
  });
}

function sessionCompletedForProgress(session) {
  if (!session || typeof session !== "object") return false;
  if (session.completed) return true;
  const active = (Array.isArray(session.movements) ? session.movements : []).filter(
    (movement) => movement && !movement.skipped
  );
  if (!active.length) return false;
  return active.every((movement) => {
    if (movement.completed) return true;
    const result = movement.result;
    return !!result && typeof result === "object" && Object.keys(result).length > 0;
  });
}

function buildBlockWeeklySeries(logs = []) {
  const weeks = new Map();

  for (const row of Array.isArray(logs) ? logs : []) {
    const date = row?.date_ymd || row?.date || logPayload(row)?.date_ymd || "";
    const week = mondayWeekStartYmd(date);
    const payload = logPayload(row);
    if (!week || !payload) continue;

    const aggregate = weeks.get(week) || {
      week,
      strengthSets: 0,
      cardioMinutes: 0,
      durationMinutes: 0,
      sessions: 0,
      tasks: 0,
      recovery: 0,
    };

    for (const block of Array.isArray(payload.blocks) ? payload.blocks : []) {
      if (!block) continue;
      if (["strength", "hiit", "box"].includes(block.typeId)) {
        for (const sets of Object.values(block.sets || {})) {
          aggregate.strengthSets += (Array.isArray(sets) ? sets : []).filter(setHasActivity).length;
        }
      } else if (block.typeId === "cardio") {
        aggregate.cardioMinutes += Math.max(0, Number(block.cardio?.durationMin) || 0);
      } else if (block.typeId === "duration") {
        aggregate.durationMinutes += Math.max(0, Number(block.duration?.minutes) || 0);
      } else if (block.typeId === "session") {
        if (sessionCompletedForProgress(block.session)) aggregate.sessions += 1;
      } else if (block.typeId === "tasks") {
        aggregate.tasks += Object.values(block.tasksDone || {}).filter(Boolean).length;
      } else if (block.typeId === "recovery") {
        if (block.recoveryDone || Number(block.duration?.minutes) > 0) aggregate.recovery += 1;
      }
    }
    weeks.set(week, aggregate);
  }

  return Array.from(weeks.values())
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8)
    .map((row) => ({
      ...row,
      label: row.week.slice(5),
      cardioMinutes: Math.round(row.cardioMinutes * 10) / 10,
      durationMinutes: Math.round(row.durationMinutes * 10) / 10,
    }));
}

function ActivityTypeChart({ title, note, data, dataKey, formatter = (value) => value }) {
  const rows = Array.isArray(data) ? data : [];
  const hasData = rows.some((row) => Number(row?.[dataKey]) > 0);
  if (!hasData) return null;

  return (
    <div className="progress-chart-card progress-overview-chart">
      <div className="progress-chart-card__title">{title}</div>
      <div className="progress-chart-card__note">{note}</div>
      <div className="progress-chart-card__canvas">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#2a2d36" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#9aa4b5" }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#9aa4b5" }} />
            <Tooltip formatter={(value) => [formatter(value), title]} />
            <Bar dataKey={dataKey} fill="#00e5ff" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
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
  summaryStats = null,
  recordStats = null,
  dbApi = DEFAULT_DB_API,
}) {
  const [remoteData, setRemoteData] = useState(() => emptyRemoteData());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [trainingRangeKey, setTrainingRangeKey] = useState("recent28");
  const [progressView, setProgressView] = useState("dashboard");
  const [verificationData, setVerificationData] = useState(null);
  const resolvedReferenceDate = referenceDate || todayYmd();

  useEffect(() => {
    setVerificationData(null);
  }, [profileId]);

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

  const trainingRangeViews = useMemo(
    () =>
      buildTrainingRangeViews({
        logs,
        profileId,
        sessionTemplates: remoteData.sessionLibrary?.templates || [],
        selectedDate: resolvedReferenceDate,
      }),
    [logs, profileId, remoteData.sessionLibrary, resolvedReferenceDate]
  );

  const trainingRangeModel = useMemo(
    () => buildTrainingRangeViewModel(trainingRangeViews),
    [trainingRangeViews]
  );
  const trainingDetail =
    trainingRangeModel.ranges[trainingRangeKey] ||
    trainingRangeModel.ranges[trainingRangeModel.defaultRangeKey];

  useEffect(() => {
    setTrainingRangeKey("recent28");
    setProgressView("dashboard");
  }, [profileId]);

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

  const blockWeeklySeries = useMemo(
    () => buildBlockWeeklySeries(logs),
    [logs]
  );

  const hasSessionHistory =
    trainingProgress.lifetime.completedSessions > 0 ||
    trainingProgress.lifetime.partialSessions > 0 ||
    trainingProgress.recent28.activeSessionDays > 0;

  return (
    <section className="progress-dashboard" aria-label="Progress dashboard">
      <div className="progress-hero">
        <div>
          <div className="progress-hero__eyebrow">PERFORMANCE PROGRESS</div>
          <h2>{model.profileName} · Progress</h2>
          <p>
            Activity, benchmark history and development direction in one place.
            Every number comes from genuine recorded activity.
          </p>
        </div>
        <div className="progress-hero__date">Through {resolvedReferenceDate}</div>
      </div>

      <nav className="progress-subnav" aria-label="Progress sections">
        {PROGRESS_VIEWS.map(([key, label]) => (
          <button
            type="button"
            key={key}
            className={progressView === key ? "active" : ""}
            aria-current={progressView === key ? "page" : undefined}
            onClick={() => setProgressView(key)}
          >
            {label}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="progress-system-message" role="status">
          Loading Progress data…
        </div>
      ) : null}

      {error ? (
        <div className="progress-system-message progress-system-message--error" role="alert">
          <div>
            <strong>Some Progress data could not be loaded.</strong>
            <span> Existing workout statistics remain available.</span>
          </div>
          <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>
            Retry
          </button>
        </div>
      ) : null}

      {progressView === "dashboard" ? (
        <div className="progress-view-stack">
          <div className="progress-section progress-overview-section">
            <SectionHeading kicker="AT A GLANCE" title="Your progress dashboard" />
            <p className="progress-section-copy">
              The useful headlines first. Open the other Progress tabs when you want the detail behind them.
            </p>

            <div className="progress-metric-grid progress-overview-grid">
              <MetricCard label="Current streak" value={`${model.training.currentStreak}d`} />
              <MetricCard label="XP" value={model.training.currentXp.toLocaleString("en-GB")} />

              {hasSessionHistory ? (
                <>
                  <MetricCard
                    label="Sessions · this month"
                    value={model.training.sessionsThisMonth}
                    note="Completion ticks count even when numeric drill counts are left blank"
                  />
                  <MetricCard
                    label="Skills training days · 4 weeks"
                    value={trainingProgress.recent28.activeSessionDays}
                    note="Structured Session activity"
                  />
                </>
              ) : null}

              <MetricCard
                label="Most active day"
                value={summaryStats?.mostActiveDayMinutes ? formatMinutes(summaryStats.mostActiveDayMinutes) : "—"}
                note="Recorded / estimated activity time"
              />
              <MetricCard
                label="Most active week"
                value={summaryStats?.mostActiveWeekMinutes ? formatMinutes(summaryStats.mostActiveWeekMinutes) : "—"}
              />
              <MetricCard
                label="Best cardio distance"
                value={summaryStats?.bestCardioDistance ? `${Number(summaryStats.bestCardioDistance).toFixed(2)} km` : "—"}
              />
              <MetricCard
                label="Best cardio speed"
                value={summaryStats?.bestCardioSpeed ? `${Number(summaryStats.bestCardioSpeed).toFixed(2)} km/h` : "—"}
              />

              {!hasSessionHistory ? (
                <>
                  <MetricCard
                    label="Sessions · this month"
                    value={model.training.sessionsThisMonth}
                    note="Appears higher once Session history is recorded"
                  />
                  <MetricCard
                    label="Skills training days · 4 weeks"
                    value={trainingProgress.recent28.activeSessionDays}
                    note="Structured Session activity"
                  />
                </>
              ) : null}
            </div>

            <div className="progress-highlight-strip">
              <div>
                <span>Session headline</span>
                <strong>
                  {trainingProgress.recent28.completedSessions > 0
                    ? `${trainingProgress.recent28.completedSessions} completed in the last 4 weeks`
                    : "Complete a structured Session to start this headline"}
                </strong>
              </div>
              <div>
                <span>Strength activity change</span>
                <strong>
                  {summaryStats?.improved === null || summaryStats?.improved === undefined
                    ? "Needs comparable month-to-month activity"
                    : `${summaryStats.improved > 0 ? "+" : ""}${summaryStats.improved}% vs last month`}
                </strong>
              </div>
              <div>
                <span>Record</span>
                <strong>
                  {recordStats?.bestXpValue
                    ? `${recordStats.bestXpValue} XP · best day`
                    : summaryStats?.longestActivityStreak
                    ? `${summaryStats.longestActivityStreak}d longest activity streak`
                    : "Keep logging to build records"}
                </strong>
              </div>
            </div>
          </div>

          <div className="progress-section">
            <SectionHeading kicker="ACTIVITY TRENDS" title="What you have actually been doing" />
            <p className="progress-section-copy">
              Each chart keeps its own real unit. Workout Tracker does not combine unrelated activity measures into a made-up score.
            </p>
            <div className="progress-chart-grid progress-activity-chart-grid">
              <ActivityTypeChart title="Strength sets" note="Logged sets by week" data={blockWeeklySeries} dataKey="strengthSets" formatter={(value) => `${value} sets`} />
              <ActivityTypeChart title="Cardio time" note="Recorded cardio minutes by week" data={blockWeeklySeries} dataKey="cardioMinutes" formatter={(value) => formatMinutes(value)} />
              <ActivityTypeChart title="Duration activity" note="Yoga, mobility and other duration blocks" data={blockWeeklySeries} dataKey="durationMinutes" formatter={(value) => formatMinutes(value)} />
              <ActivityTypeChart title="Structured Sessions" note="Completed or fully ticked Sessions" data={blockWeeklySeries} dataKey="sessions" formatter={(value) => `${value} Sessions`} />
              <ActivityTypeChart title="Tasks completed" note="Plan tasks ticked by week" data={blockWeeklySeries} dataKey="tasks" formatter={(value) => `${value} tasks`} />
              <ActivityTypeChart title="Recovery completions" note="Recovery blocks completed by week" data={blockWeeklySeries} dataKey="recovery" formatter={(value) => `${value} days`} />
            </div>
            {!blockWeeklySeries.some((row) =>
              row.strengthSets || row.cardioMinutes || row.durationMinutes || row.sessions || row.tasks || row.recovery
            ) ? (
              <div className="progress-empty-block">Activity charts will appear as genuine block history is logged.</div>
            ) : null}
          </div>

          <div className="progress-section progress-readiness-section">
            <SectionHeading kicker="DEEPER PROGRESS" title="Recorded progress areas" />
            <p className="progress-section-copy">
              These become more useful as Skills Sessions, Assessments and comparable development history build over time.
            </p>
            <div className="progress-state-grid" aria-label="Progress data readiness">
              <ProgressStateChip label="Sessions" state={model.states.training} />
              <ProgressStateChip label="Assessments" state={model.states.assessment} />
              <ProgressStateChip label="Development" state={model.states.development} />
            </div>
          </div>
        </div>
      ) : null}

      {progressView === "sessions" ? (
        <div className="progress-view-stack">
          <ProgressDisclosure
            kicker="SKILLS TRAINING"
            title="Skills training progress & benchmarks"
            summary={`${model.training.sessionsThisMonth} Sessions this month · ${trainingProgress.recent28.activeSessionDays} active Session days in 4 weeks`}
          >
            <p className="progress-section-copy">{model.training.message}</p>
            <div className="progress-metric-grid progress-overview-grid">
              <MetricCard label="Sessions · this week" value={model.training.sessionsThisWeek} />
              <MetricCard label="Sessions · this month" value={model.training.sessionsThisMonth} />
              <MetricCard label="Current streak" value={`${model.training.currentStreak}d`} />
              <MetricCard label="XP" value={model.training.currentXp.toLocaleString("en-GB")} />
            </div>

            <TrainingRangeControl
              model={trainingRangeModel}
              value={trainingRangeKey}
              onChange={setTrainingRangeKey}
              activeRange={trainingDetail}
            />

            <div className="progress-metric-grid progress-range-metric-grid">
              <MetricCard
                label={`Sessions · ${trainingDetail.label}`}
                value={trainingDetail.completedSessions}
                note={trainingDetail.partialSessions ? `${trainingDetail.partialSessions} partial kept separate` : "Completed structured Sessions"}
              />
              <MetricCard
                label={`Skills training days · ${trainingDetail.label}`}
                value={trainingDetail.activeSessionDays}
                note="A day counts once even with multiple Sessions"
              />
              <MetricCard label={`Training time · ${trainingDetail.label}`} value={formatMinutes(trainingDetail.totalMinutes)} />
              <MetricCard
                label={`Recorded executions · ${trainingDetail.label}`}
                value={formatNumber(trainingDetail.recordedExecutions)}
                note="Counts are optional; completion still builds Session history"
              />
              <MetricCard
                label={`Success rate · ${trainingDetail.label}`}
                value={trainingDetail.accuracyPct === null ? "—" : `${trainingDetail.accuracyPct}%`}
                note={trainingDetail.attempts > 0 ? `${trainingDetail.successes}/${trainingDetail.attempts} successful attempts` : "Available where attempts/successes are recorded"}
              />
            </div>
            <TrainingTrendCharts training={trainingDetail} />
          </ProgressDisclosure>

          <ProgressDisclosure
            kicker="SESSION MIX"
            title="Session distribution"
            summary={trainingDetail.sessionDistributionTotal > 0 ? `${trainingDetail.sessionDistributionTotal} completed · ${trainingDetail.label}` : "No completed Sessions in this range yet"}
          >
            <p className="progress-section-copy">
              Completion ticks are enough to build Session history. Numeric drill counts add detail when they are practical to record.
            </p>
            <SessionDistribution rows={trainingDetail.sessionBalance} total={trainingDetail.sessionDistributionTotal} />
          </ProgressDisclosure>

          <ProgressDisclosure
            kicker="MOVEMENTS"
            title="Movement totals"
            summary={trainingDetail.movementTotals.length ? `${trainingDetail.movementTotals.length} Movements recorded · ${trainingDetail.label}` : "No Movement history in this range yet"}
          >
            <p className="progress-section-copy">
              Movement completion is useful evidence on its own. Repetitions, attempts and scores remain separate optional measures.
            </p>
            <MovementTotals rows={trainingDetail.movementTotals} />
          </ProgressDisclosure>
        </div>
      ) : null}

      {progressView === "assessments" ? (
        <div className="progress-view-stack">
          <ProgressDisclosure
            kicker="ASSESSMENTS"
            title="Benchmark progress"
            summary={model.assessment.completedCount ? `${model.assessment.completedCount} completed · latest ${model.assessment.latestDateLabel || "recorded"}` : "No baseline yet"}
            action={typeof onOpenAssessments === "function" ? (
              <button type="button" className="progress-link-button" onClick={(event) => { event.preventDefault(); onOpenAssessments(); }}>
                Open Assess
              </button>
            ) : null}
          >
            <p className="progress-section-copy">{model.assessment.message}</p>
            <AssessmentSnapshot model={model} />
            <div className={`progress-schedule progress-schedule--${model.assessment.schedule.state}`}>
              <div className="progress-schedule__label">Assessment schedule</div>
              <div className="progress-schedule__title">{model.assessment.schedule.title}</div>
              <div className="progress-schedule__detail">{model.assessment.schedule.detail}</div>
            </div>
            <AssessmentProgressDetails assessmentProgress={assessmentProgress} />
          </ProgressDisclosure>

          <ProgressDisclosure
            kicker="DEVELOPMENT"
            title="Development trends"
            summary={model.development.trendCount ? `${model.development.trendCount} development areas · ${model.development.comparisonReadyCount} comparison-ready` : "Needs comparable benchmark history"}
          >
            <p className="progress-section-copy">{model.development.message}</p>
            <div className="progress-development-summary">
              <MetricCard label="Development areas" value={model.development.trendCount} note="Shared Development Tags" />
              <MetricCard label="Comparison-ready areas" value={model.development.comparisonReadyCount} note="Compatible benchmark history" />
              <div className="progress-development-summary__note">
                Direction comes from compatible Assessment history. Strong arrows mean sustained/aligned recent evidence, not a causal training claim.
              </div>
            </div>
            <DevelopmentTrendDetails developmentTrends={developmentTrends} />
          </ProgressDisclosure>

          <ProgressDisclosure
            kicker="ASSESSMENT ANALYSIS"
            title="Assessment analysis"
            summary={model.assessment.completedCount > 1 ? "Comparison evidence available" : "Build a second compatible benchmark to unlock deeper analysis"}
          >
            <Suspense fallback={<div className="progress-system-message" role="status">Loading Assessment Analysis…</div>}>
              <AssessmentAnalysisSection
                view="analysis"
                completedHistory={remoteData.completedHistory}
                logs={logs}
                profileId={profileId}
                sessionLibrary={remoteData.sessionLibrary}
                assessmentLibrary={remoteData.assessmentLibrary}
                onOpenAssessments={onOpenAssessments}
                verificationData={verificationData}
              />
            </Suspense>
          </ProgressDisclosure>
        </div>
      ) : null}

      {progressView === "verification" ? (
        <div className="progress-view-stack">
          <VerifiedActivityEvidenceSection
            profileId={profileId}
            profileName={profileName}
            onDataChange={setVerificationData}
          />
          <Suspense fallback={<div className="progress-system-message" role="status">Loading plan verification…</div>}>
            <AssessmentAnalysisSection
              view="verification"
              completedHistory={remoteData.completedHistory}
              logs={logs}
              profileId={profileId}
              sessionLibrary={remoteData.sessionLibrary}
              assessmentLibrary={remoteData.assessmentLibrary}
              onOpenAssessments={onOpenAssessments}
              verificationData={verificationData}
            />
          </Suspense>
        </div>
      ) : null}

      {progressView === "autobiography" ? (
        <div className="progress-view-stack">
          <Suspense fallback={<div className="progress-system-message" role="status">Loading Performance Autobiography…</div>}>
            <AssessmentAnalysisSection
              view="autobiography"
              completedHistory={remoteData.completedHistory}
              logs={logs}
              profileId={profileId}
              sessionLibrary={remoteData.sessionLibrary}
              assessmentLibrary={remoteData.assessmentLibrary}
              onOpenAssessments={onOpenAssessments}
              verificationData={verificationData}
            />
          </Suspense>
        </div>
      ) : null}
    </section>
  );
}
