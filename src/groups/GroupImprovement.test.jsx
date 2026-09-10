// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupDb", () => ({
  loadGroupImprovementLeaderboard: vi.fn(),
}));

import GroupImprovement from "./GroupImprovement.jsx";
import { loadGroupImprovementLeaderboard } from "./groupDb";

const group = { id: "group-1", name: "Falcons" };
const membership = { id: "member-self", nickname: "WS10" };

function data() {
  return {
    scoreVersion: 1,
    baselineDays: 28,
    current: {
      startDate: "2026-09-07",
      endDate: "2026-09-13",
      state: "live",
      available: true,
      rows: [
        { membership_id: "other", nickname: "Rocket", rank: 1, improvementPct: 8.4, metricCount: 2, improvedMetricCount: 2, declinedMetricCount: 0, unchangedMetricCount: 0, scoreState: "scored", avatar_id: "emoji_tiger", avatar_frame: "", avatar_frames_enabled: true },
        { membership_id: "member-self", nickname: "WS10", rank: 2, improvementPct: 4.2, metricCount: 3, improvedMetricCount: 2, declinedMetricCount: 1, unchangedMetricCount: 0, scoreState: "scored", avatar_id: "emoji_bolt", avatar_frame: "prestige_cyan_gold", avatar_frames_enabled: true },
        { membership_id: "waiting", nickname: "Baseline", rank: null, improvementPct: null, metricCount: 0, scoreState: "no_comparable_baseline", avatar_id: "", avatar_frame: "", avatar_frames_enabled: true },
      ],
    },
    history: [{
      startDate: "2026-08-31",
      endDate: "2026-09-06",
      state: "frozen",
      available: true,
      rows: [{ membership_id: "member-self", nickname: "WS10", rank: 1, improvementPct: 6.1, metricCount: 1, improvedMetricCount: 1, declinedMetricCount: 0, unchangedMetricCount: 0, scoreState: "scored" }],
    }],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  loadGroupImprovementLeaderboard.mockResolvedValue({ data: data(), error: null });
});

afterEach(() => cleanup());

describe("GroupImprovement", () => {
  it("renders self-vs-self standings with safe Group identity and evidence counts", async () => {
    render(<GroupImprovement group={group} membership={membership} />);
    expect(await screen.findByText("Improvement")).toBeTruthy();
    expect(screen.getByText("+4.2%")).toBeTruthy();
    expect(screen.getByText("WS10 · You")).toBeTruthy();
    expect(screen.getByText(/3 comparable metrics · 2 up · 1 down/)).toBeTruthy();
    expect(screen.getByText(/No matching 4-week baseline yet/)).toBeTruthy();
    expect(loadGroupImprovementLeaderboard).toHaveBeenCalledWith("group-1", "member-self");
  });

  it("shows completed history as final standings", async () => {
    render(<GroupImprovement group={group} membership={membership} />);
    await screen.findByText("+4.2%");
    fireEvent.click(screen.getByRole("button", { name: "Last 4 weeks" }));
    expect(await screen.findByText("+6.1%")).toBeTruthy();
    expect(screen.getByText("Final standings")).toBeTruthy();
  });

  it("does not create a podium for athletes without a comparable score", async () => {
    const empty = data();
    empty.current.rows = [{ membership_id: "member-self", nickname: "WS10", rank: null, improvementPct: null, metricCount: 0, scoreState: "no_current_performance" }];
    loadGroupImprovementLeaderboard.mockResolvedValue({ data: empty, error: null });
    render(<GroupImprovement group={group} membership={membership} />);
    expect(await screen.findByText("No comparable performance recorded this week")).toBeTruthy();
    expect(screen.queryByLabelText("Improvement Top 3")).toBeNull();
  });

  it("shows failures deliberately rather than hiding the leaderboard", async () => {
    loadGroupImprovementLeaderboard.mockResolvedValue({ data: null, error: new Error("network down") });
    render(<GroupImprovement group={group} membership={membership} />);
    expect(await screen.findByRole("alert")).toHaveTextContent("network down");
  });

  it("refreshes through the authenticated server loader", async () => {
    render(<GroupImprovement group={group} membership={membership} />);
    await screen.findByText("+4.2%");
    fireEvent.click(screen.getByRole("button", { name: "Refresh Improvement" }));
    await waitFor(() => expect(loadGroupImprovementLeaderboard).toHaveBeenCalledTimes(2));
  });
});
