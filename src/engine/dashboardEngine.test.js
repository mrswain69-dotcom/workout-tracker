import { describe, expect, it } from "vitest";
import {
  buildDashboardCoachInsight,
  buildDashboardWeekSummary,
  getNextAvatarReward,
} from "./dashboardEngine.js";

describe("dashboard engine", () => {
  it("makes current-week XP primary without losing completed/recovery-day context", () => {
    const result = buildDashboardWeekSummary({
      referenceDate: "2026-09-18",
      xpRows: [
        { date: "2026-09-14", totalXp: 20, complete: true },
        { date: "2026-09-16", totalXp: 15, complete: true },
        { date: "2026-09-18", totalXp: 10, complete: false },
        { date: "2026-09-10", totalXp: 99, complete: true },
      ],
      logs: [
        { date_ymd: "2026-09-16", log: { meta: { profileRecoveryMode: "injury" } } },
        { date_ymd: "2026-09-18", log: {} },
      ],
    });

    expect(result.startDate).toBe("2026-09-14");
    expect(result.xp).toBe(45);
    expect(result.completedDays).toBe(2);
    expect(result.activeDays).toBe(3);
    expect(result.recoveryDays).toBe(1);
    expect(result.bestXpDay).toEqual({ date: "2026-09-14", xp: 20 });
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
