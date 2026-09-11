import { describe, expect, it } from "vitest";
import {
  GROUP_SEASON_DAYS,
  addGroupPeriodRanks,
  buildGroupProgressAwards,
  getCurrentGroupSeasonWindow,
  getGroupMonthWindow,
  getGroupSeasonAnchorYmd,
  getPreviousCompletedGroupMonthWindows,
  getPreviousCompletedGroupSeasonWindows,
  rankGroupPeriodMetric,
} from "./groupPeriodEngine.js";

describe("Group period engine", () => {
  it("uses calendar months rather than rolling 30-day windows", () => {
    expect(getGroupMonthWindow("2026-09-11")).toEqual({
      key: "2026-09",
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      complete: false,
    });
    expect(getPreviousCompletedGroupMonthWindows("2026-09-11", 2)).toEqual([
      { key: "2026-08", startDate: "2026-08-01", endDate: "2026-08-31", complete: true },
      { key: "2026-07", startDate: "2026-07-01", endDate: "2026-07-31", complete: true },
    ]);
  });

  it("anchors eight-week seasons to the Monday of the Group competition-start week", () => {
    expect(getGroupSeasonAnchorYmd("2026-09-10")).toBe("2026-09-07");
    expect(GROUP_SEASON_DAYS).toBe(56);
    expect(getCurrentGroupSeasonWindow("2026-09-10", "2026-09-11")).toEqual({
      key: "season-1",
      seasonNumber: 1,
      startDate: "2026-09-07",
      endDate: "2026-11-01",
      weekNumber: 1,
      complete: false,
    });
  });

  it("advances seasons in exact 56-day Monday-Sunday blocks", () => {
    expect(getCurrentGroupSeasonWindow("2026-09-10", "2026-11-02")).toMatchObject({
      seasonNumber: 2,
      startDate: "2026-11-02",
      endDate: "2026-12-27",
      weekNumber: 1,
    });
    expect(getPreviousCompletedGroupSeasonWindows("2026-09-10", "2026-11-02", 2)).toEqual([
      {
        key: "season-1",
        seasonNumber: 1,
        startDate: "2026-09-07",
        endDate: "2026-11-01",
        weekNumber: 8,
        complete: true,
      },
    ]);
  });

  it("ranks each long-cycle metric independently and preserves genuine ties", () => {
    const rows = [
      { membership_id: "a", nickname: "Alpha", xp: 100, plannedDays: 4, consistencyPct: 75, improvementPct: 5, improvementMetricCount: 2 },
      { membership_id: "b", nickname: "Beta", xp: 100, plannedDays: 5, consistencyPct: 80, improvementPct: 5, improvementMetricCount: 1 },
      { membership_id: "c", nickname: "Charlie", xp: 50, plannedDays: 4, consistencyPct: 80, improvementPct: null, improvementMetricCount: 0 },
    ];
    expect(rankGroupPeriodMetric(rows, "xp").map((row) => row.rank)).toEqual([1, 1, 3]);
    const ranked = addGroupPeriodRanks(rows);
    expect(ranked.find((row) => row.membership_id === "a")).toMatchObject({ xpRank: 1, consistencyRank: 3, improvementRank: 1 });
    expect(ranked.find((row) => row.membership_id === "b")).toMatchObject({ xpRank: 1, consistencyRank: 1, improvementRank: 1 });
    expect(ranked.find((row) => row.membership_id === "c")).toMatchObject({ xpRank: 3, consistencyRank: 1, improvementRank: null });
  });

  it("does not rank missing Improvement as zero", () => {
    const rows = rankGroupPeriodMetric([
      { membership_id: "a", nickname: "Decline", improvementPct: -4, improvementMetricCount: 2 },
      { membership_id: "b", nickname: "Missing", improvementPct: null, improvementMetricCount: 0 },
    ], "improvement");
    expect(rows.map((row) => [row.membership_id, row.rank])).toEqual([["a", 1], ["b", null]]);
  });

  it("creates joint completed-month winners but never awards a zero-XP month", () => {
    const awards = buildGroupProgressAwards({
      periodType: "month",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      state: "frozen",
      rows: [
        { membership_id: "a", nickname: "Alpha", xp: 200, plannedDays: 4, consistencyPct: 75, improvementPct: 5, improvementMetricCount: 2 },
        { membership_id: "b", nickname: "Beta", xp: 200, plannedDays: 4, consistencyPct: 100, improvementPct: 5, improvementMetricCount: 2 },
      ],
    });
    expect(awards.filter((award) => award.awardType === "monthly_xp")).toHaveLength(2);
    expect(awards.filter((award) => award.awardType === "monthly_improvement")).toHaveLength(2);
    expect(awards.filter((award) => award.awardType === "monthly_consistency")).toHaveLength(1);

    expect(buildGroupProgressAwards({
      periodType: "month",
      periodStart: "2026-08-01",
      periodEnd: "2026-08-31",
      state: "frozen",
      rows: [{ membership_id: "z", nickname: "Zero", xp: 0, plannedDays: 0, consistencyPct: null, improvementPct: null, improvementMetricCount: 0 }],
    })).toEqual([]);
  });

  it("awards Season Finisher only after a completed season and only with participation evidence", () => {
    const live = buildGroupProgressAwards({
      periodType: "season",
      periodStart: "2026-09-07",
      periodEnd: "2026-11-01",
      seasonNumber: 1,
      state: "live",
      rows: [{ membership_id: "a", nickname: "Alpha", xp: 100 }],
    });
    expect(live).toEqual([]);

    const frozen = buildGroupProgressAwards({
      periodType: "season",
      periodStart: "2026-09-07",
      periodEnd: "2026-11-01",
      seasonNumber: 1,
      state: "frozen",
      rows: [
        { membership_id: "a", nickname: "Alpha", xp: 100, plannedDays: 4, completedDays: 3, consistencyPct: 75, improvementPct: 5, improvementMetricCount: 2 },
        { membership_id: "b", nickname: "No Show", xp: 0, plannedDays: 4, completedDays: 0, consistencyPct: 0, improvementPct: null, improvementMetricCount: 0 },
      ],
    });
    expect(frozen.some((award) => award.awardType === "season_finisher" && award.membership_id === "a")).toBe(true);
    expect(frozen.some((award) => award.awardType === "season_finisher" && award.membership_id === "b")).toBe(false);
  });
});
