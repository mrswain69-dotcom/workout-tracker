import { describe, expect, it } from "vitest";
import {
  mergeChallengeXpDebugRows,
  normaliseChallengeXpRewards,
  sumChallengeXpRewards,
} from "./challengeXpEngine.js";

describe("Challenge XP ledger helper", () => {
  const rewards = [
    { challengeId: "c2", awardedOn: "2026-09-20", xpAwarded: 17, title: "Consistency 85" },
    { challenge_id: "c1", awarded_on: "2026-09-14", xp_awarded: 20, title: "Team XP Rhythm" },
  ];

  it("normalises only real dated positive challenge rewards", () => {
    expect(normaliseChallengeXpRewards([...rewards, { challengeId: "bad", awardedOn: "", xpAwarded: 50 }])).toEqual([
      { challengeId: "c1", date: "2026-09-14", xp: 20, title: "Team XP Rhythm" },
      { challengeId: "c2", date: "2026-09-20", xp: 17, title: "Consistency 85" },
    ]);
  });

  it("sums Challenge XP by its real award date", () => {
    expect(sumChallengeXpRewards(rewards)).toBe(37);
    expect(sumChallengeXpRewards(rewards, "2026-09-15", "2026-09-30")).toBe(17);
  });

  it("adds Challenge XP to the visible ledger without changing base XP rows", () => {
    const base = [{ date: "2026-09-20", kind: "blocks", totalXp: 30, runningTotalXp: 30 }];
    const merged = mergeChallengeXpDebugRows(base, rewards);
    expect(base).toEqual([{ date: "2026-09-20", kind: "blocks", totalXp: 30, runningTotalXp: 30 }]);
    expect(merged.map((row) => [row.date, row.kind, row.totalXp])).toEqual([
      ["2026-09-20", "blocks", 30],
      ["2026-09-20", "group_challenge_reward", 17],
      ["2026-09-14", "group_challenge_reward", 20],
    ]);
    expect(merged[0].runningTotalXp).toBe(67);
    expect(merged[2].runningTotalXp).toBe(20);
  });
});
