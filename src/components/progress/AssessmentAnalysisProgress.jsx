import React from "react";
import "./AssessmentAnalysisProgress.css";

function ToneChip({ tone = "muted", children }) {
  return <span className={`analysis-chip analysis-chip--${tone}`}>{children}</span>;
}

function AnalysisMetric({ label, value, note = "", tone = "neutral" }) {
  return (
    <div className={`analysis-metric analysis-metric--${tone}`}>
      <div className="analysis-metric__label">{label}</div>
      <div className="analysis-metric__value">{value}</div>
      {note ? <div className="analysis-metric__note">{note}</div> : null}
    </div>
  );
}

function EmptyState({ model, onOpenAssessments }) {
  return (
    <div className={`analysis-state analysis-state--${model.state}`}>
      <div className="analysis-state__eyebrow">
        {model.state === "baseline_only" ? "1 BENCHMARK" : "0 BENCHMARKS"}
      </div>
      <div className="analysis-state__title">{model.title}</div>
      <p>{model.stateMessage}</p>
      {model.state === "baseline_only" && model.benchmark.latestDateLabel ? (
        <div className="analysis-state__baseline">
          Baseline completed {model.benchmark.latestDateLabel}
        </div>
      ) : null}
      {typeof onOpenAssessments === "function" ? (
        <button type="button" className="analysis-action" onClick={onOpenAssessments}>
          Open Assess
        </button>
      ) : null}
    </div>
  );
}

function BenchmarkStrip({ benchmark }) {
  return (
    <div className="analysis-benchmark" aria-label="Assessment comparison period">
      <div className="analysis-benchmark__point">
        <span>Previous</span>
        <strong>{benchmark.previousDateLabel || "—"}</strong>
      </div>
      <div className="analysis-benchmark__interval">
        <span>{benchmark.intervalDays || 0} days between</span>
        <div className="analysis-benchmark__line" aria-hidden="true" />
      </div>
      <div className="analysis-benchmark__point analysis-benchmark__point--latest">
        <span>Latest</span>
        <strong>{benchmark.latestDateLabel || "—"}</strong>
      </div>
    </div>
  );
}

function EvidenceQuality({ counts }) {
  const rows = [
    ["High detail", counts.high, "positive"],
    ["Medium detail", counts.medium, "interaction"],
    ["Limited detail", counts.low, "muted"],
    ["No related structured evidence", counts.none, "muted"],
  ];
  return (
    <div className="analysis-evidence-quality" aria-label="Analysis evidence quality">
      {rows.map(([label, value, tone]) => (
        <div className="analysis-evidence-quality__row" key={label}>
          <ToneChip tone={tone}>{label}</ToneChip>
          <strong>{value}</strong>
        </div>
      ))}
    </div>
  );
}

function SessionBalance({ rows, possibleNextFocus }) {
  if (!rows.length) {
    return (
      <div className="analysis-empty-detail">
        No Assessment-relevant active Session definitions are available for this comparison.
      </div>
    );
  }

  return (
    <>
      <div className="analysis-session-list" aria-label="Assessment relevant Session balance">
        {rows.map((row) => (
          <div
            className={`analysis-session-row${row.underrepresented ? " analysis-session-row--underrepresented" : ""}`}
            key={row.templateId}
          >
            <div className="analysis-session-row__code">{row.displayCode || "—"}</div>
            <div className="analysis-session-row__name">
              <strong>{row.name}</strong>
              <span>
                {row.completedCount} completed between benchmarks
                {row.underrepresented ? " · underrepresented" : ""}
              </span>
            </div>
            <div className="analysis-session-row__count">{row.completedCount}</div>
          </div>
        ))}
      </div>

      {possibleNextFocus.available ? (
        <div className="analysis-focus">
          <div className="analysis-focus__label">POSSIBLE NEXT FOCUS</div>
          <strong>
            {possibleNextFocus.displayCode ? `Session ${possibleNextFocus.displayCode} · ` : ""}
            {possibleNextFocus.name}
          </strong>
          <p>{possibleNextFocus.reason}</p>
          <span>Based on recorded Session balance only — not an automatic load prescription.</span>
        </div>
      ) : (
        <div className="analysis-focus analysis-focus--none">
          <div className="analysis-focus__label">SESSION BALANCE</div>
          <strong>No automatic focus suggested</strong>
          <p>The recorded evidence does not justify selecting one related Session over another.</p>
        </div>
      )}
    </>
  );
}

function TestEvidence({ test }) {
  return (
    <details className="analysis-test">
      <summary>
        <div className="analysis-test__identity">
          <strong>{test.testName}</strong>
          <span>
            {test.previousValue} → {test.latestValue}
            {test.percentageImprovementLabel ? ` · ${test.percentageImprovementLabel}` : ""}
          </span>
        </div>
        <div className="analysis-test__chips">
          {test.latestPbCount > 0 ? <ToneChip tone="prestige">PB</ToneChip> : null}
          <ToneChip tone={test.statusTone}>{test.statusLabel}</ToneChip>
          <ToneChip tone={test.evidenceTone}>{test.evidenceLabel}</ToneChip>
        </div>
      </summary>
      <div className="analysis-test__detail">
        <p className="analysis-test__narrative">{test.narrative}</p>
        <div className="analysis-test__facts">
          <span>Baseline <strong>{test.baselineValue}</strong></span>
          <span>Related Sessions <strong>{test.completedRelevantSessions}</strong></span>
          {test.partialRelevantSessions > 0 ? (
            <span>Partial related Sessions <strong>{test.partialRelevantSessions}</strong></span>
          ) : null}
          {test.volumeFacts.map((fact) => <span key={fact}>{fact}</span>)}
        </div>
        {test.metricChanged ? (
          <div className="analysis-test__note">Metric changed; only compatible benchmark results are compared.</div>
        ) : null}
        {test.taxonomyNote ? <div className="analysis-test__note">{test.taxonomyNote}</div> : null}
      </div>
    </details>
  );
}

export default function AssessmentAnalysisProgress({ model, onOpenAssessments = null }) {
  if (!model) return null;

  return (
    <div className="progress-section assessment-analysis" aria-label="Assessment Analysis">
      <div className="analysis-heading">
        <div>
          <div className="analysis-heading__kicker">ANALYSIS</div>
          <h3>Assessment Analysis</h3>
          <p>What changed between benchmarks, alongside the structured training that was recorded between them.</p>
        </div>
        {model.ready && typeof onOpenAssessments === "function" ? (
          <button type="button" className="analysis-action analysis-action--quiet" onClick={onOpenAssessments}>
            Open Assess
          </button>
        ) : null}
      </div>

      {!model.ready ? <EmptyState model={model} onOpenAssessments={onOpenAssessments} /> : (
        <>
          <BenchmarkStrip benchmark={model.benchmark} />

          <div className="analysis-summary-grid" aria-label="Latest Assessment outcome summary">
            {model.summaryCards.map((card) => (
              <AnalysisMetric key={card.key} label={card.label} value={card.value} tone={card.tone} />
            ))}
          </div>

          <div className="analysis-narrative">
            <div className="analysis-narrative__label">BETWEEN-BENCHMARK SUMMARY</div>
            <p>{model.overallNarrative}</p>
          </div>

          <div className="analysis-subsection">
            <div className="analysis-subsection__heading">
              <div>
                <span>TRAINING CONTEXT</span>
                <h4>Recorded rhythm between Assessments</h4>
              </div>
            </div>
            <div className="analysis-training-grid">
              {model.trainingCards.map((card) => (
                <AnalysisMetric key={card.key} label={card.label} value={card.value} note={card.note} />
              ))}
            </div>
            <p className="analysis-boundary analysis-boundary--consistency">{model.consistencyBoundary}</p>
          </div>

          <div className="analysis-two-column">
            <div className="analysis-subsection analysis-subsection--contained">
              <div className="analysis-subsection__heading">
                <div>
                  <span>SESSION BALANCE</span>
                  <h4>Assessment-relevant Sessions</h4>
                </div>
              </div>
              <SessionBalance rows={model.sessionRows} possibleNextFocus={model.possibleNextFocus} />
            </div>

            <div className="analysis-subsection analysis-subsection--contained">
              <div className="analysis-subsection__heading">
                <div>
                  <span>EVIDENCE QUALITY</span>
                  <h4>How much training detail is available?</h4>
                </div>
              </div>
              <EvidenceQuality counts={model.evidenceCounts} />
              {model.taxonomyFallbackUsed ? (
                <div className="analysis-taxonomy-note">
                  Some historical links use the current Development Tag taxonomy because frozen tag IDs were unavailable in those snapshots.
                </div>
              ) : null}
            </div>
          </div>

          <div className="analysis-subsection">
            <div className="analysis-subsection__heading analysis-subsection__heading--tests">
              <div>
                <span>TEST EVIDENCE</span>
                <h4>Test-by-Test Analysis</h4>
              </div>
              <div className="analysis-subsection__count">{model.tests.length} Tests</div>
            </div>
            {model.tests.length ? (
              <div className="analysis-test-list">
                {model.tests.map((test) => <TestEvidence key={test.testId} test={test} />)}
              </div>
            ) : (
              <div className="analysis-empty-detail">No compatible Test evidence is available for this comparison.</div>
            )}
          </div>

          <div className="analysis-boundary">
            <strong>Interpretation boundary</strong>
            <span>{model.causationBoundary}</span>
          </div>
        </>
      )}
    </div>
  );
}
