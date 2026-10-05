// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../../verifiedActivityDb.js", () => ({
  loadVerifiedActivityData: vi.fn(async () => ({ data: null, error: null })),
}));
vi.mock("../../groups/groupDb.js", () => ({
  listProfileGroups: vi.fn(async () => ({ data: [], error: null })),
}));
vi.mock("../../assessmentScheduleDb.js", () => ({
  listAssessmentSchedules: vi.fn(async () => ({ data: [], error: null })),
}));
vi.mock("../../assessmentRunDb.js", () => ({
  listAssessmentRuns: vi.fn(async () => ({ data: [], error: null })),
}));

import PerformanceDashboard from "./PerformanceDashboard.jsx";

afterEach(() => cleanup());

describe("PerformanceDashboard recent activity calendar", () => {
  it("renders the history directly after the coach and opens the selected date", () => {
    const onOpenHistoryDate = vi.fn();
    const days = Array.from({ length: 14 }, (_, index) => ({
      dateYmd: `2026-10-${String(index + 1).padStart(2, "0")}`,
      kind: index === 13 ? "complete" : "none",
      label: index === 13 ? "Plan completed" : "No completed activity",
      icon: index === 13 ? "✓" : "",
      isToday: index === 13,
      earnedXp: index === 13 ? 125 : 0,
    }));

    render(
      <PerformanceDashboard
        profileId="profile-1"
        todayYmd="2026-10-14"
        weekSummary={{ xp: 0, lastWeekXp: 1250 }}
        todayBlocks={[{ id: "strength-1", typeId: "strength", label: "Strength" }]}
        historyDays={days}
        onOpenHistoryDate={onOpenHistoryDate}
      />
    );

    const coach = screen.getByText("Today’s opportunity is clear.").closest("section");
    const history = screen.getByRole("region", { name: "Recent plan history" });
    expect(coach?.nextElementSibling).toBe(history);
    const xpCard = screen.getByText("Last week").closest(".dashboardMetric");
    expect(xpCard.textContent).toContain("This week0 XP");
    expect(xpCard.textContent).toContain("Last week1,250 XP");
    expect(history.querySelector("svg")).toBeNull();
    expect(history.querySelector(".dashboardHistoryDay.is-today .dashboardHistoryDay__xp").textContent).toBe("125XP");
    const strip = history.querySelector(".dashboardHistory__days");
    strip.scrollBy = vi.fn();
    fireEvent.click(screen.getByRole("button", { name: "Earlier plan history" }));
    expect(strip.scrollBy).toHaveBeenCalledWith({ left: -strip.clientWidth, behavior: "smooth" });
    fireEvent.click(screen.getByRole("button", { name: "2026-10-14. Plan completed" }));
    expect(onOpenHistoryDate).toHaveBeenCalledWith("2026-10-14");
  });
});
