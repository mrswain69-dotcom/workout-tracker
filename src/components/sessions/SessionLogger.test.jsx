// @vitest-environment jsdom

import React, { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import SessionLogger, {
  completeSessionForLogging,
  formatSessionLoggerDuration,
  getSessionLoggerProgress,
  reopenSessionForLogging,
} from "./SessionLogger.jsx";

afterEach(cleanup);

function makeSession() {
  return {
    schemaVersion: 1,
    programmeId: "programme-football",
    programmeName: "Football Development",
    templateId: "session-a",
    templateVersion: 3,
    displayCode: "A",
    name: "Close Control",
    description: "Sharp touches and confident close control.",
    plannedDurationSec: 900,
    actualDurationSec: null,
    completed: false,
    movements: [
      {
        templateMovementId: "tm-sole-rolls",
        movementId: "m-sole-rolls",
        position: 1,
        name: "Sole Rolls",
        displayLabel: "Sole Rolls",
        instructions: "Alternate feet and keep the ball close.",
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
      },
      {
        templateMovementId: "tm-drag-backs",
        movementId: "m-drag-backs",
        position: 2,
        name: "Drag-Backs",
        displayLabel: "Drag-Backs",
        instructions: "Sell the turn before dragging away.",
        plannedDurationSec: 150,
        trackingMethod: "completion",
        trackingConfig: {},
        completed: false,
        skipped: false,
        result: null,
        note: "",
      },
      {
        templateMovementId: "tm-flip-flap",
        movementId: "m-flip-flap",
        position: 3,
        name: "Flip-Flap",
        displayLabel: "Flip-Flap Out → In",
        instructions: "45 seconds each foot.",
        plannedDurationSec: 90,
        trackingMethod: "repetitions",
        trackingConfig: {
          countLabel: "Clean reps",
          unit: "reps",
          quickSteps: [1, 5, 10],
          sideMode: "separate",
        },
        completed: false,
        skipped: false,
        result: null,
        note: "",
      },
    ],
  };
}

function LoggerHarness({ initialSession = makeSession(), onSession, ...props }) {
  const [session, setSession] = useState(initialSession);
  return (
    <SessionLogger
      {...props}
      session={session}
      onChange={(next, meta) => {
        setSession(next);
        if (typeof onSession === "function") onSession(next, meta);
      }}
    />
  );
}

describe("SessionLogger", () => {
  it("renders frozen Session identity, programme, version and duration", () => {
    render(<LoggerHarness blockLabel="Football Skills — Session A" />);

    expect(screen.getByRole("region", { name: "Session A — Close Control" })).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Close Control" })).toBeTruthy();
    expect(screen.getByText("SESSION A")).toBeTruthy();
    expect(screen.getByText("Football Skills — Session A")).toBeTruthy();
    expect(screen.getByText("Football Development")).toBeTruthy();
    expect(screen.getByText("Planned 15:00")).toBeTruthy();
    expect(screen.getByText("v3")).toBeTruthy();
    expect(screen.getByText("Sharp touches and confident close control.")).toBeTruthy();
  });

  it("renders every movement from the frozen Session snapshot", () => {
    render(<LoggerHarness />);

    expect(screen.getByRole("article", { name: "Sole Rolls" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Drag-Backs" })).toBeTruthy();
    expect(screen.getByRole("article", { name: "Flip-Flap Out → In" })).toBeTruthy();
  });

  it("persists movement result changes into a new Session object", () => {
    const original = makeSession();
    const originalJson = JSON.stringify(original);
    const onSession = vi.fn();
    render(<LoggerHarness initialSession={original} onSession={onSession} />);

    const soleRolls = screen.getByRole("article", { name: "Sole Rolls" });
    fireEvent.click(
      Array.from(soleRolls.querySelectorAll("button")).find(
        (button) => button.getAttribute("aria-label") === "Increase by 10"
      )
    );

    expect(onSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        completed: false,
        movements: expect.arrayContaining([
          expect.objectContaining({
            templateMovementId: "tm-sole-rolls",
            completed: true,
            result: { overall: { count: 10 } },
          }),
        ]),
      }),
      expect.objectContaining({ source: "movement", movementIndex: 0 })
    );
    expect(JSON.stringify(original)).toBe(originalJson);
  });

  it("preserves rapid counter updates through the Session wrapper", () => {
    const onSession = vi.fn();
    render(<SessionLogger session={makeSession()} onChange={onSession} />);

    const soleRolls = screen.getByRole("article", { name: "Sole Rolls" });
    const plus10 = Array.from(soleRolls.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Increase by 10"
    );
    const plus5 = Array.from(soleRolls.querySelectorAll("button")).find(
      (button) => button.getAttribute("aria-label") === "Increase by 5"
    );

    fireEvent.click(plus10);
    fireEvent.click(plus10);
    fireEvent.click(plus5);

    expect(
      onSession.mock.calls.map(([next]) => next.movements[0].result?.overall?.count)
    ).toEqual([10, 20, 25]);
  });

  it("completes the Session without requiring numeric results", () => {
    const onSession = vi.fn();
    const initial = makeSession();
    initial.movements[2] = {
      ...initial.movements[2],
      skipped: true,
      completed: false,
    };

    render(<LoggerHarness initialSession={initial} onSession={onSession} />);
    fireEvent.click(screen.getByRole("button", { name: "Complete Session" }));

    const [next, meta] = onSession.mock.calls.at(-1);
    expect(meta).toEqual(expect.objectContaining({ source: "session-complete" }));
    expect(next.completed).toBe(true);
    expect(next.movements[0]).toEqual(
      expect.objectContaining({ completed: true, skipped: false, result: null })
    );
    expect(next.movements[1]).toEqual(
      expect.objectContaining({ completed: true, skipped: false, result: null })
    );
    expect(next.movements[2]).toEqual(
      expect.objectContaining({ completed: false, skipped: true, result: null })
    );
    expect(screen.getByText("Complete")).toBeTruthy();
  });

  it("keeps existing movement results and notes when the Session is completed", () => {
    const initial = makeSession();
    initial.movements[0] = {
      ...initial.movements[0],
      result: { overall: { count: 36 } },
      note: "Best rhythm so far.",
    };

    const completed = completeSessionForLogging(initial);
    expect(completed.movements[0].result).toEqual({ overall: { count: 36 } });
    expect(completed.movements[0].note).toBe("Best rhythm so far.");
    expect(completed.movements[0].completed).toBe(true);
  });

  it("reopens completion without deleting movement work", () => {
    const initial = completeSessionForLogging(makeSession());
    initial.movements[0].result = { overall: { count: 28 } };
    const onSession = vi.fn();

    render(<LoggerHarness initialSession={initial} onSession={onSession} />);
    fireEvent.click(screen.getByRole("button", { name: "Reopen Session" }));

    expect(onSession).toHaveBeenLastCalledWith(
      expect.objectContaining({
        completed: false,
        movements: expect.arrayContaining([
          expect.objectContaining({ result: { overall: { count: 28 } } }),
        ]),
      }),
      expect.objectContaining({ source: "session-reopen" })
    );
  });

  it("shows movement progress separately from skipped drills", () => {
    const initial = makeSession();
    initial.movements[0].completed = true;
    initial.movements[2].skipped = true;
    render(<LoggerHarness initialSession={initial} />);

    const progress = screen.getByLabelText("Session movement progress");
    expect(progress.textContent).toContain("1 of 2 active drills done");
    expect(screen.getByText("1 skipped")).toBeTruthy();
    expect(getSessionLoggerProgress(initial)).toEqual({
      total: 3,
      active: 2,
      completed: 1,
      skipped: 1,
      remaining: 1,
    });
  });

  it("shows actual duration when the historical snapshot contains it", () => {
    render(
      <LoggerHarness
        initialSession={{ ...makeSession(), actualDurationSec: 916 }}
      />
    );
    expect(screen.getByText("Actual 15:16")).toBeTruthy();
  });

  it("disables movement and completion editing when the block is disabled", () => {
    render(<LoggerHarness disabled />);

    expect(screen.getByRole("button", { name: "Complete Session" }).disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: "Done" })[0].disabled).toBe(true);
    expect(screen.getAllByRole("button", { name: "Skip" })[0].disabled).toBe(true);
  });

  it("handles an empty frozen Session without failing", () => {
    render(<LoggerHarness initialSession={{ ...makeSession(), movements: [] }} />);
    expect(
      screen.getByText("No drills are defined in this frozen Session snapshot.")
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: "Complete Session" })).toBeTruthy();
  });
});

describe("SessionLogger helpers", () => {
  it("formats Session durations compactly", () => {
    expect(formatSessionLoggerDuration(45)).toBe("0:45");
    expect(formatSessionLoggerDuration(900)).toBe("15:00");
    expect(formatSessionLoggerDuration(3723)).toBe("1:02:03");
    expect(formatSessionLoggerDuration(null)).toBe("");
  });

  it("reopenSessionForLogging only changes the Session completion state", () => {
    const completed = completeSessionForLogging(makeSession());
    const reopened = reopenSessionForLogging(completed);
    expect(reopened.completed).toBe(false);
    expect(reopened.movements.every((movement) => movement.completed)).toBe(true);
  });
});
