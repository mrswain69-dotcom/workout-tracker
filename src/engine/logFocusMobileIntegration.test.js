import { describe, expect, it } from "vitest";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("focused Log and dashboard readiness integration", () => {
  it("moves the compact readiness context to the dashboard and removes the full Log card", () => {
    const app = read("../App.jsx");
    const dashboard = read("../components/dashboard/PerformanceDashboard.jsx");
    const readiness = read("../components/dashboard/BodyReadinessSummary.jsx");

    expect(app).toContain("bodyReadiness={bodyReadiness}");
    expect(dashboard).toContain("<BodyReadinessSummary readiness={bodyReadiness} />");
    expect(readiness).toContain("Body Readiness Status");
    expect(readiness).toContain("recommendationText");
    expect(app).not.toContain('className="pad bodyReadinessCard"');
  });

  it("keeps targets beside the action and removes the duplicated Today's mission card", () => {
    const app = read("../App.jsx");

    expect(app).toContain('className="inMomentTarget mt8"');
    expect(app).toContain("cardioTarget");
    expect(app).toContain("block.plannedMinutes");
    expect(app).toContain("targetInfo?.progressionText");
    expect(app).not.toContain("<div className=\"h3\">Today’s mission</div>");
    expect(app).not.toContain("<b>Planned blocks:</b>");
  });

  it("pairs strength progression guidance with History inside a contained full-width band", () => {
    const app = read("../App.jsx");

    expect(app).toContain("movementProgressionBand");
    expect(app).toContain("movementProgressionBand__history");
    expect(app).toContain("progressionText");
    expect(app).toContain("overflow-wrap:anywhere");
  });

  it("uses progressive movement disclosure without preventing out-of-order access", () => {
    const app = read("../App.jsx");

    expect(app).toContain("focusedMovementByBlock");
    expect(app).toContain("firstIncompleteMovementId");
    expect(app).toContain('className="focusedMovementSummary"');
    expect(app).toContain("aria-expanded={movementOpen}");
    expect(app).toContain("setFocusedMovementByBlock");
    expect(app).toContain('movementComplete ? "✓"');
  });

  it("focuses the day on the next incomplete block while keeping every block manually accessible", () => {
    const app = read("../App.jsx");

    expect(app).toContain("function FocusedLogBlock");
    expect(app).toContain("focusedLogBlockId");
    expect(app).toContain("getLogBlockFocusState");
    expect(app).toContain("firstIncompleteFocusBlockId");
    expect(app).toContain("toggleLogBlockFocus");
    expect(app).toContain("<FocusedLogBlock");
    expect(app).toContain("doneCount");
    expect(app).toContain(".focusedLogBlock.isComplete");
    expect(app).toContain(".focusedLogBlock.isCancelled");
  });

  it("protects cancel and reset actions while condensing mobile controls", () => {
    const app = read("../App.jsx");

    expect(app).toContain("Cancel this block?");
    expect(app).toContain('ensureUnlocked("mark this block as cancelled")');
    expect(app).toContain("Reset this day?");
    expect(app).toContain('ensureUnlocked("reset this day")');
    expect(app).toContain("resetDayButton");
    expect(app).toContain('content:"C"');
    expect(app).toContain(".todaySummaryCard{display:none}");
  });

  it("removes redundant control labels and keeps cancel actions at block bottoms", () => {
    const app = read("../App.jsx");

    expect(app).not.toContain(">Block controls<");
    expect(app).not.toContain(">Cardio controls<");
    expect(app).not.toContain(">Duration controls<");
    expect(app).not.toContain(">Session controls<");
    expect(app).toContain("blockBottomControls");
    expect(app).toContain("BlockCancelControl");
  });

  it("does not create speed targets for time-only cardio", () => {
    const app = read("../App.jsx");

    expect(app).toContain("distanceEnabled: !distanceHidden");
    expect(app).toContain("if (!distanceEnabled)");
    expect(app).toContain("findLastCardio(allLogs, ymd(selectedDate), block)");
  });

  it("uses performance-brand history styling", () => {
    const app = read("../App.jsx");

    expect(app).toContain("background:#0f1117");
    expect(app).toContain("color:#00e5ff");
    expect(app).toContain("color:#00ff88");
  });
});
