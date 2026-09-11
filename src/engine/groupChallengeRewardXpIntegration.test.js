import { describe, expect, it } from "vitest";
import { buildXpDebugRows, computeXpFromLogs, sumXpRowsInRange } from "./xpEngine.js";
import {
  buildGroupChallengeTrainingXpRows,
  sumGroupChallengeTrainingXp,
} from "./groupChallengeXpEngine.js";

function rewardPlan(rewards) {
  return {
    meta: { groupChallengeRewards: rewards },
    blocksByWeekday: {},
  };
}

describe("Stage 8 Group Challenge reward XP integration", () => {
  it("counts a server-mirrored Challenge reward even when the athlete has no workout logs", () => {
    const plan = rewardPlan([
      { challengeId: "challenge-1", awardedOn: "2026-09-11", xpAwarded: 20 },
    ]);

    const rows = buildXpDebugRows([], plan);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      date: "2026-09-11",
      kind: "group_challenge_reward",
      totalXp: 20,
      challengeRewardXp: 20,
    });
    expect(computeXpFromLogs([], plan)).toBe(20);
  });

  it("deduplicates the same challenge/date mirror and clamps a single award to the server cap", () => {
    const plan = rewardPlan([
      { challengeId: "challenge-1", awardedOn: "2026-09-11", xpAwarded: 30 },
      { challengeId: "challenge-1", awardedOn: "2026-09-11", xpAwarded: 30 },
      { challengeId: "challenge-2", awardedOn: "2026-09-11", xpAwarded: 999 },
      { challengeId: "challenge-3", awardedOn: "bad-date", xpAwarded: 20 },
    ]);

    expect(computeXpFromLogs([], plan)).toBe(60);
  });

  it("credits Challenge XP on its actual award date in Weekly/period range sums", () => {
    const plan = rewardPlan([
      { challengeId: "challenge-1", awardedOn: "2026-09-14", xpAwarded: 25 },
    ]);
    const rows = buildXpDebugRows([], plan);

    expect(sumXpRowsInRange(rows, "2026-09-07", "2026-09-13")).toBe(0);
    expect(sumXpRowsInRange(rows, "2026-09-14", "2026-09-20")).toBe(25);
  });

  it("does not feed Challenge reward XP back into an XP-rate challenge score", () => {
    const plan = rewardPlan([
      { challengeId: "previous-challenge", awardedOn: "2026-09-11", xpAwarded: 30 },
    ]);

    const canonicalRows = buildXpDebugRows([], plan);
    const challengeRows = buildGroupChallengeTrainingXpRows([], plan);

    expect(canonicalRows.reduce((sum, row) => sum + row.totalXp, 0)).toBe(30);
    expect(sumGroupChallengeTrainingXp(challengeRows, "2026-09-01", "2026-09-30")).toBe(0);
  });
});
