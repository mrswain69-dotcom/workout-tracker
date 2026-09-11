// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("./groupChallengeDb.js", () => ({
  loadGroupChallenges: vi.fn(),
  createGroupChallenge: vi.fn(),
  cancelGroupChallenge: vi.fn(),
}));

import GroupChallenges from "./GroupChallenges.jsx";
import * as db from "./groupChallengeDb.js";

const group = { id: "g1", name: "Falcons", group_type: "squad" };
const membership = { id: "m1", role: "admin" };

function payload(overrides = {}) {
  return {
    rulesVersion: 1,
    maxOpenChallenges: 3,
    teamBadge: { key: "group_challenges_10", title: "Challenge Unit", completedChallenges: 4, target: 10, unlocked: false },
    challenges: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.loadGroupChallenges.mockResolvedValue({ data: payload(), error: null });
  db.createGroupChallenge.mockResolvedValue({ data: { challenge: { id: "c-new" } }, error: null });
  db.cancelGroupChallenge.mockResolvedValue({ data: { ok: true }, error: null });
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Private Group Challenges", () => {
  it("shows collective privacy framing and the team completion badge", async () => {
    render(<GroupChallenges group={group} membership={membership} isAdmin />);
    expect(await screen.findByText("Challenge Unit")).toBeTruthy();
    expect(screen.getByText("4 / 10")).toBeTruthy();
    expect(screen.getByText(/No feed, no public ranking/)).toBeTruthy();
  });

  it("lets an Admin create only a controlled template, duration and start date", async () => {
    render(<GroupChallenges group={group} membership={membership} isAdmin />);
    await screen.findByText("Challenge Unit");
    fireEvent.change(screen.getByLabelText("Goal"), { target: { value: "consistency_85" } });
    fireEvent.change(screen.getByLabelText("Duration"), { target: { value: "28" } });
    const start = screen.getByLabelText("Starts");
    const date = start.min;
    fireEvent.change(start, { target: { value: date } });
    fireEvent.click(screen.getByRole("button", { name: "Create challenge" }));

    await waitFor(() => expect(db.createGroupChallenge).toHaveBeenCalledWith("g1", "m1", {
      templateKey: "consistency_85",
      durationDays: 28,
      startDate: date,
    }));
    const args = db.createGroupChallenge.mock.calls[0][2];
    expect(args).not.toHaveProperty("targetValue");
    expect(args).not.toHaveProperty("rewardPoolXp");
  });

  it("shows live aggregate evidence without exposing private athlete performance details", async () => {
    db.loadGroupChallenges.mockResolvedValue({
      data: payload({
        challenges: [{
          id: "c1",
          title: "Consistency 85",
          description: "Complete the plan.",
          metricType: "consistency",
          targetValue: 85,
          targetUnit: "pct",
          startDate: "2026-09-01",
          endDate: "2026-09-14",
          durationDays: 14,
          rewardPoolXp: 60,
          state: "live",
          currentValue: 80,
          progressPct: 94.1,
          evidence: { completedDays: 8, plannedDays: 10, contributingAthletes: 2 },
        }],
      }),
      error: null,
    });
    render(<GroupChallenges group={group} membership={membership} isAdmin={false} />);
    expect(await screen.findByText("8 / 10 planned days completed")).toBeTruthy();
    expect(screen.queryByText(/profile_id/i)).toBeNull();
    expect(screen.queryByText(/body_weight/i)).toBeNull();
    expect(screen.queryByRole("button", { name: "Create challenge" })).toBeNull();
  });

  it("shows completed challenge reward distribution as a shared team result", async () => {
    db.loadGroupChallenges.mockResolvedValue({
      data: payload({
        challenges: [{
          id: "c2",
          title: "Team Progress +5",
          description: "Improve together.",
          metricType: "improvement",
          targetValue: 5,
          startDate: "2026-08-01",
          endDate: "2026-08-28",
          durationDays: 28,
          rewardPoolXp: 80,
          state: "completed",
          currentValue: 5.6,
          progressPct: 100,
          evidence: { scoredAthletes: 3 },
          rewardSummary: { distributedXp: 80, recipients: 3 },
        }],
      }),
      error: null,
    });
    render(<GroupChallenges group={group} membership={membership} isAdmin />);
    expect(await screen.findByText(/80 XP shared across 3 contributing athletes/)).toBeTruthy();
  });

  it("allows an Admin to cancel an open challenge but keeps history server-owned", async () => {
    db.loadGroupChallenges.mockResolvedValue({
      data: payload({
        challenges: [{
          id: "c3",
          title: "Team XP Rhythm",
          description: "Build rhythm.",
          metricType: "xp_rate",
          targetValue: 100,
          startDate: "2099-09-01",
          endDate: "2099-09-14",
          durationDays: 14,
          rewardPoolXp: 30,
          state: "scheduled",
          currentValue: null,
          progressPct: null,
          evidence: {},
        }],
      }),
      error: null,
    });
    render(<GroupChallenges group={group} membership={membership} isAdmin />);
    fireEvent.click(await screen.findByRole("button", { name: "Cancel challenge" }));
    await waitFor(() => expect(db.cancelGroupChallenge).toHaveBeenCalledWith("g1", "m1", "c3"));
  });
});
