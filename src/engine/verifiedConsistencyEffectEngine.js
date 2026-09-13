import {
  consistencyPlannedDayCompleted,
  normaliseConsistencyRecords,
  selectConsistencyScheduleSnapshot,
} from "./consistencyEngine.js";

export const VERIFIED_CONSISTENCY_EFFECT_VERSION = "verification_stage6_consistency_effect_v1";

function text(value) {
  return value === null || value === undefined ? "" : String(value).trim();
}

function validYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value));
}

function evidenceDate(row) {
  return text(row?.date || row?.localDateYmd || row?.local_date_ymd);
}

export function buildVerifiedConsistencyEffects({
  logs = [],
  consistencySnapshots = [],
  verifiedCardioEvidence = [],
} = {}) {
  const records = normaliseConsistencyRecords(logs);
  const logByDate = new Map(records.map((row) => [row.date_ymd, row.log]));
  const evidence = Array.isArray(verifiedCardioEvidence) ? verifiedCardioEvidence : [];
  const dates = [...new Set(evidence.map(evidenceDate).filter(validYmd))].sort();
  const rows = [];

  for (const dateYmd of dates) {
    const snapshot = selectConsistencyScheduleSnapshot(consistencySnapshots, dateYmd);
    if (!snapshot) {
      rows.push({
        dateYmd,
        state: "schedule_unavailable",
        planned: false,
        completedBeforeVerification: false,
        completedAfterVerification: false,
        verifiedAssignments: [],
      });
      continue;
    }

    const log = logByDate.get(dateYmd) || null;
    const manual = consistencyPlannedDayCompleted({
      dateYmd,
      schedule: snapshot.schedule,
      log,
    });
    const withVerification = consistencyPlannedDayCompleted({
      dateYmd,
      schedule: snapshot.schedule,
      log,
      verifiedCardioEvidence: evidence,
    });

    rows.push({
      dateYmd,
      state: withVerification.planned ? "evaluated" : "no_planned_training",
      scheduleEffectiveDate: snapshot.effectiveDate,
      planned: withVerification.planned,
      expectedBlocks: withVerification.expectedBlocks,
      completedBeforeVerification: manual.completed,
      completedAfterVerification: withVerification.completed,
      manualCompletedBlocks: withVerification.manualCompletedBlocks,
      verifiedCompletedBlocks: withVerification.verifiedCompletedBlocks,
      completionSource: withVerification.completionSource,
      verifiedAssignments: withVerification.verifiedAssignments,
    });
  }

  const appliedRows = rows.filter((row) => row.verifiedAssignments.length > 0);
  return {
    version: VERIFIED_CONSISTENCY_EFFECT_VERSION,
    evidenceOnly: true,
    rewardXp: 0,
    evaluatedDates: rows.length,
    verifiedPlanBlocks: appliedRows.reduce(
      (sum, row) => sum + row.verifiedAssignments.length,
      0
    ),
    daysCompletedByVerification: appliedRows.filter(
      (row) => !row.completedBeforeVerification && row.completedAfterVerification
    ).length,
    mixedCompletionDays: appliedRows.filter((row) => row.completionSource === "mixed").length,
    rows,
  };
}
