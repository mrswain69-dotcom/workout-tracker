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

  it("shows human-readable total time rather than a raw decimal minute value", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain('label="Total time"');
    expect(app).toContain("formatActivityMinutes(computeTotalMinutesForDay(logForDay))");
    expect(app).toContain("estimateStrengthMinutes(setCount, restSec)");
    expect(app).toContain("getSessionBlockTrainingMinutes(b)");
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
