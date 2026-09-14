export const VERIFIED_PLAN_COMPLETION_VERSION = "verification_stage6_plan_completion_v1";

const COMPATIBLE_PLAN_TYPES = Object.freeze({
  run: new Set(["run", "cardio"]),
  cycle: new Set(["cycle", "bike", "cardio"]),
  swim: new Set(["swim", "cardio"]),
  walk: new Set(["walk", "cardio"]),
  row: new Set(["row", "cardio"]),
  team_sport: new Set(["cardio"]),
  other_cardio: new Set(["cardio"]),
});

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function validYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value));
}

function providersOf(row) {
  return [...new Set((Array.isArray(row?.providers) ? row.providers : [])
    .map((provider) => text(provider).toLowerCase())
    .filter(Boolean))].sort();
}

function planTypeOf(block) {
  return text(block?.typeId || block?.type_id).toLowerCase();
}

function blockIdOf(block) {
  return text(block?.id || block?.blockId || block?.block_id);
}

function cardioKindOf(row) {
  return text(row?.cardioKind || row?.cardio_kind).toLowerCase();
}

function evidenceIdOf(row) {
  return text(row?.id || row?.verifiedActivityId || row?.verified_activity_id);
}

function evidenceDateOf(row) {
  return text(row?.date || row?.localDateYmd || row?.local_date_ymd);
}

function manualBlockIdOf(row) {
  return text(row?.manualBlockId || row?.manual_block_id);
}

function isMatchedManual(row) {
  return !!(row?.matchedManual || row?.matched_manual || row?.manualLogId || row?.manual_log_id);
}

export function verifiedCardioCompatibleWithPlanType(cardioKind, planType) {
  const allowed = COMPATIBLE_PLAN_TYPES[text(cardioKind).toLowerCase()];
  return !!allowed?.has(text(planType).toLowerCase());
}

export function isVerifiedPlanCompletionEvidence(row, dateYmd = "") {
  if (!row || typeof row !== "object") return false;
  const evidenceDate = evidenceDateOf(row);
  const providers = providersOf(row);
  const cardioKind = cardioKindOf(row);
  const objectiveEvidence = positive(row?.distanceKm ?? row?.distance_km) !== null ||
    positive(row?.durationMin ?? row?.duration_min) !== null;
  const verificationLevel = text(row?.verificationLevel || row?.verification_level).toLowerCase();

  if (!evidenceIdOf(row) || !validYmd(evidenceDate)) return false;
  if (dateYmd && evidenceDate !== dateYmd) return false;
  if (!COMPATIBLE_PLAN_TYPES[cardioKind]) return false;
  if (!providers.length || !objectiveEvidence) return false;
  if (row?.verificationEligible === false || row?.verification_eligible === false) return false;
  if (row?.sourceManualEntry === true || row?.source_manual_entry === true) return false;
  if (verificationLevel === "provider_manual") return false;
  if (text(row?.authority) !== "verified_evidence_only") return false;
  if (Number(row?.rewardXp ?? row?.reward_xp ?? 0) !== 0) return false;
  return true;
}

export function matchVerifiedPlanCompletionEvidence({
  dateYmd,
  expectedBlocks = [],
  manualCompletedBlockIds = [],
  verifiedCardioEvidence = [],
} = {}) {
  if (!validYmd(dateYmd)) {
    return { version: VERIFIED_PLAN_COMPLETION_VERSION, assignments: [], completedBlockIds: [] };
  }

  const manualCompleted = new Set((Array.isArray(manualCompletedBlockIds) ? manualCompletedBlockIds : [])
    .map(text)
    .filter(Boolean));
  const expected = (Array.isArray(expectedBlocks) ? expectedBlocks : [])
    .map((block, index) => ({
      id: blockIdOf(block),
      typeId: planTypeOf(block),
      index,
    }))
    .filter((block) => block.id && block.typeId && !manualCompleted.has(block.id));

  const eligible = (Array.isArray(verifiedCardioEvidence) ? verifiedCardioEvidence : [])
    .filter((row) => isVerifiedPlanCompletionEvidence(row, dateYmd))
    .map((row) => ({
      row,
      id: evidenceIdOf(row),
      cardioKind: cardioKindOf(row),
      providers: providersOf(row),
      matchedManual: isMatchedManual(row),
      manualBlockId: manualBlockIdOf(row),
      multiSource: !!row?.multiSource,
    }))
    .filter((candidate) => {
      if (!candidate.matchedManual) return true;
      if (!candidate.manualBlockId) return false;
      return expected.some((block) => block.id === candidate.manualBlockId);
    })
    .sort((a, b) => {
      if (a.matchedManual !== b.matchedManual) return a.matchedManual ? -1 : 1;
      if (a.multiSource !== b.multiSource) return a.multiSource ? -1 : 1;
      return a.id.localeCompare(b.id);
    });

  const usedEvidenceIds = new Set();
  const assignments = [];

  for (const block of expected) {
    const candidates = eligible.filter((candidate) => {
      if (usedEvidenceIds.has(candidate.id)) return false;
      if (!verifiedCardioCompatibleWithPlanType(candidate.cardioKind, block.typeId)) return false;
      if (candidate.matchedManual && candidate.manualBlockId !== block.id) return false;
      return true;
    });
    if (!candidates.length) continue;

    const selected = candidates[0];
    usedEvidenceIds.add(selected.id);
    assignments.push({
      expectedBlockId: block.id,
      expectedBlockType: block.typeId,
      verifiedActivityId: selected.id,
      cardioKind: selected.cardioKind,
      providers: selected.providers,
      matchedManual: selected.matchedManual,
      multiSource: selected.multiSource,
      source: "verified_cardio",
      authority: "verified_evidence_only",
      rewardXp: 0,
    });
  }

  return {
    version: VERIFIED_PLAN_COMPLETION_VERSION,
    assignments,
    completedBlockIds: assignments.map((row) => row.expectedBlockId),
  };
}
