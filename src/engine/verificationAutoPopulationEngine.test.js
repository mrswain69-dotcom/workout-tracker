import { describe, expect, it } from "vitest";
import {
  VERIFICATION_AUTO_POPULATION_VERSION,
  applyVerifiedActivityPopulation,
  buildSafePlanLogShell,
  canonicalVerificationActivityFamily,
  getAutoPopulationForVerifiedActivity,
  isDateInsideAutoPopulationWindow,
  undoVerifiedActivityPopulation,
} from "./verificationAutoPopulationEngine.js";

function evidence(overrides = {}) {
  return {
    verifiedActivityId: "va-1",
    activityType: "run",
    providers: ["strava"],
    observationIds: ["obs-1"],
    distanceM: 5020,
    durationSec: 1629,
    ...overrides,
  };
}

function cardioBlock(overrides = {}) {
  return {
    id: "run-block",
    typeId: "cardio",
    label: "Run",
    cardioType: "run",
    cancelled: false,
    cardio: { distanceKm: "", durationMin: "", avgSpeedKmh: "" },
    duration: { minutes: "" },
    ...overrides,
  };
}

describe("verification auto population", () => {
  it("normalises supported activity families without treating strength as cardio", () => {
    expect(canonicalVerificationActivityFamily("TrailRun")).toBe("run");
    expect(canonicalVerificationActivityFamily("WeightTraining")).toBe("strength");
    expect(canonicalVerificationActivityFamily("Soccer")).toBe("team_sport");
  });

  it("bounds the recent-day window to today through the previous three days", () => {
    expect(isDateInsideAutoPopulationWindow("2026-09-15", "2026-09-15", 2)).toBe(true);
    expect(isDateInsideAutoPopulationWindow("2026-09-13", "2026-09-15", 2)).toBe(true);
    expect(isDateInsideAutoPopulationWindow("2026-09-12", "2026-09-15", 2)).toBe(false);
    expect(isDateInsideAutoPopulationWindow("2026-09-11", "2026-09-15", 99)).toBe(false);
    expect(isDateInsideAutoPopulationWindow("2026-09-16", "2026-09-15", 3)).toBe(false);
  });

  it("fills only empty fields on a compatible planned cardio block and records field provenance", () => {
    const log = buildSafePlanLogShell([cardioBlock()]);
    const result = applyVerifiedActivityPopulation({ logJson: log, evidence: evidence(), nowIso: "2026-09-15T10:00:00Z" });

    expect(result.changed).toBe(true);
    expect(result.extraBlocksCreated).toBe(0);
    expect(result.fieldsFilled).toBe(2);
    expect(result.targetBlockId).toBe("run-block");
    expect(result.logJson.blocks[0].cardio.distanceKm).toBe("5.02");
    expect(result.logJson.blocks[0].cardio.durationMin).toBe("27.2");

    const provenance = result.logJson.meta.verificationPopulation;
    expect(provenance.version).toBe(VERIFICATION_AUTO_POPULATION_VERSION);
    expect(provenance.fields["run-block|cardio.distanceKm"]).toMatchObject({
      verifiedActivityId: "va-1",
      providers: ["strava"],
      importedValue: "5.02",
      previousValue: "",
      state: "imported",
    });
  });

  it("never overwrites genuine manual values, but may fill a compatible empty companion field", () => {
    const log = buildSafePlanLogShell([cardioBlock()]);
    log.blocks[0].cardio.distanceKm = "5";
    const result = applyVerifiedActivityPopulation({ logJson: log, evidence: evidence() });

    expect(result.logJson.blocks[0].cardio.distanceKm).toBe("5");
    expect(result.logJson.blocks[0].cardio.durationMin).toBe("27.2");
    expect(result.fieldsFilled).toBe(1);
    expect(result.logJson.meta.verificationPopulation.fields["run-block|cardio.distanceKm"]).toBeUndefined();
  });

  it("refuses to use incompatible existing manual metrics as a target", () => {
    const log = buildSafePlanLogShell([cardioBlock()]);
    log.blocks[0].cardio.distanceKm = "12";
    const result = applyVerifiedActivityPopulation({ logJson: log, evidence: evidence() });

    expect(result.extraBlocksCreated).toBe(1);
    expect(result.logJson.blocks[0].cardio.distanceKm).toBe("12");
    expect(result.logJson.blocks[0].cardio.durationMin).toBe("");
  });

  it("does not auto-populate strength evidence or silently create a structured Session", () => {
    const plan = [
      { id: "session-1", typeId: "session", label: "Gym Session", sessionTemplateId: "template-1" },
      cardioBlock(),
    ];
    const log = buildSafePlanLogShell(plan);
    const result = applyVerifiedActivityPopulation({
      logJson: log,
      evidence: evidence({ verifiedActivityId: "strength-1", activityType: "WeightTraining", distanceM: null, durationSec: 1800 }),
    });

    expect(result.changed).toBe(false);
    expect(result.skippedReason).toBe("unsupported");
    expect(result.logJson.blocks.filter((block) => block.typeId === "session")).toHaveLength(1);
    expect(result.logJson.blocks).toHaveLength(2);
  });

  it("creates one deterministic reversible extra cardio block when no compatible planned block exists", () => {
    const log = buildSafePlanLogShell([{ id: "session-1", typeId: "session", label: "Session" }]);
    const first = applyVerifiedActivityPopulation({ logJson: log, evidence: evidence() });
    const second = applyVerifiedActivityPopulation({ logJson: first.logJson, evidence: evidence() });

    expect(first.extraBlocksCreated).toBe(1);
    expect(first.targetBlockId).toBe("verified_va-1");
    expect(first.logJson.blocks.find((block) => block.id === "verified_va-1")).toMatchObject({
      typeId: "cardio",
      isExtra: true,
      cardioType: "run",
    });
    expect(second.extraBlocksCreated).toBe(0);
    expect(second.logJson.blocks.filter((block) => block.id === "verified_va-1")).toHaveLength(1);
  });

  it("treats any user edit to an imported field as permanent manual authority", () => {
    const first = applyVerifiedActivityPopulation({ logJson: buildSafePlanLogShell([cardioBlock()]), evidence: evidence() });
    first.logJson.blocks[0].cardio.distanceKm = "5.10";

    const second = applyVerifiedActivityPopulation({ logJson: first.logJson, evidence: evidence({ distanceM: 5050 }) });
    expect(second.logJson.blocks[0].cardio.distanceKm).toBe("5.10");
    expect(second.logJson.meta.verificationPopulation.fields["run-block|cardio.distanceKm"].state).toBe("manual_override");
  });

  it("undo restores untouched imported fields without disturbing manual companion data", () => {
    const log = buildSafePlanLogShell([cardioBlock()]);
    log.blocks[0].cardio.avgSpeedKmh = "11.1";
    const populated = applyVerifiedActivityPopulation({ logJson: log, evidence: evidence() });
    const undone = undoVerifiedActivityPopulation({ logJson: populated.logJson, verifiedActivityId: "va-1", nowIso: "2026-09-15T11:00:00Z" });

    expect(undone.fieldsRestored).toBe(2);
    expect(undone.logJson.blocks[0].cardio.distanceKm).toBe("");
    expect(undone.logJson.blocks[0].cardio.durationMin).toBe("");
    expect(undone.logJson.blocks[0].cardio.avgSpeedKmh).toBe("11.1");
    expect(getAutoPopulationForVerifiedActivity(undone.logJson, "va-1").fields.every((row) => row.state === "undone")).toBe(true);
  });

  it("undo preserves a field the athlete changed instead of restoring over it", () => {
    const populated = applyVerifiedActivityPopulation({ logJson: buildSafePlanLogShell([cardioBlock()]), evidence: evidence() });
    populated.logJson.blocks[0].cardio.distanceKm = "5.3";
    const undone = undoVerifiedActivityPopulation({ logJson: populated.logJson, verifiedActivityId: "va-1" });

    expect(undone.logJson.blocks[0].cardio.distanceKm).toBe("5.3");
    expect(undone.manualOverridesPreserved).toBe(1);
    expect(undone.logJson.meta.verificationPopulation.fields["run-block|cardio.distanceKm"].state).toBe("manual_override");
  });

  it("undo removes an untouched generated extra block but preserves an edited one", () => {
    const populated = applyVerifiedActivityPopulation({ logJson: buildSafePlanLogShell([]), evidence: evidence() });
    const cleanUndo = undoVerifiedActivityPopulation({ logJson: populated.logJson, verifiedActivityId: "va-1" });
    expect(cleanUndo.extraBlocksRemoved).toBe(1);
    expect(cleanUndo.logJson.blocks).toHaveLength(0);

    const edited = applyVerifiedActivityPopulation({ logJson: buildSafePlanLogShell([]), evidence: evidence() });
    edited.logJson.blocks[0].label = "My Tuesday run";
    const editedUndo = undoVerifiedActivityPopulation({ logJson: edited.logJson, verifiedActivityId: "va-1" });
    expect(editedUndo.extraBlocksRemoved).toBe(0);
    expect(editedUndo.logJson.blocks[0].label).toBe("My Tuesday run");
    expect(editedUndo.manualOverridesPreserved).toBe(1);
  });
});
