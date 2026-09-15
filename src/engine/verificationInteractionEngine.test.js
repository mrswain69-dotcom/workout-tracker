import { describe, expect, it } from "vitest";
import {
  VERIFICATION_MANUAL_SYNC_COOLDOWN_MS,
  canonicalVerificationActivityFamily,
  isVerificationDateCompatible,
  manualSyncCooldown,
  verificationDateOffsetDays,
  verificationFamiliesCompatible,
  verificationRollup,
} from "./verificationInteractionEngine.js";

describe("verification interaction policy", () => {
  it("uses a five-minute server-compatible manual sync cooldown", () => {
    expect(VERIFICATION_MANUAL_SYNC_COOLDOWN_MS).toBe(300000);
    const now = Date.parse("2026-09-15T12:00:00Z");
    const blocked = manualSyncCooldown({ last_manual_sync_at: "2026-09-15T11:58:00Z" }, now);
    expect(blocked.blocked).toBe(true);
    expect(blocked.remainingMs).toBe(180000);
    expect(manualSyncCooldown({ last_manual_sync_at: "2026-09-15T11:54:59Z" }, now).blocked).toBe(false);
  });

  it("allows manual catch-up matching within two days without changing the performed date", () => {
    expect(verificationDateOffsetDays("2026-09-15", "2026-09-14")).toBe(-1);
    expect(isVerificationDateCompatible("2026-09-15", "2026-09-13")).toBe(true);
    expect(isVerificationDateCompatible("2026-09-15", "2026-09-12")).toBe(false);
  });

  it("normalises both spaced and Strava one-word WeightTraining as strength", () => {
    expect(canonicalVerificationActivityFamily("Trail Run")).toBe("run");
    expect(canonicalVerificationActivityFamily("Weight Training")).toBe("strength");
    expect(canonicalVerificationActivityFamily("WeightTraining")).toBe("strength");
    expect(canonicalVerificationActivityFamily("weighttraining")).toBe("strength");
    expect(verificationFamiliesCompatible("WeightTraining", "strength")).toBe(true);
    expect(verificationFamiliesCompatible("run", "cardio")).toBe(true);
    expect(verificationFamiliesCompatible("run", "strength")).toBe(false);
  });

  it("rolls component evidence up without pretending a partial block is fully verified", () => {
    expect(verificationRollup({ eligibleComponents: 2, verifiedComponents: 2 })).toBe("verified");
    expect(verificationRollup({ eligibleComponents: 2, verifiedComponents: 1 })).toBe("partial");
    expect(verificationRollup({ eligibleComponents: 0, sessionVerified: true })).toBe("session_verified");
    expect(verificationRollup({ eligibleComponents: 2, verifiedComponents: 0 })).toBe("unverified");
  });
});
