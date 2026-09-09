// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentRunner from "./AssessmentRunner.jsx";

afterEach(cleanup);

function runState(overrides = {}) {
  const snapshot = {
    schemaVersion: 1,
    template: {
      id: "a1",
      name: "Athletic Check",
      category: "Football",
      description: "Benchmark",
      version: 3,
    },
    tests: [
      {
        position: 1,
        assessmentTemplateTestId: "row-1",
        testId: "test-1",
        sectionLabel: "Athletic",
        displayLabel: "10m Sprint",
        instructions: "Standing start",
        protocolText: "One maximal effort",
        test: { id: "test-1", name: "10 m acceleration", version: 2 },
        metric: {
          metricType: "time",
          unit: "s",
          scoringDirection: "lower",
          attemptCount: 1,
          resultStrategy: "single",
          sideMode: "none",
          allowNegative: false,
          pbEligible: true,
          metricConfig: { decimalPlaces: 2 },
        },
      },
      {
        position: 2,
        assessmentTemplateTestId: "row-2",
        testId: "test-2",
        sectionLabel: "Strength",
        displayLabel: "Calf Raises",
        instructions: "Full range",
        protocolText: "One set each side",
        test: { id: "test-2", name: "Single leg calf raises", version: 1 },
        metric: {
          metricType: "repetitions",
          unit: "reps",
          scoringDirection: "higher",
          attemptCount: 1,
          resultStrategy: "single",
          sideMode: "separate",
          allowNegative: false,
          pbEligible: true,
          metricConfig: { decimalPlaces: 0 },
        },
      },
    ],
  };

  return {
    run: {
      id: "run-1",
      date_ymd: "2026-09-09",
      status: "in_progress",
      template_version: 3,
      template_snapshot: snapshot,
    },
    results: [],
    snapshot,
    draft: {
      runNotes: "",
      answers: {
        "1": { resultData: {}, notes: "" },
        "2": { resultData: {}, notes: "" },
      },
    },
    ...overrides,
  };
}

function renderRunner(props = {}) {
  const defaults = {
    runState: runState(),
    athleteName: "Wilf",
    onSaveProgress: vi.fn(async () => {}),
    onComplete: vi.fn(async () => {}),
    onCancel: vi.fn(async () => {}),
    onClose: vi.fn(),
  };
  const merged = { ...defaults, ...props };
  render(<AssessmentRunner {...merged} />);
  return merged;
}

describe("AssessmentRunner", () => {
  it("renders the immutable snapshot identity, sections and protocols", () => {
    renderRunner();
    expect(screen.getByText("Athletic Check")).toBeTruthy();
    expect(screen.getByText(/Wilf · 2026-09-09 · definition v3/)).toBeTruthy();
    expect(screen.getByText("Athletic")).toBeTruthy();
    expect(screen.getByText("Strength")).toBeTruthy();
    expect(screen.getByText("10m Sprint")).toBeTruthy();
    expect(screen.getByText(/One maximal effort/)).toBeTruthy();
    expect(screen.getByText(/One set each side/)).toBeTruthy();
  });

  it("starts incomplete and blocks completion", () => {
    renderRunner();
    expect(screen.getByText("0/2 Tests valid")).toBeTruthy();
    expect(screen.getByText("Complete Assessment").disabled).toBe(true);
  });

  it("enables completion only after every required Test dimension is valid", () => {
    renderRunner();
    fireEvent.change(screen.getByLabelText("Result attempt 1"), {
      target: { value: "2.04" },
    });
    expect(screen.getByText("1/2 Tests valid")).toBeTruthy();
    expect(screen.getByText("Complete Assessment").disabled).toBe(true);

    fireEvent.change(screen.getByLabelText("Left attempt 1"), {
      target: { value: "18" },
    });
    expect(screen.getByText("Complete Assessment").disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Right attempt 1"), {
      target: { value: "21" },
    });
    expect(screen.getByText("2/2 Tests valid")).toBeTruthy();
    expect(screen.getByText("Complete Assessment").disabled).toBe(false);
  });

  it("passes raw answers plus Test and Assessment notes when saving progress", async () => {
    const onSaveProgress = vi.fn(async () => {});
    renderRunner({ onSaveProgress });
    fireEvent.change(screen.getByLabelText("Result attempt 1"), {
      target: { value: "2.04" },
    });
    fireEvent.change(screen.getByLabelText("Test 1 notes"), {
      target: { value: "Good start" },
    });
    fireEvent.change(screen.getByLabelText("Assessment notes"), {
      target: { value: "Wet surface" },
    });
    fireEvent.click(screen.getByText("Save progress"));

    await waitFor(() => expect(onSaveProgress).toHaveBeenCalledTimes(1));
    expect(onSaveProgress).toHaveBeenCalledWith({
      answers: expect.objectContaining({
        "1": {
          resultData: { overall: { attempts: ["2.04"] } },
          notes: "Good start",
        },
      }),
      runNotes: "Wet surface",
    });
  });

  it("restores an in-progress saved draft for resume", () => {
    const state = runState();
    state.draft = {
      runNotes: "Indoor surface",
      answers: {
        "1": {
          resultData: { overall: { attempts: [2.01] } },
          notes: "Fast",
        },
        "2": {
          resultData: {
            left: { attempts: [17] },
            right: { attempts: [20] },
          },
          notes: "",
        },
      },
    };
    renderRunner({ runState: state });
    expect(screen.getByLabelText("Result attempt 1").value).toBe("2.01");
    expect(screen.getByLabelText("Left attempt 1").value).toBe("17");
    expect(screen.getByLabelText("Right attempt 1").value).toBe("20");
    expect(screen.getByLabelText("Assessment notes").value).toBe("Indoor surface");
    expect(screen.getByText("2/2 Tests valid")).toBeTruthy();
  });

  it("submits a completed valid Assessment", async () => {
    const onComplete = vi.fn(async () => {});
    renderRunner({ onComplete });
    fireEvent.change(screen.getByLabelText("Result attempt 1"), {
      target: { value: "2.04" },
    });
    fireEvent.change(screen.getByLabelText("Left attempt 1"), {
      target: { value: "18" },
    });
    fireEvent.change(screen.getByLabelText("Right attempt 1"), {
      target: { value: "21" },
    });
    fireEvent.click(screen.getByText("Complete Assessment"));
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1));
  });

  it("calls cancel without deleting or locally discarding historical semantics", async () => {
    const onCancel = vi.fn(async () => {});
    renderRunner({ onCancel });
    fireEvent.click(screen.getByText("Cancel Assessment"));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(1));
  });

  it("surfaces a save failure rather than displaying a false success", async () => {
    const onSaveProgress = vi.fn(async () => {
      throw new Error("save failed");
    });
    renderRunner({ onSaveProgress });
    fireEvent.click(screen.getByText("Save progress"));
    expect((await screen.findByRole("alert")).textContent).toContain("save failed");
    expect(screen.queryByText("Progress saved.")).toBeNull();
  });
});
