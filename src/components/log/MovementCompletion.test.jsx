// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MovementCompletion from "./MovementCompletion.jsx";

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const tick = (ms) => act(() => vi.advanceTimersByTime(ms));

describe("movement completion confirmation", () => {
  it("waits for complete fields, then two idle seconds and a three-second confirmation", () => {
    const done = vi.fn();
    const { rerender } = render(<MovementCompletion complete={false} signature="empty" onDone={done} />);
    rerender(<MovementCompletion complete={false} signature="reps-only" onDone={done} />);
    tick(10000);
    expect(screen.queryByText("Next Movement")).toBeNull();
    expect(done).not.toHaveBeenCalled();
    rerender(<MovementCompletion complete signature="all-fields" onDone={done} />);
    tick(1999);
    expect(screen.queryByText("Next Movement")).toBeNull();
    tick(1);
    expect(screen.getByText("Next Movement")).toBeTruthy();
    tick(2999);
    expect(done).not.toHaveBeenCalled();
    tick(1);
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("restarts the wait when typing continues or an extra set is added", () => {
    const done = vi.fn();
    const { rerender } = render(<MovementCompletion complete={false} signature="empty" onDone={done} />);
    rerender(<MovementCompletion complete signature="1" onDone={done} />);
    tick(4000);
    rerender(<MovementCompletion complete signature="12" onDone={done} />);
    tick(1999);
    expect(screen.queryByText("Next Movement")).toBeNull();
    rerender(<MovementCompletion complete={false} signature="extra-blank-set" onDone={done} />);
    tick(10000);
    expect(done).not.toHaveBeenCalled();
  });

  it("allows explicit Next Movement and disables auto-collapse with the keep-open button", () => {
    const done = vi.fn();
    const disable = vi.fn();
    const { rerender } = render(<MovementCompletion complete={false} signature="empty" onDone={done} onDisableAuto={disable} />);
    rerender(<MovementCompletion complete signature="filled" onDone={done} onDisableAuto={disable} />);
    tick(2000);
    fireEvent.click(screen.getByRole("button", { name: /Keep movement open/ }));
    expect(disable).toHaveBeenCalledTimes(1);
    rerender(<MovementCompletion complete signature="filled" onDone={done} autoDisabled />);
    tick(10000);
    expect(done).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Next Movement" }));
    expect(done).toHaveBeenCalledTimes(1);
  });

  it("does not auto-collapse saved results on reopening and cancels timers on closing", () => {
    const done = vi.fn();
    const { rerender, unmount } = render(<MovementCompletion complete signature="saved" onDone={done} />);
    tick(10000);
    expect(done).not.toHaveBeenCalled();
    rerender(<MovementCompletion complete signature="edited" onDone={done} />);
    tick(2000);
    unmount();
    tick(10000);
    expect(done).not.toHaveBeenCalled();
  });
});
