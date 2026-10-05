// @vitest-environment jsdom
import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ActivityCalendar from "./ActivityCalendar.jsx";

describe("ActivityCalendar", () => {
  it("shows status-aware dates and selects a historical day", () => {
    const onChange = vi.fn();
    render(
      <ActivityCalendar
        value="2026-10-05"
        todayYmd="2026-10-05"
        onChange={onChange}
        getDayState={(dateYmd) => dateYmd === "2026-10-04"
          ? { kind: "complete", label: "Plan completed", icon: "✓" }
          : { kind: "none", label: "No completed activity", icon: "" }}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "05/10/2026" }));
    const completedDay = screen.getByRole("button", { name: "2026-10-04. Plan completed" });
    expect(completedDay.className).toContain("is-complete");
    fireEvent.click(completedDay);
    expect(onChange).toHaveBeenCalledWith("2026-10-04");
  });
});
