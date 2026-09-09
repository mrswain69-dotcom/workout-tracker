// @vitest-environment jsdom

import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import QuickCounter, {
  applyQuickCounterDelta,
  normaliseQuickCounterValue,
} from "./QuickCounter.jsx";

afterEach(cleanup);

describe("QuickCounter", () => {
  it("preserves rapid increments even before the controlled prop rerenders", () => {
    const onChange = vi.fn();
    render(<QuickCounter value={0} onChange={onChange} label="Clean reps" />);

    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase by 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase by 1" }));

    expect(onChange.mock.calls.map(([next]) => next)).toEqual([10, 20, 25, 26]);
  });

  it("supports fast correction with -5 and -1", () => {
    const onChange = vi.fn();
    render(<QuickCounter value={18} onChange={onChange} label="Touches" />);

    fireEvent.click(screen.getByRole("button", { name: "Decrease by 5" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease by 1" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease by 1" }));

    expect(onChange.mock.calls.map(([next]) => next)).toEqual([13, 12, 11]);
  });

  it("clamps decrement corrections at the minimum", () => {
    const onChange = vi.fn();
    render(<QuickCounter value={3} min={0} onChange={onChange} label="Reps" />);

    fireEvent.click(screen.getByRole("button", { name: "Decrease by 5" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      0,
      expect.objectContaining({ source: "decrement", delta: -5, previous: 3 })
    );
    expect(screen.getByRole("button", { name: "Decrease by 1" }).disabled).toBe(true);
  });

  it("clamps increments at the maximum", () => {
    const onChange = vi.fn();
    render(
      <QuickCounter value={18} min={0} max={20} onChange={onChange} label="Attempts" />
    );

    fireEvent.click(screen.getByRole("button", { name: "Increase by 5" }));

    expect(onChange).toHaveBeenLastCalledWith(
      20,
      expect.objectContaining({ source: "increment", delta: 5, previous: 18 })
    );
    expect(screen.getByRole("button", { name: "Increase by 1" }).disabled).toBe(true);
  });

  it("allows direct correction by typing a replacement value", () => {
    const onChange = vi.fn();
    render(<QuickCounter value={42} onChange={onChange} label="Clean reps" />);

    const input = screen.getByRole("spinbutton", { name: "Clean reps" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "37" } });
    fireEvent.blur(input);

    expect(onChange).toHaveBeenCalledWith(
      37,
      expect.objectContaining({ source: "direct", previous: 42 })
    );
  });

  it("restores the current value when direct input is blank or invalid", () => {
    const onChange = vi.fn();
    render(<QuickCounter value={12} onChange={onChange} label="Score" />);

    const input = screen.getByRole("spinbutton", { name: "Score" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);

    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe("12");
  });

  it("disables every interactive control when disabled", () => {
    const onChange = vi.fn();
    render(<QuickCounter value={9} disabled onChange={onChange} label="Reps" />);

    for (const button of screen.getAllByRole("button")) {
      expect(button.disabled).toBe(true);
    }
    expect(screen.getByRole("spinbutton", { name: "Reps" }).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("can render a read-only central value while retaining counter buttons", () => {
    render(
      <QuickCounter value={24} allowDirectEdit={false} label="Best score" unit="touches" />
    );

    expect(screen.queryByRole("spinbutton")).toBeNull();
    expect(screen.getByText("24")).toBeTruthy();
    expect(screen.getByText("touches")).toBeTruthy();
  });

  it("supports custom counter steps", () => {
    const onChange = vi.fn();
    render(
      <QuickCounter
        value={10}
        onChange={onChange}
        label="Custom"
        incrementSteps={[2, 7]}
        decrementSteps={[2, 3]}
      />
    );

    expect(screen.queryByRole("button", { name: "Increase by 10" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Increase by 7" }));
    fireEvent.click(screen.getByRole("button", { name: "Decrease by 3" }));

    expect(onChange.mock.calls.map(([next]) => next)).toEqual([17, 14]);
  });
});

describe("QuickCounter numeric helpers", () => {
  it("normalises precision and boundaries", () => {
    expect(
      normaliseQuickCounterValue(3.146, { min: 0, max: 10, decimalPlaces: 2 })
    ).toBe(3.15);
    expect(normaliseQuickCounterValue(-5, { min: 0 })).toBe(0);
    expect(normaliseQuickCounterValue(50, { min: 0, max: 20 })).toBe(20);
  });

  it("applies deltas using the same boundary rules as the component", () => {
    expect(applyQuickCounterDelta(18, 5, { min: 0, max: 20 })).toBe(20);
    expect(applyQuickCounterDelta(3, -5, { min: 0 })).toBe(0);
  });
});
