import React, { useCallback, useEffect, useMemo, useState } from "react";
import * as assessmentRunDb from "../../assessmentRunDb.js";
import {
  buildAssessmentRunHistory,
  buildAssessmentTestHistory,
  formatAssessmentHistoryEntry,
} from "../../engine/assessmentHistoryEngine.js";
import {
  formatAssessmentMetricValue,
  normaliseAssessmentMetricDefinition,
} from "../../engine/assessmentMetricEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function formatDate(dateYmd) {
  if (!dateYmd) return "—";
  const date = new Date(`${dateYmd}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateYmd;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function resultError(result, fallback) {
  if (!result?.error) return null;
  const message = result.error?.message || String(result.error);
  return new Error(`${fallback}: ${message}`);
}

function dimensionComparable(entry, dimension) {
  if (!entry) return null;
  const raw =
    entry.metric.sideMode === "separate"
      ? entry.comparableDimensions?.[dimension]
      : entry.comparableValue;
  if (raw === "" || raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function comparisonUnit(metric) {
  if (
    metric.metricType === "attempts_successes" &&
    metric.metricConfig.comparisonMode === "rate"
  ) {
    return "pp";
  }
  return metric.unit || "";
}

function signedNumber(value, places = 1) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) {
    return "—";
  }
  const number = Number(value);
  const rounded = Number(number.toFixed(Math.max(0, Math.min(3, places))));
  return `${rounded > 0 ? "+" : ""}${rounded}`;
}

function comparisonPart(dimension, metric) {
  if (!dimension || dimension.status === "unavailable") return "Unavailable";
  if (dimension.status === "same") return "No change";
  const amount = Math.abs(Number(dimension.improvementValue || 0));
  const unit = comparisonUnit(metric);
  const amountText = `${amount}${unit ? ` ${unit}` : ""}`;
  const percentageValue =
    dimension.percentageImprovement === null ||
    dimension.percentageImprovement === undefined ||
    dimension.percentageImprovement === ""
      ? null
      : Number(dimension.percentageImprovement);
  const percentage = Number.isFinite(percentageValue)
    ? ` (${signedNumber(
        percentageValue,
        metric.metricConfig.percentageDecimalPlaces
      )}%)`
    : "";
  return `${dimension.status === "improved" ? "Improved" : "Declined"} ${amountText}${percentage}`;
}

function ComparisonSummary({ bundle, metric, label }) {
  if (!bundle?.available) {
    const reason =
      bundle?.reason === "metric_changed"
        ? "Metric changed — comparison withheld"
        : "No comparison yet";
    return (
      <div className="assessment-history__comparison">
        <strong>{label}</strong>
        <span>{reason}</span>
      </div>
    );
  }

  const comparison = bundle.comparison;
  if (metric.sideMode === "separate") {
    return (
      <div className="assessment-history__comparison">
        <strong>{label}</strong>
        <span>L: {comparisonPart(comparison.dimensions.left, metric)}</span>
        <span>R: {comparisonPart(comparison.dimensions.right, metric)}</span>
      </div>
    );
  }

  return (
    <div className="assessment-history__comparison">
      <strong>{label}</strong>
      <span>{comparisonPart(comparison.overall, metric)}</span>
    </div>
  );
}

function TrendStrip({ entries, dimension = "overall", label }) {
  const points = entries
    .map((entry, index) => ({
      index,
      value: dimensionComparable(entry, dimension),
    }))
    .filter((point) => point.value !== null);
  if (points.length < 2) return null;

  const width = 320;
  const height = 70;
  const pad = 8;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const maxIndex = Math.max(1, entries.length - 1);
  const coords = points.map((point) => {
    const x = pad + (point.index / maxIndex) * (width - pad * 2);
    const y = height - pad - ((point.value - min) / span) * (height - pad * 2);
    return { ...point, x, y };
  });
  const polyline = coords.map((point) => `${point.x},${point.y}`).join(" ");

  return (
    <div className="assessment-history__trend">
      <div className="assessment-history__trend-label">{label}</div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${label} chronological result trend`}
        preserveAspectRatio="none"
      >
        <polyline points={polyline} fill="none" stroke="currentColor" strokeWidth="3" />
        {coords.map((point) => (
          <circle key={`${point.index}-${point.value}`} cx={point.x} cy={point.y} r="3.5" fill="currentColor" />
        ))}
      </svg>
      <div className="assessment-history__trend-axis">
        <span>{formatDate(entries[0]?.dateYmd)}</span>
        <span>{formatDate(entries.at(-1)?.dateYmd)}</span>
      </div>
    </div>
  );
}

function SummaryValue({ label, entry, extra = null }) {
  return (
    <div className="assessment-history__stat">
      <div className="assessment-history__stat-label">{label}</div>
      <div className="assessment-history__stat-value">
        {entry ? formatAssessmentHistoryEntry(entry) : "—"}
      </div>
      <div className="assessment-history__stat-meta">
        {entry ? formatDate(entry.dateYmd) : "No result yet"}
        {extra ? ` · ${extra}` : ""}
      </div>
    </div>
  );
}

function PbValue({ history }) {
  if (!history.pb.eligible) {
    return (
      <div className="assessment-history__stat">
        <div className="assessment-history__stat-label">Personal best</div>
        <div className="assessment-history__stat-value">Not tracked</div>
        <div className="assessment-history__stat-meta">PB disabled for this history</div>
      </div>
    );
  }

  if (history.metric.sideMode === "separate") {
    const left = history.pb.dimensions.left;
    const right = history.pb.dimensions.right;
    return (
      <div className="assessment-history__stat">
        <div className="assessment-history__stat-label">Personal best</div>
        <div className="assessment-history__stat-value assessment-history__stat-value--small">
          L {left ? formatAssessmentMetricValue(left.retainedResult.left, history.metric) : "—"}
          <br />
          R {right ? formatAssessmentMetricValue(right.retainedResult.right, history.metric) : "—"}
        </div>
        <div className="assessment-history__stat-meta">
          L {left ? formatDate(left.dateYmd) : "—"} · R {right ? formatDate(right.dateYmd) : "—"}
        </div>
      </div>
    );
  }

  return <SummaryValue label="Personal best" entry={history.pb.overall} />;
}

function TestHistoryCard({ history }) {
  const metric = history.metric;
  const newPb = metric.sideMode === "separate"
    ? Object.entries(history.pb.latestNewPb.dimensions)
        .filter(([, value]) => value)
        .map(([dimension]) => dimension === "left" ? "L" : "R")
        .join("/")
    : history.pb.latestNewPb.overall
      ? "PB"
      : "";

  return (
    <article className="assessment-history__test-card">
      <div className="assessment-history__test-top">
        <div>
          <h3>{history.testName}</h3>
          <div className="assessment-history__meta">
            {history.count} completed result{history.count === 1 ? "" : "s"} · {metric.scoringDirection === "lower" ? "lower" : "higher"} is better
          </div>
        </div>
        {newPb ? <span className="assessment-history__pb-badge">New {newPb}</span> : null}
      </div>

      {history.metricChanged ? (
        <div className="assessment-history__warning">
          This Test’s frozen metric changed during its history. Older entries remain visible, but incompatible results are not mixed into current PB/change calculations.
        </div>
      ) : null}

      <div className="assessment-history__stats">
        <SummaryValue label="Latest" entry={history.latest} />
        <SummaryValue label="Previous" entry={history.previous} />
        <SummaryValue label="Original baseline" entry={history.baseline} />
        <PbValue history={history} />
      </div>

      <div className="assessment-history__comparisons">
        <ComparisonSummary bundle={history.previousComparison} metric={metric} label="Vs previous" />
        <ComparisonSummary bundle={history.baselineComparison} metric={metric} label="Vs baseline" />
      </div>

      <div className="assessment-history__trends">
        {metric.sideMode === "separate" ? (
          <>
            <TrendStrip entries={history.entries.filter((entry) => entry.metricKey === history.metricKey)} dimension="left" label="Left result" />
            <TrendStrip entries={history.entries.filter((entry) => entry.metricKey === history.metricKey)} dimension="right" label="Right result" />
          </>
        ) : (
          <TrendStrip entries={history.entries.filter((entry) => entry.metricKey === history.metricKey)} label="Result" />
        )}
      </div>

      <details className="assessment-history__details">
        <summary>Full Test history</summary>
        <div className="assessment-history__timeline">
          {history.entries.slice().reverse().map((entry, reverseIndex) => {
            const isBaseline = entry.id === history.baseline?.id;
            const recordLabels = [];
            if (entry.recordMarkers.overall) recordLabels.push("PB at the time");
            if (entry.recordMarkers.left) recordLabels.push("L PB at the time");
            if (entry.recordMarkers.right) recordLabels.push("R PB at the time");
            return (
              <div className="assessment-history__timeline-row" key={entry.id || `${entry.runId}-${reverseIndex}`}>
                <div>
                  <strong>{formatDate(entry.dateYmd)}</strong>
                  <div className="assessment-history__meta">
                    {entry.assessmentName}{entry.testName !== history.testName ? ` · recorded as “${entry.testName}”` : ""}
                  </div>
                </div>
                <div className="assessment-history__timeline-result">
                  <strong>{formatAssessmentHistoryEntry(entry)}</strong>
                  <div className="assessment-history__markers">
                    {isBaseline ? <span>Baseline</span> : null}
                    {recordLabels.map((label) => <span key={label}>{label}</span>)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </details>
    </article>
  );
}

function formatStoredResult(row) {
  const metric = normaliseAssessmentMetricDefinition(row?.metric_snapshot || row?.metricSnapshot || {});
  const retained = jsonObject(row?.retained_result || row?.retainedResult || {});
  if (metric.sideMode === "separate") {
    return `L ${formatAssessmentMetricValue(retained.left, metric)} · R ${formatAssessmentMetricValue(retained.right, metric)}`;
  }
  return formatAssessmentMetricValue(retained.overall, metric);
}

function AssessmentRunCard({ item }) {
  const snapshot = jsonObject(item.run?.template_snapshot || item.run?.templateSnapshot || {});
  return (
    <article className="assessment-history__run-card">
      <div className="assessment-history__test-top">
        <div>
          <h3>{snapshot.template?.name || "Assessment"}</h3>
          <div className="assessment-history__meta">{formatDate(item.run?.date_ymd || item.run?.dateYmd)} · v{item.run?.template_version || item.run?.templateVersion || snapshot.template?.version || 1}</div>
        </div>
        <span>{item.results.length} valid Test{item.results.length === 1 ? "" : "s"}</span>
      </div>
      {item.run?.notes ? <p className="assessment-history__run-notes">{item.run.notes}</p> : null}
      <div className="assessment-history__run-results">
        {item.results.map((row) => (
          <div key={row.id}>
            <span>{row.test_name_snapshot || row.testNameSnapshot || "Test"}</span>
            <strong>{formatStoredResult(row)}</strong>
          </div>
        ))}
      </div>
    </article>
  );
}

const styles = `
.assessment-history{display:flex;flex-direction:column;gap:14px}
.assessment-history__header,.assessment-history__test-top,.assessment-history__timeline-row{display:flex;justify-content:space-between;align-items:flex-start;gap:12px}
.assessment-history__header h2,.assessment-history__test-card h3,.assessment-history__run-card h3{margin:0}.assessment-history__header p{margin:4px 0 0;color:#64748b;font-size:13px}
.assessment-history__eyebrow{text-transform:uppercase;font-size:11px;font-weight:850;letter-spacing:.08em;color:#64748b}.assessment-history__meta{font-size:12px;color:#64748b;margin-top:3px}
.assessment-history__tabs{display:flex;gap:8px;flex-wrap:wrap}.assessment-history__tabs button[aria-pressed="true"]{font-weight:850;box-shadow:inset 0 0 0 2px rgba(255,122,24,.38)}
.assessment-history__summary{display:flex;gap:8px;flex-wrap:wrap;color:#475569;font-size:13px}.assessment-history__summary strong{color:#0f172a}
.assessment-history__grid,.assessment-history__runs{display:grid;gap:12px}.assessment-history__grid{grid-template-columns:repeat(auto-fit,minmax(310px,1fr))}
.assessment-history__test-card,.assessment-history__run-card{border:1px solid rgba(15,23,42,.12);border-radius:18px;background:#fff;padding:15px;min-width:0}.assessment-history__pb-badge{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:999px;padding:5px 9px;font-size:11px;font-weight:900;white-space:nowrap}
.assessment-history__warning{margin-top:10px;padding:9px 10px;border-radius:10px;background:#fef3c7;color:#92400e;font-size:12px}
.assessment-history__stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}.assessment-history__stat{border-radius:12px;background:#f8fafc;padding:10px;min-width:0}.assessment-history__stat-label{font-size:10px;font-weight:900;text-transform:uppercase;letter-spacing:.04em;color:#64748b}.assessment-history__stat-value{font-size:17px;font-weight:900;margin-top:3px;overflow-wrap:anywhere}.assessment-history__stat-value--small{font-size:14px}.assessment-history__stat-meta{font-size:10px;color:#64748b;margin-top:3px}
.assessment-history__comparisons{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:9px}.assessment-history__comparison{display:flex;flex-direction:column;gap:2px;border:1px solid #e2e8f0;border-radius:11px;padding:9px;font-size:12px}.assessment-history__comparison strong{font-size:11px;text-transform:uppercase;color:#64748b}
.assessment-history__trends{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;margin-top:10px}.assessment-history__trend{border:1px solid #e2e8f0;border-radius:12px;padding:8px;color:#f97316;min-width:0}.assessment-history__trend-label{font-size:11px;font-weight:850;color:#475569}.assessment-history__trend svg{display:block;width:100%;height:70px}.assessment-history__trend-axis{display:flex;justify-content:space-between;font-size:9px;color:#64748b}
.assessment-history__details{margin-top:10px}.assessment-history__details summary{cursor:pointer;font-size:12px;font-weight:850;color:#475569}.assessment-history__timeline{display:flex;flex-direction:column;gap:0;margin-top:8px}.assessment-history__timeline-row{padding:9px 0;border-top:1px solid #e2e8f0}.assessment-history__timeline-result{text-align:right}.assessment-history__markers{display:flex;justify-content:flex-end;gap:4px;flex-wrap:wrap;margin-top:3px}.assessment-history__markers span{font-size:9px;background:#ffedd5;color:#9a3412;border-radius:999px;padding:2px 5px}
.assessment-history__run-notes{font-size:13px;color:#475569}.assessment-history__run-results{display:flex;flex-direction:column;margin-top:10px}.assessment-history__run-results>div{display:flex;justify-content:space-between;gap:12px;padding:7px 0;border-top:1px solid #e2e8f0;font-size:12px}.assessment-history__run-results strong{text-align:right}.assessment-history__empty{padding:18px;border:1px dashed #cbd5e1;border-radius:14px;color:#64748b;background:rgba(255,255,255,.55)}.assessment-history__error{padding:10px 12px;border-radius:12px;background:#fee2e2;color:#991b1b}
@media(max-width:720px){.assessment-history__stats{grid-template-columns:repeat(2,minmax(0,1fr))}.assessment-history__comparisons{grid-template-columns:1fr}.assessment-history__header,.assessment-history__test-top{flex-direction:column}.assessment-history__grid{grid-template-columns:1fr}}
`;

export default function AssessmentHistory({
  familyId,
  profileId,
  athleteName = "Athlete",
  dbApi = assessmentRunDb,
}) {
  const [data, setData] = useState({ runs: [], results: [] });
  const [view, setView] = useState("tests");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!familyId || !profileId) {
      setData({ runs: [], results: [] });
      return;
    }
    setLoading(true);
    setError("");
    try {
      const result = await dbApi.loadCompletedAssessmentHistory(familyId, profileId);
      const loadError = resultError(result, "Could not load Assessment history");
      if (loadError) throw loadError;
      setData(result?.data || { runs: [], results: [] });
    } catch (loadError) {
      setError(loadError?.message || String(loadError));
      setData({ runs: [], results: [] });
    } finally {
      setLoading(false);
    }
  }, [familyId, profileId, dbApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const testHistory = useMemo(
    () => buildAssessmentTestHistory(data),
    [data]
  );
  const runHistory = useMemo(
    () => buildAssessmentRunHistory(data),
    [data]
  );

  return (
    <section className="assessment-history">
      <style>{styles}</style>
      <div className="assessment-history__header">
        <div>
          <div className="assessment-history__eyebrow">Measured development</div>
          <h2>{athleteName}’s Assessment progress</h2>
          <p>PBs and improvements are recalculated from completed immutable history. No result is permanently “claimed” as a PB.</p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}>Refresh</button>
      </div>

      <div className="assessment-history__tabs" role="tablist" aria-label="Assessment history views">
        <button type="button" aria-pressed={view === "tests"} onClick={() => setView("tests")}>Test progress</button>
        <button type="button" aria-pressed={view === "assessments"} onClick={() => setView("assessments")}>Completed Assessments</button>
      </div>

      {error ? <div role="alert" className="assessment-history__error">{error}</div> : null}

      <div className="assessment-history__summary">
        <span><strong>{runHistory.length}</strong> completed Assessment{runHistory.length === 1 ? "" : "s"}</span>
        <span><strong>{testHistory.length}</strong> tracked canonical Test{testHistory.length === 1 ? "" : "s"}</span>
      </div>

      {loading ? (
        <div className="assessment-history__empty">Loading completed Assessment history…</div>
      ) : view === "tests" ? (
        testHistory.length ? (
          <div className="assessment-history__grid">
            {testHistory.map((history) => <TestHistoryCard key={history.testId} history={history} />)}
          </div>
        ) : (
          <div className="assessment-history__empty">No completed Assessment results yet. Once an Assessment is completed, its baseline, previous result, PB and trend will appear here.</div>
        )
      ) : runHistory.length ? (
        <div className="assessment-history__runs">
          {runHistory.map((item) => <AssessmentRunCard key={item.run.id} item={item} />)}
        </div>
      ) : (
        <div className="assessment-history__empty">No completed Assessments yet.</div>
      )}
    </section>
  );
}
