import fs from "node:fs";

const path = "src/components/progress/ProgressDashboard.jsx";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}`);
  }
  source = source.replace(before, after);
}

replaceOnce(
  'import { buildTrainingProgress } from "../../engine/progressTrainingEngine.js";\nimport { buildProgressViewModel } from "../../engine/progressViewModel.js";',
  'import { buildTrainingProgress } from "../../engine/progressTrainingEngine.js";\nimport { buildTrainingRangeViews } from "../../engine/progressTrainingRangeEngine.js";\nimport { buildTrainingRangeViewModel } from "../../engine/progressTrainingRangeViewModel.js";\nimport { buildProgressViewModel } from "../../engine/progressViewModel.js";',
  "range imports"
);

replaceOnce(
  'import "./ProgressDashboard.css";',
  'import "./ProgressDashboard.css";\nimport "./ProgressDashboardStage7.css";',
  "Stage 7 CSS import"
);

replaceOnce(
`function formatNumber(value) {
  return Math.max(0, Number(value) || 0).toLocaleString("en-GB");
}

function TrainingTrendCharts({ training }) {`,
`function formatNumber(value) {
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

function TrainingTrendCharts({ training }) {`,
  "range control helpers"
);

replaceOnce(
  '  const rows = Array.isArray(training?.trainingTrend) ? training.trainingTrend : [];',
  '  const rows = Array.isArray(training?.trend) ? training.trend : [];',
  "trend source"
);

replaceOnce(
`      <div className="progress-empty-block progress-empty-block--chart">
        Training charts will appear after structured Session activity is recorded.
        The chart window is the same rolling 28 days shown in the cards above.
      </div>`,
`      <div className="progress-empty-block progress-empty-block--chart">
        Training charts will appear after structured Session activity is recorded in
        {training?.label ? ` ${training.label.toLowerCase()}` : " this range"}.
      </div>`,
  "trend empty state"
);

replaceOnce(
  '        aria-label="Completed Sessions by 7-day period"',
  '        aria-label={training?.key === "recent28" ? "Completed Sessions by 7-day period" : `Completed Sessions by ${training?.trendPeriodLabel || "period"}`}',
  "completed chart aria"
);

replaceOnce(
`        <div className="progress-chart-card__note">
          Four consecutive 7-day periods · rolling 28 days
        </div>`,
`        <div className="progress-chart-card__note">
          {training?.label || "Selected range"} · {training?.trendPeriodLabel || "periods"}
        </div>`,
  "completed chart note"
);

replaceOnce(
  '        aria-label="Training time by 7-day period"',
  '        aria-label={training?.key === "recent28" ? "Training time by 7-day period" : `Training time by ${training?.trendPeriodLabel || "period"}`}',
  "time chart aria"
);

replaceOnce(
`        <div className="progress-chart-card__note">
          Actual time where recorded; completed Sessions may use frozen planned-time fallback
        </div>`,
`        <div className="progress-chart-card__note">
          {training?.label || "Selected range"} · actual time where recorded; completed Sessions may use frozen planned-time fallback
        </div>`,
  "time chart note"
);

source = source.replaceAll('stroke="#e2e8f0"', 'stroke="#2a2d36"');
source = source.replaceAll('fill: "#64748b"', 'fill: "#9aa4b5"');

replaceOnce(
`  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const resolvedReferenceDate = referenceDate || todayYmd();`,
`  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [trainingRangeKey, setTrainingRangeKey] = useState("recent28");
  const resolvedReferenceDate = referenceDate || todayYmd();`,
  "training range state"
);

replaceOnce(
`  const assessmentProgress = useMemo(
    () =>
      buildAssessmentProgress({`,
`  const trainingRangeViews = useMemo(
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
      buildAssessmentProgress({`,
  "range view model integration"
);

replaceOnce(
`        <div className="progress-metric-grid">
          <MetricCard label="Sessions · this week" value={model.training.sessionsThisWeek} />
          <MetricCard label="Sessions · this month" value={model.training.sessionsThisMonth} />
          <MetricCard
            label="Sessions · last 4 weeks"
            value={model.training.completedSessions28}
            note={model.training.partialSessions28 ? `${model.training.partialSessions28} partial kept separate` : "Completed structured Sessions"}
          />
          <MetricCard
            label="Active days · last 4 weeks"
            value={model.training.activeSessionDays28}
            note="A day counts once even with multiple Sessions"
          />
          <MetricCard label="Current streak" value={`${model.training.currentStreak}d`} />
          <MetricCard label="XP" value={model.training.currentXp.toLocaleString("en-GB")} />
          <MetricCard
            label="Training time · last 4 weeks"
            value={formatMinutes(model.training.trainingMinutes28)}
          />
          <MetricCard
            label="Recorded executions · last 4 weeks"
            value={formatNumber(model.training.recordedExecutions28)}
            note="Explicit compatible counts only"
          />
          <MetricCard
            label="Success rate · last 4 weeks"
            value={model.training.accuracyPct28 === null ? "—" : `${model.training.accuracyPct28}%`}
            note={model.training.attempts28 > 0 ? `${model.training.successes28}/${model.training.attempts28} successful attempts` : "Available for attempts/successes tracking"}
          />
        </div>

        <TrainingTrendCharts training={model.training} />`,
`        <div className="progress-metric-grid progress-overview-grid">
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

        <TrainingTrendCharts training={trainingDetail} />`,
  "training overview and detail"
);

replaceOnce(
`        <SectionHeading kicker="SESSION MIX" title="Session distribution" />
        <p className="progress-section-copy">
          Completed structured Sessions across the rolling last 4 weeks. Partial
          Sessions remain separate, and legacy workouts are never reclassified as
          Session A/B/C.
        </p>
        <SessionDistribution
          rows={model.training.sessionBalance}
          total={model.training.sessionDistributionTotal}
        />`,
`        <SectionHeading kicker="SESSION MIX" title="Session distribution">
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
        />`,
  "Session distribution range"
);

replaceOnce(
`        <SectionHeading kicker="MOVEMENTS" title="Movement totals" />
        <p className="progress-section-copy">
          Lifetime totals from structured Session history. Repetitions/executions,
          attempts/successes and best scores stay in separate measures rather than
          being added together as if they shared a unit.
        </p>
        <MovementTotals rows={model.training.movementTotals} />`,
`        <SectionHeading kicker="MOVEMENTS" title="Movement totals">
          <RangeChip label={trainingDetail.label} />
        </SectionHeading>
        <p className="progress-section-copy">
          Structured Movement totals for the selected training range. Repetitions/executions,
          attempts/successes and best scores stay in separate measures rather than
          being added together as if they shared a unit.
        </p>
        <MovementTotals rows={trainingDetail.movementTotals} />`,
  "Movement totals range"
);

replaceOnce(
`      <div className="progress-legacy-bridge">
        <strong>More training history below</strong>
        <span>
          Existing workout, exercise and cardio statistics remain available while
          the Progress area expands.
        </span>
      </div>`,
`      <div className="progress-legacy-bridge">
        <strong>Legacy workout history retained below</strong>
        <span>
          Best cardio values, older strength-volume trends and exercise/cardio records
          do not yet have truthful Progress parity, so Phase 3 keeps those statistics available.
        </span>
      </div>`,
  "legacy parity bridge"
);

fs.writeFileSync(path, source);

// No-op trigger: the temporary Stage 7 workflow now exists on the branch.
