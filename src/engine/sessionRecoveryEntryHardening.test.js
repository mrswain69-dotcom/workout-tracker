import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("session, recovery and live-entry hardening release contract", () => {
  it("debounces typed log persistence while protecting newer local revisions", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain("LOG_INPUT_SAVE_DEBOUNCE_MS = 900");
    expect(app).toContain("logPersistTimersRef");
    expect(app).toContain("logSaveRevisionRef");
    expect(app).toContain("Older DB responses");
    expect(app).toContain("{ debounceMs: LOG_INPUT_SAVE_DEBOUNCE_MS }");
    expect(app).toContain("latestLogForSelectedDay()");
  });

  it("shows human-readable activity time from the shared activity-time engine", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    const timeEngine = fs.readFileSync(
      new URL("./activityTimeEngine.js", import.meta.url),
      "utf8"
    );

    expect(app).toContain('label="Activity time"');
    expect(app).toContain("formatActivityMinutes(computeTotalMinutesForDay(logForDay))");
    expect(app).toContain("return computeActivityMinutesForDay(log);");
    expect(timeEngine).toContain("countCompletedSetsInBlock");
    expect(timeEngine).toContain("getSessionBlockTrainingMinutes(block)");
  });

  it("keeps the day summary focused on consistency, progression and earned XP", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain('label="Consistency"');
    expect(app).toContain('label="Progress wins"');
    expect(app).toContain('label="XP earned"');
    expect(app).toContain("selectedDayPlanStreak");
    expect(app).toContain("selectedDayProgressWins");
  });

  it("supports authorised start/end timing corrections for recovery history", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    const db = fs.readFileSync(new URL("../db.js", import.meta.url), "utf8");
    const migration = fs.readFileSync(
      new URL(
        "../../supabase/migrations/20260922103500_profile_recovery_timing_edit.sql",
        import.meta.url
      ),
      "utf8"
    );

    expect(app).toContain("RecoveryTimingEditor");
    expect(app).toContain('type="datetime-local"');
    expect(app).toContain("Recovery history");
    expect(db).toContain("update_profile_recovery_period_timing");
    expect(migration).toContain("f.owner_user_id = auth.uid()");
  });
});
