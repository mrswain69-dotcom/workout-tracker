function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function valueOf(obj, camelKey, snakeKey, fallback = undefined) {
  if (!obj || typeof obj !== "object") return fallback;
  if (obj[camelKey] !== undefined) return obj[camelKey];
  if (snakeKey && obj[snakeKey] !== undefined) return obj[snakeKey];
  return fallback;
}

function positiveInt(value, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.max(1, Math.round(n));
}

function jsonObject(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...value }
    : {};
}

function dateFromYmd(value) {
  const text = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const date = new Date(`${text}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

export function addAssessmentDays(ymd, days) {
  const date = dateFromYmd(ymd);
  if (!date) return "";
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
}

export function assessmentDaysBetween(fromYmd, toYmd) {
  const from = dateFromYmd(fromYmd);
  const to = dateFromYmd(toYmd);
  if (!from || !to) return null;
  return Math.floor((to.getTime() - from.getTime()) / 86400000);
}

export function normaliseAssessmentSchedule(raw = {}) {
  const cadenceDays = positiveInt(
    valueOf(raw, "cadenceDays", "cadence_days", 28),
    28
  );
  return {
    id: cleanText(raw.id),
    familyId: cleanText(valueOf(raw, "familyId", "family_id", "")),
    profileId: cleanText(valueOf(raw, "profileId", "profile_id", "")),
    assessmentTemplateId: cleanText(
      valueOf(raw, "assessmentTemplateId", "assessment_template_id", "")
    ),
    startDate: cleanText(valueOf(raw, "startDate", "start_date", "")),
    cadenceDays,
    windowDays: Math.min(
      cadenceDays,
      positiveInt(valueOf(raw, "windowDays", "window_days", 7), 7)
    ),
    workflowConfig: jsonObject(
      valueOf(raw, "workflowConfig", "workflow_config", {})
    ),
    active: valueOf(raw, "active", "active", true) !== false,
  };
}

function runField(run, camelKey, snakeKey) {
  return cleanText(valueOf(run, camelKey, snakeKey, ""));
}

function matchingRuns(schedule, runs = []) {
  return (Array.isArray(runs) ? runs : []).filter((run) => {
    return (
      runField(run, "profileId", "profile_id") === schedule.profileId &&
      runField(run, "assessmentTemplateId", "assessment_template_id") ===
        schedule.assessmentTemplateId
    );
  });
}

function newestRun(runs) {
  return runs.slice().sort((a, b) => {
    const dateCompare = runField(b, "dateYmd", "date_ymd").localeCompare(
      runField(a, "dateYmd", "date_ymd")
    );
    if (dateCompare !== 0) return dateCompare;
    return runField(b, "startedAt", "started_at").localeCompare(
      runField(a, "startedAt", "started_at")
    );
  })[0] || null;
}

export function buildAssessmentScheduleStatus(rawSchedule, runs = [], todayYmd) {
  const schedule = normaliseAssessmentSchedule(rawSchedule);
  const today = cleanText(todayYmd);
  const start = schedule.startDate;
  const startDelta = assessmentDaysBetween(start, today);

  if (!schedule.active || !dateFromYmd(start) || !dateFromYmd(today)) {
    return {
      schedule,
      state: schedule.active ? "invalid" : "inactive",
      cycleStartYmd: "",
      cycleEndYmd: "",
      nextCycleStartYmd: "",
      completedRun: null,
      inProgressRun: null,
    };
  }

  const scopedRuns = matchingRuns(schedule, runs);
  const inProgressRun = newestRun(
    scopedRuns.filter(
      (run) => runField(run, "status", "status").toLowerCase() === "in_progress"
    )
  );

  if (startDelta < 0) {
    return {
      schedule,
      state: inProgressRun ? "in_progress" : "upcoming",
      cycleIndex: 0,
      cycleStartYmd: start,
      cycleEndYmd: addAssessmentDays(start, schedule.windowDays - 1),
      nextCycleStartYmd: addAssessmentDays(start, schedule.cadenceDays),
      completedRun: null,
      inProgressRun,
      daysUntilCycle: Math.abs(startDelta),
      daysPastWindow: 0,
    };
  }

  const cycleIndex = Math.floor(startDelta / schedule.cadenceDays);
  const cycleStartYmd = addAssessmentDays(
    start,
    cycleIndex * schedule.cadenceDays
  );
  const nextCycleStartYmd = addAssessmentDays(
    cycleStartYmd,
    schedule.cadenceDays
  );
  const cycleEndYmd = addAssessmentDays(
    cycleStartYmd,
    schedule.windowDays - 1
  );

  const completedRun = newestRun(
    scopedRuns.filter((run) => {
      if (runField(run, "status", "status").toLowerCase() !== "completed") {
        return false;
      }
      const runDate = runField(run, "dateYmd", "date_ymd");
      return runDate >= cycleStartYmd && runDate < nextCycleStartYmd;
    })
  );

  let state = "due";
  if (inProgressRun) state = "in_progress";
  else if (completedRun) state = "completed";
  else if (today > cycleEndYmd) state = "overdue";

  return {
    schedule,
    state,
    cycleIndex,
    cycleStartYmd,
    cycleEndYmd,
    nextCycleStartYmd,
    completedRun,
    inProgressRun,
    daysUntilCycle: 0,
    daysPastWindow:
      state === "overdue"
        ? Math.max(0, assessmentDaysBetween(cycleEndYmd, today) || 0)
        : 0,
  };
}

export function buildAssessmentScheduleStatuses({
  schedules = [],
  runs = [],
  todayYmd,
} = {}) {
  return (Array.isArray(schedules) ? schedules : [])
    .map((schedule) => buildAssessmentScheduleStatus(schedule, runs, todayYmd))
    .filter((status) => status.state !== "inactive")
    .sort((a, b) => {
      const priority = {
        in_progress: 0,
        overdue: 1,
        due: 2,
        upcoming: 3,
        completed: 4,
        invalid: 5,
      };
      const stateCompare =
        (priority[a.state] ?? 99) - (priority[b.state] ?? 99);
      if (stateCompare !== 0) return stateCompare;
      return a.cycleStartYmd.localeCompare(b.cycleStartYmd);
    });
}
