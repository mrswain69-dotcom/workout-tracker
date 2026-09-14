import { describe, expect, it } from "vitest";
import {
  isVerifiedPlanCompletionEvidence,
  matchVerifiedPlanCompletionEvidence,
  verifiedCardioCompatibleWithPlanType,
} from "./verifiedPlanCompletionEngine.js";

function evidence({
  id = "v1",
  date = "2026-09-14",
  cardioKind = "run",
  distanceKm = 5,
  durationMin = 25,
  providers = ["strava"],
  matchedManual = false,
  manualBlockId = "",
} = {}) {
  return {
    id,
    date,
    cardioKind,
    distanceKm,
    durationMin,
    providers,
    matchedManual,
    manualBlockId,
    authority: "verified_evidence_only",
    rewardXp: 0,
  };
}

describe("verifiedPlanCompletionEngine Stage 6", () => {
  it("uses strict cardio compatibility and never treats generic duration, strength, Session or recovery as wearable-verifiable", () => {
    expect(verifiedCardioCompatibleWithPlanType("run", "run")).toBe(true);
    expect(verifiedCardioCompatibleWithPlanType("run", "cardio")).toBe(true);
    expect(verifiedCardioCompatibleWithPlanType("run", "duration")).toBe(false);
    expect(verifiedCardioCompatibleWithPlanType("run", "strength")).toBe(false);
    expect(verifiedCardioCompatibleWithPlanType("run", "session")).toBe(false);
    expect(verifiedCardioCompatibleWithPlanType("run", "recovery")).toBe(false);
    expect(verifiedCardioCompatibleWithPlanType("cycle", "bike")).toBe(true);
    expect(verifiedCardioCompatibleWithPlanType("walk", "run")).toBe(false);
    expect(verifiedCardioCompatibleWithPlanType("team_sport", "cardio")).toBe(true);
    expect(verifiedCardioCompatibleWithPlanType("team_sport", "duration")).toBe(false);
  });

  it("requires same-day canonical provider evidence with an objective distance or duration and zero reward authority", () => {
    expect(isVerifiedPlanCompletionEvidence(evidence(), "2026-09-14")).toBe(true);
    expect(isVerifiedPlanCompletionEvidence(evidence({ date: "2026-09-13" }), "2026-09-14")).toBe(false);
    expect(isVerifiedPlanCompletionEvidence(evidence({ distanceKm: 0, durationMin: 0 }), "2026-09-14")).toBe(false);
    expect(isVerifiedPlanCompletionEvidence(evidence({ providers: [] }), "2026-09-14")).toBe(false);
    expect(isVerifiedPlanCompletionEvidence({ ...evidence(), authority: "manual" }, "2026-09-14")).toBe(false);
    expect(isVerifiedPlanCompletionEvidence({ ...evidence(), rewardXp: 10 }, "2026-09-14")).toBe(false);
  });

  it("rejects provider-manual and explicitly ineligible evidence even when its metrics otherwise look valid", () => {
    expect(
      isVerifiedPlanCompletionEvidence(
        { ...evidence(), source_manual_entry: true },
        "2026-09-14"
      )
    ).toBe(false);
    expect(
      isVerifiedPlanCompletionEvidence(
        { ...evidence(), verificationLevel: "provider_manual" },
        "2026-09-14"
      )
    ).toBe(false);
    expect(
      isVerifiedPlanCompletionEvidence(
        { ...evidence(), verificationEligible: false },
        "2026-09-14"
      )
    ).toBe(false);
    expect(
      isVerifiedPlanCompletionEvidence(
        { ...evidence(), verificationEligible: true, verificationLevel: "device_or_file" },
        "2026-09-14"
      )
    ).toBe(true);
  });

  it("never assigns provider-manual evidence to a planned block", () => {
    const result = matchVerifiedPlanCompletionEvidence({
      dateYmd: "2026-09-14",
      expectedBlocks: [{ id: "run-a", typeId: "run" }],
      verifiedCardioEvidence: [
        { ...evidence(), verificationEligible: false, verificationLevel: "provider_manual" },
      ],
    });

    expect(result.completedBlockIds).toEqual([]);
    expect(result.assignments).toEqual([]);
  });

  it("lets one verified run satisfy one compatible planned block and never double-consumes the same activity", () => {
    const result = matchVerifiedPlanCompletionEvidence({
      dateYmd: "2026-09-14",
      expectedBlocks: [
        { id: "run-a", typeId: "run" },
        { id: "run-b", typeId: "run" },
      ],
      verifiedCardioEvidence: [evidence()],
    });

    expect(result.completedBlockIds).toEqual(["run-a"]);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]).toMatchObject({
      verifiedActivityId: "v1",
      expectedBlockId: "run-a",
      authority: "verified_evidence_only",
      rewardXp: 0,
    });
  });

  it("gives manual completion precedence so provider evidence cannot duplicate a completed manual block", () => {
    const result = matchVerifiedPlanCompletionEvidence({
      dateYmd: "2026-09-14",
      expectedBlocks: [
        { id: "run-a", typeId: "run" },
        { id: "run-b", typeId: "run" },
      ],
      manualCompletedBlockIds: ["run-a"],
      verifiedCardioEvidence: [evidence({ matchedManual: true, manualBlockId: "run-a" })],
    });

    expect(result.completedBlockIds).toEqual([]);
    expect(result.assignments).toEqual([]);
  });

  it("can use a clear link to the same incomplete planned block, but a link to another or whole manual log is consumed and cannot satisfy a different block", () => {
    const sameBlock = matchVerifiedPlanCompletionEvidence({
      dateYmd: "2026-09-14",
      expectedBlocks: [{ id: "run-a", typeId: "run" }],
      verifiedCardioEvidence: [evidence({ matchedManual: true, manualBlockId: "run-a" })],
    });
    expect(sameBlock.completedBlockIds).toEqual(["run-a"]);

    const anotherBlock = matchVerifiedPlanCompletionEvidence({
      dateYmd: "2026-09-14",
      expectedBlocks: [{ id: "run-a", typeId: "run" }],
      verifiedCardioEvidence: [evidence({ matchedManual: true, manualBlockId: "different" })],
    });
    expect(anotherBlock.completedBlockIds).toEqual([]);

    const wholeLog = matchVerifiedPlanCompletionEvidence({
      dateYmd: "2026-09-14",
      expectedBlocks: [{ id: "run-a", typeId: "run" }],
      verifiedCardioEvidence: [evidence({ matchedManual: true, manualBlockId: "" })],
    });
    expect(wholeLog.completedBlockIds).toEqual([]);
  });
});
