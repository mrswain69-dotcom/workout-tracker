import { describe, expect, it } from "vitest";
import {
  GROUP_CHALLENGE_DURATIONS,
  GROUP_CHALLENGE_MAX_REWARD_PER_ATHLETE,
  GROUP_CHALLENGE_TEMPLATES,
  allocateGroupChallengeRewards,
  buildConsistencyChallengeScore,
  buildGroupChallengeDefinition,
  buildImprovementChallengeScore,
  buildXpRateChallengeScore,
  calculateGroupChallengeRewardPool,
  evaluateGroupChallenge,
  groupChallengeDisplayState,
} from "./groupChallengeEngine.js";

describe("Group Challenge engine", () => {
  it("offers only controlled templates and bounded durations", () => {
    expect(GROUP_CHALLENGE_DURATIONS).toEqual([7, 14, 28, 42]);
    expect(GROUP_CHALLENGE_TEMPLATES).toHaveLength(9);
    expect(GROUP_CHALLENGE_TEMPLATES.map((item) => item.metricType)).toEqual(
      expect.arrayContaining(["xp_rate", "consistency", "improvement"])
    );
    expect(buildGroupChallengeDefinition({ templateKey: "xp_175", durationDays: 14, startDate: "2026-09-14" })).toMatchObject({
      metricType: "xp_rate",
      targetValue: 175,
      startDate: "2026-09-14",
      endDate: "2026-09-27",
      rewardPoolXp: 60,
    });
    expect(buildGroupChallengeDefinition({ templateKey: "xp_175", durationDays: 365, startDate: "2026-09-14" })).toBeNull();
    expect(calculateGroupChallengeRewardPool("improvement_8", 42)).toBe(150);
  });

  it("normalises XP by eligible athlete-days so group size does not create an advantage", () => {
    const twoAthletes = buildXpRateChallengeScore([
      { membership_id: "a", xp: 200, eligibleDays: 14 },
      { membership_id: "b", xp: 200, eligibleDays: 14 },
    ]);
    const fourAthletes = buildXpRateChallengeScore([
      { membership_id: "a", xp: 200, eligibleDays: 14 },
      { membership_id: "b", xp: 200, eligibleDays: 14 },
      { membership_id: "c", xp: 200, eligibleDays: 14 },
      { membership_id: "d", xp: 200, eligibleDays: 14 },
    ]);
    expect(twoAthletes.value).toBe(100);
    expect(fourAthletes.value).toBe(100);
  });

  it("builds Team Consistency from the real denominator rather than averaging athlete percentages", () => {
    const score = buildConsistencyChallengeScore([
      { membership_id: "a", plannedDays: 1, completedDays: 1, consistencyState: "scored" },
      { membership_id: "b", plannedDays: 9, completedDays: 4, consistencyState: "scored" },
    ]);
    expect(score.plannedDays).toBe(10);
    expect(score.completedDays).toBe(5);
    expect(score.value).toBe(50);
  });

  it("fails Consistency closed when schedule truth is unavailable", () => {
    const score = buildConsistencyChallengeScore([
      { membership_id: "a", plannedDays: 3, completedDays: 3, consistencyState: "scored" },
      { membership_id: "b", plannedDays: 0, completedDays: 0, consistencyState: "schedule_unavailable" },
    ]);
    expect(score.available).toBe(false);
    expect(score.reason).toBe("schedule_unavailable");
    expect(score.value).toBeNull();
  });

  it("weights each athlete Improvement score once and excludes unscored athletes rather than treating them as zero", () => {
    const score = buildImprovementChallengeScore([
      { membership_id: "a", improvementPct: 8, metricCount: 8 },
      { membership_id: "b", improvementPct: 2, metricCount: 1 },
      { membership_id: "c", improvementPct: null, metricCount: 0 },
    ]);
    expect(score.value).toBe(5);
    expect(score.scoredAthletes).toBe(2);
    expect(score.contributors).toEqual(["a", "b"]);
  });

  it("evaluates progress without turning missing evidence into a fake zero score", () => {
    expect(evaluateGroupChallenge({
      metricType: "improvement",
      targetValue: 5,
      rows: [{ membership_id: "a", improvementPct: 6, metricCount: 2 }],
    })).toMatchObject({ achieved: true, progressPct: 100, value: 6 });

    expect(evaluateGroupChallenge({
      metricType: "improvement",
      targetValue: 5,
      rows: [{ membership_id: "a", improvementPct: null, metricCount: 0 }],
    })).toMatchObject({ achieved: false, progressPct: null, value: null, available: false });
  });

  it("allocates one controlled shared reward pool deterministically with a hard per-athlete cap", () => {
    const split = allocateGroupChallengeRewards(50, ["c", "a", "b", "b"]);
    expect(split.allocations).toEqual([
      { membershipId: "a", xp: 17 },
      { membershipId: "b", xp: 17 },
      { membershipId: "c", xp: 16 },
    ]);
    expect(split.distributedXp).toBe(50);
    expect(split.unusedXp).toBe(0);

    const capped = allocateGroupChallengeRewards(150, ["a", "b"]);
    expect(capped.allocations.every((row) => row.xp <= GROUP_CHALLENGE_MAX_REWARD_PER_ATHLETE)).toBe(true);
    expect(capped.distributedXp).toBe(60);
    expect(capped.unusedXp).toBe(90);
  });

  it("keeps scheduled, live, final and cancelled challenge states explicit", () => {
    const challenge = { start_date: "2026-09-14", end_date: "2026-09-27" };
    expect(groupChallengeDisplayState(challenge, "2026-09-13")).toBe("scheduled");
    expect(groupChallengeDisplayState(challenge, "2026-09-20")).toBe("live");
    expect(groupChallengeDisplayState(challenge, "2026-09-28")).toBe("awaiting_finalization");
    expect(groupChallengeDisplayState({ ...challenge, outcome: "completed" }, "2026-09-28")).toBe("completed");
    expect(groupChallengeDisplayState({ ...challenge, cancelled_at: "2026-09-15T10:00:00Z" }, "2026-09-20")).toBe("cancelled");
  });
});
