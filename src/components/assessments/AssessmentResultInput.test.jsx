// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import AssessmentResultInput from "./AssessmentResultInput.jsx";

afterEach(cleanup);

const TIME = {
  metricType: "time",
  unit: "s",
  scoringDirection: "lower",
  attemptCount: 3,
  resultStrategy: "best",
  sideMode: "none",
  allowNegative: false,
  metricConfig: { decimalPlaces: 2 },
};

describe("AssessmentResultInput", () => {
  it("renders the configured scalar attempts and unit", () => {
    render(<AssessmentResultInput metric={TIME} value={{}} />);
    expect(screen.getByLabelText("Result attempt 1")).toBeTruthy();
    expect(screen.getByLabelText("Result attempt 2")).toBeTruthy();
    expect(screen.getByLabelText("Result attempt 3")).toBeTruthy();
    expect(screen.getByText("Result attempt 1 (s)")).toBeTruthy();
  });

  it("uses the metric engine for a lower-is-better best-result preview", () => {
    render(
      <AssessmentResultInput
        metric={TIME}
        value={{ overall: { attempts: [2.14, 2.03, 2.08] } }}
      />
    );
    expect(screen.getByText("2.03 s")).toBeTruthy();
  });

  it("emits the raw attempt structure expected by the Stage 2 engine", () => {
    const onChange = vi.fn();
    render(<AssessmentResultInput metric={TIME} value={{}} onChange={onChange} />);
    fireEvent.change(screen.getByLabelText("Result attempt 2"), {
      target: { value: "2.06" },
    });
    expect(onChange).toHaveBeenCalledWith({
      overall: { attempts: ["", "2.06", ""] },
    });
  });

  it("permits genuinely signed Test values only when configured", () => {
    const { rerender } = render(
      <AssessmentResultInput metric={TIME} value={{}} />
    );
    expect(screen.getByLabelText("Result attempt 1").getAttribute("min")).toBe("0");

    rerender(
      <AssessmentResultInput
        metric={{ ...TIME, allowNegative: true }}
        value={{}}
      />
    );
    expect(screen.getByLabelText("Result attempt 1").getAttribute("min")).toBeNull();
  });

  it("renders independent left and right result dimensions", () => {
    render(
      <AssessmentResultInput
        metric={{
          metricType: "repetitions",
          unit: "reps",
          scoringDirection: "higher",
          attemptCount: 1,
          resultStrategy: "single",
          sideMode: "separate",
        }}
        value={{
          left: { attempts: [18] },
          right: { attempts: [21] },
        }}
      />
    );
    expect(screen.getByLabelText("Left attempt 1").value).toBe("18");
    expect(screen.getByLabelText("Right attempt 1").value).toBe("21");
    expect(screen.getByText("L 18 reps · R 21 reps")).toBeTruthy();
  });

  it("keeps attempts/successes incomplete until both fields are entered", () => {
    const onChange = vi.fn();
    const metric = {
      metricType: "attempts_successes",
      scoringDirection: "higher",
      attemptCount: 1,
      resultStrategy: "single",
      sideMode: "none",
      metricConfig: { comparisonMode: "successes" },
    };
    const { rerender } = render(
      <AssessmentResultInput metric={metric} value={{}} onChange={onChange} />
    );

    fireEvent.change(screen.getByLabelText("Result attempt 1 attempts"), {
      target: { value: "10" },
    });
    const partial = {
      overall: { results: [{ attempts: "10", successes: "" }] },
    };
    expect(onChange).toHaveBeenLastCalledWith(partial);

    rerender(
      <AssessmentResultInput metric={metric} value={partial} onChange={onChange} />
    );
    expect(screen.getByText("—")).toBeTruthy();
    expect(screen.getByLabelText("Result validation")).toBeTruthy();
  });

  it("accepts an explicitly entered zero successes value", () => {
    render(
      <AssessmentResultInput
        metric={{
          metricType: "attempts_successes",
          scoringDirection: "higher",
          attemptCount: 1,
          resultStrategy: "single",
          sideMode: "none",
        }}
        value={{
          overall: { results: [{ attempts: 10, successes: 0 }] },
        }}
      />
    );
    expect(screen.getByText("0/10")).toBeTruthy();
  });
});
