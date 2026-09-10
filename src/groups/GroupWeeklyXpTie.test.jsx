// @vitest-environment jsdom
import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  loadGroupXpLeaderboard: vi.fn().mockResolvedValue({
    data: {
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
          { membership_id: "m4", nickname: "Ace", xp: 110, rank: 3, avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
        ],
      },
      history: [],
    },
    error: null,
  }),
  updateGroupXpHistoryScope: vi.fn(),
}));

import GroupWeeklyXp from "./GroupWeeklyXp";

afterEach(() => cleanup());

describe("GroupWeeklyXp tied Top 3", () => {
  it("keeps every athlete whose competition rank is 3 when rank 3 is tied", async () => {
    const { container } = render(
      <GroupWeeklyXp
        group={{ id: "group-1", competition_start_date: "2026-09-10", xp_history_scope: "group_start" }}
        membership={{ id: "m2", nickname: "WS10", role: "member" }}
      />
    );

    await screen.findByLabelText("Weekly XP Top 3");
    expect(container.querySelectorAll(".groupXpPodium")).toHaveLength(4);
    expect(screen.getAllByText("110 XP")).toHaveLength(4);
  });
});
