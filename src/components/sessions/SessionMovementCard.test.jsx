// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionMovementCard, {
  formatSessionMovementDuration,
} from "./SessionMovementCard.jsx";

afterEach(cleanup);

const baseMovement = {
  templateMovementId: "tm-sole-rolls",
  movementId: "m-sole-rolls",
  position: 1,
  name: "Sole Rolls",
  displayLabel: "Sole Rolls",
  instructions: "Keep the ball close and alternate feet.",
  plannedDurationSec: 150,
  trackingMethod: "repetitions",
  trackingConfig: {
    countLabel: "Clean reps",
    unit: "reps",
    quickSteps: [1, 5, 10],
  },
  completed: false,
  skipped: false,
  result: null,
  note: "",
};

function MovementHarness({ initialMovement = baseMovement, onMovement, ...props }) {
  const [movement, setMovement] = useState(initialMovement);
  return (
    <SessionMovementCard
      {...props}
      movement={movement}
      onChange={(next, meta) => {
        setMovement(next);
        if (typeof onMovement === "function") onMovement(next, meta);
      }}
    />
  );
}

describe("SessionMovementCard", () => {
  it("shows the movement identity, instructions and planned duration", () => {
    render(<MovementHarness />);

    expect(screen.getByRole("heading", { name: "Sole Rolls" })).toBeTruthy();
    expect(screen.getByText("Keep the ball close and alternate feet.")).toBeTruthy();
    expect(screen.getByLabelText("Planned duration 2:30")).toBeTruthy();
    expect(screen.getByRole("article", { name: "Sole Rolls" })).toBeTruthy();
  });

  it("marks a movement done automatically when a result is recorded", () => {
    const onMovement = vi.fn();
    render(<MovementHarness onMovement={onMovement} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase by 5" }));

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        completed: true,
        skipped: false,
        result: { overall: { count: 15 } },
      }),
      expect.objectContaining({ source: "result" })
    );
    expect(screen.getByRole("button", { name: "Done" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("preserves rapid counter updates through the movement wrapper", () => {
    const onMovement = vi.fn();
    render(<SessionMovementCard movement={baseMovement} onChange={onMovement} />);

    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase by 10" }));
    fireEvent.click(screen.getByRole("button", { name: "Increase by 5" }));

    expect(onMovement.mock.calls.map(([next]) => next.result?.overall?.count)).toEqual([
      10,
      20,
      25,
    ]);
    expect(onMovement.mock.calls.every(([next]) => next.completed === true)).toBe(true);
  });

  it("can explicitly mark a non-numeric movement done without entering a result", () => {
    const onMovement = vi.fn();
    render(<MovementHarness onMovement={onMovement} />);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true, skipped: false, result: null }),
      expect.objectContaining({ source: "status", status: "completed" })
    );
  });

  it("makes skipped and completed mutually exclusive while preserving prior result data", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={{
          ...baseMovement,
          completed: true,
          result: { overall: { count: 22 } },
        }}
        onMovement={onMovement}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Skip" }));

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({
        completed: false,
        skipped: true,
        result: { overall: { count: 22 } },
      }),
      expect.objectContaining({ source: "status", status: "skipped" })
    );
    expect(screen.getByText("Skipped — result entry is paused.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Increase by 10" }).disabled).toBe(true);

    fireEvent.click(screen.getByRole("button", { name: "Skipped" }));
    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ skipped: false, result: { overall: { count: 22 } } }),
      expect.objectContaining({ status: "unskipped" })
    );
  });

  it("lets Done reactivate a skipped movement", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={{ ...baseMovement, skipped: true, completed: false }}
        onMovement={onMovement}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true, skipped: false }),
      expect.objectContaining({ status: "completed" })
    );
  });

  it("uses the Practised control as the completion state for completion-only movements", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={{
          ...baseMovement,
          trackingMethod: "completion",
          trackingConfig: {},
          result: null,
        }}
        onMovement={onMovement}
      />
    );

    expect(screen.queryByRole("button", { name: "Done" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Practised" }));

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ completed: true, skipped: false, result: null }),
      expect.objectContaining({ source: "completion" })
    );
  });

  it("keeps notes editable while skipped so the reason can be recorded", () => {
    const onMovement = vi.fn();
    render(
      <MovementHarness
        initialMovement={{ ...baseMovement, skipped: true }}
        onMovement={onMovement}
      />
    );

    const notes = screen.getByRole("textbox", { name: "Sole Rolls notes" });
    expect(notes.disabled).toBe(false);
    fireEvent.change(notes, { target: { value: "Ankle felt tight." } });

    expect(onMovement).toHaveBeenLastCalledWith(
      expect.objectContaining({ note: "Ankle felt tight.", skipped: true }),
      expect.objectContaining({ source: "note" })
    );
  });

  it("does not mutate the supplied movement object when notes or status change", () => {
    const original = {
      ...baseMovement,
      trackingConfig: { ...baseMovement.trackingConfig },
    };
    const snapshot = JSON.stringify(original);
    render(<SessionMovementCard movement={original} onChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Done" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Sole Rolls notes" }), {
      target: { value: "Good session" },
    });

    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("can hide optional notes", () => {
    render(<MovementHarness showNotes={false} />);
    expect(screen.queryByRole("textbox", { name: "Sole Rolls notes" })).toBeNull();
  });

  it("disables status, result and note editing when the whole card is disabled", () => {
    render(<MovementHarness disabled />);

    expect(screen.getByRole("button", { name: "Done" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Skip" }).disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Increase by 10" }).disabled).toBe(true);
    expect(screen.getByRole("textbox", { name: "Sole Rolls notes" }).disabled).toBe(true);
  });
});

describe("formatSessionMovementDuration", () => {
  it("formats movement durations compactly for the training card", () => {
    expect(formatSessionMovementDuration(45)).toBe("0:45");
    expect(formatSessionMovementDuration(150)).toBe("2:30");
    expect(formatSessionMovementDuration(900)).toBe("15:00");
    expect(formatSessionMovementDuration(3723)).toBe("1:02:03");
    expect(formatSessionMovementDuration(null)).toBe("");
  });
});
