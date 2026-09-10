// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  loadGroupConsistencyLeaderboard: vi.fn(),
}));

import { loadGroupConsistencyLeaderboard } from "./groupDb";
import GroupConsistency from "./GroupConsistency";

const group = { id: "g1", competition_start_date: "2026-09-10" };
const membership = { id: "m2", nickname: "WS10" };

function payload() {
  return {
    scoreVersion: 1,
    competitionStartDate: "2026-09-10",
    current: {
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      dueThrough: "2026-09-10",
      state: "live",
      available: true,
      rows: [
        { membership_id: "m1", nickname: "Rocket", rank: 1, plannedDays: 4, completedDays: 4, consistencyPct: 100, scoreState: "scored", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
        { membership_id: "m2", nickname: "WS10", rank: 2, plannedDays: 4, completedDays: 3, consistencyPct: 75, scoreState: "scored", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
        { membership_id: "m3", nickname: "Ace", rank: 3, plannedDays: 3, completedDays: 2, consistencyPct: 66.7, scoreState: "scored", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
        { membership_id: "m4", nickname: "Rest", rank: null, plannedDays: 0, completedDays: 0, consistencyPct: null, scoreState: "no_planned_days", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
      ],
    },
    history: [
      { startDate: "2026-08-31", endDate: "2026-09-06", state: "not_started", available: false, rows: [] },
      { startDate: "2026-08-24", endDate: "2026-08-30", state: "not_started", available: false, rows: [] },
      { startDate: "2026-08-17", endDate: "2026-08-23", state: "not_started", available: false, rows: [] },
      { startDate: "2026-08-10", endDate: "2026-08-16", state: "not_started", available: false, rows: [] },
    ],
  };
}

describe("GroupConsistency", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadGroupConsistencyLeaderboard.mockResolvedValue({ data: payload(), error: null });
  });

  afterEach(() => cleanup());

  it("defaults to this week and explains the truthful planned-day formula", async () => {
    render(<GroupConsistency group={group} membership={membership} />);
    expect(await screen.findByText("Consistency")).toBeTruthy();
    expect(screen.getByText(/Completed planned performance and recovery days ÷ planned days/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "This week" }).className).toContain("active");
    expect(loadGroupConsistencyLeaderboard).toHaveBeenCalledWith("g1", "m2");
    expect(screen.getAllByText(/WS10/).length).toBeGreaterThan(0);
  });

  it("shows percentages and completed-versus-planned evidence without rewarding no-plan days", async () => {
    render(<GroupConsistency group={group} membership={membership} />);
    expect(await screen.findAllByText("75%")).not.toHaveLength(0);
    expect(screen.getAllByText("3 / 4 planned days")).not.toHaveLength(0);
    expect(screen.getByText("No planned days due")).toBeTruthy();
  });

  it("shows Top 3 while emphasizing self and immediate neighbours", async () => {
    const { container } = render(<GroupConsistency group={group} membership={membership} />);
    await screen.findByLabelText("Consistency Top 3");
    expect(container.querySelectorAll(".groupXpPodium")).toHaveLength(3);
    expect(container.querySelectorAll(".groupXpStandingRow.self")).toHaveLength(1);
    expect(container.querySelectorAll(".groupXpStandingRow.neighbour")).toHaveLength(2);
  });

  it("keeps all athletes in a genuine tie spanning rank 3", async () => {
    const tied = payload();
    tied.current.rows = [
      tied.current.rows[0],
      tied.current.rows[1],
      { ...tied.current.rows[2], membership_id: "m3", nickname: "Ace", rank: 3, consistencyPct: 66.7 },
      { ...tied.current.rows[2], membership_id: "m5", nickname: "Bolt", rank: 3, consistencyPct: 66.7 },
    ];
    loadGroupConsistencyLeaderboard.mockResolvedValueOnce({ data: tied, error: null });
    const { container } = render(<GroupConsistency group={group} membership={membership} />);
    await screen.findByLabelText("Consistency Top 3");
    expect(container.querySelectorAll(".groupXpPodium")).toHaveLength(4);
  });

  it("opens the four completed-week history choices", async () => {
    render(<GroupConsistency group={group} membership={membership} />);
    await screen.findByText("Consistency");
    fireEvent.click(screen.getByRole("button", { name: "Last 4 weeks" }));
    const picker = screen.getByRole("group", { name: "Choose Consistency week" });
    expect(picker.querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByText("This Group had not started yet.")).toBeTruthy();
  });

  it("states that tasks and Streak Saver do not count", async () => {
    render(<GroupConsistency group={group} membership={membership} />);
    await screen.findByText("Consistency");
    expect(screen.getByText(/Task-only days and Streak Saver do not count/)).toBeTruthy();
  });
});
