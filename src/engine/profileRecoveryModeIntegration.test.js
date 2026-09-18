import { describe, expect, it } from "vitest";
import { buildXpDebugRows } from "./xpEngine.js";
import { consistencyPlannedDayCompleted } from "./consistencyEngine.js";

function injuryLog(minutes = 20) {
  return {
    meta: { profileRecoveryMode: "injury" },
    blocks: [
      {
        id: "planned-strength",
        typeId: "strength",
        suspendedByRecoveryMode: true,
        sets: { squat: [{ reps: 10, weight: 20 }] },
      },
      {
        id: "profile-recovery::p1::2026-09-18",
        typeId: "recovery",
        isProfileRecoveryBlock: true,
        profileRecoveryMode: "injury",
        duration: { minutes },
        recoveryDone: minutes > 0,
        loggedAt: "2026-09-18T08:00:00Z",
      },
    ],
  };
}

describe("profile recovery mode integration", () => {
  it("awards only fixed Recovery XP and no normal day/streak XP", () => {
    const rows = buildXpDebugRows([{ date_ymd: "2026-09-18", log: injuryLog(20) }], {});
    expect(rows).toHaveLength(1);
    expect(rows[0].recoveryXp).toBe(5);
    expect(rows[0].strengthXp).toBe(0);
    expect(rows[0].dayCompleteXp).toBe(0);
    expect(rows[0].streakXp).toBe(0);
    expect(rows[0].totalXp).toBe(5);
  });

  it("lets completed parent-authorised recovery satisfy a planned Consistency day", () => {
    const result = consistencyPlannedDayCompleted({
      dateYmd: "2026-09-18",
      schedule: { Fri: [{ id: "planned-strength", typeId: "strength" }] },
      log: injuryLog(20),
    });
    expect(result.planned).toBe(true);
    expect(result.completed).toBe(true);
    expect(result.completionSource).toBe("recovery_mode");
  });

  it("does not give Consistency completion until the recovery block is genuinely completed", () => {
    const result = consistencyPlannedDayCompleted({
      dateYmd: "2026-09-18",
      schedule: { Fri: [{ id: "planned-strength", typeId: "strength" }] },
      log: injuryLog(0),
    });
    expect(result.planned).toBe(true);
    expect(result.completed).toBe(false);
  });
});
