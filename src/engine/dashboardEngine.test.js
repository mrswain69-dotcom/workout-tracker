import { describe, expect, it } from "vitest";
import {
  buildDashboardCoachInsight,
  buildDashboardWeekSummary,
  buildRewardsRoadmap,
  getNextAvatarReward,
} from "./dashboardEngine.js";

describe("dashboard engine", () => {
  it("makes current-week XP primary without losing completed/recovery-day context", () => {
    const result = buildDashboardWeekSummary({
      referenceDate: "2026-09-18",
      xpRows: [
        { date: "2026-09-14", totalXp: 25, earnedXp: 20, bonusXp: 5, complete: true },
        { date: "2026-09-16", totalXp: 15, earnedXp: 15, bonusXp: 0, complete: true },
        { date: "2026-09-18", totalXp: 10, earnedXp: 10, bonusXp: 0, complete: false },
        { date: "2026-09-10", totalXp: 99, earnedXp: 99, bonusXp: 0, complete: true },
      ],
      logs: [
        { date_ymd: "2026-09-16", log: { meta: { profileRecoveryMode: "injury" } } },
        { date_ymd: "2026-09-18", log: {} },
      ],
    });

    expect(result.startDate).toBe("2026-09-14");
    expect(result.xp).toBe(45);
    expect(result.earnedXp).toBe(45);
    expect(result.bonusXp).toBe(5);
    expect(result.totalXp).toBe(50);
    expect(result.completedDays).toBe(2);
    expect(result.activeDays).toBe(3);
    expect(result.recoveryDays).toBe(1);
    expect(result.bestXpDay).toEqual({ date: "2026-09-14", xp: 20 });
  });

  it("does not turn reward-only Bonus XP into an active training day", () => {
    const result = buildDashboardWeekSummary({
      referenceDate: "2026-09-18",
      xpRows: [
        { date: "2026-09-18", totalXp: 25, earnedXp: 0, bonusXp: 25, complete: false },
      ],
      logs: [],
    });

    expect(result.earnedXp).toBe(0);
    expect(result.bonusXp).toBe(25);
    expect(result.totalXp).toBe(25);
    expect(result.activeDays).toBe(0);
  });

  it("uses actual configured avatar milestones rather than assuming every 1,000 XP forever", () => {
    expect(
      getNextAvatarReward(10500, [
        { key: "a", title: "10k", unlockAtXp: 10000 },
        { key: "b", title: "12k", unlockAtXp: 12000 },
      ])
    ).toEqual({
      key: "b",
      title: "12k",
      unlockAtXp: 12000,
      remainingXp: 1500,
    });
    expect(getNextAvatarReward(12000, [{ unlockAtXp: 12000 }])).toBeNull();
  });

  it("builds a moving rewards roadmap around the user's current position", () => {
    const result = buildRewardsRoadmap(8657, [
      { key: "p8", title: "Avatar Pack 8 – Apex Beings", unlockAtXp: 8000 },
      { key: "p9", title: "Avatar Pack 9 – Apex Beings 2", unlockAtXp: 9000 },
      { key: "p10", title: "Avatar Pack 10 – Prestige Athlete Archetypes", unlockAtXp: 10000 },
    ]);

    expect(result.currentLevel).toBe(87);
    expect(result.nextLevel).toBe(88);
    expect(result.nextLevelRemainingXp).toBe(43);
    expect(result.unlockedAvatarCount).toBe(1);
    expect(result.nextAvatar).toMatchObject({
      key: "p9",
      packLabel: "Pack 9",
      name: "Apex Beings 2",
      unlockAtXp: 9000,
      remainingXp: 343,
      progressPct: 96.2,
    });
    expect(result.followingAvatar).toMatchObject({
      key: "p10",
      packLabel: "Pack 10",
      name: "Prestige Athlete Archetypes",
      remainingXp: 1343,
    });
  });

  it("makes recovery adherence a first-class coaching message", () => {
    expect(
      buildDashboardCoachInsight({
        recoveryMode: "injury",
        currentStreak: 7,
        weekXp: 40,
      })
    ).toMatchObject({
      title: "Recovery work is today’s training.",
      tone: "recovery",
    });
  });

  it("treats a blank schedule and an unplanned day without guilt", () => {
    expect(buildDashboardCoachInsight({ planIsBlank: true })).toMatchObject({
      title: "Build your first training week.",
      tone: "focus",
    });
    expect(buildDashboardCoachInsight({ todayActionCount: 0 })).toMatchObject({
      title: "Nothing is planned today.",
      tone: "recovery",
    });
  });
});
