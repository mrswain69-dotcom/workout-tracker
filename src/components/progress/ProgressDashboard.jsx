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
import { buildTrainingProgress } from "../../engine/progressTrainingEngine.js";
import { buildTrainingRangeViews } from "../../engine/progressTrainingRangeEngine.js";
import { buildTrainingRangeViewModel } from "../../engine/progressTrainingRangeViewModel.js";
import { buildProgressViewModel } from "../../engine/progressViewModel.js";
import {
  AssessmentProgressDetails,
  DevelopmentTrendDetails,
} from "./AssessmentDevelopmentProgress.jsx";
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
  const [trainingRangeKey, setTrainingRangeKey] = useState("recent28");
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
            label={`Active days · ${trainingDetail.label}`}
            value={trainingDetail.activeSessionDays}
            note="A day counts once even with multiple Sessions"
          />
          <MetricCard
            label={`Training time · ${trainingDetail.label}`}
            value={formatMinutes(trainingDetail.totalMinutes)}
          />
          <MetricCard
            label={`Recorded executions · ${trainingDetail.label}`}
            value={formatNumber(trainingDetail.recordedExecutions)}
            note="Explicit compatible counts only"
          />
          <MetricCard
            label={`Success rate · ${trainingDetail.label}`}
            value={trainingDetail.accuracyPct === null ? "—" : `${trainingDetail.accuracyPct}%`}
            note={trainingDetail.attempts > 0 ? `${trainingDetail.successes}/${trainingDetail.attempts} successful attempts` : "Available for attempts/successes tracking"}
          />
        </div>

        <TrainingTrendCharts training={trainingDetail} />
      </div>

      <div className="progress-section">
        <SectionHeading kicker="SESSION MIX" title="Session distribution">
          <RangeChip label={trainingDetail.label} />
        </SectionHeading>
        <p className="progress-section-copy">
          Completed structured Sessions for the selected training range. Partial
          Sessions remain separate, and legacy workouts are never reclassified as
          Session A/B/C.
        </p>
        <SessionDistribution
          rows={trainingDetail.sessionBalance}
          total={trainingDetail.sessionDistributionTotal}
        />
      </div>

      <div className="progress-section">
        <SectionHeading kicker="MOVEMENTS" title="Movement totals">
          <RangeChip label={trainingDetail.label} />
        </SectionHeading>
        <p className="progress-section-copy">
          Structured Movement totals for the selected training range. Repetitions/executions,
          attempts/successes and best scores stay in separate measures rather than
          being added together as if they shared a unit.
        </p>
        <MovementTotals rows={trainingDetail.movementTotals} />
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

        <AssessmentProgressDetails assessmentProgress={assessmentProgress} />
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
            Direction comes from compatible Assessment history. Strong arrows mean
            sustained/aligned recent evidence, not a causal training claim.
          </div>
        </div>

        <DevelopmentTrendDetails developmentTrends={developmentTrends} />
      </div>

      <Suspense
        fallback={
          <div className="progress-system-message" role="status">
            Loading Assessment Analysis…
          </div>
        }
      >
        <AssessmentAnalysisSection
          completedHistory={remoteData.completedHistory}
          logs={logs}
          profileId={profileId}
          sessionLibrary={remoteData.sessionLibrary}
          assessmentLibrary={remoteData.assessmentLibrary}
          onOpenAssessments={onOpenAssessments}
        />
      </Suspense>

      <div className="progress-legacy-bridge">
        <strong>Legacy workout history retained below</strong>
        <span>
          Best cardio values, older strength-volume trends and exercise/cardio records
          do not yet have truthful Progress parity, so Phase 3 keeps those statistics available.
        </span>
      </div>
    </section>
  );
}
