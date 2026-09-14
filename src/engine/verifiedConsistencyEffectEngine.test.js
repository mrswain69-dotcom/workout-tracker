import { describe, expect, it } from "vitest";
import { buildVerifiedConsistencyEffects } from "./verifiedConsistencyEffectEngine.js";

const schedule = {
  Mon: [{ id: "run", typeId: "run" }],
  Tue: [{ id: "strength", typeId: "strength" }],
  Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
};

function verifiedRun(overrides = {}) {
  return {
    id: "v1",
    date: "2026-09-14",
    cardioKind: "run",
    distanceKm: 5,
    durationMin: 25,
    providers: ["strava"],
    authority: "verified_evidence_only",
    rewardXp: 0,
    ...overrides,
  };
}

describe("verifiedConsistencyEffectEngine Stage 6", () => {
  it("shows that a genuine verified run can complete the matching planned run without writing a manual log", () => {
    const result = buildVerifiedConsistencyEffects({
      logs: [],
      consistencySnapshots: [{ effective_date: "2026-09-01", schedule_json: schedule }],
      verifiedCardioEvidence: [verifiedRun()],
    });

    expect(result).toMatchObject({
      evidenceOnly: true,
      rewardXp: 0,
      verifiedPlanBlocks: 1,
      daysCompletedByVerification: 1,
    });
    expect(result.rows[0]).toMatchObject({
      dateYmd: "2026-09-14",
      completedBeforeVerification: false,
      completedAfterVerification: true,
      completionSource: "verified",
      verifiedCompletedBlocks: 1,
    });
  });

  it("does not add another completion when the planned run was already completed manually", () => {
    const result = buildVerifiedConsistencyEffects({
      logs: [{
        date_ymd: "2026-09-14",
        log: {
          blocks: [{
            id: "run",
            typeId: "run",
            loggedAt: "2026-09-14T17:00:00.000Z",
            cardio: { distanceKm: 5, durationMin: 25 },
          }],
        },
      }],
      consistencySnapshots: [{ effective_date: "2026-09-01", schedule_json: schedule }],
      verifiedCardioEvidence: [verifiedRun({ matchedManual: true, manualBlockId: "run" })],
    });

    expect(result.verifiedPlanBlocks).toBe(0);
    expect(result.daysCompletedByVerification).toBe(0);
    expect(result.rows[0]).toMatchObject({
      completedBeforeVerification: true,
      completedAfterVerification: true,
      completionSource: "manual",
      manualCompletedBlocks: 1,
      verifiedCompletedBlocks: 0,
    });
  });

  it("keeps incompatible planned strength manual even when provider cardio exists on the same day", () => {
    const result = buildVerifiedConsistencyEffects({
      logs: [],
      consistencySnapshots: [{ effective_date: "2026-09-01", schedule_json: schedule }],
      verifiedCardioEvidence: [verifiedRun({ date: "2026-09-15" })],
    });

    expect(result.verifiedPlanBlocks).toBe(0);
    expect(result.rows[0]).toMatchObject({
      planned: true,
      completedBeforeVerification: false,
      completedAfterVerification: false,
      verifiedCompletedBlocks: 0,
    });
  });
});
