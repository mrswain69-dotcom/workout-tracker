// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import MovementResultControl from "./MovementResultControl.jsx";

afterEach(cleanup);

function ResultHarness({
  trackingMethod,
  trackingConfig,
  initialResult = null,
  onResult,
  ...props
}) {
  const [result, setResult] = useState(initialResult);
  return (
    <MovementResultControl
      {...props}
      trackingMethod={trackingMethod}
      trackingConfig={trackingConfig}
      result={result}
      onChange={(next, meta) => {
        setResult(next);
        if (typeof onResult === "function") onResult(next, meta);
      }}
    />
  );
}

describe("MovementResultControl", () => {
  it("uses QuickCounter for repetitions and preserves rapid updates", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="repetitions"
        trackingConfig={{ countLabel: "Clean reps" }}
        result={null}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase by 5" }));

    expect(onChange.mock.calls.map(([next]) => next)).toEqual([
      { overall: { count: 10 } },
      { overall: { count: 15 } },
    ]);
  });

  it("preserves attempts while a second rapid counter updates successes", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="attempts_successes"
        result={null}
        onChange={onChange}
      />
    );

    const plusTen = screen.getAllByRole("button", { name: "Increase by 10" });
    const plusFive = screen.getAllByRole("button", { name: "Increase by 5" });
    fireEvent.click(plusTen[0]);
    fireEvent.click(plusFive[1]);

    expect(onChange).toHaveBeenLastCalledWith(
      { overall: { attempts: 10, successes: 5 } },
      expect.objectContaining({ method: "attempts_successes", bucket: "overall" })
    );
  });

  it("supports successful-execution counts with custom labels", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="successful_executions"
        trackingConfig={{ countLabel: "Clean touches", unit: "touches" }}
        onChange={onChange}
      />
    );

    expect(screen.getByRole("spinbutton", { name: "Clean touches" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Increase by 1" }));

    expect(onChange).toHaveBeenLastCalledWith(
      { overall: { count: 1 } },
      expect.objectContaining({ method: "successful_executions" })
    );
  });

  it("records a best score with the same quick-entry controls", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="best_score"
        result={{ overall: { best: 12 } }}
        onChange={onChange}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));

    expect(onChange).toHaveBeenLastCalledWith(
      { overall: { best: 22 } },
      expect.objectContaining({ method: "best_score", field: "best" })
    );
  });

  it("keeps left and right results independent while preserving both", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="repetitions"
        trackingConfig={{ sideMode: "separate" }}
        result={null}
        onChange={onChange}
      />
    );

    const left = screen.getByRole("group", { name: "Left" });
    const right = screen.getByRole("group", { name: "Right" });
    fireEvent.click(within(left).getByRole("button", { name: "Increase by 5" }));
    fireEvent.click(within(right).getByRole("button", { name: "Increase by 10" }));

    expect(onChange).toHaveBeenLastCalledWith(
      { left: { count: 5 }, right: { count: 10 } },
      expect.objectContaining({ method: "repetitions", bucket: "right" })
    );
  });

  it("stores duration canonically in seconds while allowing minute entry", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="duration"
        trackingConfig={{ unit: "minutes", decimalPlaces: 1 }}
        result={{ overall: { durationSec: 90 } }}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("spinbutton", { name: "time" });
    expect(input.value).toBe("1.5");
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "2.5" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(
      { overall: { durationSec: 150 } },
      expect.objectContaining({ method: "duration", displayUnit: "minutes" })
    );
  });

  it("records distance with the configured unit", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="distance"
        trackingConfig={{ unit: "m", decimalPlaces: 1 }}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("spinbutton", { name: "distance" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "12.4" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(
      { overall: { value: 12.4, unit: "m" } },
      expect.objectContaining({ method: "distance", field: "value" })
    );
  });

  it("uses the selected resistance unit for weight results", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="weight"
        trackingConfig={{ unit: "lb", decimalPlaces: 1 }}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("spinbutton", { name: "weight" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "22.5" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(
      { overall: { value: 22.5, unit: "lb" } },
      expect.objectContaining({ method: "weight" })
    );
  });

  it("allows negative generic numeric results only when configured", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="numeric"
        trackingConfig={{ allowNegative: true, decimalPlaces: 1, unit: "points" }}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("spinbutton", { name: "result" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "-2.3" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(
      { overall: { value: -2.3, unit: "points" } },
      expect.objectContaining({ method: "numeric" })
    );
  });

  it("keeps practised completion separate from result JSON", () => {
    const onChange = vi.fn();
    const onCompletedChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="completion"
        completed={false}
        onChange={onChange}
        onCompletedChange={onCompletedChange}
      />
    );

    const practised = screen.getByRole("button", { name: "Practised" });
    expect(practised.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(practised);

    expect(onCompletedChange).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ method: "completion", previous: false })
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("supports sets and reps with optional resistance", () => {
    const onResult = vi.fn();
    render(
      <ResultHarness
        trackingMethod="sets_reps"
        trackingConfig={{ allowWeight: true, weightUnit: "kg" }}
        onResult={onResult}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Add set" }));

    const reps = screen.getByRole("spinbutton", { name: "Reps" });
    fireEvent.focus(reps);
    fireEvent.change(reps, { target: { value: "12" } });
    fireEvent.blur(reps);

    const weight = screen.getByRole("spinbutton", { name: "Weight" });
    fireEvent.focus(weight);
    fireEvent.change(weight, { target: { value: "7.5" } });
    fireEvent.blur(weight);

    expect(onResult).toHaveBeenLastCalledWith(
      { overall: { sets: [{ reps: 12, weight: 7.5 }] } },
      expect.objectContaining({ method: "sets_reps", field: "weight" })
    );
  });

  it("removes a direct numeric result when the field is cleared", () => {
    const onChange = vi.fn();
    render(
      <MovementResultControl
        trackingMethod="distance"
        result={{ overall: { value: 10, unit: "m" } }}
        onChange={onChange}
      />
    );

    const input = screen.getByRole("spinbutton", { name: "distance" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenLastCalledWith(
      null,
      expect.objectContaining({ method: "distance", field: "value" })
    );
  });

  it("disables every rendered entry control when disabled", () => {
    render(
      <MovementResultControl
        trackingMethod="attempts_successes"
        disabled
      />
    );

    for (const button of screen.getAllByRole("button")) {
      expect(button.disabled).toBe(true);
    }
    for (const input of screen.getAllByRole("spinbutton")) {
      expect(input.disabled).toBe(true);
    }
  });
});
