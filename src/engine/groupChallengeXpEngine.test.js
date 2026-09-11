import { describe, expect, it } from "vitest";
import { buildXpDebugRows } from "./xpEngine.js";
import {
  buildGroupChallengeTrainingXpRows,
  sumGroupChallengeTrainingXp,
} from "./groupChallengeXpEngine.js";

describe("Group Challenge training XP", () => {
  const plan = {
    blocksByWeekday: {
      Mon: [{ id: "tasks-1", typeId: "tasks", tasks: [{ id: "read", xpValue: 7 }] }],
    },
    meta: {
      claimedRewards: [{ key: "badge_early_1", claimedAtYmd: "2026-09-15" }],
    },
  };

  const records = [
    {
      date_ymd: "2026-09-14",
      log: {
        blocks: [
          {
            id: "strength-1",
            typeId: "strength",
            movements: [{ id: "squat" }],
            sets: { squat: [{ reps: 10, weight: 10 }] },
          },
          { id: "tasks-1", typeId: "tasks", tasksDone: { read: true } },
        ],
      },
    },
    {
      date_ymd: "2026-09-15",
      log: {
        meta: { challengeClaimed: true },
        blocks: [
          {
            id: "strength-1",
            typeId: "strength",
            movements: [{ id: "squat" }],
            sets: { squat: [{ reps: 12, weight: 10 }] },
          },
        ],
      },
    },
  ];

  it("matches canonical XP after intentionally removing badge and challenge bonus XP", () => {
    const canonical = buildXpDebugRows(records, plan);
    const expected = canonical.reduce(
      (sum, row) => sum + row.totalXp - (row.badgeClaimXp || 0) - (row.dailyBonusXp || 0),
      0
    );
    const challengeRows = buildGroupChallengeTrainingXpRows(records, plan);
    expect(challengeRows.reduce((sum, row) => sum + row.totalXp, 0)).toBe(expected);
  });

  it("scores only the requested challenge window while retaining historical context for progression", () => {
    const rows = buildGroupChallengeTrainingXpRows(records, plan);
    const dayTwo = rows.find((row) => row.date === "2026-09-15");
    expect(sumGroupChallengeTrainingXp(rows, "2026-09-15", "2026-09-15")).toBe(dayTwo.totalXp);
    expect(dayTwo.totalXp).toBeGreaterThan(0);
  });
});
