import { describe, expect, it } from "vitest";
import {
  applyVerifiedActivityPopulation,
  buildSafePlanLogShell,
} from "./verificationAutoPopulationEngine.js";

function runBlock(id, overrides = {}) {
  return {
    id,
    typeId: "cardio",
    label: "Run",
    cardioType: "run",
    cancelled: false,
    cardio: { distanceKm: "", durationMin: "", avgSpeedKmh: "" },
    duration: { minutes: "" },
    ...overrides,
  };
}

const evidence = {
  verifiedActivityId: "va-ambiguous",
  activityType: "run",
  providers: ["strava"],
  observationIds: ["obs-1"],
  distanceM: 5000,
  durationSec: 1500,
};

describe("Stage 7.3 safe target selection", () => {
  it("creates an extra verified block rather than guessing between equally plausible planned blocks", () => {
    const log = buildSafePlanLogShell([runBlock("run-a"), runBlock("run-b")]);
    const result = applyVerifiedActivityPopulation({ logJson: log, evidence });

    expect(result.extraBlocksCreated).toBe(1);
    expect(result.targetBlockId).toBe("verified_va-ambiguous");
    expect(result.logJson.blocks.find((row) => row.id === "run-a").cardio.distanceKm).toBe("");
    expect(result.logJson.blocks.find((row) => row.id === "run-b").cardio.distanceKm).toBe("");
  });

  it("prefers the single block with compatible manual context over another empty block", () => {
    const log = buildSafePlanLogShell([runBlock("run-a"), runBlock("run-b")]);
    log.blocks[1].cardio.distanceKm = "5.0";
    const result = applyVerifiedActivityPopulation({ logJson: log, evidence });

    expect(result.extraBlocksCreated).toBe(0);
    expect(result.targetBlockId).toBe("run-b");
    expect(result.logJson.blocks[1].cardio.distanceKm).toBe("5.0");
    expect(result.logJson.blocks[1].cardio.durationMin).toBe("25");
  });
});
