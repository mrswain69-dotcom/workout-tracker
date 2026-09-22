import fs from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildXpDebugRows,
  sumXpRowsInRange,
} from "../engine/xpEngine.js";

describe("XP Classification & Group Integrity release contract", () => {
  it("separates Earned XP from reward Bonus XP while preserving Total XP", () => {
    const plan = {
      meta: {
        claimedRewards: [
          { key: "sport_avatar_football_bronze", claimedAtYmd: "2026-09-21" },
        ],
      },
    };
    const records = [{
      date_ymd: "2026-09-21",
      log: {
        blocks: [{
          id: "strength",
          typeId: "strength",
          movements: [{ id: "squat" }],
          sets: { squat: [{ reps: 10 }] },
        }],
      },
    }];

    const rows = buildXpDebugRows(records, plan, { todayYmd: "2026-09-21" });
    const row = rows.find((item) => item.date === "2026-09-21");

    expect(row.earnedXp).toBeGreaterThan(0);
    expect(row.bonusXp).toBe(25);
    expect(row.totalXp).toBe(row.earnedXp + row.bonusXp);
    expect(row.competitionXp).toBe(row.earnedXp);
    expect(
      sumXpRowsInRange(rows, "2026-09-21", "2026-09-21", "", "earnedXp")
    ).toBe(row.earnedXp);
  });

  it("uses Earned XP for Group competition and exposes only opt-in safe evidence", () => {
    const edge = fs.readFileSync(
      new URL("../../supabase/functions/group-xp-leaderboard/index.ts", import.meta.url),
      "utf8"
    );

    expect(edge).toContain('"earnedXp"');
    expect(edge).toContain('score_kind: "earned_xp"');
    expect(edge).toContain("xp_evidence_visible");
    expect(edge).toContain("verificationPct");
    expect(edge).toContain('verified ? "✓ Verified"');
    expect(edge).not.toContain("provider_payload");
    expect(edge).not.toContain("raw_payload");
  });

  it("keeps competition exclusion reversible and separate from personal XP", () => {
    const migration = fs.readFileSync(
      new URL(
        "../../supabase/migrations/20260922143000_xp_classification_group_integrity.sql",
        import.meta.url
      ),
      "utf8"
    );
    const hub = fs.readFileSync(new URL("./GroupHub.jsx", import.meta.url), "utf8");

    expect(migration).toContain("competition_excluded");
    expect(migration).toContain("group_competition_integrity_audit");
    expect(migration).toContain("group_set_competition_exclusion");
    expect(migration).toContain("'restore'");
    expect(hub).toContain("Exclude from competition");
    expect(hub).toContain("Restore to competition");
    expect(hub).toContain("personal XP is unchanged");
  });

  it("applies exclusion to every competitive Group scoring surface", () => {
    const paths = [
      "../../supabase/functions/group-xp-leaderboard/index.ts",
      "../../supabase/functions/group-consistency-leaderboard/index.ts",
      "../../supabase/functions/group-improvement-leaderboard/index.ts",
      "../../supabase/functions/group-seasons-awards/index.ts",
      "../../supabase/functions/group-team-pr-board/index.ts",
    ];

    for (const path of paths) {
      const source = fs.readFileSync(new URL(path, import.meta.url), "utf8");
      expect(source).toContain("competition_excluded");
    }
  });

  it("keeps the Log summary historical and fixes Rewards Info", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain('label="Earned XP"');
    expect(app).toContain("selectedDayBonusXp");
    expect(app).toContain("Total XP added that day");
    expect(app).toContain("workoutStreak?.streakByDate?.[selectedDate]");
    expect(app).toContain("selectedDayProgressComparableCount");
    expect(app).toContain("previous comparable activity");
    expect(app).not.toContain("avatarTier");
    expect(app).toContain("XP avatar packs unlocked");
  });
});
