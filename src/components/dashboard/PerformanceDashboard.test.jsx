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
  it("keeps a one-day extra activity in today's primary workout", () => {
    render(<PerformanceDashboard todayYmd="2026-10-20" logs={[{date_ymd:"2026-10-20",log:{blocks:[{id:"extra",typeId:"duration",label:"Yoga",isExtra:true,duration:{minutes:20}}]}}]} />);
    expect(screen.getByRole("region",{name:"Today’s workout"}).textContent).toContain("Yoga");
    fireEvent.click(screen.getByRole("button", {name: /Today’s workout/}));
    expect(screen.getByRole("button",{name:"Start / continue today’s workout"})).toBeTruthy();
  });
  it("puts Performance Coach first and keeps today collapsed below it", () => {
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
    const dashboard = screen.getByRole("main", {name:"Performance dashboard"});
    expect(dashboard.firstElementChild).toBe(coach);
    const today = screen.getByRole("region", {name: "Today’s workout"});
    expect(coach.nextElementSibling).toBe(today);
    const toggle = screen.getByRole("button", {name: /Today’s workout/});
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByRole("button", {name: "Review today’s workout"})).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByRole("button", {name: "Review today’s workout"})).toBeTruthy();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(coach.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
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
  it('shows partial activity with its earned XP and opens the matching Log date', () => {
    const onOpenHistoryDate = vi.fn();
    render(<PerformanceDashboard historyDays={[{ dateYmd: '2026-10-12', kind: 'partial',
      label: 'Plan partially completed', icon: '◐', earnedXp: 255 }]}
      onOpenHistoryDate={onOpenHistoryDate} />);
    const day = screen.getByRole('button', { name: '2026-10-12. Plan partially completed' });
    expect(day.className).toContain('is-partial');
    expect(day.querySelector('.dashboardHistoryDay__xp').textContent).toBe('255XP');
    expect(screen.getByText('Partial').className).toBe('is-partial');
    fireEvent.click(day);
    expect(onOpenHistoryDate).toHaveBeenCalledWith('2026-10-12');
  });

  it.each(["complete", "partial", "rest", "illness", "cancelled", "streak-saver", "none"])("uses the rhythm status %s and opens the log without expanding", kind => {
    const onOpenLog = vi.fn();
    render(<PerformanceDashboard todayYmd="2026-10-20" todayBlocks={[{id:"yoga",typeId:"duration",label:"Yoga"}]}
      historyDays={[{dateYmd:"2026-10-20",kind}]} onOpenLog={onOpenLog} />);
    const today = screen.getByRole("region", {name:"Today’s workout"});
    expect(today.querySelector("article").classList.contains(`is-${kind}`)).toBe(true);
    expect(today.querySelector("article").classList.contains("is-pending")).toBe(kind === "none");
    fireEvent.click(screen.getByRole("button", {name:kind === "complete" ? "Review log" : "Open log"}));
    expect(onOpenLog).toHaveBeenCalledOnce();
    expect(screen.getByRole("button", {name:/Today’s workout/}).getAttribute("aria-expanded")).toBe("false");
  });

});
