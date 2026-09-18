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
  it("keeps the streak, rewards physio more than illness recovery, and ignores paused training XP", () => {
    const injuryRows = buildXpDebugRows(
      [
        {
          date_ymd: "2026-09-17",
          log: { blocks: [{ id: "recovery", typeId: "recovery", recoveryDone: true }] },
        },
        { date_ymd: "2026-09-18", log: injuryLog(20) },
      ],
      {}
    );
    const injury = injuryRows.find((row) => row.date === "2026-09-18");
    expect(injury.recoveryXp).toBe(10);
    expect(injury.strengthXp).toBe(0);
    expect(injury.dayCompleteXp).toBe(10);
    expect(injury.streakXp).toBe(5);

    const illnessLog = {
      meta: { profileRecoveryMode: "illness" },
      blocks: [{
        id: "illness",
        typeId: "recovery",
        isProfileRecoveryBlock: true,
        profileRecoveryMode: "illness",
        recoveryDone: true,
      }],
    };
    const illness = buildXpDebugRows(
      [{ date_ymd: "2026-09-18", log: illnessLog }],
      {}
    )[0];
    expect(illness.recoveryXp).toBe(5);
    expect(illness.dayCompleteXp).toBe(10);
    expect(injury.recoveryXp).toBeGreaterThan(illness.recoveryXp);
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
