import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const count = source.split(before).length - 1;
  if (count !== 1) throw new Error(`${label}: expected one anchor, found ${count}`);
  return source.replace(before, after);
}

// AssessmentHistory: protect nulls from Number(null) and keep trend units compatible.
const historyPath = "src/components/assessments/AssessmentHistory.jsx";
let history = fs.readFileSync(historyPath, "utf8");
history = replaceOnce(
  history,
`function dimensionComparable(entry, dimension) {
  if (!entry) return null;
  if (entry.metric.sideMode === "separate") {
    const value = Number(entry.comparableDimensions?.[dimension]);
    return Number.isFinite(value) ? value : null;
  }
  const value = Number(entry.comparableValue);
  return Number.isFinite(value) ? value : null;
}`,
`function dimensionComparable(entry, dimension) {
  if (!entry) return null;
  const raw =
    entry.metric.sideMode === "separate"
      ? entry.comparableDimensions?.[dimension]
      : entry.comparableValue;
  if (raw === "" || raw === null || raw === undefined) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}`,
  "history comparable null guard"
);
history = replaceOnce(
  history,
`  const percentage = Number.isFinite(Number(dimension.percentageImprovement))
    ? \` (\${signedNumber(
        dimension.percentageImprovement,
        metric.metricConfig.percentageDecimalPlaces
      )}%)\`
    : "";`,
`  const percentageValue =
    dimension.percentageImprovement === null ||
    dimension.percentageImprovement === undefined ||
    dimension.percentageImprovement === ""
      ? null
      : Number(dimension.percentageImprovement);
  const percentage = Number.isFinite(percentageValue)
    ? \` (\${signedNumber(
        percentageValue,
        metric.metricConfig.percentageDecimalPlaces
      )}%)\`
    : "";`,
  "history percentage null guard"
);
history = replaceOnce(
  history,
`      <div className="assessment-history__trends">
        {metric.sideMode === "separate" ? (
          <>
            <TrendStrip entries={history.entries} dimension="left" label="Left result" />
            <TrendStrip entries={history.entries} dimension="right" label="Right result" />
          </>
        ) : (
          <TrendStrip entries={history.entries} label="Result" />
        )}
      </div>`,
`      <div className="assessment-history__trends">
        {metric.sideMode === "separate" ? (
          <>
            <TrendStrip entries={history.entries.filter((entry) => entry.metricKey === history.metricKey)} dimension="left" label="Left result" />
            <TrendStrip entries={history.entries.filter((entry) => entry.metricKey === history.metricKey)} dimension="right" label="Right result" />
          </>
        ) : (
          <TrendStrip entries={history.entries.filter((entry) => entry.metricKey === history.metricKey)} label="Result" />
        )}
      </div>`,
  "compatible trend cohort"
);
fs.writeFileSync(historyPath, history);

// AssessmentHub: expose Run / Progress and go to Progress after completion.
const hubPath = "src/components/assessments/AssessmentHub.jsx";
let hub = fs.readFileSync(hubPath, "utf8");
hub = replaceOnce(
  hub,
`import AssessmentRunner from "./AssessmentRunner.jsx";`,
`import AssessmentRunner from "./AssessmentRunner.jsx";
import AssessmentHistory from "./AssessmentHistory.jsx";`,
  "history import"
);
hub = replaceOnce(
  hub,
`.assessment-hub__eyebrow{text-transform:uppercase;font-size:11px;font-weight:850;letter-spacing:.08em;color:#64748b}`,
`.assessment-hub__eyebrow{text-transform:uppercase;font-size:11px;font-weight:850;letter-spacing:.08em;color:#64748b}
.assessment-hub__modes{display:flex;gap:8px;flex-wrap:wrap}.assessment-hub__modes button[aria-pressed="true"]{font-weight:850;box-shadow:inset 0 0 0 2px rgba(255,122,24,.38)}`,
  "hub mode styles"
);
hub = replaceOnce(
  hub,
`  const [library, setLibrary] = useState(() => emptyAssessmentLibrary());
  const [runs, setRuns] = useState([]);`,
`  const [library, setLibrary] = useState(() => emptyAssessmentLibrary());
  const [runs, setRuns] = useState([]);
  const [mode, setMode] = useState("run");`,
  "hub mode state"
);
hub = replaceOnce(
  hub,
`    setRunState(null);
    setStatus("Assessment completed and added to history.");
    await refresh();
    return completed;`,
`    setRunState(null);
    setStatus("Assessment completed and added to history.");
    await refresh();
    setMode("progress");
    return completed;`,
  "completion progress switch"
);
hub = replaceOnce(
  hub,
`  if (runState) {
    return (
      <AssessmentRunner`,
`  const modeControls = (
    <div className="assessment-hub__modes" role="tablist" aria-label="Assessment modes">
      <button type="button" aria-pressed={mode === "run"} onClick={() => setMode("run")}>Run</button>
      <button type="button" aria-pressed={mode === "progress"} onClick={() => setMode("progress")}>Progress</button>
    </div>
  );

  if (runState) {
    return (
      <AssessmentRunner`,
  "hub mode controls"
);
hub = replaceOnce(
  hub,
`  return (
    <section className="assessment-hub">
      <style>{styles}</style>
      <div className="assessment-hub__header">`,
`  if (mode === "progress") {
    return (
      <section className="assessment-hub">
        <style>{styles}</style>
        {modeControls}
        <AssessmentHistory
          familyId={familyId}
          profileId={profileId}
          athleteName={athleteName}
          dbApi={dbApi}
        />
      </section>
    );
  }

  return (
    <section className="assessment-hub">
      <style>{styles}</style>
      {modeControls}
      <div className="assessment-hub__header">`,
  "hub progress view"
);
fs.writeFileSync(hubPath, hub);

// Hub tests: history adapter and Progress integration.
const hubTestPath = "src/components/assessments/AssessmentHub.test.jsx";
let hubTest = fs.readFileSync(hubTestPath, "utf8");
hubTest = replaceOnce(
  hubTest,
`    loadAssessmentLibrary: vi.fn(async () => ({ data: library, error: null })),
    listAssessmentRuns: vi.fn(async () => ({ data: runs, error: null })),`,
`    loadAssessmentLibrary: vi.fn(async () => ({ data: library, error: null })),
    loadCompletedAssessmentHistory: vi.fn(async () => ({
      data: { runs: [], results: [] },
      error: null,
    })),
    listAssessmentRuns: vi.fn(async () => ({ data: runs, error: null })),`,
  "hub test history mock"
);
hubTest = replaceOnce(
  hubTest,
`  it("cancels by status update and never calls a delete path", async () => {`,
`  it("opens profile-scoped derived progress from the Assess hub", async () => {
    const db = mockDb();
    await renderHub(db);
    fireEvent.click(screen.getByRole("button", { name: "Progress" }));
    expect(await screen.findByRole("heading", { name: /Wilf’s Assessment progress/i })).toBeTruthy();
    expect(db.loadCompletedAssessmentHistory).toHaveBeenCalledWith("f1", "p1");
  });

  it("cancels by status update and never calls a delete path", async () => {`,
  "hub progress test"
);
fs.writeFileSync(hubTestPath, hubTest);
