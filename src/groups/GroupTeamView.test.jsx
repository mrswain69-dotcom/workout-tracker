// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  loadGroupSeasonsAwards: vi.fn(),
  loadGroupImprovementLeaderboard: vi.fn(),
}));

vi.mock("./groupTeamDb", () => ({
  loadGroupTeamPrBoard: vi.fn(),
}));

import GroupTeamView from "./GroupTeamView.jsx";
import { loadGroupImprovementLeaderboard, loadGroupSeasonsAwards } from "./groupDb";
import { loadGroupTeamPrBoard } from "./groupTeamDb";

const membership = { id: "m2", nickname: "WS10" };

function seasonPayload() {
  return {
    season: {
      current: {
        seasonNumber: 1,
        weekNumber: 3,
        startDate: "2026-08-31",
        endDate: "2026-10-25",
        state: "live",
        available: true,
        rows: [
          { membership_id: "m1", nickname: "Rocket", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true, xp: 900, xpRank: 1, plannedDays: 6, completedDays: 6, consistencyPct: 100, consistencyState: "scored", consistencyRank: 1, improvementPct: 6, improvementMetricCount: 2, improvementRank: 1 },
          { membership_id: "m2", nickname: "WS10", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true, xp: 700, xpRank: 2, plannedDays: 6, completedDays: 5, consistencyPct: 83.3, consistencyState: "scored", consistencyRank: 2, improvementPct: 2, improvementMetricCount: 2, improvementRank: 2 },
          { membership_id: "m3", nickname: "Flash", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true, xp: 500, xpRank: 3, plannedDays: 6, completedDays: 4, consistencyPct: 66.7, consistencyState: "scored", consistencyRank: 3, improvementPct: 1, improvementMetricCount: 1, improvementRank: 3 },
        ],
      },
    },
  };
}

function improvementPayload() {
  return {
    current: {
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      state: "live",
      available: true,
      rows: [
        { membership_id: "m1", improvementPct: 6, metricCount: 2 },
        { membership_id: "m2", improvementPct: 2, metricCount: 2 },
      ],
    },
    history: [
      { startDate: "2026-08-31", endDate: "2026-09-06", state: "frozen", available: true, rows: [{ membership_id: "m1", improvementPct: 4, metricCount: 2 }, { membership_id: "m2", improvementPct: 2, metricCount: 1 }] },
      { startDate: "2026-08-24", endDate: "2026-08-30", state: "frozen", available: true, rows: [{ membership_id: "m1", improvementPct: 1, metricCount: 1 }] },
    ],
  };
}

function prPayload() {
  return {
    scoreVersion: 1,
    groupType: "squad",
    current: {
      seasonNumber: 1,
      weekNumber: 3,
      startDate: "2026-08-31",
      endDate: "2026-10-25",
      state: "live",
      rows: [
        { membership_id: "m1", nickname: "Rocket", prCount: 3, latestPrDate: "2026-09-10", rank: 1 },
        { membership_id: "m2", nickname: "WS10", prCount: 2, latestPrDate: "2026-09-09", rank: 2 },
        { membership_id: "m3", nickname: "Flash", prCount: 0, latestPrDate: null, rank: null },
      ],
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadGroupSeasonsAwards.mockResolvedValue({ data: seasonPayload(), error: null });
  loadGroupImprovementLeaderboard.mockResolvedValue({ data: improvementPayload(), error: null });
  loadGroupTeamPrBoard.mockResolvedValue({ data: prPayload(), error: null });
});

afterEach(() => cleanup());

describe("GroupTeamView", () => {
  it("renders Squad season tracking, team consistency, Improvement graph, Top 3 and the safe PR board", async () => {
    render(<GroupTeamView group={{ id: "g1", group_type: "squad" }} membership={membership} />);
    expect(await screen.findByRole("heading", { name: "Squad View" })).toBeTruthy();
    expect(screen.getByText("Week 3 of 8")).toBeTruthy();
    expect(screen.getByText("83.3%")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Team Improvement graph" })).toBeTruthy();
    expect(screen.getByText("Top 3 Spotlight")).toBeTruthy();

    const prTable = screen.getByRole("table", { name: "Squad PR board" });
    expect(within(prTable).getByText("WS10 · You")).toBeTruthy();
    expect(within(prTable).getByText("2 PRs")).toBeTruthy();
    expect(within(prTable).getByText("No new PR yet")).toBeTruthy();
    expect(loadGroupTeamPrBoard).toHaveBeenCalledWith("g1", "m2");
  });

  it("keeps Top 3 metrics independent", async () => {
    render(<GroupTeamView group={{ id: "g1", group_type: "squad" }} membership={membership} />);
    await screen.findByRole("heading", { name: "Squad View" });
    fireEvent.click(screen.getByRole("button", { name: "Improvement" }));
    const spotlight = screen.getByLabelText("Team improvement Top 3");
    expect(within(spotlight).getByText("+6.0%")).toBeTruthy();
    expect(within(spotlight).getByText("+2.0%")).toBeTruthy();
  });

  it("uses Club language for Club Groups", async () => {
    loadGroupTeamPrBoard.mockResolvedValue({ data: { ...prPayload(), groupType: "club" }, error: null });
    render(<GroupTeamView group={{ id: "g2", group_type: "club" }} membership={membership} />);
    expect(await screen.findByRole("heading", { name: "Club View" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Club PR board" })).toBeTruthy();
  });

  it("does not turn private Groups into team mode or make team-performance calls", () => {
    const { container } = render(<GroupTeamView group={{ id: "g3", group_type: "private" }} membership={membership} />);
    expect(container.innerHTML).toBe("");
    expect(loadGroupSeasonsAwards).not.toHaveBeenCalled();
    expect(loadGroupImprovementLeaderboard).not.toHaveBeenCalled();
    expect(loadGroupTeamPrBoard).not.toHaveBeenCalled();
  });

  it("reports a team-performance loader failure without exposing raw data", async () => {
    loadGroupTeamPrBoard.mockResolvedValue({ data: null, error: new Error("PR service down") });
    render(<GroupTeamView group={{ id: "g1", group_type: "squad" }} membership={membership} />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("PR service down");
    expect(screen.queryByText(/squat/i)).toBeNull();
  });
});
