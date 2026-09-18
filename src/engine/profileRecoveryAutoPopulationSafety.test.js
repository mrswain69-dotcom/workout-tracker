import { describe, expect, it } from "vitest";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("../../supabase/functions/_shared/verificationAutoPopulate.ts", import.meta.url),
  "utf8"
);

describe("recovery mode verified-activity safety", () => {
  it("prevents connected activity auto-population while a profile recovery period governs the day", () => {
    expect(source).toContain('from("profile_recovery_periods")');
    expect(source).toContain("getProfileRecoveryModeForDate");
    expect(source).toContain("skippedRecoveryMode");
    expect(source).toContain("if (recoveryPeriod)");
  });
});
