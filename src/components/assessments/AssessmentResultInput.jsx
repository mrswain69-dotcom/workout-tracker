import React, { useMemo } from "react";
import {
  normaliseAssessmentMetricDefinition,
  normaliseAssessmentResult,
} from "../../engine/assessmentMetricEngine.js";

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function dimensionBucket(value, dimension) {
  const root = jsonObject(value);
  return jsonObject(root[dimension]);
}

function scalarAttempts(value, dimension, count) {
  const bucket = dimensionBucket(value, dimension);
  const source = Array.isArray(bucket.attempts) ? bucket.attempts : [];
  return Array.from({ length: count }, (_, index) => source[index] ?? "");
}

function pairAttempts(value, dimension, count, fixedAttempts = null) {
  const bucket = dimensionBucket(value, dimension);
  const source = Array.isArray(bucket.results) ? bucket.results : [];
  return Array.from({ length: count }, (_, index) => ({
    attempts: fixedAttempts ?? source[index]?.attempts ?? "",
    successes: source[index]?.successes ?? "",
  }));
}

const styles = `
.assessment-result-input{display:flex;flex-direction:column;gap:10px}
.assessment-result-input__dimension{border:1px solid #e2e8f0;border-radius:12px;padding:10px;background:#fff}
.assessment-result-input__dimension-title{font-weight:800;font-size:12px;margin-bottom:8px;text-transform:uppercase;letter-spacing:.04em;color:#475569}
.assessment-result-input__attempts{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
.assessment-result-input__field{display:flex;flex-direction:column;gap:4px;font-size:12px;font-weight:700;color:#475569}
.assessment-result-input__field input{width:100%;border:1px solid #cbd5e1;border-radius:10px;padding:9px;background:#fff;color:#0f172a}
.assessment-result-input__pair{display:grid;grid-template-columns:1fr 1fr;gap:6px}
.assessment-result-input__preview{font-size:12px;color:#475569}.assessment-result-input__preview strong{color:#0f172a}
.assessment-result-input__errors{font-size:12px;color:#991b1b;margin:0;padding-left:18px}
`;

export default function AssessmentResultInput({
  metric: rawMetric,
  value = {},
  onChange,
  disabled = false,
  labelPrefix = "Result",
}) {
  const metric = useMemo(
    () => normaliseAssessmentMetricDefinition(rawMetric || {}),
    [rawMetric]
  );
  const evaluation = useMemo(
    () => normaliseAssessmentResult(metric, value || {}),
    [metric, value]
  );
  const dimensions = metric.sideMode === "separate" ? ["left", "right"] : ["overall"];
  const isPair = metric.metricType === "attempts_successes";
  const fixedAttempts = isPair ? metric.metricConfig.fixedAttempts : null;

  const updateScalar = (dimension, index, nextValue) => {
    const root = { ...jsonObject(value) };
    const attempts = scalarAttempts(value, dimension, metric.attemptCount);
    attempts[index] = nextValue;
    root[dimension] = { ...dimensionBucket(value, dimension), attempts };
    onChange?.(root);
  };

  const updatePair = (dimension, index, field, nextValue) => {
    const root = { ...jsonObject(value) };
    const results = pairAttempts(
      value,
      dimension,
      metric.attemptCount,
      fixedAttempts
    );
    results[index] = { ...results[index], [field]: nextValue };
    root[dimension] = { ...dimensionBucket(value, dimension), results };
    onChange?.(root);
  };

  return (
    <div className="assessment-result-input">
      <style>{styles}</style>
      {dimensions.map((dimension) => {
        const title =
          dimension === "overall"
            ? labelPrefix
            : dimension === "left"
            ? "Left"
            : "Right";
        const scalars = scalarAttempts(value, dimension, metric.attemptCount);
        const pairs = pairAttempts(
          value,
          dimension,
          metric.attemptCount,
          fixedAttempts
        );

        return (
          <div className="assessment-result-input__dimension" key={dimension}>
            {metric.sideMode === "separate" ? (
              <div className="assessment-result-input__dimension-title">{title}</div>
            ) : null}
            <div className="assessment-result-input__attempts">
              {Array.from({ length: metric.attemptCount }, (_, index) => (
                <div key={`${dimension}-${index}`}>
                  {isPair ? (
                    <div className="assessment-result-input__pair">
                      <label className="assessment-result-input__field">
                        <span>{`${title} attempt ${index + 1} attempts`}</span>
                        <input
                          aria-label={`${title} attempt ${index + 1} attempts`}
                          type="number"
                          min="0"
                          step="1"
                          disabled={disabled || fixedAttempts !== null}
                          value={pairs[index].attempts}
                          onChange={(event) =>
                            updatePair(
                              dimension,
                              index,
                              "attempts",
                              event.target.value
                            )
                          }
                        />
                      </label>
                      <label className="assessment-result-input__field">
                        <span>{`${title} attempt ${index + 1} successes`}</span>
                        <input
                          aria-label={`${title} attempt ${index + 1} successes`}
                          type="number"
                          min="0"
                          step="1"
                          disabled={disabled}
                          value={pairs[index].successes}
                          onChange={(event) =>
                            updatePair(
                              dimension,
                              index,
                              "successes",
                              event.target.value
                            )
                          }
                        />
                      </label>
                    </div>
                  ) : (
                    <label className="assessment-result-input__field">
                      <span>{`${title} attempt ${index + 1}${metric.unit ? ` (${metric.unit})` : ""}`}</span>
                      <input
                        aria-label={`${title} attempt ${index + 1}`}
                        type="number"
                        min={metric.allowNegative ? undefined : "0"}
                        step="any"
                        disabled={disabled}
                        value={scalars[index]}
                        onChange={(event) =>
                          updateScalar(dimension, index, event.target.value)
                        }
                      />
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div className="assessment-result-input__preview">
        Retained result: <strong>{evaluation.valid ? evaluation.displayValue : "—"}</strong>
      </div>
      {!evaluation.valid && evaluation.errors.length ? (
        <ul className="assessment-result-input__errors" aria-label="Result validation">
          {evaluation.errors.map((error, index) => (
            <li key={`${error}-${index}`}>{error}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
