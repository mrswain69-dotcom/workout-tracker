import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return source.replace(before, after);
}

// Generic attempts/successes protocol support: a result entry can represent a
// fixed number of trials (for example 8/10) independently of best-of-N entries.
const metricPath = "src/engine/assessmentMetricEngine.js";
let metric = fs.readFileSync(metricPath, "utf8");
metric = replaceOnce(
  metric,
`      comparisonMode:\n        cleanText(metricConfig.comparisonMode, "successes").toLowerCase() ===\n        "rate"\n          ? "rate"\n          : "successes",`,
`      comparisonMode:\n        cleanText(metricConfig.comparisonMode, "successes").toLowerCase() ===\n        "rate"\n          ? "rate"\n          : "successes",\n      fixedAttempts:\n        Number.isInteger(Number(metricConfig.fixedAttempts)) &&\n        Number(metricConfig.fixedAttempts) > 0\n          ? Number(metricConfig.fixedAttempts)\n          : null,`,
  "normalise fixed attempts"
);
metric = replaceOnce(
  metric,
`    if (parsed === null) {\n      errors.push(\`${"${dimension}"} attempt ${"${index + 1}"} is not a valid result.\`);\n    } else {\n      attempts.push(parsed);\n    }`,
`    if (parsed === null) {\n      errors.push(\`${"${dimension}"} attempt ${"${index + 1}"} is not a valid result.\`);\n    } else if (\n      definition.metricType === "attempts_successes" &&\n      definition.metricConfig.fixedAttempts !== null &&\n      parsed.attempts !== definition.metricConfig.fixedAttempts\n    ) {\n      errors.push(\`${"${dimension}"} attempt ${"${index + 1}"} must use ${"${definition.metricConfig.fixedAttempts}"} attempts.\`);\n    } else {\n      attempts.push(parsed);\n    }`,
  "validate fixed attempts"
);
fs.writeFileSync(metricPath, metric);

const historyPath = "src/engine/assessmentHistoryEngine.js";
let history = fs.readFileSync(historyPath, "utf8");
history = replaceOnce(
  history,
`    comparisonMode: metric.metricConfig.comparisonMode,\n  });`,
`    comparisonMode: metric.metricConfig.comparisonMode,\n    fixedAttempts:\n      metric.metricType === "attempts_successes" &&\n      metric.metricConfig.comparisonMode === "successes"\n        ? metric.metricConfig.fixedAttempts\n        : null,\n  });`,
  "history fixed-attempt compatibility"
);
fs.writeFileSync(historyPath, history);

const inputPath = "src/components/assessments/AssessmentResultInput.jsx";
let input = fs.readFileSync(inputPath, "utf8");
input = replaceOnce(
  input,
`function pairAttempts(value, dimension, count) {\n  const bucket = dimensionBucket(value, dimension);\n  const source = Array.isArray(bucket.results) ? bucket.results : [];\n  return Array.from({ length: count }, (_, index) => ({\n    attempts: source[index]?.attempts ?? "",\n    successes: source[index]?.successes ?? "",\n  }));\n}`,
`function pairAttempts(value, dimension, count, fixedAttempts = null) {\n  const bucket = dimensionBucket(value, dimension);\n  const source = Array.isArray(bucket.results) ? bucket.results : [];\n  return Array.from({ length: count }, (_, index) => ({\n    attempts: fixedAttempts ?? source[index]?.attempts ?? "",\n    successes: source[index]?.successes ?? "",\n  }));\n}`,
  "prefill fixed pair attempts"
);
input = replaceOnce(
  input,
`  const isPair = metric.metricType === "attempts_successes";`,
`  const isPair = metric.metricType === "attempts_successes";\n  const fixedAttempts = isPair ? metric.metricConfig.fixedAttempts : null;`,
  "input fixed attempts value"
);
input = replaceOnce(
  input,
`    const results = pairAttempts(value, dimension, metric.attemptCount);`,
`    const results = pairAttempts(\n      value,\n      dimension,\n      metric.attemptCount,\n      fixedAttempts\n    );`,
  "update fixed pairs"
);
input = replaceOnce(
  input,
`        const pairs = pairAttempts(value, dimension, metric.attemptCount);`,
`        const pairs = pairAttempts(\n          value,\n          dimension,\n          metric.attemptCount,\n          fixedAttempts\n        );`,
  "render fixed pairs"
);
input = replaceOnce(
  input,
`                          disabled={disabled}\n                          value={pairs[index].attempts}`,
`                          disabled={disabled || fixedAttempts !== null}\n                          value={pairs[index].attempts}`,
  "lock fixed attempts input"
);
fs.writeFileSync(inputPath, input);

const editorPath = "src/components/assessments/AssessmentTestEditor.jsx";
let editor = fs.readFileSync(editorPath, "utf8");
editor = replaceOnce(
  editor,
`        <Field label="Attempts">\n          <input`,
`        <Field\n          label={attemptsSuccesses ? "Result entries" : "Attempts"}\n          hint={\n            attemptsSuccesses\n              ? "Usually 1 aggregate result; fixed trials are set in Metric details."\n              : ""\n          }\n        >\n          <input`,
  "pair result-entry label"
);
editor = replaceOnce(
  editor,
`            <div className="assessment-editor__grid assessment-editor__grid--two">\n              <Field label="Compare using">`,
`            <div className="assessment-editor__grid assessment-editor__grid--three">\n              <Field label="Fixed trials per result" hint="e.g. 10 for successes /10">\n                <input\n                  aria-label="Fixed attempts per result"\n                  type="number"\n                  min="1"\n                  step="1"\n                  value={draft.metricConfig.fixedAttempts ?? ""}\n                  disabled={saving}\n                  onChange={(event) =>\n                    setMetricConfig({\n                      fixedAttempts:\n                        event.target.value === ""\n                          ? null\n                          : Math.max(1, Number(event.target.value) || 1),\n                    })\n                  }\n                />\n              </Field>\n              <Field label="Compare using">`,
  "editor fixed attempts control"
);
fs.writeFileSync(editorPath, editor);

const metricTestPath = "src/engine/assessmentMetricEngine.test.js";
let metricTest = fs.readFileSync(metricTestPath, "utf8");
metricTest = replaceOnce(
  metricTest,
`  it("can compare attempts/successes by success rate", () => {`,
`  it("enforces a configured fixed number of trials per attempts/successes result", () => {\n    const definition = {\n      metric_type: "attempts_successes",\n      result_strategy: "single",\n      metric_config: { fixedAttempts: 10 },\n    };\n    expect(\n      normaliseAssessmentResult(definition, { attempts: 10, successes: 7 }).valid\n    ).toBe(true);\n    const invalid = normaliseAssessmentResult(definition, {\n      attempts: 8,\n      successes: 7,\n    });\n    expect(invalid.valid).toBe(false);\n    expect(invalid.errors[0]).toMatch(/must use 10 attempts/i);\n  });\n\n  it("can compare attempts/successes by success rate", () => {`,
  "metric fixed-attempt test"
);
fs.writeFileSync(metricTestPath, metricTest);

const inputTestPath = "src/components/assessments/AssessmentResultInput.test.jsx";
let inputTest = fs.readFileSync(inputTestPath, "utf8");
inputTest = replaceOnce(
  inputTest,
`  it("accepts an explicitly entered zero successes value", () => {`,
`  it("prefills and locks fixed trial counts while emitting them with successes", () => {\n    const onChange = vi.fn();\n    render(\n      <AssessmentResultInput\n        metric={{\n          metricType: "attempts_successes",\n          scoringDirection: "higher",\n          attemptCount: 1,\n          resultStrategy: "single",\n          sideMode: "none",\n          metricConfig: { comparisonMode: "successes", fixedAttempts: 10 },\n        }}\n        value={{}}\n        onChange={onChange}\n      />\n    );\n    expect(screen.getByLabelText("Result attempt 1 attempts").value).toBe("10");\n    expect(screen.getByLabelText("Result attempt 1 attempts").disabled).toBe(true);\n    fireEvent.change(screen.getByLabelText("Result attempt 1 successes"), {\n      target: { value: "8" },\n    });\n    expect(onChange).toHaveBeenLastCalledWith({\n      overall: { results: [{ attempts: 10, successes: "8" }] },\n    });\n  });\n\n  it("accepts an explicitly entered zero successes value", () => {`,
  "input fixed-attempt test"
);
fs.writeFileSync(inputTestPath, inputTest);

const editorTestPath = "src/components/assessments/AssessmentTestEditor.test.jsx";
let editorTest = fs.readFileSync(editorTestPath, "utf8");
editorTest = replaceOnce(
  editorTest,
`    expect(screen.getByLabelText("Attempts successes comparison mode")).toBeTruthy();\n    expect(screen.getByLabelText("Show success rate beside result")).toBeTruthy();`,
`    expect(screen.getByLabelText("Fixed attempts per result")).toBeTruthy();\n    expect(screen.getByLabelText("Attempts successes comparison mode")).toBeTruthy();\n    expect(screen.getByLabelText("Show success rate beside result")).toBeTruthy();`,
  "editor fixed-attempt test"
);
fs.writeFileSync(editorTestPath, editorTest);

const historyTestPath = "src/engine/assessmentHistoryEngine.test.js";
let historyTest = fs.readFileSync(historyTestPath, "utf8");
historyTest = replaceOnce(
  historyTest,
`  it("separates histories when unit, direction or side semantics change", () => {`,
`  it("treats fixed trial changes as incompatible for raw-success comparisons but not rate comparisons", () => {\n    const successes10 = assessmentMetricComparisonKey({\n      metricType: "attempts_successes",\n      metricConfig: { comparisonMode: "successes", fixedAttempts: 10 },\n    });\n    const successes8 = assessmentMetricComparisonKey({\n      metricType: "attempts_successes",\n      metricConfig: { comparisonMode: "successes", fixedAttempts: 8 },\n    });\n    expect(successes10).not.toBe(successes8);\n\n    const rate10 = assessmentMetricComparisonKey({\n      metricType: "attempts_successes",\n      metricConfig: { comparisonMode: "rate", fixedAttempts: 10 },\n    });\n    const rate8 = assessmentMetricComparisonKey({\n      metricType: "attempts_successes",\n      metricConfig: { comparisonMode: "rate", fixedAttempts: 8 },\n    });\n    expect(rate10).toBe(rate8);\n  });\n\n  it("separates histories when unit, direction or side semantics change", () => {`,
  "history fixed-attempt test"
);
fs.writeFileSync(historyTestPath, historyTest);
