// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionMovementEditor, {
  formatDurationClock,
  parseDurationClock,
} from "./SessionMovementEditor.jsx";

afterEach(cleanup);

const library = [
  { id: "m1", name: "Sole Rolls", archived: false },
  { id: "m2", name: "Drag-Backs", archived: false },
  { id: "m3", name: "Archived Drill", archived: true },
];

function MovementHarness({ initialMovement, onMovement, ...props }) {
  const [movement, setMovement] = useState(initialMovement);
  return (
    <SessionMovementEditor
      {...props}
      movement={movement}
      canonicalMovements={library}
      onChange={(next, meta) => {
        setMovement(next);
        if (typeof onMovement === "function") onMovement(next, meta);
      }}
    />
  );
}

function baseMovement(overrides = {}) {
  return {
    localId: "row-1",
    movementId: "m1",
    position: 1,
    displayLabel: "Sole Rolls",
    instructions: "Keep the ball close.",
    plannedDurationSec: 150,
    trackingMethod: "completion",
    trackingConfig: {},
    ...overrides,
  };
}

describe("SessionMovementEditor duration helpers", () => {
  it("formats canonical seconds as mm:ss", () => {
    expect(formatDurationClock(150)).toBe("2:30");
    expect(formatDurationClock(900)).toBe("15:00");
    expect(formatDurationClock(null)).toBe("");
  });

  it("parses mm:ss and raw seconds safely", () => {
    expect(parseDurationClock("2:30")).toBe(150);
    expect(parseDurationClock("90")).toBe(90);
    expect(parseDurationClock("2:75")).toBeNull();
    expect(parseDurationClock("")).toBeNull();
  });
});

describe("SessionMovementEditor", () => {
  it("shows active canonical movements and excludes archived ones", () => {
    render(<MovementHarness initialMovement={baseMovement()} />);
    const select = screen.getByRole("combobox", { name: "Movement 1 library movement" });
    expect(select.value).toBe("m1");
    expect(screen.getByRole("option", { name: "Sole Rolls" })).toBeTruthy();
    expect(screen.getByRole("option", { name: "Drag-Backs" })).toBeTruthy();
    expect(screen.queryByRole("option", { name: "Archived Drill" })).toBeNull();
  });

  it("updates the display label when switching an uncustomised canonical movement", () => {
    const onMovement = vi.fn();
    render(<MovementHarness initialMovement={baseMovement()} onMovement={onMovement} />);

    fireEvent.change(
      screen.getByRole("combobox", { name: "Movement 1 library movement" }),
      { target: { value: "m2" } }
    );

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ movementId: "m2", displayLabel: "Drag-Backs" }),
      expect.objectContaining({ source: "movement-selection" })
    );
  });

  it("preserves a deliberately customised display label when changing canonical movement", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={baseMovement({ displayLabel: "Quick Sole Rolls" })}
        onMovement={onMovement}
      />
    );

    fireEvent.change(
      screen.getByRole("combobox", { name: "Movement 1 library movement" }),
      { target: { value: "m2" } }
    );

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ movementId: "m2", displayLabel: "Quick Sole Rolls" }),
      expect.any(Object)
    );
  });

  it("edits planned duration as mm:ss but emits canonical seconds", () => {
    const onMovement = vi.fn();
    render(<MovementHarness initialMovement={baseMovement()} onMovement={onMovement} />);

    const duration = screen.getByRole("textbox", { name: "Movement 1 planned duration" });
    expect(duration.value).toBe("2:30");
    fireEvent.change(duration, { target: { value: "3:15" } });
    fireEvent.blur(duration);

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ plannedDurationSec: 195 }),
      expect.objectContaining({ source: "duration" })
    );
    expect(duration.value).toBe("3:15");
  });

  it("switches tracking method and creates the correct optional default config", () => {
    const onMovement = vi.fn();
    render(<MovementHarness initialMovement={baseMovement()} onMovement={onMovement} />);

    fireEvent.change(
      screen.getByRole("combobox", { name: "Movement 1 tracking method" }),
      { target: { value: "repetitions" } }
    );

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trackingMethod: "repetitions",
        trackingConfig: expect.objectContaining({
          required: false,
          quickSteps: [1, 5, 10],
          sideMode: "none",
        }),
      }),
      expect.objectContaining({ source: "tracking-method" })
    );
  });

  it("configures side mode and quick-counter steps for a count method", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={baseMovement({
          trackingMethod: "repetitions",
          trackingConfig: { countLabel: "Clean reps" },
        })}
        onMovement={onMovement}
      />
    );

    fireEvent.change(screen.getByRole("combobox", { name: "Movement 1 side mode" }), {
      target: { value: "separate" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Movement 1 quick counter steps" }), {
      target: { value: "2, 7, 2, 10" },
    });

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trackingConfig: expect.objectContaining({
          sideMode: "separate",
          quickSteps: [2, 7, 10],
          required: false,
        }),
      }),
      expect.objectContaining({ field: "quickSteps" })
    );
  });

  it("supports custom attempts and successes labels", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={baseMovement({ trackingMethod: "attempts_successes" })}
        onMovement={onMovement}
      />
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Movement 1 attempts label" }), {
      target: { value: "Feeds" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Movement 1 successes label" }), {
      target: { value: "Controlled" },
    });

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trackingConfig: expect.objectContaining({
          attemptsLabel: "Feeds",
          successesLabel: "Controlled",
        }),
      }),
      expect.objectContaining({ field: "successesLabel" })
    );
  });

  it("enables optional resistance for sets and reps", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={baseMovement({ trackingMethod: "sets_reps" })}
        onMovement={onMovement}
      />
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Movement 1 track resistance" }));
    fireEvent.change(screen.getByRole("combobox", { name: "Movement 1 resistance unit" }), {
      target: { value: "lb" },
    });

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        trackingConfig: expect.objectContaining({ allowWeight: true, weightUnit: "lb" }),
      }),
      expect.objectContaining({ field: "weightUnit" })
    );
  });

  it("exposes move and remove controls without changing the movement itself", () => {
    const onMoveUp = vi.fn();
    const onMoveDown = vi.fn();
    const onRemove = vi.fn();
    render(
      <MovementHarness
        initialMovement={baseMovement()}
        canMoveUp
        canMoveDown
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onRemove={onRemove}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Move movement 1 up" }));
    fireEvent.click(screen.getByRole("button", { name: "Move movement 1 down" }));
    fireEvent.click(screen.getByRole("button", { name: "Remove movement 1" }));

    expect(onMoveUp).toHaveBeenCalledTimes(1);
    expect(onMoveDown).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });
});
