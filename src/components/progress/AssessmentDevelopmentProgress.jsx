import React, { useMemo } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  buildAssessmentDetailViewModel,
  buildDevelopmentDetailViewModel,
} from "../../engine/progressAssessmentDetailViewModel.js";
import "./AssessmentDevelopmentProgress.css";

function signedPercentage(value) {
  if (value === null || value === undefined || value === "") return "";
  const number = Number(value);
  if (!Number.isFinite(number)) return "";
  const rounded = Math.round(number * 10) / 10;
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function statusTone(status) {
  if (status === "improved" || status === "improving") return "positive";
  if (status === "declined" || status === "declining") return "caution";
  if (status === "mixed") return "mixed";
  if (status === "same" || status === "unchanged") return "neutral";
  if (status === "baseline" || status === "baseline_set") return "building";
  return "empty";
}

function StatusBadge({ status, label, glyph = "" }) {
  return (
    <span className={`progress-detail-status progress-detail-status--${statusTone(status)}`}>
      {glyph ? <span aria-hidden="true">{glyph}</span> : null}
      <span>{label}</span>
    </span>
  );
}

function AssessmentStatusSummary({ model }) {
  if (!model.hasComparison) {
    return (
      <div className="progress-detail-empty">
        {model.hasBaseline
          ? "Baseline recorded. A second compatible benchmark is required before improvement, decline and PB comparisons are shown."
          : "Complete the first benchmark to establish genuine Test baselines. No PB or trend is created from a single baseline result."}
      </div>
    );
  }

  const items = [
    ["Improved", model.statusCounts.improved, "positive"],
    ["Declined", model.statusCounts.declining, "caution"],
    ["Unchanged", model.statusCounts.unchanged, "neutral"],
    ["Mixed", model.statusCounts.mixed, "mixed"],
    ["No comparison", model.statusCounts.unavailable, "empty"],
  ];

  return (
    <div className="progress-assessment-status-grid" aria-label="Latest benchmark Test status summary">
      {items.map(([label, value, tone]) => (
        <div className={`progress-assessment-status-card progress-assessment-status-card--${tone}`} key={label}>
          <div className="progress-assessment-status-card__value">{value}</div>
          <div className="progress-assessment-status-card__label">{label}</div>
        </div>
      ))}
      <div className="progress-assessment-status-card progress-assessment-status-card--pb">
        <div className="progress-assessment-status-card__value">{model.latestPbCount}</div>
        <div className="progress-assessment-status-card__label">New PBs</div>
      </div>
    </div>
  );
}

function ComparisonDimensions({ rows }) {
  const safeRows = Array.isArray(rows) ? rows : [];
  if (!safeRows.length) return null;
  return (
    <div className="progress-test-comparison-list">
      {safeRows.map((row) => {
        const percent = signedPercentage(row.percentageImprovement);
        const dimension = row.dimension === "overall"
          ? "Result"
          : row.dimension.charAt(0).toUpperCase() + row.dimension.slice(1);
        return (
          <span className={`progress-test-comparison progress-test-comparison--${statusTone(row.status)}`} key={row.dimension}>
            {dimension}: {row.statusLabel}{percent ? ` · ${percent}` : ""}
          </span>
        );
      })}
    </div>
  );
}

function AssessmentTestChart({ row }) {
  if (!row.hasChart) {
    return (
      <div className="progress-test-chart-empty">
        {row.compatibleHistoryCount <= 1
          ? "Baseline point recorded · chart starts after the next compatible result."
          : "Comparable numeric chart data is unavailable for the current metric contract."}
      </div>
    );
  }

  const tooltipFormatter = (value, name) => [value, name];
  return (
    <div className="progress-test-chart" aria-label={`${row.testName} Assessment history chart`}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={row.points} margin={{ top: 8, right: 10, left: -12, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} />
          <YAxis tick={{ fontSize: 10, fill: "#64748b" }} domain={["auto", "auto"]} />
          <Tooltip
            formatter={tooltipFormatter}
            labelFormatter={(label) => String(label || "")}
          />
          {row.sideMode === "separate" ? (
            <>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line
                type="monotone"
                dataKey="left"
                name="Left"
                stroke="#00e5ff"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
              />
              <Line
                type="monotone"
                dataKey="right"
                name="Right"
                stroke="#00ff88"
                strokeWidth={2.5}
                dot={{ r: 3 }}
                connectNulls={false}
              />
            </>
          ) : (
            <Line
              type="monotone"
              dataKey="overall"
              name={row.metricLabel}
              stroke="#00e5ff"
              strokeWidth={2.5}
              dot={{ r: 3 }}
              connectNulls={false}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

function AssessmentTestHistory({ model }) {
  if (!model.testRows.length) {
    return (
      <div className="progress-detail-empty">
        No completed Assessment Test history yet.
      </div>
    );
  }

  return (
    <div className="progress-test-history-grid" aria-label="Assessment Test history">
      {model.testRows.map((row) => (
        <article className="progress-test-history-card" key={row.testId || row.testName}>
          <div className="progress-test-history-card__header">
            <div>
              {row.sectionLabel ? (
                <div className="progress-test-history-card__section">{row.sectionLabel}</div>
              ) : null}
              <h4>{row.testName}</h4>
              <div className="progress-test-history-card__metric">
                {row.metricLabel} · {row.directionLabel}
              </div>
            </div>
            <StatusBadge status={row.status} label={row.statusLabel} />
          </div>

          <div className="progress-test-history-card__latest">
            <div>
              <span>Latest</span>
              <strong>{row.latestValue}</strong>
            </div>
            <div className="progress-test-history-card__latest-meta">
              {row.latestDateLabel || "—"}
              {row.latestPbCount > 0 ? ` · ${row.latestPbCount} new PB${row.latestPbCount === 1 ? "" : "s"}` : ""}
            </div>
          </div>

          <ComparisonDimensions rows={row.comparisonDimensions} />
          <AssessmentTestChart row={row} />

          <div className="progress-test-history-card__footer">
            <span>{row.compatibleHistoryCount} compatible point{row.compatibleHistoryCount === 1 ? "" : "s"}</span>
            {row.metricChanged ? (
              <span>{row.hiddenPriorMetricCount} older point{row.hiddenPriorMetricCount === 1 ? "" : "s"} kept outside this chart after metric change</span>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}

function ImprovementHighlights({ model }) {
  if (!model.hasComparison) return null;
  const safe = model.biggestImprovements;
  const absoluteOnly = model.absoluteOnlyImprovements;
  if (!safe.length && !absoluteOnly.length) return null;

  return (
    <div className="progress-improvement-highlights">
      {safe.length ? (
        <div className="progress-improvement-panel">
          <div className="progress-improvement-panel__title">Largest percentage-safe improvements</div>
          <div className="progress-improvement-panel__list">
            {safe.map((row) => (
              <div className="progress-improvement-row" key={row.testId || row.testName}>
                <span>{row.testName}</span>
                <strong>{signedPercentage(row.percentage)}</strong>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {absoluteOnly.length ? (
        <div className="progress-improvement-panel progress-improvement-panel--muted">
          <div className="progress-improvement-panel__title">Improved without safe cross-unit percentage</div>
          <div className="progress-improvement-panel__copy">
            {absoluteOnly.map((row) => row.testName).join(" · ")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function AssessmentProgressDetails({ assessmentProgress }) {
  const model = useMemo(
    () => buildAssessmentDetailViewModel(assessmentProgress),
    [assessmentProgress]
  );

  return (
    <div className="progress-assessment-details">
      <AssessmentStatusSummary model={model} />
      <ImprovementHighlights model={model} />
      <div className="progress-detail-subheading">
        <div>
          <div className="progress-detail-subheading__kicker">TEST HISTORY</div>
          <h4>Assessment charts</h4>
        </div>
        <span>
          {model.chartReadyTestCount} chart-ready Test{model.chartReadyTestCount === 1 ? "" : "s"}
        </span>
      </div>
      <p className="progress-detail-copy">
        Each Test uses only its current compatible metric cohort. Different units are never plotted on the same performance axis.
      </p>
      <AssessmentTestHistory model={model} />
    </div>
  );
}

function DevelopmentTestList({ tests }) {
  const rows = Array.isArray(tests) ? tests : [];
  if (!rows.length) return null;
  return (
    <div className="progress-development-test-list">
      {rows.map((test) => {
        const percent = test.percentageSafe
          ? signedPercentage(test.normalizedPercentageImprovement)
          : "";
        return (
          <div className="progress-development-test-row" key={test.testId || test.testName}>
            <div className="progress-development-test-row__identity">
              <span className={`progress-development-glyph progress-development-glyph--${statusTone(test.state)}`} aria-hidden="true">
                {test.glyph}
              </span>
              <span>{test.testName}</span>
            </div>
            <div className="progress-development-test-row__meta">
              <span>{test.stateLabel}</span>
              {percent ? <span>{percent}</span> : null}
              {test.latestDateLabel ? <span>{test.latestDateLabel}</span> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function DevelopmentTrendDetails({ developmentTrends }) {
  const model = useMemo(
    () => buildDevelopmentDetailViewModel(developmentTrends),
    [developmentTrends]
  );

  if (!model.rows.length) {
    return (
      <div className="progress-detail-empty">
        Development Tags are not available for the current Assessment history.
      </div>
    );
  }

  return (
    <div className="progress-development-detail-list" aria-label="Detailed Development trends">
      {model.rows.map((row) => {
        const percent = row.percentageSafe
          ? signedPercentage(row.normalizedPercentageImprovement)
          : "";
        return (
          <article className={`progress-development-detail progress-development-detail--${statusTone(row.state)}`} key={row.developmentTagId || row.name}>
            <div className="progress-development-detail__header">
              <div className="progress-development-detail__identity">
                <span className={`progress-development-glyph progress-development-glyph--${statusTone(row.state)}`} aria-hidden="true">
                  {row.glyph}
                </span>
                <div>
                  <h4>{row.name}</h4>
                  <div className="progress-development-detail__counts">
                    {row.comparisonReadyTestCount}/{row.linkedTestCount} linked Tests comparison-ready
                    {row.observedTestCount !== row.linkedTestCount ? ` · ${row.observedTestCount} observed` : ""}
                  </div>
                </div>
              </div>
              <div className="progress-development-detail__status">
                <StatusBadge status={row.state} label={row.stateLabel} glyph={row.glyph} />
                {percent ? (
                  <span className="progress-development-detail__percent">
                    {percent} normalized recent change
                  </span>
                ) : null}
              </div>
            </div>

            {row.strength === "strong" && (row.state === "improving" || row.state === "declining") ? (
              <div className="progress-development-detail__strength">
                Sustained/aligned recent signal across compatible benchmark evidence.
              </div>
            ) : null}

            {!row.percentageSafe && row.comparisonReadyTestCount > 0 ? (
              <div className="progress-development-detail__percentage-note">
                Direction is valid, but no combined percentage is shown because not every contributing Test is percentage-safe.
              </div>
            ) : null}

            <DevelopmentTestList tests={row.tests} />
          </article>
        );
      })}
      <div className="progress-development-boundary-note">
        Development Trends summarize benchmark direction only. They do not claim that a particular training Session caused a Test result and they do not generate training recommendations in Phase 3.
      </div>
    </div>
  );
}
