import React, { useEffect, useMemo, useState } from "react";
import {
  normaliseAssessmentMetricDefinition,
  validateAssessmentMetricDefinition,
} from "../../engine/assessmentMetricEngine.js";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function makeDraft(value = {}) {
  const metric = normaliseAssessmentMetricDefinition(value);
  return {
    id: cleanText(value.id),
    name: cleanText(value.name),
    description: cleanText(value.description),
    version: Math.max(1, Number(value.version) || 1),
    metricType: metric.metricType,
    unit: metric.unit,
    scoringDirection: metric.scoringDirection,
    attemptCount: metric.attemptCount,
    resultStrategy: metric.resultStrategy,
    sideMode: metric.sideMode,
    allowNegative: metric.allowNegative,
    pbEligible: metric.pbEligible,
    metricConfig: {
      ...metric.metricConfig,
      decimalPlaces: Number(metric.metricConfig.decimalPlaces) || 0,
      percentageDecimalPlaces:
        Number(metric.metricConfig.percentageDecimalPlaces) || 0,
    },
  };
}

const METRIC_TYPES = [
  ["numeric", "Number"],
  ["time", "Time"],
  ["distance", "Distance"],
  ["repetitions", "Repetitions"],
  ["attempts_successes", "Attempts / successes"],
  ["best_score", "Best score"],
];

function Field({ label, children, hint = "" }) {
  return (
    <label className="assessment-editor__field">
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export default function AssessmentTestEditor({
  value,
  developmentTags = [],
  selectedDevelopmentTagIds = [],
  onSave,
  onCancel,
  saving = false,
}) {
  const [draft, setDraft] = useState(() => makeDraft(value));
  const [tagIds, setTagIds] = useState(() => [...new Set(selectedDevelopmentTagIds)]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  useEffect(() => {
    setDraft(makeDraft(value));
  }, [value]);

  useEffect(() => {
    setTagIds([...new Set(selectedDevelopmentTagIds)]);
  }, [selectedDevelopmentTagIds]);

  const metricValidation = useMemo(
    () => validateAssessmentMetricDefinition(draft),
    [draft]
  );
  const valid = !!cleanText(draft.name) && metricValidation.valid;
  const attemptsSuccesses = draft.metricType === "attempts_successes";

  const setMetricConfig = (patch) =>
    setDraft((current) => ({
      ...current,
      metricConfig: { ...current.metricConfig, ...patch },
    }));

  const setMetricType = (metricType) => {
    setDraft((current) => ({
      ...current,
      metricType,
      resultStrategy:
        metricType === "attempts_successes" && current.resultStrategy === "average"
          ? "single"
          : current.resultStrategy,
    }));
  };

  return (
    <form
      className="assessment-editor assessment-test-editor"
      aria-label={draft.id ? "Edit Test" : "New Test"}
      onSubmit={(event) => {
        event.preventDefault();
        if (!valid || saving) return;
        onSave?.({
          test: {
            ...draft,
            name: cleanText(draft.name),
            description: cleanText(draft.description),
            unit: cleanText(draft.unit),
            attemptCount: Math.max(1, Number(draft.attemptCount) || 1),
            metricConfig: {
              ...draft.metricConfig,
              decimalPlaces: Math.max(
                0,
                Math.min(6, Number(draft.metricConfig.decimalPlaces) || 0)
              ),
              percentageDecimalPlaces: Math.max(
                0,
                Math.min(
                  3,
                  Number(draft.metricConfig.percentageDecimalPlaces) || 0
                )
              ),
            },
          },
          developmentTagIds: [...new Set(tagIds)].filter(Boolean),
        });
      }}
    >
      <div className="assessment-editor__heading">
        <div>
          <h3>{draft.id ? "Edit Test" : "New Test"}</h3>
          {draft.id ? <span className="assessment-editor__version">v{draft.version}</span> : null}
        </div>
        <p>Reusable measurement definition. Editing it affects future Assessments only.</p>
      </div>

      <div className="assessment-editor__grid assessment-editor__grid--two">
        <Field label="Test name">
          <input
            aria-label="Test name"
            value={draft.name}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, name: event.target.value }))
            }
            placeholder="e.g. 10 m acceleration"
          />
        </Field>
        <Field label="Metric type">
          <select
            aria-label="Metric type"
            value={draft.metricType}
            disabled={saving}
            onChange={(event) => setMetricType(event.target.value)}
          >
            {METRIC_TYPES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Description">
        <textarea
          aria-label="Test description"
          rows={2}
          value={draft.description}
          disabled={saving}
          onChange={(event) =>
            setDraft((current) => ({ ...current, description: event.target.value }))
          }
          placeholder="What this Test measures"
        />
      </Field>

      <div className="assessment-editor__grid assessment-editor__grid--three">
        <Field label="Unit" hint={attemptsSuccesses ? "Not used for attempts/successes" : "e.g. s, cm, reps"}>
          <input
            aria-label="Unit"
            value={draft.unit}
            disabled={saving || attemptsSuccesses}
            onChange={(event) =>
              setDraft((current) => ({ ...current, unit: event.target.value }))
            }
          />
        </Field>
        <Field label="Better result">
          <select
            aria-label="Scoring direction"
            value={draft.scoringDirection}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                scoringDirection: event.target.value,
              }))
            }
          >
            <option value="higher">Higher is better</option>
            <option value="lower">Lower is better</option>
          </select>
        </Field>
        <Field label="Attempts">
          <input
            aria-label="Attempt count"
            type="number"
            min="1"
            step="1"
            value={draft.attemptCount}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                attemptCount: Math.max(1, Number(event.target.value) || 1),
              }))
            }
          />
        </Field>
      </div>

      <div className="assessment-editor__grid assessment-editor__grid--two">
        <Field label="Retained result">
          <select
            aria-label="Result strategy"
            value={draft.resultStrategy}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, resultStrategy: event.target.value }))
            }
          >
            <option value="single">Single / first valid result</option>
            <option value="best">Best attempt</option>
            <option value="average" disabled={attemptsSuccesses}>Average</option>
          </select>
        </Field>
        <Field label="Sides">
          <select
            aria-label="Side mode"
            value={draft.sideMode}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sideMode: event.target.value }))
            }
          >
            <option value="none">One result</option>
            <option value="separate">Separate left / right</option>
          </select>
        </Field>
      </div>

      <div className="assessment-editor__checks">
        <label>
          <input
            type="checkbox"
            checked={draft.allowNegative}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, allowNegative: event.target.checked }))
            }
          />
          Allow negative values
        </label>
        <label>
          <input
            type="checkbox"
            checked={draft.pbEligible}
            disabled={saving}
            onChange={(event) =>
              setDraft((current) => ({ ...current, pbEligible: event.target.checked }))
            }
          />
          Eligible for PBs
        </label>
      </div>

      {developmentTags.length ? (
        <fieldset className="assessment-editor__tags">
          <legend>Development Tags</legend>
          <p>Shared with training Movements so later analysis can compare related work and results.</p>
          <div className="assessment-editor__tag-grid">
            {developmentTags.filter((tag) => !tag.archived).map((tag) => (
              <label key={tag.id}>
                <input
                  type="checkbox"
                  checked={tagIds.includes(tag.id)}
                  disabled={saving}
                  onChange={(event) =>
                    setTagIds((current) =>
                      event.target.checked
                        ? [...new Set([...current, tag.id])]
                        : current.filter((id) => id !== tag.id)
                    )
                  }
                />
                {tag.name}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      <button
        type="button"
        className="assessment-editor__advanced-toggle"
        aria-expanded={showAdvanced}
        onClick={() => setShowAdvanced((value) => !value)}
      >
        {showAdvanced ? "Hide metric details" : "Metric details"}
      </button>

      {showAdvanced ? (
        <div className="assessment-editor__advanced">
          <div className="assessment-editor__grid assessment-editor__grid--three">
            <Field label="Decimal places">
              <input
                aria-label="Decimal places"
                type="number"
                min="0"
                max="6"
                value={draft.metricConfig.decimalPlaces}
                disabled={saving}
                onChange={(event) =>
                  setMetricConfig({ decimalPlaces: Number(event.target.value) || 0 })
                }
              />
            </Field>
            <Field label="% decimal places">
              <input
                aria-label="Percentage decimal places"
                type="number"
                min="0"
                max="3"
                value={draft.metricConfig.percentageDecimalPlaces}
                disabled={saving}
                onChange={(event) =>
                  setMetricConfig({
                    percentageDecimalPlaces: Number(event.target.value) || 0,
                  })
                }
              />
            </Field>
            <Field label="Percentage improvement">
              <select
                aria-label="Percentage improvement mode"
                value={draft.metricConfig.percentageImprovement || "auto"}
                disabled={saving}
                onChange={(event) =>
                  setMetricConfig({ percentageImprovement: event.target.value })
                }
              >
                <option value="auto">Automatic when safe</option>
                <option value="never">Never</option>
                <option value="allow">Allow for signed metrics</option>
              </select>
            </Field>
          </div>

          <label className="assessment-editor__inline-check">
            <input
              type="checkbox"
              checked={!!draft.metricConfig.fixedDecimals}
              disabled={saving}
              onChange={(event) => setMetricConfig({ fixedDecimals: event.target.checked })}
            />
            Always show fixed decimal places
          </label>

          {attemptsSuccesses ? (
            <div className="assessment-editor__grid assessment-editor__grid--two">
              <Field label="Compare using">
                <select
                  aria-label="Attempts successes comparison mode"
                  value={draft.metricConfig.comparisonMode || "successes"}
                  disabled={saving}
                  onChange={(event) =>
                    setMetricConfig({ comparisonMode: event.target.value })
                  }
                >
                  <option value="successes">Successful attempts</option>
                  <option value="rate">Success rate</option>
                </select>
              </Field>
              <label className="assessment-editor__inline-check assessment-editor__inline-check--bottom">
                <input
                  type="checkbox"
                  checked={!!draft.metricConfig.showRate}
                  disabled={saving}
                  onChange={(event) => setMetricConfig({ showRate: event.target.checked })}
                />
                Show success rate beside result
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {!metricValidation.valid ? (
        <div className="assessment-editor__error" role="alert">
          {metricValidation.errors.join(" ")}
        </div>
      ) : null}

      <div className="assessment-editor__actions">
        <button type="button" disabled={saving} onClick={onCancel}>Cancel</button>
        <button type="submit" disabled={saving || !valid}>
          {saving ? "Saving…" : "Save Test"}
        </button>
      </div>
    </form>
  );
}
