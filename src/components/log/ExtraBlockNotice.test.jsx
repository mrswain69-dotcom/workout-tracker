// @vitest-environment jsdom
import React from "react";
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ExtraBlockNotice from "./ExtraBlockNotice.jsx";

afterEach(() => { cleanup(); vi.useRealTimers(); });

it("keeps the added confirmation for five seconds and clears its timer on closing", () => {
  vi.useFakeTimers();
  const expire = vi.fn();
  const { unmount } = render(<ExtraBlockNotice onExpire={expire} />);
  expect(screen.getByRole("status").textContent).toBe("Extra block added");
  act(() => vi.advanceTimersByTime(4999));
  expect(expire).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(expire).toHaveBeenCalledTimes(1);
  unmount();
  const cancelled = vi.fn();
  const next = render(<ExtraBlockNotice onExpire={cancelled} />);
  next.unmount();
  act(() => vi.advanceTimersByTime(5000));
  expect(cancelled).not.toHaveBeenCalled();
});
