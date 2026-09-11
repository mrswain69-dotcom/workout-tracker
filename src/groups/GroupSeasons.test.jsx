// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  loadGroupSeasonsAwards: vi.fn(),
}));

import GroupSeasons from "./GroupSeasons.jsx";
import { loadGroupSeasonsAwards } from "./groupDb";

const group = { id: "g1", name: "Falcons" };
const membership = { id: "m2", nickname: "WS10" };

function payload() {
  return {
    scoreVersion: 1,
    monthly: {
      current: {
        periodType: "month",
        startDate: "2026-09-01",
        endDate: "2026-09-30",
        state: "live",
        available: true,
        rows: [
          { membership_id: "m1", nickname: "Rocket", xp: 900, xpRank: 1, plannedDays: 7, completedDays: 7, consistencyPct: 100, consistencyRank: 1, improvementPct: 6.2, improvementMetricCount: 2, improvementRank: 1 },
          { membership_id: "m2", nickname: "WS10", xp: 700, xpRank: 2, plannedDays: 8, completedDays: 7, consistencyPct: 87.5, consistencyRank: 2, improvementPct: 4.4, improvementMetricCount: 3, improvementRank: 2 },
        ],
      },
      history: [{
        periodType: "month",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
        state: "frozen",
        available: true,
        rows: [{ membership_id: "m2", nickname: "WS10", xp: 2100, xpRank: 1, plannedDays: 16, completedDays: 14, consistencyPct: 87.5, consistencyRank: 1, improvementPct: 5.1, improvementMetricCount: 4, improvementRank: 1 }],
      }],
    },
    season: {
      current: {
        periodType: "season",
        seasonNumber: 1,
        weekNumber: 1,
        startDate: "2026-09-07",
        endDate: "2026-11-01",
        state: "live",
        available: true,
        rows: [
          { membership_id: "m1", nickname: "Rocket", xp: 400, xpRank: 1, plannedDays: 4, completedDays: 4, consistencyPct: 100, consistencyRank: 1, improvementPct: 6.2, improvementMetricCount: 2, improvementRank: 1 },
          { membership_id: "m2", nickname: "WS10", xp: 350, xpRank: 2, plannedDays: 4, completedDays: 3, consistencyPct: 75, consistencyRank: 2, improvementPct: 4.4, improvementMetricCount: 3, improvementRank: 2 },
        ],
      },
      history: [],
    },
    awards: [{ membership_id: "m2", nickname: "WS10", awardType: "monthly_xp", periodType: "month", periodStart: "2026-08-01", periodEnd: "2026-08-31" }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadGroupSeasonsAwards.mockResolvedValue({ data: payload(), error: null });
});

afterEach(() => cleanup());

describe("GroupSeasons", () => {
  it("defaults to calendar-month XP and shows safe identity plus Progress Awards", async () => {
    render(<GroupSeasons group={group} membership={membership} />);
    const table = await screen.findByRole("table", { name: "Monthly XP standings" });
    expect(within(table).getByText("WS10 · You")).toBeTruthy();
    expect(within(table).getByText("700 XP")).toBeTruthy();
    expect(screen.getByText("Monthly XP Winner")).toBeTruthy();
    expect(loadGroupSeasonsAwards).toHaveBeenCalledWith("g1", "m2");
  });

  it("switches metrics without mixing their independent ranks", async () => {
    render(<GroupSeasons group={group} membership={membership} />);
    await screen.findByRole("table", { name: "Monthly XP standings" });
    fireEvent.click(screen.getByRole("button", { name: "Consistency" }));
    const table = screen.getByRole("table", { name: "Monthly Consistency standings" });
    expect(within(table).getByText("87.5%")).toBeTruthy();
    expect(within(table).getByText("7 / 8 planned days")).toBeTruthy();
  });

  it("shows the fixed eight-week season and its current week", async () => {
    render(<GroupSeasons group={group} membership={membership} />);
    await screen.findByRole("table", { name: "Monthly XP standings" });
    fireEvent.click(screen.getByRole("button", { name: "8-week season" }));
    expect(await screen.findByText(/Live · week 1 of 8/)).toBeTruthy();
    expect(screen.getByRole("table", { name: "Season XP standings" })).toBeTruthy();
    expect(screen.getByText(/Season 1 ·/)).toBeTruthy();
  });

  it("shows frozen completed months as final standings", async () => {
    render(<GroupSeasons group={group} membership={membership} />);
    await screen.findByRole("table", { name: "Monthly XP standings" });
    fireEvent.click(screen.getByRole("button", { name: "Aug 2026" }));
    expect(await screen.findByText("Final standings")).toBeTruthy();
    const table = screen.getByRole("table", { name: "Monthly XP standings" });
    expect(within(table).getByText("2,100 XP")).toBeTruthy();
  });

  it("reports loader failures deliberately", async () => {
    loadGroupSeasonsAwards.mockResolvedValue({ data: null, error: new Error("long-cycle down") });
    render(<GroupSeasons group={group} membership={membership} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("long-cycle down");
  });
});
