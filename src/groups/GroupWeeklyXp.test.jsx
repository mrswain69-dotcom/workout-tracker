import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  loadGroupXpLeaderboard: vi.fn(),
  updateGroupXpHistoryScope: vi.fn(),
}));

import { loadGroupXpLeaderboard, updateGroupXpHistoryScope } from "./groupDb";
import GroupWeeklyXp from "./GroupWeeklyXp";

const group = {
  id: "group-1",
  name: "Performance Squad",
  competition_start_date: "2026-09-10",
  xp_history_scope: "group_start",
};
const membership = { id: "m2", nickname: "WS10", role: "member" };

function payload() {
  return {
    scoreVersion: 1,
    scopeMode: "group_start",
    competitionStartDate: "2026-09-10",
    current: {
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      state: "live",
      available: true,
      rows: [
        { membership_id: "m1", nickname: "Rocket", xp: 170, rank: 1, avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
        { membership_id: "m2", nickname: "WS10", xp: 140, rank: 2, avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
        { membership_id: "m3", nickname: "Keeper", xp: 110, rank: 3, avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
        { membership_id: "m4", nickname: "Ace", xp: 90, rank: 4, avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
      ],
    },
    history: [
      {
        startDate: "2026-08-31", endDate: "2026-09-06", state: "not_started", available: false, rows: [],
      },
      {
        startDate: "2026-08-24", endDate: "2026-08-30", state: "not_started", available: false, rows: [],
      },
      {
        startDate: "2026-08-17", endDate: "2026-08-23", state: "not_started", available: false, rows: [],
      },
      {
        startDate: "2026-08-10", endDate: "2026-08-16", state: "not_started", available: false, rows: [],
      },
    ],
  };
}

describe("GroupWeeklyXp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadGroupXpLeaderboard.mockResolvedValue({ data: payload(), error: null });
    updateGroupXpHistoryScope.mockResolvedValue({ data: { xp_history_scope: "all_history" }, error: null });
  });

  it("uses This week as the standard leaderboard view with safe pseudonyms", async () => {
    render(<GroupWeeklyXp group={group} membership={membership} />);
    expect(await screen.findByText("Weekly XP")).toBeTruthy();
    expect(screen.getByRole("button", { name: "This week" }).className).toContain("active");
    expect(await screen.findAllByText(/WS10/)).not.toHaveLength(0);
    expect(screen.getByText("170 XP")).toBeTruthy();
    expect(loadGroupXpLeaderboard).toHaveBeenCalledWith("group-1", "m2");
  });

  it("shows Top 3 and emphasizes self plus the rows immediately around self", async () => {
    const { container } = render(<GroupWeeklyXp group={group} membership={membership} />);
    await screen.findByLabelText("Weekly XP Top 3");
    expect(container.querySelectorAll(".groupXpPodium")).toHaveLength(3);
    expect(container.querySelectorAll(".groupXpStandingRow.self")).toHaveLength(1);
    expect(container.querySelectorAll(".groupXpStandingRow.neighbour")).toHaveLength(2);
  });

  it("opens four completed week choices under Last 4 weeks", async () => {
    render(<GroupWeeklyXp group={group} membership={membership} />);
    await screen.findByText("Weekly XP");
    fireEvent.click(screen.getByRole("button", { name: "Last 4 weeks" }));
    const picker = screen.getByRole("group", { name: "Choose completed week" });
    expect(picker.querySelectorAll("button")).toHaveLength(4);
    expect(screen.getByText("This Group had not started yet.")).toBeTruthy();
  });

  it("shows the Admin history-scope control only to Admins", async () => {
    const { rerender } = render(<GroupWeeklyXp group={group} membership={membership} isAdmin={false} />);
    await screen.findByText("Weekly XP");
    expect(screen.queryByRole("group", { name: "Weekly XP history setting" })).toBeNull();

    rerender(<GroupWeeklyXp group={group} membership={membership} isAdmin />);
    const settings = await screen.findByRole("group", { name: "Weekly XP history setting" });
    expect(settings).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "All eligible history" }));
    await waitFor(() => expect(updateGroupXpHistoryScope).toHaveBeenCalledWith("group-1", "all_history"));
  });
});
