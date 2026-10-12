Warning: truncated output (original token count: 136798)
Total output lines: 16516

import { hasSportAvatarArtwork, sportAvatarArtworkSrc, PAIRED_SPORT_AVATAR_ARTWORK_READY } from "./config/sportAvatarArtwork";
import { loadVerifiedActivityData } from "./verifiedActivityDb.js";
import { buildPerformanceEvidence, performanceEvidenceForCard } from "./engine/performanceBadgeEvidence.js";
import { performanceBadgeState } from "./engine/performanceBadgeProgression.js";
import { sportsMasteryState } from "./engine/sportsMasteryProgression.js";
import SportsMasteryCabinet from "./components/rewards/SportsMasteryCabinet.jsx";
import MasteryDisclosure from "./components/rewards/MasteryDisclosure.jsx";
import SportMasteryCollections from "./components/rewards/SportMasteryCollections.jsx";
import { claimMasterySequence } from "./engine/masteryClaimSequence.js";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { readLogNavigation, writeLogNavigation, clearLogNavigation } from "./engine/logNavigationState.js";
import { selectDayLogSnapshot, sameLogView, createKeyedLogWriteQueue } from "./engine/dayLogLifecycle.js";
import ExtraBlockNotice from "./components/log/ExtraBlockNotice.jsx";
import MovementCompletion from "./components/log/MovementCompletion.jsx";
import ActivityCalendar from "./components/log/ActivityCalendar.jsx";
import { movementEntriesComplete } from "./engine/movementEntryCompletion.js";
import { mapProfileHistoryRows } from "./engine/profileHistoryRows.js";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

import {
  isSupabaseReady,
  getSession,
  signIn,
  signUp,
  signOut,
  resendSignUpConfirmation,
  getOrCreateFamily,
  listProfiles,
  addProfile,
  renameProfile,
  setProfileBodyweight,
  updateAgeGroup,
  listProfileRecoveryPeriods,
  setProfileRecoveryMode,
  updateProfileRecoveryPeriodTiming,
  archiveProfile,
  getPlan,
  upsertPlan,
  getProfilePlan,
  upsertProfilePlan,
  listProfileStreakScheduleSnapshots,
  getLog,
  upsertLog,
  listLogs,
  loadSessionLibrary,
  setFamilyPinHash,
  clearFamilyPin,
  updateFamilyOnboardingState,
} from "./db";

import { BADGE_CARDS, BADGE_DEFS, TIERS, SPORT_MASTERY_PACKS, formatTimeMMSS } from "./config/badges";
import { buildBadgeStatsV2 } from "./engine/badgeStatsV2";
import {
  buildXpDebugRows as buildXpDebugRowsEngine,
  computeXpFromLogs as computeXpFromLogsEngine,
  getWeekStartYmd,
} from "./engine/xpEngine.js";
import { buildWorkoutStreakSeries } from "./engine/workoutStreakEngine.js";
import {
  buildDashboardWeekSummary,
  buildRewardsRoadmap,
  getNextAvatarReward,
} from "./engine/dashboardEngine.js";
import {
  buildActivityCalendarDay,
  buildRecentActivityCalendarDays,
  shiftActivityCalendarDate,
} from "./engine/activityCalendarEngine.js";
import {
  getAccountHydrationPhase,
  runAccountLoadWithRetry,
} from "./engine/accountHydrationEngine.js";
import {
  extractComparableMovementSets,
  findLastComparableMovementSets,
  movementHistoryPoint,
  normaliseMovementHistoryName,
} from "./engine/movementHistoryEngine.js";
import {
  PRESTIGE_FRAME_OPTIONS,
  PRESTIGE_FRAME_UNLOCK_XP,
  getPrestigeFrameState,
  normalisePrestigeFrameKey,
} from "./engine/avatarFrameSettings.js";
import {
  buildSessionLogBlockSnapshot,
  hydrateSessionSnapshotsInLog,
  reconcileSessionLogBlockSnapshot,
  sessionHasActivity,
} from "./engine/sessionEngine.js";
import {
  SESSION_COMPLETION_XP,
  getSessionBlockLoadScore,
  getSessionBlockTrainingMinutes,
  getSessionBlockXp,
  sessionBlockHasActivity,
  sessionBlockIsComplete,
} from "./engine/sessionCore.js";
import {
  applyProfileRecoveryModeToPlannedBlocks,
  getProfileRecoveryModeForDate,
  isProfileRecoveryLogBlock,
  isProfileRecoveryModeLog,
  normaliseProfileRecoveryMode,
  profileRecoveryBlockComplete,
} from "./engine/recoveryModeEngine.js";
import {
  computeActivityMinutesForDay,
  formatActivityMinutes,
} from "./engine/activityTimeEngine.js";
import { buildStrengthActivityTrend } from "./engine/strengthActivityTrendEngine.js";

import { AVATAR_PACKS, AVATAR_PACK_GROUPS } from "./config/avatars";
import { resolveAvatarIdentity, AVATAR_IDENTITY_TRACKING_RELEASED_AT } from "./config/avatarIdentity";
import {
  listAvatarSelectionPeriods,
  listProfileGroupAwards,
  setProfileAvatarIdentity,
} from "./avatarIdentityDb";
import { loadCompletedAssessmentHistory } from "./assessmentRunDb";
import { buildAvatarPersonalStats } from "./engine/avatarIdentityEngine";
import AvatarIdentityView from "./components/avatar/AvatarIdentityView.jsx";
import SessionPlanBlockEditor, {
  createSessionPlanBlock,
  normaliseSessionPlanBlock,
} from "./components/sessions/SessionPlanBlockEditor.jsx";
import SessionLogger from "./components/sessions/SessionLogger.jsx";
import AssessmentTemplateLibrary from "./components/assessments/AssessmentTemplateLibrary.jsx";
import AssessmentHub from "./components/assessments/AssessmentHub.jsx";
import ProgressDashboard from "./components/progress/ProgressDashboard.jsx";
import ProgramNotifications from "./programs/ProgramNotifications.jsx";
import ProgramCheckpointEditor from "./programs/ProgramCheckpointEditor.jsx";
import { listRecipientProgramControls } from "./programs/programWorkflowDb.js";
import PerformanceDashboard from "./components/dashboard/PerformanceDashboard.jsx";
import ConnectionsSettings from "./components/settings/ConnectionsSettings.jsx";
import LogVerificationSummary from "./components/verification/LogVerificationSummary.jsx";
import FirstRunTutorial, {
  FIRST_RUN_TUTORIAL_VERSION,
} from "./components/onboarding/FirstRunTutorial.jsx";
import PublicSite from "./components/public/PublicSite.jsx";
import AccountPrivacyPanel from "./components/settings/AccountPrivacyPanel.jsx";
import { sendWelcomeTutorialEmail } from "./accountLifecycleDb.js";
import {
  removeLibraryTrainingProgramAddOn,
  removeTrainingProgramAddOn,
  undoTrainingProgramAssignment,
  saveTrainingProgram,
} from "./programs/trainingProgramDb.js";
import {
  extractShareablePlanContent,
  addProgramAssessment,
  addProgramPhase,
  duplicateProgramWeek,
  ensurePlanProgram,
  flattenProgramWeeks,
  getPlanEditorWeek,
  getProgramWeekPosition,
  planHasAnyCycleBlocks,
  prepareImportedPlanContent,
  removeProgramAssessment,
  removeProgramPhase,
  removeProgramWeek,
  resolvePlanForDate,
  setPlanProgramWeek,
  updatePlanProgramSettings,
  updateEditableProgramAddOn,
  updateProgramPhase,
} from "./engine/planCycleEngine.js";
const GroupHub = React.lazy(() => import("./groups/GroupHub.jsx"));
import useProgramDraft from "./programs/useProgramDraft.js";
import { saveProgramDraft } from "./programs/programDraftDb.js";

const TrainingProgramLibrary = React.lazy(() => import("./programs/TrainingProgramLibrary.jsx"));

// -------- Utilities ----------
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const LOG_INPUT_SAVE_DEBOUNCE_MS = 900;
function weekdayFromYMD(ymd) {
  try {
    const d = new Date(`${ymd}T00:00:00`);
    return WEEKDAYS[d.getDay()] || "";
  } catch {
    return "";
  }
}

function getWeekdayKey(ymd) {
  return weekdayFromYMD(ymd);
}

function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// -------- Utilities ----------
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}
function safeNumber(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}
function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function softFloor(value, floor, max = 100, softness = 12, hardMin = 0) {
  const v = clamp(safeNumber(value), hardMin, max);

  // Above the floor, leave the value untouched.
  if (v >= floor) return v;

  // Below the floor, compress the deficit so the number becomes
  // increasingly sticky as it approaches the floor, without becoming
  // a visibly fake hard clamp.
  const deficit = floor - v;
  const compressed = floor - deficit / (1 + deficit / softness);

  return clamp(compressed, hardMin, max);
}
// Build a simple target string for a strength movement given:
// - the movement config
// - the last logged sets in history
// - any planned reps text from the plan
function buildTargetInfoForMovement({ movement, lastSets, plannedRepsText }) {
  const baseText = (plannedRepsText || "").trim();

  if (!lastSets || !Array.isArray(lastSets) || lastSets.length === 0) {
    return {
      text: baseText ? `Today: ${baseText}` : "",
      todayText: baseText ? `Today: ${baseText}` : "",
      progressionText: "",
    };
  }

  const activeSets = lastSets.filter(setDidSomething);
  const lastTime = Math.max(0, ...activeSets.map((set) => safeNumber(set?.timeSeconds)));
  const lastReps = Math.max(0, ...activeSets.map((set) => safeNumber(set?.reps)));
  const weightedSets = activeSets
    .filter((set) => safeNumber(set?.weight) > 0)
    .sort((a, b) =>
      safeNumber(b?.weight) - safeNumber(a?.weight) ||
      safeNumber(b?.reps) - safeNumber(a?.reps)
    );
  const bestWeightedSet = weightedSets[0] || null;
  const lastWeight = safeNumber(bestWeightedSet?.weight);
  const weightedReps = safeNumber(bestWeightedSet?.reps);

  let progression = "";
  if (movement?.trackDuration && lastTime > 0) {
    progression = `Aim for ${Math.round(lastTime + 5)}s with the same clean form`;
  } else if (weightedReps > 0 && movement?.trackWeight && lastWeight > 0) {
    progression = `Aim for ${Math.round(weightedReps + 1)} clean reps at ${lastWeight} kg`;
  } else if (lastReps > 0) {
    progression = `Aim for ${Math.round(lastReps + 1)} clean reps`;
  } else if (movement?.trackWeight && lastWeight > 0) {
    progression = `Match ${lastWeight} kg with clean form; only progress if technique stays strong`;
  }

  const todayText = baseText ? `Today: ${baseText}` : "";
  const text =
    todayText && progression
      ? `${todayText} · Progression: ${progression}`
      : todayText || progression;

  return {
    text,
    todayText,
    progressionText: progression,
  };
}
// ----- V3 BLOCK MODEL HELPERS -----

function createStrengthBlock() {
  return {
    id: uid(),
    typeId: "strength", // "strength" | "hiit" | "box"
    label: "",
    note: "",
    restSec: 60,
    movements: [
      {
        id: uid(),
        name: "",
        sets: 3,
        reps: "",
        trackWeight: false,
        trackDuration: false,
        initialTarget: "",
        coachNote: "",
      },
    ],
  };
}

const CARDIO_TYPE_OPTIONS = [
  { value: "run", label: "Run" },
  { value: "cycle", label: "Cycle" },
  { value: "walk", label: "Walk" },
  { value: "swim", label: "Swim" },
  { value: "row", label: "Outdoor Rowing" },
  { value: "indoor_rowing", label: "Indoor Rowing" },
  { value: "team_sport", label: "Team Sport" },
  { value: "no_distance", label: "No Distance" },
  { value: "other", label: "Other" },
];

const TEAM_SPORT_ACTIVITY_CHIPS = [
  "Football Match",
  "Football Training",
  "Rugby",
  "Basketball",
  "Netball",
  "Hockey",
];

const NO_DISTANCE_ACTIVITY_CHIPS = [
  "Badminton",
  "Karate",
  "Fencing",
  "Yoga",
  "Tai Chi",
  "Circuits",
];

function isDistanceHiddenCardioType(cardioType) {
  return cardioType === "team_sport" || cardioType === "no_distance";
}

function createCardioBlock() {
  return {
    id: uid(),
    typeId: "cardio",
    label: "",
    note: "",
    cardioType: "run",
    cardioTypeOtherLabel: "",
    activityName: "",
    targetText: "",
    plannedMinutes: "",
  };
}

function createDurationBlock() {
  return {
    id: uid(),
    typeId: "duration",
    label: "",
    note: "",
    plannedMinutes: "",
  };
}

function createRecoveryBlock() {
  return {
    id: uid(),
    typeId: "recovery",
    label: "Recovery",
    note:
      "Recovery is where adaptation happens. Muscles repair. Energy restores. Smart athletes recover well so they can push harder next session.",
    recoveryMode: "full", // "full" | "light"
    plannedMinutes: "",
  };
}

function createTasksBlock() {
  return {
    id: uid(),
    typeId: "tasks",
    label: "",
    note: "",
    tasks: [
      {
        id: uid(),
        label: "",
        xpValue: 5,
        coachNote: "",
      },
    ],
  };
}

function ensureBlocksByWeekday(plan) {
  const base = plan || {};
  const existing = base.blocksByWeekday || {};
  const next = { ...existing };
  for (const d of weekdays) {
    if (!Array.isArray(next[d])) next[d] = [];
  }
  return { ...base, blocksByWeekday: next };
}

function ymd(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);
}

function ymdAddDays(ymdStr, days) {
  const d = new Date(`${ymdStr}T00:00:00`);
  d.setDate(d.getDate() + days);
  return ymd(d);
}
function formatDate(dISO) {
  const d = new Date(dISO + "T00:00:00");
  return d.toLocaleDateString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric" });
}
function weekKey(ymdStr) {
  const d = new Date(ymdStr + "T00:00:00");
  const day = d.getDay(); // Sun=0
  const diffToMon = (day + 6) % 7;
  const mon = new Date(d);
  mon.setDate(d.getDate() - diffToMon);
  return ymd(mon);
}
function monthKey(ymdStr) {
  const d = new Date(ymdStr + "T00:00:00");
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

async function sha256Hex(input) {
  const enc = new TextEncoder();
  const buf = await crypto.subtle.digest("SHA-256", enc.encode(input));
  const arr = Array.from(new Uint8Array(buf));
  return arr.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// -------- Sound (WebAudio) ----------
function createAudio() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  return new AudioCtx();
}
function playTone(ctx, { freq = 440, duration = 0.12, type = "sine", gain = 0.08, when = 0 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.02);
}
function playNoisePop(ctx, { gain = 0.05, when = 0, duration = 0.12 }) {
  if (!ctx) return;
  const t0 = ctx.currentTime + when;
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  source.connect(g);
  g.connect(ctx.destination);
  source.start(t0);
  source.stop(t0 + duration);
}
function playStartSound(ctx, theme = "classic") {
  if (theme === "arcade") {
    playTone(ctx, { freq: 523.25, duration: 0.07, type: "square", gain: 0.05, when: 0.0 });
    playTone(ctx, { freq: 659.25, duration: 0.07, type: "square", gain: 0.05, when: 0.08 });
    playTone(ctx, { freq: 783.99, duration: 0.08, type: "square", gain: 0.05, when: 0.16 });
    return;
  }
  if (theme === "chill") {
    playTone(ctx, { freq: 392, duration: 0.12, type: "sine", gain: 0.045, when: 0.0 });
    playTone(ctx, { freq: 523.25, duration: 0.14, type: "sine", gain: 0.04, when: 0.10 });
    playTone(ctx, { freq: 659.25, duration: 0.16, type: "sine", gain: 0.035, when: 0.22 });
    return;
  }
  playTone(ctx, { freq: 440, duration: 0.08, type: "triangle", gain: 0.06, when: 0.0 });
  playTone(ctx, { freq: 660, duration: 0.09, type: "triangle", gain: 0.06, when: 0.08 });
  playTone(ctx, { freq: 880, duration: 0.10, type: "triangle", gain: 0.06, when: 0.17 });
}
function playWhoosh(ctx, combo = 1, theme = "classic") {
  const c = clamp(combo, 1, 10);

  if (theme === "chill") {
    playTone(ctx, { freq: 260 + c * 18, duration: 0.14, type: "sine", gain: 0.025, when: 0.0 });
    playTone(ctx, { freq: 340 + c * 22, duration: 0.16, type: "sine", gain: 0.02, when: 0.05 });
    return;
  }

  const base = theme === "arcade" ? 320 : 240;
  const t = theme === "arcade" ? "square" : "sawtooth";
  playTone(ctx, { freq: base + c * 30, duration: 0.10, type: t, gain: 0.035, when: 0.0 });
  playTone(ctx, { freq: base + c * 45, duration: 0.10, type: t, gain: 0.03, when: 0.03 });
}
function playBling(ctx, combo = 1, theme = "classic") {
  const c = clamp(combo, 1, 10);
  const mult = 1 + c * 0.04;

  if (theme === "chill") {
    playTone(ctx, { freq: 784 * mult, duration: 0.08, type: "sine", gain: 0.035, when: 0.0 });
    playTone(ctx, { freq: 987.77 * mult, duration: 0.10, type: "sine", gain: 0.03, when: 0.08 });
    playTone(ctx, { freq: 1174.66 * mult, duration: 0.12, type: "sine", gain: 0.025, when: 0.18 });
    return;
  }

  const type = theme === "arcade" ? "square" : "sine";
  playTone(ctx, { freq: 1046.5 * mult, duration: 0.055, type, gain: 0.055, when: 0.0 });
  playTone(ctx, { freq: 1318.5 * mult, duration: 0.065, type, gain: 0.05, when: 0.06 });
  playTone(ctx, { freq: 1567.98 * mult, duration: 0.075, type, gain: 0.045, when: 0.13 });
}
function playLevelUp(ctx, theme = "classic") {
  if (theme === "chill") {
    playTone(ctx, { freq: 261.63, duration: 0.20, type: "sine", gain: 0.03, when: 0.0 });
    playTone(ctx, { freq: 392.0, duration: 0.22, type: "sine", gain: 0.03, when: 0.08 });
    playTone(ctx, { freq: 523.25, duration: 0.24, type: "sine", gain: 0.028, when: 0.18 });
    playTone(ctx, { freq: 783.99, duration: 0.18, type: "sine", gain: 0.022, when: 0.34 });
    return;
  }

  const t = theme === "arcade" ? "square" : "sawtooth";
  playTone(ctx, { freq: 220, duration: 0.18, type: t, gain: 0.04, when: 0.0 });
  playTone(ctx, { freq: 330, duration: 0.18, type: t, gain: 0.04, when: 0.02 });
  playTone(ctx, { freq: 440, duration: 0.18, type: t, gain: 0.04, when: 0.04 });
  playNoisePop(ctx, { gain: 0.035, when: 0.22, duration: 0.10 });
  playTone(ctx, { freq: 880, duration: 0.06, type: "triangle", gain: 0.03, when: 0.24 });
  playTone(ctx, { freq: 1320, duration: 0.06, type: "triangle", gain: 0.03, when: 0.30 });
  playTone(ctx, { freq: 1760, duration: 0.06, type: "triangle", gain: 0.03, when: 0.36 });
}

// -------- Default plan (fully customisable) ----------
const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// built-in activity types
function builtInTypes() {
  return [
    { id: "strength", name: "Strength / HIIT / Box (sets, reps or duration)", kind: "strength", movementsEnabled: true, sets: 3, allowWeight: true },
    { id: "cardio", name: "Cardio (distance, time or target)", kind: "cardio", movementsEnabled: false, fields: { distanceKm: true, durationMin: true, avgSpeed: true } },
    { id: "duration", name: "Duration (mobility, yoga or stretching)", kind: "custom", movementsEnabled: false, fields: { durationMin: true } },
    { id: "recovery", name: "Recovery", kind: "recovery", movementsEnabled: false, fields: { recoveryDone: true, plannedMinutes: true } },
    { id: "session", name: "Session Library workout", kind: "session", movementsEnabled: false },
    { id: "tasks", name: "Tick-box tasks (yes/no)", kind: "task", movementsEnabled: false, fields: { tasks: true } },
  ];
}


function defaultPlanForFamily() {
  const types = builtInTypes();

  // V3: day has NO "type" – only an ordered list of blocks.
  const blocksByWeekday = {
    Mon: [],
    Tue: [],
    Wed: [],
    Thu: [],
    Fri: [],
    Sat: [],
    Sun: [],
  };

  return {
    version: 3,
    activityTypes: types,
    blocksByWeekday,
  };
}

function blankPlanForNewProfile() {
  const plan = defaultPlanForFamily();
  return {
    ...plan,
    meta: {
      ...(plan.meta || {}),
      planSetupPrompt: true,
    },
  };
}

function planHasBlocks(plan) {
  return planHasAnyCycleBlocks(plan || defaultPlanForFamily());
}

// -------- Day activities (primary + extras) ----------
// Primary activity still comes from dayTypeByWeekday / movementsByWeekday / cardioTargetByWeekday
// Extras are stored in plan.dayActivitiesByWeekday[weekday] as an array of blocks.
function getDayActivitiesForWeekday(plan, weekday) {
  if (!plan || !weekday) return [];

  // --- Plan V3: prefer blocksByWeekday if present ---
  const hasBlocks =
    plan.blocksByWeekday &&
    Array.isArray(plan.blocksByWeekday[weekday]);

  if (hasBlocks) {
    const blocksForDay = plan.blocksByWeekday[weekday];

    // IMPORTANT: keep the full block object (cardioType, plannedMinutes, etc.)
    // and just add metadata like id / isPrimary.
    return blocksForDay.map((b, idx) => ({
      ...b,
      id: b.id || `${weekday}_${idx === 0 ? "main" : `extra_${idx - 1}`}`,
      typeId: b.typeId || "strength",
      isPrimary: idx === 0,
    }));
  }

  // --- Legacy fallback: derive from dayType + movements + extras list ---
  const typeId = plan.dayTypeByWeekday?.[weekday] || "strength";
  const movements = plan.movementsByWeekday?.[weekday] || [];
  const restSec = plan.restSecByWeekday?.[weekday] ?? 60;
  const cardioTarget = plan.cardioTargetByWeekday?.[weekday] || "";

  const primary = {
    id: `${weekday}_main`,
    typeId,
    label: "",
    note: "",
    movements,
    restSec,
    cardioTarget,
    isPrimary: true,
    tasks: [],
  };

  const extrasRaw = Array.isArray(plan.dayActivitiesByWeekday?.[weekday])
    ? plan.dayActivitiesByWeekday[weekday]
    : [];

  const extras = extrasRaw.map((block, idx) => ({
    id: block.id || `${weekday}_extra_${idx}`,
    typeId: block.typeId || "tasks",
    label: block.label || "",
    note: typeof block.note === "string" ? block.note : "",
    movements: block.movements || [],
    restSec: typeof block.restSec === "number" ? block.restSec : undefined,
    cardioTarget: block.cardioTarget,
    tasks: Array.isArray(block.tasks) ? block.tasks : [],
    isPrimary: false,
  }));

  return [primary, ...extras];
}

// Update only the *extra* blocks for a given weekday, leaving the primary plan intact.
function updateDayActivities(plan, weekday, updater) {
  if (!plan || !weekday || typeof updater !== "function") return plan;

  // --- Plan V2: operate on blocksByWeekday if present ---
  if (plan.blocksByWeekday && Array.isArray(plan.blocksByWeekday[weekday])) {
    const existingBlocks = plan.blocksByWeekday[weekday] || [];
    if (existingBlocks.length === 0) {
      // Nothing sensible to update
      return plan;
    }

    const primary = existingBlocks[0];
    const extras = existingBlocks.slice(1);
    const nextExtras = updater(extras, primary) || [];

    const nextBlocks = [primary, ...nextExtras];

    return {
  ...plan,
  blocksByWeekday: {
    ...(plan.blocksByWeekday || {}),
    [weekday]: nextBlocks.map((block, idx) => ({
      id: block.id || `${weekday}_${idx === 0 ? "main" : `extra_${idx - 1}`}`,
      typeId: block.typeId || primary.typeId || "strength",
      label: block.label || "",
      note: typeof block.note === "string" ? block.note : "",
      movements: Array.isArray(block.movements) ? block.movements : [],
      restSec:
        typeof block.restSec === "number"
          ? block.restSec
          : typeof primary.restSec === "number"
          ? primary.restSec
          : plan.restSecByWeekday?.[weekday] ?? 60,
      cardioTarget:
        typeof block.cardioTarget === "string"
          ? block.cardioTarget
          : primary.cardioTarget ||
            plan.cardioTargetByWeekday?.[weekday] ||
            "",
      tasks: Array.isArray(block.tasks) ? block.tasks : [],
    })),
  },
};

  }

  // --- Legacy fallback: update dayActivitiesByWeekday only ---
  const all = getDayActivitiesForWeekday(plan, weekday);
  const primary = all[0];
  const extras = all.slice(1);
  const nextExtras = updater(extras, primary) || [];

  return {
    ...plan,
    dayActivitiesByWeekday: {
      ...(plan.dayActivitiesByWeekday || {}),
      [weekday]: nextExtras.map((block, idx) => ({
  id: block.id || `${weekday}_extra_${idx}`,
  typeId: block.typeId || "tasks",
  label: block.label || "",
  note: typeof block.note === "string" ? block.note : "",
  movements: block.movements || [],
  restSec: typeof block.restSec === "number" ? block.restSec : undefined,
  cardioTarget: block.cardioTarget,
  tasks: Array.isArray(block.tasks) ? block.tasks : [],
})),
    },
  };
}

// -------- Blocks helpers for Plan V2 (Stage 1) ----------
function getBlocksForPlanWeekday(plan, weekday) {
  // For now, just use the existing helper which already prefers blocksByWeekday
  return getDayActivitiesForWeekday(plan, weekday);
}

function updateBlocksForPlanWeekday(plan, weekday, updater) {
  if (!plan || !weekday || typeof updater !== "function") return plan;

  const base = ensureBlocksByWeekday(plan);
  const current = Array.isArray(base.blocksByWeekday[weekday])
    ? base.blocksByWeekday[weekday]
    : [];

  const nextBlocks = updater(current) || current;

  if (!Array.isArray(nextBlocks)) {
    return base;
  }

  return {
    ...base,
    blocksByWeekday: {
      ...base.blocksByWeekday,
      [weekday]: nextBlocks,
    },
  };
}


// -------- Calculations ----------
function setDidSomething(s) {
  if (!s || typeof s !== "object") return false;

  const reps = safeNumber(s.reps);
  const time = safeNumber(s.timeSeconds);
  const count = safeNumber(s.count);
  const distanceKm = safeNumber(s.distanceKm);
  const durationMin = safeNumber(s.durationMin);
  return reps > 0 || time > 0 || count > 0 || distanceKm > 0 || durationMin > 0;
}
function setVolume(s) {
  if (!s || typeof s !== "object") return 0;

  const reps = safeNumber(s.reps);
  const w = safeNumber(s.weight);
  return reps * w;
}
function scoreSets(sets) {
  if (!Array.isArray(sets)) return 0;
  let score = 0;
  for (const s of sets) {
  if (!s || typeof s !== "object") continue;

  // Strength volume is the main signal
  score += setVolume(s);

    // Small bonuses for reps / time / distance
    score += safeNumber(s.reps) * 0.5;
    score += safeNumber(s.timeSeconds) * 0.1;
    score += safeNumber(s.count) * 0.5;
    score += safeNumber(s.distanceKm) * 10;
    score += safeNumber(s.durationMin);
  }
  return score;
}
function calcComboMax(log) {
  const entries = log?.entries || {};
  let combo = 0;
  let maxCombo = 0;
  for (const sets of Object.values(entries)) {
    for (const s of sets || []) {
      if (setDidSomething(s)) {
        combo += 1;
        maxCombo = Math.max(maxCombo, combo);
      } else combo = 0;
    }
  }
  return maxCombo;
}
function findLastMovementSets(allLogs, movement, beforeYmd) {
  return findLastComparableMovementSets(allLogs, movement, beforeYmd);
}

// Backwards-compatible wrapper for older calls.
// Some parts of the app may still call findLastMovementSetsInHistory,
// so we forward those to the new helper.
function findLastMovementSetsInHistory(allLogs, profileId, movementId) {
  // We ignore profileId here because allLogs is already filtered
  // to the active profile in our stats fetch.
  // Use a "far future" date so we consider all historical logs.
  return findLastMovementSets(allLogs, movementId, "9999-12-31");
}

function summarizeStrengthSets(sets) {
  if (!Array.isArray(sets) || !sets.length) return "—";
  const reps = sets.map((s) => (Number.isFinite(Number(s?.reps)) ? Number(s.reps) : 0)).filter((x) => x > 0);
  const w = sets.map((s) => (Number.isFinite(Number(s?.weight)) ? Number(s.weight) : 0));
  const maxW = Math.max(...w, 0);
  const repStr = reps.length ? reps.join(",") : "—";
  if (maxW > 0) return `${repStr} reps @ ${maxW}kg`;
  return repStr ? `${repStr} reps` : "—";
}
function suggestStrengthTarget({ ex, lastSets, initialTarget, ageGroup }) {
  const step = ageGroup === "adult" ? 2.5 : 1.0;
  const repFloor = 8;
  const repCeil = 12;

  if (!lastSets || !lastSets.some(setDidSomething)) {
    if (initialTarget?.text) {
      return { text: initialTarget.text };
    }
    if (initialTarget?.reps || initialTarget?.weight) {
      const r = initialTarget?.reps ? Number(initialTarget.reps) : null;
      const w = initialTarget?.weight ? Number(initialTarget.weight) : null;
      if (w && ex.allowWeight) return { text: `${r || repFloor} reps @ ${w}kg` };
      if (r) return { text: `${r} reps` };
    }
    return { text: "Log once to generate targets." };
  }

  const reps = lastSets.map((s) => (Number.isFinite(Number(s?.reps)) ? Number(s.reps) : 0)).filter((x) => x > 0);
  const w = lastSets.map((s) => (Number.isFinite(Number(s?.weight)) ? Number(s.weight) : 0)).filter((x) => x > 0);
  const minReps = reps.length ? Math.min(...reps) : 0;
  const maxW = w.length ? Math.max(...w) : 0;

  if (ex.allowWeight && maxW > 0) {
    if (minReps >= repCeil) {
      const nextW = Math.round((maxW + step) * 10) / 10;
      return { text: `${repFloor}-${repCeil} reps @ ${nextW}kg` };
    }
    const nextReps = Math.min(repCeil, Math.max(repFloor, minReps + 1));
    return { text: `${nextReps} reps @ ${maxW}kg` };
  }

  const nextReps = minReps ? minReps + 1 : repFloor;
  return { text: `${nextReps} reps` };
}
function findLastCardio(allLogs, beforeYmd, currentBlock = null) {
  if (!Array.isArray(allLogs)) return null;

  const currentId = currentBlock?.id || "";
  const currentType = currentBlock?.cardioType || "run";

  for (let i = allLogs.length - 1; i >= 0; i--) {
    const row = allLogs[i];
    const date = row?.date_ymd || row?.date;
    if (!date || date >= beforeYmd) continue;

    const log = row?.log || row?.log_json || row;
    if (!log) continue;

    if (Array.isArray(log.blocks) && log.blocks.length) {
      const cardioBlocks = log.blocks.filter((block) => block?.cardio);
      const exact = cardioBlocks.find((block) => currentId && block.id === currentId);
      const comparable =
        exact ||
        cardioBlocks.find(
          (block) => (block.cardioType || "run") === currentType
        );

      if (comparable?.cardio) {
        const distanceKm = safeNumber(comparable.cardio.distanceKm);
        const durationMin = safeNumber(comparable.cardio.durationMin);
        if (distanceKm > 0 || durationMin > 0) {
          return {
            distanceKm,
            durationMin,
            avgSpeedKmh:
              distanceKm > 0 && durationMin > 0
                ? distanceKm / (durationMin / 60)
                : safeNumber(comparable.cardio.avgSpeedKmh),
          };
        }
      }
    }

    // Legacy cardio can only be safely compared to normal distance-based cardio.
    if (!currentBlock || currentType === "run") {
      const legacy = log.cardio;
      if (
        legacy &&
        (safeNumber(legacy.distanceKm) > 0 ||
          safeNumber(legacy.durationMin) > 0)
      ) {
        return {
          distanceKm: safeNumber(legacy.distanceKm),
          durationMin: safeNumber(legacy.durationMin),
          avgSpeedKmh: safeNumber(legacy.avgSpeedKmh),
        };
      }
    }
  }

  return null;
}

function isCardioImproved(current, last) {
  if (!current || !last) return false;

  const curD = safeNumber(current.distanceKm);
  const curT = safeNumber(current.durationMin);
  const lastD = safeNumber(last.distanceKm);
  const lastT = safeNumber(last.durationMin);

  // If we have distance + time for both, compare speed
  if (curD && curT && lastD && lastT) {
    const curSpeed = curD / curT;
    const lastSpeed = lastD / lastT;
    return curSpeed > lastSpeed + 0.01; // ~1% faster
  }

  // Otherwise fall back to simple distance / duration comparisons
  if (curD && lastD) return curD > lastD + 0.05;      // +0.05km
  if (curT && lastT) return curT > lastT + 1;         // +1 min

  return false;
}

function formatPaceFromMinutes(minPerUnit) {
  const n = Number(minPerUnit);
  if (!Number.isFinite(n) || n <= 0) return null;
  const totalSec = Math.round(n * 60);
  const min = Math.floor(totalSec / 60);
  const sec = String(totalSec % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function getPaceFromSpeedKmh(speedKmh) {
  const s = safeNumber(speedKmh);
  if (!s) return null;

  // Pace per km
  const minPerKm = 60 / s;

  // Pace per mile (km/h -> mph then 60 / mph)
  const mph = s * 0.621371;
  const minPerMile = 60 / mph;

  const perKm = formatPaceFromMinutes(minPerKm);
  const perMile = formatPaceFromMinutes(minPerMile);

  if (!perKm && !perMile) return null;
  return { perKm, perMile };
}

function summarizeCardio(c) {
  if (!c) return "—";

  const d = safeNumber(c.distanceKm);
  const t = safeNumber(c.durationMin);

  // Derive avg speed from distance + time when possible
  let s = 0;
  if (d > 0 && t > 0) {
    s = d / (t / 60); // km/h
  } else {
    s = safeNumber(c.avgSpeedKmh);
  }

  const bits = [];
  if (d) bits.push(`${d}km`);
  if (t) bits.push(`${t}min`);
  if (s) bits.push(`${s.toFixed(1)}km/h`);

  return bits.join(" • ") || "—";
}

function suggestCardioTarget({ lastCardio, distanceEnabled = true }) {
  if (!distanceEnabled) {
    return { text: "", targetSpeedKmh: null };
  }
  if (!lastCardio) {
    return { text: "Log a distance + time result to generate a performance target.", targetSpeedKmh: null };
  }

  const d = safeNumber(lastCardio.distanceKm);
  const t = safeNumber(lastCardio.durationMin);

  if (d > 0 && t > 0) {
    const speed = d / (t / 60);
    const targetSpeedKmh = speed + 0.2;
    return {
      text: `Try +0.2 km/h average speed (≈ ${targetSpeedKmh.toFixed(1)} km/h)`,
      targetSpeedKmh,
    };
  }

  if (d > 0) {
    return {
      text: `Try +0.1 km distance (≈ ${(d + 0.1).toFixed(1)} km)`,
      targetSpeedKmh: null,
    };
  }

  return { text: "", targetSpeedKmh: null };
}

function isDayComplete(log, planDay) {
  if (!log) return false;

  // Pure “tasks day” – any ticked task counts
  if (planDay.kind === "task") {
    const anyDone = Object.values(log?.tasks || {}).some((t) => t && t.done);
    return anyDone;
  }

  // Cardio day: prefer per-block cardio if present, otherwise fall back to old log.cardio
  if (planDay.kind === "cardio") {
    // 1) Check per-block cardio
    if (Array.isArray(log.blocks) && log.blocks.length) {
      let totalDist = 0;
      let totalMin = 0;
      for (const b of log.blocks) {
        if (!b || !b.cardio) continue;
        totalDist += safeNumber(b.cardio.distanceKm);
        totalMin += safeNumber(b.cardio.durationMin);
      }
      if (totalDist > 0 && totalMin > 0) return true;
    }

    // 2) Fallback to legacy day-level cardio
    return (
      safeNumber(log.cardio?.distanceKm) > 0 &&
      safeNumber(log.cardio?.durationMin) > 0
    );
  }

  // Duration-only/custom day: prefer per-block duration if present
  if (planDay.kind === "custom") {
    if (Array.isArray(log.blocks) && log.blocks.length) {
      let totalMin = 0;
      for (const b of log.blocks) {
        if (!b || !b.duration) continue;
        totalMin += safeNumber(b.duration.minutes);
      }
      if (totalMin > 0) return true;
    }

    // Fallback to legacy custom.durationMin
    return safeNumber(log.custom?.durationMin) > 0;
  }

  // Strength / time-based day (prefer per-block sets, fall back to legacy entries)
  if (!planDay.movementsEnabled) return false;
  const ex = planDay.movements || [];
  if (!ex.length) return false;

  const plannedMovementIds = new Set(
    ex.map((m) => m && m.id).filter(Boolean)
  );

  // 1) New model: check per-block sets for any planned movement
  if (
    Array.isArray(log.blocks) &&
    log.blocks.length &&
    plannedMovementIds.size
  ) {
    for (const b of log.blocks) {
      if (!b || !b.sets || typeof b.sets !== "object") continue;
      for (const [mid, sets] of Object.entries(b.sets)) {
        if (!plannedMovementIds.has(mid)) continue;
        if (Array.isArray(sets) && sets.some(setDidSomething)) {
          return true;
        }
      }
    }
  }

  // 2) Legacy model: fallback to log.entries
  const entries = log.entries || {};
  for (const m of ex) {
    const sets = entries[m.id] || [];
    if (Array.isArray(sets) && sets.some(setDidSomething)) {
      return true;
    }
  }

  return false;
}

// Can be deleted once new xp engine works
function awardXpForDay(log, planDay) {
  const base = 10;
  const completion = isDayComplete(log, planDay) ? 25 : 0;
  const combo = clamp(log?.gamify?.comboMax || 0, 0, 30);
  return base + completion + combo;
}

function getCaloriesKindForLog(log) {
  if (!log) return "other";

  const blocks = Array.isArray(log.blocks) ? log.blocks : [];

  let hasCardio = false;
  let hasStrength = false;
  let hasDuration = false;

  if (blocks.length) {
    // New blocks model
    for (const b of blocks) {
      if (!b) continue;
      const typeId = b.typeId;

      // Cardio blocks (run / bike / swim / other)
      if (
        typeId === "cardio" ||
        typeId === "run" ||
        typeId === "swim"
      ) {
        const c = b.cardio || {};
        const cardioHasData =
          safeNumber(c.durationMin) > 0 ||
          safeNumber(c.distanceKm) > 0;
        if (cardioHasData) hasCardio = true;
      }

      // Strength / HIIT style blocks
      if (
        typeId === "strength" ||
        typeId === "hiit" ||
        typeId === "box"
      ) {
        if (b.sets && typeof b.sets === "object") {
          for (const key of Object.keys(b.sets)) {
            const arr = Array.isArray(b.sets[key]) ? b.sets[key] : [];
            if (arr.some(setDidSomething)) {
              hasStrength = true;
              break;
            }
          }
        }
      }

      // Duration-only blocks (yoga, mobility, etc.)
      if (typeId === "duration") {
        const d = b.duration || {};
        if (safeNumber(d.minutes) > 0) hasDuration = true;
      }
    }
  } else {
    // Legacy logs with no blocks snapshot yet
    if (
      safeNumber(log?.cardio?.durationMin) > 0 ||
      safeNumber(log?.cardio?.distanceKm) > 0
    ) {
      hasCardio = true;
    }

    if (safeNumber(log?.custom?.durationMin) > 0) {
      hasDuration = true;
    }

    const legacySets =
      (Object.values(log?.entries || {})
        .flat()
        .filter(setDidSomething).length);

    if (legacySets > 0) {
      hasStrength = true;
    }
  }

  // Priority: cardio > strength > duration-only
  if (hasCardio) return "cardio";
  if (hasStrength) return "strength";
  if (hasDuration) return "time";

  return "other";
}

function estimateCalories({ bodyWeightKg, log }) {
  const bw = safeNumber(bodyWeightKg);
  if (!bw) return null;

  // Use the same minutes as Today summary (cardio + duration + strength)
  const minutes = computeTotalMinutesForDay(log);
  if (!minutes) return null;

  // Infer an intensity kind from the actual blocks logged
  const kind = getCaloriesKindForLog(log);

  let met;
  if (kind === "cardio") {
    met = 8.3; // moderate run / bike
  } else if (kind === "strength") {
    met = 6.0; // strength / HIIT average
  } else if (kind === "time") {
    met = 4.0; // yoga / mobility / light activity
  } else {
    met = 5.0; // mixed / other
  }

  const kcalPerMin = (met * 3.5 * bw) / 200;
  return Math.round(kcalPerMin * minutes);
}

// -------- UI primitives ----------
function Card({ children, className = "", style }) {
  return (
    <div className={`card ${className}`} style={style}>
      {children}
    </div>
  );
}
function Pill({ children, onClick }) {
  if (onClick) {
    return (
      <button type="button" className="pill pillBtn" onClick={onClick}>
        {children}
      </button>
    );
  }
  return <span className="pill">{children}</span>;
}
function PrimaryButton({ children, onClick, disabled, className = "", ...buttonProps }) {
  return (
    <button type="button" className={`btn btn-primary ${className} ${disabled ? "btn-disabled" : ""}`.trim()} onClick={onClick} disabled={disabled} {...buttonProps}>
      {children}
    </button>
  );
}
function SecondaryButton({ children, onClick, disabled, className = "", ...buttonProps }) {
  return (
    <button type="button" className={`btn btn-secondary ${className} ${disabled ? "btn-disabled" : ""}`.trim()} onClick={onClick} disabled={disabled} {...buttonProps}>
      {children}
    </button>
  );
}
function Input({ value, onChange, placeholder, type = "text", min, step, readOnly, onKeyDown }) {
  const safeValue = value === undefined || value === null ? "" : value;

  return (
    <input
      value={safeValue}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      min={min}
      step={step}
      readOnly={readOnly}
      onKeyDown={onKeyDown}
      className="input"
    />
  );
}

function CommitOnBlurInput({
  value,
  onCommit,
  placeholder,
  type = "text",
  min,
  step,
  max,
  multiline = false,
  rows = 3,
  ...inputProps
}) {
  const externalValue =
    value === undefined || value === null ? "" : String(value);
  const [draft, setDraft] = useState(externalValue);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setDraft(externalValue);
  }, [externalValue]);

  const commit = () => {
    focusedRef.current = false;
    if (draft === externalValue) return;
    onCommit?.(draft);
  };

  const Element = multiline ? "textarea" : "input";
  return (
    <Element
      {...inputProps}
      className={multiline ? "textarea" : "input"}
      rows={multiline ? rows : undefined}
      max={max}
      value={draft}
      type={type}
      min={min}
      step={step}
      placeholder={placeholder}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (!multiline && event.key === "Enter" && !event.nativeEvent.isComposing) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}
function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="textarea"
    />
  );
}

function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
function SummaryStat({ label, value }) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
    </div>
  );
}

function FocusedLogBlock({
  label,
  programSource = null,
  extraLabel = "",
  onRemoveExtra,
  summary = "",
  open = false,
  complete = false,
  cancelled = false,
  suspended = false,
  onToggle,
  children,
}) {
  const stateClass = cancelled
    ? "isCancelled"
    : complete
    ? "isComplete"
    : suspended
    ? "isSuspended"
    : "";

  return (
    <div className={`focusedLogBlock ${open ? "isOpen" : "isCollapsed"} ${stateClass}${programSource ? " isProgramAdded" : ""}`}>
      <button
        type="button"
        className="focusedLogBlockSummary"
        onClick={onToggle}
        aria-expanded={open}
      >
        <div className="focusedLogBlockSummary__copy">
          {programSource ? (
            <div className="focusedLogBlockSource">Group Program · {programSource.title || "Assigned Program"}</div>
          ) : null}
          <div className="focusedLogBlockTitle">{label || "Activity"}</div>
          {summary ? <div className="focusedLogBlockMeta">{summary}</div> : null}
        </div>
        <span className="focusedLogBlockState" aria-hidden="true">
          {cancelled ? "C" : complete ? "✓" : suspended ? "Ⅱ" : open ? "−" : "+"}
        </span>
      </button>
      {open ? (
        <div className="focusedLogBlockBody">
          {children}
          {onRemoveExtra ? (
            <div className="extraBlockRemove">
              <SecondaryButton className="btnSmall" onClick={onRemoveExtra}>Remove</SecondaryButton>
            </div>
          ) : null}
          {extraLabel ? <div className="oneDayExtraPill">{extraLabel}</div> : null}
        </div>
      ) : null}
    </div>
  );
}

function BlockCancelControl({ cancelled, onChange, session = false }) {
  return (
    <label
      className={`blockCancelControl${cancelled ? " isCancelled" : ""}`}
      title={
        session
          ? "Mark this Session as cancelled when it was impossible to do. It will be handled by the normal cancellation rules."
          : "Mark this block as cancelled when it was impossible to do (e.g. weather, cancelled match). It won’t block your streak."
      }
    >
      <input
        type="checkbox"
        checked={cancelled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span>{cancelled ? "Cancelled" : "Cancel"}</span>
    </label>
  );
}

function toLocalDateTimeInputValue(iso) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (!Number.isFinite(parsed.getTime())) return "";
  const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

function RecoveryTimingEditor({ period, onSave }) {
  const [startValue, setStartValue] = useState(() =>
    toLocalDateTimeInputValue(period?.started_at)
  );
  const [endValue, setEndValue] = useState(() =>
    toLocalDateTimeInputValue(period?.ended_at)
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setStartValue(toLocalDateTimeInputValue(period?.started_at));
    setEndValue(toLocalDateTimeInputValue(period?.ended_at));
  }, [period?.id, period?.started_at, period?.ended_at]);

  if (!period) return null;

  const saveTiming = async () => {
    if (busy) return;
    if (!startValue) {
      window.alert("Choose when recovery started.");
      return;
    }

    const startDate = new Date(startValue);
    const endDate = endValue ? new Date(endValue) : null;

    if (!Number.isFinite(startDate.getTime())) {
      window.alert("Recovery start time is not valid.");
      return;
    }
    if (endDate && (!Number.isFinite(endDate.getTime()) || endDate < startDate)) {
      window.alert("Recovery end time must be after the start time.");
      return;
    }

    setBusy(true);
    try {
      await onSave?.({
        startedOn: startValue.slice(0, 10),
        startedAt: startDate.toISOString(),
        endedOn: endValue ? endValue.slice(0, 10) : null,
        endedAt: endDate ? endDate.toISOString() : null,
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="panel mt12">
      <div className="h3">
        {period.mode === "illness" ? "Illness" : "Injury"} recovery timing
      </div>
      <div className="muted mt4">
        Correct the actual start and end of this recovery period. Historical log
        days use this timing rather than today's recovery setting.
      </div>
      <div className="grid2 mt12">
        <label>
          <div className="label">Started</div>
          <input
            className="input"
            type="datetime-local"
            value={startValue}
            onChange={(event) => setStartValue(event.target.value)}
          />
        </label>
        <label>
          <div className="label">Ended (leave blank if active)</div>
          <input
            className="input"
            type="datetime-local"
            value={endValue}
            onChange={(event) => setEndValue(event.target.value)}
          />
        </label>
      </div>
      <div className="mt8">
        <SecondaryButton disabled={busy} onClick={saveTiming}>
          {busy ? "Saving…" : "Save recovery timing"}
        </SecondaryButton>
      </div>
    </div>
  );
}
function Challenge({ text, done }) {
  return (
    <div className="challenge">
      <div>{text}</div>
      <div className={`challenge-box ${done ? "done" : ""}`}>{done ? "✅" : "⬜"}</div>
    </div>
  );
}
function RewardItem({ title, desc, active, locked, onPick }) {
  return (
    <div className={`reward ${locked ? "locked" : ""}`}>
      <div>
        <div className="reward-title">
          {title} {active ? "✅" : ""}
        </div>
        <div className="reward-desc">
          {desc}
          {locked ? " (locked)" : ""}
        </div>
      </div>
      <SecondaryButton onClick={onPick} disabled={locked || active}>
        Pick
      </SecondaryButton>
    </div>
  );
}

// -------- Auth screen ----------
function AuthScreen({ onAuthed }) {
  const [mode, setMode] = useState("signin"); // signin | signup
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [pendingConfirmationEmail, setPendingConfirmationEmail] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);

  useEffect(() => {
    const onPublicAuthMode = (event) => {
      const nextMode = event?.detail === "signup" ? "signup" : "signin";
      setMode(nextMode);
      setMsg("");
      if (nextMode === "signup") setPendingConfirmationEmail("");
    };
    window.addEventListener("wt-public-auth-mode", onPublicAuthMode);
    return () => window.removeEventListener("wt-public-auth-mode", onPublicAuthMode);
  }, []);

  async function handleAuth() {
    if (busy) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !pw) {
      setMsg("Enter your email address and password.");
      return;
    }

    setBusy(true);
    setMsg("");

    try {
      if (mode === "signup") {
        if (!termsAccepted) {
          setMsg("Please agree to the Terms of Use and acknowledge the Privacy Notice before creating an account.");
          return;
        }
        const { data, error } = await signUp(cleanEmail, pw);
        if (error) {
          setMsg(error.message);
          return;
        }

        if (data?.session?.user) {
          setPendingConfirmationEmail("");
          onAuthed();
          return;
        }

        // Email confirmation is enabled: signup succeeded, but Supabase has
        // intentionally not authenticated this browser yet.
        setPendingConfirmationEmail(cleanEmail);
        setMode("signin");
        setPw("");
        setMsg(
          "Account created. Check your email and confirm your address, then come back here and sign in."
        );
        return;
      }

      const { data, error } = await signIn(cleanEmail, pw);
      if (error) {
        if (/email.*not.*confirm/i.test(error.message || "")) {
          setPendingConfirmationEmail(cleanEmail);
          setMsg(
            "Please confirm your email address before signing in. Check your inbox for the confirmation email."
          );
        } else {
          setMsg(error.message);
        }
        return;
      }

      if (!data?.session?.user) {
        setMsg("Sign-in did not create a valid session. Please try again.");
        return;
      }

      setPendingConfirmationEmail("");
      onAuthed();
    } finally {
      setBusy(false);
    }
  }

  async function resendConfirmation() {
    const targetEmail = pendingConfirmationEmail || email.trim();
    if (!targetEmail || busy) return;

    setBusy(true);
    setMsg("");
    try {
      const { error } = await resendSignUpConfirmation(targetEmail);
      if (error) {
        setMsg(error.message);
        return;
      }
      setPendingConfirmationEmail(targetEmail);
      setMsg("Confirmation email sent again. Check your inbox and spam/junk folder.");
    } finally {
      setBusy(false);
    }
  }

  function switchMode(nextMode) {
    setMode(nextMode);
    setMsg("");
    if (nextMode === "signup") setPendingConfirmationEmail("");
  }

  return (
    <>
      <PublicSite>
        <Card className="pad authCard">
          <div className="brandLockup authBrand">
            <img className="brandMark" src="/icons/icon-192.png" alt="Workout Tracker" />
            <div className="brandText">
              <div className="brandTitle">Workout Tracker</div>
              <div className="brandTag">Build Strength. Build Habits.</div>
            </div>
          </div>
          <h1 className="title">Account</h1>
          {!isSupabaseReady() ? (
            <div className="panel mt16">
              <div className="h3">Supabase not configured</div>
              <div className="muted mt8">
                Add <b>VITE_SUPABASE_URL</b> and <b>VITE_SUPABASE_ANON_KEY</b> in <code>.env.local</code> (see <code>.env.example</code>).
              </div>
            </div>
          ) : (
            <>
              <div className="tabs mt16">
                <SecondaryButton onClick={() => switchMode("signin")}>Sign in</SecondaryButton>
                <SecondaryButton onClick={() => switchMode("signup")}>Sign up</SecondaryButton>
              </div>

              <div className="stack mt16">
                <div>
                  <div className="label">Email</div>
                  <Input
                    value={email}
                    onChange={setEmail}
                    placeholder="you@email.com"
                    type="email"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAuth();
                      }
                    }}
                  />
                </div>
                <div>
                  <div className="label">Password</div>
                  <Input
                    value={pw}
                    onChange={setPw}
                    placeholder="••••••••"
                    type="password"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAuth();
                      }
                    }}
                  />
                </div>
                {mode === "signup" ? (
                  <label className="check authConsent">
                    <input
                      type="checkbox"
                      checked={termsAccepted}
                      onChange={(event) => setTermsAccepted(event.target.checked)}
                    />
                    <div>
                      <div>I agree to the Terms of Use and acknowledge the Privacy Notice.</div>
                      <div className="mini muted mt4">
                        If I am creating a profile for a child under 13, I confirm I am their parent/guardian or have authority to do so.
                        Privacy, Cookies and Terms are available in the website footer.
                      </div>
                    </div>
                  </label>
                ) : null}
                <PrimaryButton disabled={busy} onClick={handleAuth}>
                  {mode === "signup" ? "Create account" : "Sign in"}
                </PrimaryButton>

                {pendingConfirmationEmail ? (
                  <SecondaryButton disabled={busy} onClick={resendConfirmation}>
                    Resend confirmation email
                  </SecondaryButton>
                ) : null}

                {msg && <div className="muted">{msg}</div>}
                <div className="muted">
                  {mode === "signup"
                    ? "New accounts must confirm their email address before the first sign-in."
                    : "Sign in to manage your people, plan, logs and rewards."}
                </div>
              </div>
            </>
          )}
        </Card>
      </PublicSite>
      <StyleTag />
    </>
  );
}

function AccountHydrationScreen({ phase, error, onRetry, profileName }) {
  const failed = phase === "error";

  return (
    <div className="page accountHydrationPage">
      <div className="wrap">
        <div className="accountHydrationCard" role={failed ? "alert" : "status"}>
          <img className="accountHydrationMark" src="/icons/icon-192.png" alt="" />
          <div className="accountHydrationKicker">WORKOUT TRACKER</div>
          <h1>{failed ? "Your training data did not load" : (profileName ? `Loading ${profileName}’s data…` : "Loading your training history")}</h1>
          <p>
            {failed
              ? error || "The first account load was interrupted. Your saved data has not been changed."
              : "We’re securely loading your profile, program, streak and stats."}
          </p>
          {failed ? (
            <PrimaryButton onClick={onRetry}>Try again</PrimaryButton>
          ) : (
            <div className="accountHydrationProgress" aria-hidden="true"><span /></div>
          )}
        </div>
      </div>
      <StyleTag />
    </div>
  );
}

// -------- Day status helpers (TOP-LEVEL, DO NOT MOVE) --------

function isOptionalAlternativeBlock(block) {
  if (!block) return false;
  if (block.optional === true || block.isOptional === true) return true;

  const label = String(block.label || "").toLowerCase();
  const note = String(block.note || "").toLowerCase();

  return (
    (label.includes("swap") ||
      note.includes("swap option") ||
      note.includes("optional")) &&
    (note.includes("replace") ||
      note.includes("instead") ||
      label.includes("swap"))
  );
}

function isDayGreen(log) {
  if (!log || !Array.isArray(log.blocks) || !log.blocks.length) return false;

  let any = false;

  for (const block of log.blocks) {
    if (!block) continue;

    // cancelled or recovery-mode-suspended blocks do not block the day
    if (block.cancelled || block.suspendedByRecoveryMode) continue;

    const typeId = block.typeId;

    // Ignore pure task blocks for day-complete logic and streaks
    if (typeId === "tasks") continue;

    let hasData = false;

    if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
      hasData =
        block.sets &&
        Object.values(block.sets).some(
          (arr) => Array.isArray(arr) && arr.some((s) => s && setDidSomething(s))
        );
    } else if (typeId === "cardio") {
      const c = block.cardio || {};
      hasData = Number(c.distanceKm) > 0 || Number(c.durationMin) > 0;
    } else if (typeId === "duration") {
      hasData = Number(block?.duration?.minutes) > 0;
    } else if (typeId === "session") {
      hasData = sessionBlockIsComplete(block);
    } else if (typeId === "recovery") {
      hasData = isProfileRecoveryLogBlock(block)
        ? profileRecoveryBlockComplete(block)
        : !!block?.recoveryDone;
    }

    if (!hasData) {
      if (isOptionalAlternativeBlock(block)) continue;
      return false;
    }
    any = true;
  }

  return any;
}

function sameYmdFromIso(iso, targetYmd) {
  if (!iso || !targetYmd) return false;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return false;
  return ymd(d) === targetYmd;
}

function blockHasSameDayLoggedActivity(block, targetYmd) {
  if (!block || block.cancelled || block.suspendedByRecoveryMode) return false;

  const typeId = String(block.typeId || "").toLowerCase();
  if (typeId === "tasks") return false;

  let hasData = false;

  if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
    hasData =
      block.sets &&
      Object.values(block.sets).some(
        (arr) => Array.isArray(arr) && arr.some((s) => s && setDidSomething(s))
      );
  } else if (typeId === "cardio") {
    const c = block.cardio || {};
    hasData = Number(c.distanceKm) > 0 || Number(c.durationMin) > 0;
  } else if (typeId === "duration") {
    hasData = Number(block?.duration?.minutes) > 0;
  } else if (typeId === "session") {
      hasData = sessionBlockIsComplete(block);
    } else if (typeId === "recovery") {
      hasData = isProfileRecoveryLogBlock(block)
        ? profileRecoveryBlockComplete(block)
        : !!block?.recoveryDone;
    }

  if (!hasData) return false;

  const firstLogTs =
    block.loggedAt ||
    block.startedAt ||
    block.completedAt ||
    block.updatedAt ||
    "";

  return sameYmdFromIso(firstLogTs, targetYmd);
}

function isEligibleForSameDayDailyBonus(log, targetYmd) {
  if (!isDayGreen(log)) return false;
  if (!log || !Array.isArray(log.blocks) || !log.blocks.length) return false;

  const qualifyingBlocks = log.blocks.filter((block) => {
    if (!block || block.cancelled || block.suspendedByRecoveryMode) return false;
    const typeId = String(block.typeId || "").toLowerCase();
    if (typeId === "tasks") return false;
    if (isOptionalAlternativeBlock(block) && !blockHasSameDayLoggedActivity(block, targetYmd)) {
      return false;
    }
    return true;
  });

  if (!qualifyingBlocks.length) return false;

  return qualifyingBlocks.every((block) =>
    blockHasSameDayLoggedActivity(block, targetYmd)
  );
}

function countSetsLoggedInLog(log) {
  if (!log || !Array.isArray(log.blocks)) return 0;

  let total = 0;
  for (const b of log.blocks) {
    if (!b || !b.sets || typeof b.sets !== "object") continue;

    const setsByMovement = b.sets;
    for (const key of Object.keys(setsByMovement)) {
      const arr = Array.isArray(setsByMovement[key])
        ? setsByMovement[key]
        : [];
      total += arr.filter(setDidSomething).length;
    }
  }
  return total;
}

function computeTotalMinutesForDay(log) {
  return computeActivityMinutesForDay(log);
}

function isTrainingBlockForRecoveryLogic(block) {
  if (!block || block.cancelled || block.suspendedByRecoveryMode) return false;
  const typeId = String(block.typeId || "").toLowerCase();

  if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
    const setsObj =
      block.sets && typeof block.sets === "object" ? block.sets : null;

    return !!(
      setsObj &&
      Object.values(setsObj).some(
        (arr) => Array.isArray(arr) && arr.some((s) => s && setDidSomething(s))
      )
    );
  }

  if (
    typeId === "cardio" ||
    typeId === "run" ||
    typeId === "swim" ||
    typeId === "walk" ||
    typeId === "row" ||
    typeId === "cycle" ||
    typeId === "bike"
  ) {
    const c = block.cardio || {};
    return safeNumber(c.distanceKm) > 0 || safeNumber(c.durationMin) > 0;
  }

  if (typeId === "duration") {
    return safeNumber(block?.duration?.minutes) > 0;
  }

  if (typeId === "session") {
    return sessionBlockHasActivity(block);
  }

  return false;
}

function hasRecoveryDoneForLog(log) {
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];
  return blocks.some(
    (b) => b && !b.cancelled && b.typeId === "recovery" && b.recoveryDone
  );
}

function getRecoveryDateMapForApp(records) {
  const map = new Map();

  for (const row of Array.isArray(records) ? records : []) {
    const dateStr = row?.date_ymd || row?.date;
    const log = row?.log;
    if (!dateStr || !log) continue;

    const blocks = Array.isArray(log.blocks) ? log.blocks : [];
    const trained = blocks.some(isTrainingBlockForRecoveryLogic);
    const recoveryDone = hasRecoveryDoneForLog(log);

    map.set(dateStr, {
      trained,
      recoveryDone,
    });
  }

  return map;
}

function countTrainingDaysInWindowForApp(dayMap, endYmd, daysBack) {
  let count = 0;
  for (let i = 1; i <= daysBack; i++) {
    const d = ymdAddDays(endYmd, -i);
    if (dayMap.get(d)?.trained) count += 1;
  }
  return count;
}

function countRecoveryDaysInWindowForApp(dayMap, endYmd, daysBack) {
  let count = 0;
  for (let i = 1; i <= daysBack; i++) {
    const d = ymdAddDays(endYmd, -i);
    if (dayMap.get(d)?.recoveryDone) count += 1;
  }
  return count;
}

function countConsecutiveTrainingDaysBeforeForApp(dayMap, endYmd) {
  let run = 0;
  for (let i = 1; i <= 30; i++) {
    const d = ymdAddDays(endYmd, -i);
    if (dayMap.get(d)?.trained) run += 1;
    else break;
  }
  return run;
}

function getRecoveryEligibilityForDateApp(records, dateStr) {
  const dayMap = getRecoveryDateMapForApp(records);
  const day = dayMap.get(dateStr);

  if (!day?.recoveryDone) {
    return {
      qualifies: false,
      score: 0,
      reasons: [],
    };
  }

  const trainingLast5 = countTrainingDaysInWindowForApp(dayMap, dateStr, 5);
  const trainingLast7 = countTrainingDaysInWindowForApp(dayMap, dateStr, 7);
  const recoveryLast7 = countRecoveryDaysInWindowForApp(dayMap, dateStr, 7);
  const prevDay = dayMap.get(ymdAddDays(dateStr, -1));

  let score = 0;
  const reasons = [];

  if (trainingLast5 >= 2) {
    score += 1;
    reasons.push("trained_2_of_last_5");
  }
  if (trainingLast7 >= 4) {
    score += 1;
    reasons.push("trained_4_of_last_7");
  }
  if (prevDay?.recoveryDone) {
    score -= 1;
    reasons.push("previous_day_recovery");
  }
  if (trainingLast7 < 2) {
    score -= 1;
    reasons.push("too_little_recent_training");
  }
  if (recoveryLast7 >= 2) {
    score -= 1;
    reasons.push("too_many_recent_recovery_days");
  }

  const qualifies =
    score >= 1 &&
    !prevDay?.recoveryDone &&
    trainingLast7 >= 2 &&
    recoveryLast7 < 2;

  return {
    qualifies,
    score,
    reasons,
    trainingLast5,
    trainingLast7,
    recoveryLast7,
    consecutiveTrainingBefore: countConsecutiveTrainingDaysBeforeForApp(
      dayMap,
      dateStr
    ),
  };
}

function getBlockLoadScoreForApp(block) {
  if (!block || block.cancelled) return 0;
  const typeId = String(block.typeId || "").toLowerCase();

  const countSetsDirectly = () => {
    const setsObj =
      block.sets && typeof block.sets === "object" ? block.sets : null;

    if (!setsObj) return 0;

    let count = 0;
    for (const arr of Object.values(setsObj)) {
      if (!Array.isArray(arr)) continue;
      count += arr.filter((s) => s && setDidSomething(s)).length;
    }
    return count;
  };

  if (typeId === "strength") {
    const setsCount = countSetsDirectly();
    return setsCount * 10;
  }

  if (typeId === "hiit" || typeId === "box") {
    const setsCount = countSetsDirectly();
    return setsCount * 13;
  }

  if (
    typeId === "cardio" ||
    typeId === "run" ||
    typeId === "swim" ||
    typeId === "walk" ||
    typeId === "row" ||
    typeId === "cycle" ||
    typeId === "bike"
  ) {
    const c = block.cardio || {};
    const km = safeNumber(c.distanceKm);
    const min = safeNumber(c.durationMin);
    const cardioType = String(block.cardioType || typeId || "").toLowerCase();

    let base = min * 1.2 + km * 8;

    if (cardioType === "walk") base *= 0.65;
    if (cardioType === "run" || cardioType === "row" || cardioType === "swim") {
      base *= 1.1;
    }

    return Math.round(base);
  }

  if (typeId === "duration") {
    const mins = safeNumber(block?.duration?.minutes);
    return Math.round(mins * 0.7);
  }

  if (typeId === "session") {
    return getSessionBlockLoadScore(block);
  }

  if (typeId === "tasks" || typeId === "recovery") {
    return 0;
  }

  return 0;
}

function getRecoveryCreditForApp(log) {
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];
  let credit = 0;

  for (const b of blocks) {
    if (!b || b.cancelled || b.typeId !== "recovery" || !b.recoveryDone) continue;

    if (b.recoveryMode === "light") credit += 10;
    else credit += 18;
  }

  return credit;
}

function getDayLoadSummaryForApp(log) {
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];

  let totalLoad = 0;
  let strengthLoad = 0;
  let nervousLoad = 0;
  let cardioEnergyLoad = 0;
  let hadTraining = false;
  let hadRecovery = false;

  for (const b of blocks) {
    if (!b || b.cancelled) continue;

    const typeId = String(b.typeId || "").toLowerCase();
    const load = getBlockLoadScoreForApp(b);

    if (load > 0 || (typeId === "session" && sessionBlockHasActivity(b))) {
      hadTraining = true;
    }
    if (typeId === "recovery" && b.recoveryDone) hadRecovery = true;

    totalLoad += load;

    if (typeId === "strength") {
      strengthLoad += load;
      nervousLoad += load * 0.85;
    } else if (typeId === "hiit" || typeId === "box") {
      strengthLoad += load * 0.5;
      nervousLoad += load * 1.15;
      cardioEnergyLoad += load * 0.7;
    } else if (
      typeId === "cardio" ||
      typeId === "run" ||
      typeId === "swim" ||
      typeId === "walk" ||
      typeId === "row" ||
      typeId === "cycle" ||
      typeId === "bike"
    ) {
      nervousLoad += load * 0.55;
      cardioEnergyLoad += load;
    } else if (typeId === "duration") {
      cardioEnergyLoad += load * 0.6;
      nervousLoad += load * 0.25;
    } else if (typeId === "session") {
      // Skill Sessions are moderate physical work with a meaningful coordination load.
      nervousLoad += load * 0.65;
      cardioEnergyLoad += load * 0.55;
    }
  }

  return {
    totalLoad,
    strengthLoad,
    nervousLoad,
    cardioEnergyLoad,
    recoveryCredit: getRecoveryCreditForApp(log),
    hadTraining,
    hadRecovery,
    streakSaved: !!log?.meta?.streakSaved,
  };
}

function getWeightedRecentLoadForApp(records, todayYmd, currentLogForToday = null) {
  const weights = [1.0, 0.78, 0.58, 0.42, 0.28, 0.18, 0.1];

  let totalLoad = 0;
  let muscleLoad = 0;
  let nervousLoad = 0;
  let energyLoad = 0;
  let recoveryCredit = 0;
  let sleepCredit = 0;

  const rows = Array.isArray(records) ? records : [];

  // 1) Include TODAY first, if there is a current log
  if (currentLogForToday) {
    const todaySummary = getDayLoadSummaryForApp(currentLogForToday);

    totalLoad += todaySummary.totalLoad * 1.15;
    muscleLoad += todaySummary.strengthLoad * 1.15;
    nervousLoad += todaySummary.nervousLoad * 1.15;
    energyLoad += todaySummary.cardioEnergyLoad * 1.15;
    recoveryCredit += todaySummary.recoveryCredit * 1.0;
  }

  // 2) Historical days
  for (let i = 1; i <= 7; i++) {
    const d = ymdAddDays(todayYmd, -i);
    const row = rows.find((r) => (r?.date_ymd || r?.date) === d);

    if (!row?.log) {
      sleepCredit += (i <= 2 ? 10 : i <= 4 ? 7 : 4) * (weights[i - 1] || 0.1);
      continue;
    }

    const w = weights[i - 1] || 0.1;
    const day = getDayLoadSummaryForApp(row.log);

    totalLoad += day.totalLoad * w;
    muscleLoad += day.strengthLoad * w;
    nervousLoad += day.nervousLoad * w;
    energyLoad += day.cardioEnergyLoad * w;
    recoveryCredit += day.recoveryCredit * w;

    const daySleepBase =
      day.totalLoad >= 120 ? 5 :
      day.totalLoad >= 70 ? 7 :
      10;

    sleepCredit += daySleepBase * w;
  }

  const lastTrainingMs = getLastTrainingTimestampMs(records, todayYmd, currentLogForToday);

  const hoursSinceLastTraining =
    lastTrainingMs == null
      ? 999
      : Math.max(0, Math.round((Date.now() - lastTrainingMs) / (60 * 60 * 1000)));

  return {
    totalLoad: Math.round(totalLoad),
    muscleLoad: Math.round(muscleLoad),
    nervousLoad: Math.round(nervousLoad),
    energyLoad: Math.round(energyLoad),
    recoveryCredit: Math.round(recoveryCredit),
    sleepCredit: Math.round(sleepCredit),
    hoursSinceLastTraining,
  };
}

function getReadinessBand(score) {
  if (score >= 85) return { label: "Prime", tone: "prime" };
  if (score >= 65) return { label: "High", tone: "high" };
  if (score >= 45) return { label: "Moderate", tone: "moderate" };
  if (score >= 25) return { label: "Reduced", tone: "reduced" };
  return { label: "Low", tone: "low" };
}

function getReadinessScalePercent(score) {
  const s = clamp(safeNumber(score), 0, 100);

  // Five equal visual segments, but score ranges are not equal.
  // Map each score range into its matching visual segment.
  if (s <= 24) {
    return (s / 24) * 20;
  }
  if (s <= 44) {
    return 20 + ((s - 25) / 19) * 20;
  }
  if (s <= 64) {
    return 40 + ((s - 45) / 19) * 20;
  }
  if (s <= 84) {
    return 60 + ((s - 65) / 19) * 20;
  }
  return 80 + ((s - 85) / 15) * 20;
}

function getFirstBlockTimestampMs(log) {
  const blocks = Array.isArray(log?.blocks) ? log.blocks : [];
  const stamps = [];

  const hasLoggedData = (b) => {
    if (!b || b.cancelled) return false;

    const typeId = String(b.typeId || "").toLowerCase();

    if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
      const setsObj =
        b.sets && typeof b.sets === "object" ? b.sets : null;

      return !!(
        setsObj &&
        Object.values(setsObj).some(
          (arr) => Array.isArray(arr) && arr.some((s) => s && setDidSomething(s))
        )
      );
    }

    if (
      typeId === "cardio" ||
      typeId === "run" ||
      typeId === "swim" ||
      typeId === "walk" ||
      typeId === "row" ||
      typeId === "cycle" ||
      typeId === "bike"
    ) {
      const c = b.cardio || {};
      return safeNumber(c.distanceKm) > 0 || safeNumber(c.durationMin) > 0;
    }

    if (typeId === "duration") {
      return safeNumber(b?.duration?.minutes) > 0;
    }

    if (typeId === "session") {
      return sessionBlockHasActivity(b);
    }

    if (typeId === "recovery") {
      return !!b?.recoveryDone;
    }

    if (typeId === "tasks") {
      const done = b?.tasksDone && typeof b.tasksDone === "object" ? b.tasksDone : {};
      return Object.values(done).some(Boolean);
    }

    return false;
  };

  for (const b of blocks) {
    if (!hasLoggedData(b)) continue;

    const raw =
      b?.startedAt ||
      b?.completedAt ||
      b?.loggedAt ||
      b?.createdAt ||
      null;

    if (!raw) continue;

    const ms = new Date(raw).getTime();
    if (Number.isFinite(ms)) stamps.push(ms);
  }

  if (!stamps.length) return null;
  return Math.min(...stamps);
}

function getExpectedNextSessionTimeMs(todayYmd, currentLogForToday, records) {
  const now = new Date();
  const nowMs = now.getTime();

  // If today already has a real logged session, the next expected session
  // becomes tomorrow at that first real session time.
  const firstTodayMs = getFirstBlockTimestampMs(currentLogForToday);
  if (firstTodayMs) {
    return firstTodayMs + 24 * 60 * 60 * 1000;
  }

  // Otherwise, anchor to the most recent real logged session time pattern.
  const rows = Array.isArray(records) ? records : [];
  const sorted = [...rows].sort((a, b) =>
    (a?.date_ymd || a?.date || "") < (b?.date_ymd || b?.date || "") ? 1 : -1
  );

  for (const row of sorted) {
    const dateStr = row?.date_ymd || row?.date;
    if (!dateStr || dateStr > todayYmd) continue;

    const ms = getFirstBlockTimestampMs(row?.log);
    if (!ms) continue;

    const d = new Date(ms);
    const targetToday = new Date();
    targetToday.setHours(d.getHours(), d.getMinutes(), 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Rule:
    // - before first real log today, keep the anchor on today's expected time
    // - only roll to tomorrow after today is actually over
    if (nowMs <= endOfToday.getTime()) {
      return targetToday.getTime();
    }

    const targetTomorrow = new Date(targetToday);
    targetTomorrow.setDate(targetTomorrow.getDate() + 1);
    return targetTomorrow.getTime();
  }

  // Final fallback: today at 17:00 if still ahead, otherwise tomorrow 17:00
  const fallback = new Date();
  fallback.setHours(17, 0, 0, 0);
  if (fallback.getTime() <= nowMs) {
    fallback.setDate(fallback.getDate() + 1);
  }
  return fallback.getTime();
}

function getHoursAheadFromNow(targetMs) {
  const diff = (targetMs - Date.now()) / (60 * 60 * 1000);
  return clamp(Math.round(diff), 0, 48);
}

function isSleepHour(dateObj) {
  const h = dateObj.getHours();
  return h >= 22 || h < 6;
}

function getProjectedConsecutiveTrainingPenaltyHours(
  consecutiveTrainingBefore,
  hour,
  pointTime
) {
  const base = Math.max(0, safeNumber(consecutiveTrainingBefore));

  // Keep the current penalty at hour 0.
  if (hour <= 0) return base;

  // Recover very little while awake, more meaningfully during sleep.
  // This is a penalty-unwind model, not a hard reset.
  let penalty = base;

  for (let h = 1; h <= hour; h++) {
    const d = new Date(pointTime.getTime() - (hour - h) * 60 * 60 * 1000);

    if (isSleepHour(d)) {
      penalty -= 0.22; // stronger overnight reduction
    } else {
      penalty -= 0.04; // mild daytime reduction
    }
  }

  return Math.max(0, penalty);
}

function getLastTrainingTimestampMs(records, todayYmd, currentLogForToday = null) {
  const rows = Array.isArray(records) ? records : [];
  let latestMs = null;

  const considerLog = (log) => {
    const blocks = Array.isArray(log?.blocks) ? log.blocks : [];
    for (const b of blocks) {
      if (!isTrainingBlockForRecoveryLogic(b)) continue;

      const raw =
        b?.startedAt ||
        b?.completedAt ||
        b?.loggedAt ||
        b?.createdAt ||
        null;

      if (!raw) continue;

      const ms = new Date(raw).getTime();
      if (!Number.isFinite(ms)) continue;

      if (latestMs == null || ms > latestMs) latestMs = ms;
    }
  };

  if (currentLogForToday) {
    considerLog(currentLogForToday);
  }

  for (const row of rows) {
    const dateStr = row?.date_ymd || row?.date;
    if (!dateStr || dateStr > todayYmd) continue;
    considerLog(row?.log);
  }

  return latestMs;
}

function getReadinessBreakdownFromState({
  muscleLoad = 0,
  nervousLoad = 0,
  energyLoad = 0,
  recoveryCredit = 0,
  sleepCredit = 0,
  hoursSinceLastTraining = 0,
  consecutiveTrainingBefore = 0,
}) {
  const timeRecoveryBoost = clamp(
    Math.round((hoursSinceLastTraining / 24) * 8),
    0,
    18
  );

  const rawMuscleReadiness =
    88 -
    muscleLoad * 0.40 +
    recoveryCredit * 0.9 +
    sleepCredit * 0.65 +
    timeRecoveryBoost;

  const muscleReadiness = Math.round(
    softFloor(rawMuscleReadiness, 30, 100, 14, 8)
  );

  const rawNervousSystemReadiness =
    86 -
    nervousLoad * 0.44 -
    consecutiveTrainingBefore * 3 +
    recoveryCredit * 0.75 +
    sleepCredit * 0.6 +
    timeRecoveryBoost;

  const nervousSystemReadiness = Math.round(
    softFloor(rawNervousSystemReadiness, 35, 100, 16, 10)
  );

  const bodyEnergy = clamp(
    Math.round(
      88 -
        energyLoad * 0.42 +
        recoveryCredit * 0.5 +
        sleepCredit * 0.8 +
        Math.round(timeRecoveryBoost * 0.65)
    ),
    20,
    100
  );

  const trainingReadinessScore = clamp(
    Math.round(
      muscleReadiness * 0.35 +
        nervousSystemReadiness * 0.35 +
        bodyEnergy * 0.3
    ),
    0,
    100
  );

  return {
    muscleReadiness,
    nervousSystemReadiness,
    bodyEnergy,
    trainingReadinessScore,
    band: getReadinessBand(trainingReadinessScore),
    timeRecoveryBoost,
  };
}

function projectNextSessionReadiness({
  weighted,
  currentLogForToday,
  records,
  todayYmd,
  consecutiveTrainingBefore = 0,
  currentState,
}) {
  const todaySummary = currentLogForToday
    ? getDayLoadSummaryForApp(currentLogForToday)
    : {
        totalLoad: 0,
        strengthLoad: 0,
        nervousLoad: 0,
        cardioEnergyLoad: 0,
        recoveryCredit: 0,
        hadTraining: false,
        hadRecovery: false,
      };

  const dayComplete = currentLogForToday ? isDayGreen(currentLogForToday) : false;

  const expectedNextSessionTimeMs = getExpectedNextSessionTimeMs(
    todayYmd,
    currentLogForToday,
    records
  );

  const expectedNextSessionHoursAhead =
    getHoursAheadFromNow(expectedNextSessionTimeMs);

  const baseNow = new Date();

  const readinessTimeline48h = [];
  let nextSessionSnapshot = null;

  for (let hour = 0; hour <= 48; hour++) {
    const pointTime = new Date(baseNow.getTime() + hour * 60 * 60 * 1000);
    const t = hour / 24;
    const sleeping = isSleepHour(pointTime);

    // System-specific decay:
    // energy recovers fastest, muscle moderate, nervous system slowest.
    let projectedMuscleLoad = weighted.muscleLoad;
    let projectedNervousLoad = weighted.nervousLoad;
    let projectedEnergyLoad = weighted.energyLoad;

    let hourlyRecoveryCredit = 0;
    let hourlySleepCredit = 0;

    for (let h = 1; h <= hour; h++) {
      const d = new Date(baseNow.getTime() + h * 60 * 60 * 1000);
      const sleepingHour = isSleepHour(d);

      // Recovery support:
      // daytime = steady recovery
      // sleep = stronger repair / restoration, but not massively disproportionate
      hourlyRecoveryCredit += sleepingHour
        ? (dayComplete ? 0.42 : 0.32)
        : (dayComplete ? 0.18 : 0.12);

      hourlySleepCredit += sleepingHour ? 0.42 : 0.08;

      // Load decay:
      // sleep still accelerates recovery, but daytime now also meaningfully restores readiness.
      const muscleStep = sleepingHour ? 0.016 : 0.009;
      const nervousStep = sleepingHour ? 0.011 : 0.006;
      const energyStep = sleepingHour ? 0.024 : 0.014;

      projectedMuscleLoad = Math.max(
        0,
        projectedMuscleLoad * (1 - muscleStep)
      );

      projectedNervousLoad = Math.max(
        0,
        projectedNervousLoad * (1 - nervousStep)
      );

      projectedEnergyLoad = Math.max(
        0,
        projectedEnergyLoad * (1 - energyStep)
      );
    }

    const projectedHoursSinceLastTraining =
      Math.min(
        999,
        Math.max(0, safeNumber(weighted.hoursSinceLastTraining)) + hour
      );

    const projectedConsecutiveTrainingBefore =
      getProjectedConsecutiveTrainingPenaltyHours(
        consecutiveTrainingBefore,
        hour,
        pointTime
      );

    const projected =
      hour === 0 && currentState
        ? currentState
        : getReadinessBreakdownFromState({
            muscleLoad: Math.round(projectedMuscleLoad),
            nervousLoad: Math.round(projectedNervousLoad),
            energyLoad: Math.round(projectedEnergyLoad),
            recoveryCredit:
              Math.round(weighted.recoveryCredit) +
              Math.round(hourlyRecoveryCredit),
            sleepCredit:
              Math.round(weighted.sleepCredit) +
              Math.round(hourlySleepCredit),
            hoursSinceLastTraining: projectedHoursSinceLastTraining,
            consecutiveTrainingBefore: projectedConsecutiveTrainingBefore,
          });

    const point = {
      hour,
      timestampMs: pointTime.getTime(),
      sleeping,
      score: projected.trainingReadinessScore,
      band: projected.band,
      muscleReadiness: projected.muscleReadiness,
      nervousSystemReadiness: projected.nervousSystemReadiness,
      bodyEnergy: projected.bodyEnergy,
      isExpectedNextSession: hour === expectedNextSessionHoursAhead,
    };

    readinessTimeline48h.push(point);

    if (hour === expectedNextSessionHoursAhead) {
      nextSessionSnapshot = point;
    }
  }

  const fallbackPoint =
    readinessTimeline48h[Math.min(24, readinessTimeline48h.length - 1)];

  const nextPoint = nextSessionSnapshot || fallbackPoint;

  return {
    dayComplete,
    expectedNextSessionTimeMs,
    expectedNextSessionHoursAhead,
    projectedMuscleReadiness: nextPoint.muscleReadiness,
    projectedNervousSystemReadiness: nextPoint.nervousSystemReadiness,
    projectedBodyEnergy: nextPoint.bodyEnergy,
    projectedTrainingReadinessScore: nextPoint.score,
    projectedBand: nextPoint.band,
    readinessTimeline48h,
  };
}

function getRecoveryRecommendationForTodayApp(records, todayYmd, currentLogForToday = null) {
  const dayMap = getRecoveryDateMapForApp(records);
  const consecutiveTrainingBefore =
    countConsecutiveTrainingDaysBeforeForApp(dayMap, todayYmd);
  const trainingLast5 = countTrainingDaysInWindowForApp(dayMap, todayYmd, 5);
  const trainingLast7 = countTrainingDaysInWindowForApp(dayMap, todayYmd, 7);
  const weighted = getWeightedRecentLoadForApp(records, todayYmd, currentLogForToday);

  const current = getReadinessBreakdownFromState({
    muscleLoad: weighted.muscleLoad,
    nervousLoad: weighted.nervousLoad,
    energyLoad: weighted.energyLoad,
    recoveryCredit: weighted.recoveryCredit,
    sleepCredit: weighted.sleepCredit,
    hoursSinceLastTraining: weighted.hoursSinceLastTraining,
    consecutiveTrainingBefore,
  });

  const muscleReadiness = current.muscleReadiness;
  const nervousSystemReadiness = current.nervousSystemReadiness;
  const bodyEnergy = current.bodyEnergy;
  const trainingReadinessScore = current.trainingReadinessScore;
  const band = current.band;

  const strengthDrivenFatigue =
    weighted.muscleLoad >= 90 &&
    weighted.muscleLoad >= weighted.energyLoad * 0.9 &&
    muscleReadiness <= 55;

  const densityRecoveryPressure =
    consecutiveTrainingBefore >= 3 ||
    trainingLast5 >= 4 ||
    trainingLast7 >= 5;

  const projected = projectNextSessionReadiness({
    weighted,
    currentLogForToday,
    records,
    todayYmd,
    consecutiveTrainingBefore,
    currentState: current,
  });

  const sameMuscleGroupCaution =
    strengthDrivenFatigue &&
    projected.projectedMuscleReadiness <= 60;

  // Recommendation should reflect likely next-session readiness,
  // not just the fact that today's session has spent readiness.
  const hardRecoveryRule =
    projected.projectedTrainingReadinessScore <= 34;

  const softRecoveryRule =
    projected.projectedTrainingReadinessScore <= 44 &&
    densityRecoveryPressure;

  const recommended =
    hardRecoveryRule ||
    softRecoveryRule ||
    (sameMuscleGroupCaution && projected.projectedTrainingReadinessScore <= 44);

  let recommendationText = "Ready to train if energy feels good.";

  if (
    sameMuscleGroupCaution &&
    projected.projectedTrainingReadinessScore <= 44
  ) {
    recommendationText =
      "Your readiness is being pulled down mainly by recent strength work. Muscles often need up to 5 days before being trained hard again, so consider avoiding the same muscle groups directly for the next 5 days and use cardio, mobility, skill work, or different areas instead.";
  } else if (
    projected.dayComplete &&
    projected.projectedTrainingReadinessScore >= 45
  ) {
    recommendationText =
      "Recent work has spent readiness, but if you now rest and sleep normally, your next-session forecast returns to a workable zone.";
  } else if (projected.projectedTrainingReadinessScore <= 24) {
    recommendationText =
      "Recovery strongly advised. Even by your next likely session, readiness is still forecast to stay low.";
  } else if (projected.projectedTrainingReadinessScore <= 44) {
    recommendationText =
      "Recovery advised. By your next likely session, readiness is still forecast to remain below the Moderate zone unless load is reduced.";
  } else if (trainingReadinessScore <= 44 && strengthDrivenFatigue) {
    recommendationText =
      "Current readiness is being held down mainly by recent strength load. General training may still be possible, but avoid hitting the same muscle groups directly until they recover further.";
  } else if (trainingReadinessScore <= 44) {
    recommendationText =
      "Current readiness is suppressed by recent work in the last 24 hours, but forecast recovery suggests you should rebound with normal rest and sleep.";
  } else if (trainingReadinessScore <= 64) {
    recommendationText =
      "Moderate readiness. You can train, but quality and intent matter more than simply adding load.";
  } else if (trainingReadinessScore >= 85) {
    recommendationText =
      "Prime for performance. Load and recovery look well balanced for a quality session.";
  } else {
    recommendationText =
      "Readiness looks solid. If energy feels good, this is a strong day to train well.";
  }

  return {
    recommended,
    recommendationText,
    trainingReadinessScore,
    band,
    muscleReadiness,
    nervousSystemReadiness,
    bodyEnergy,
    consecutiveTrainingBefore,
    trainingLast5,
    trainingLast7,
    weightedLoad: weighted,
    projectedTrainingReadinessScore: projected.projectedTrainingReadinessScore,
    projectedBand: projected.projectedBand,
    projectedMuscleReadiness: projected.projectedMuscleReadiness,
    projectedNervousSystemReadiness: projected.projectedNervousSystemReadiness,
    projectedBodyEnergy: projected.projectedBodyEnergy,
    strengthDrivenFatigue,
    sameMuscleGroupCaution,
    currentDayComplete: projected.dayComplete,
    expectedNextSessionHoursAhead: projected.expectedNextSessionHoursAhead,
    expectedNextSessionTimeMs: projected.expectedNextSessionTimeMs,
    readinessTimeline48h: projected.readinessTimeline48h,
  };
}

function computeCardioKmForDay(log) {
  if (!log) return null;

  const blocks = Array.isArray(log.blocks) ? log.blocks : [];

  let totalKm = 0;

  if (blocks.length) {
    // New model – trust per-block cardio distances
    for (const b of blocks) {
      if (!b || !b.cardio || typeof b.cardio !== "object") continue;
      totalKm += safeNumber(b.cardio.distanceKm);
    }
    return totalKm > 0 ? Number(totalKm.toFixed(2)) : null;
  }

  // Legacy fallback (no blocks snapshot at all)
  const legacyKm = safeNumber(log?.cardio?.distanceKm);
  return legacyKm > 0 ? Number(legacyKm.toFixed(2)) : null;
}

// ---- Rewards: Badges + Avatars (V1) ----
// NOTE: Graphics are optional. We use emoji placeholders until you add PNG/SVG assets.

const TIER_ORDER = ["bronze", "silver", "gold", "platinum", "diamond"];

const SPORT_AVATAR_PRESTIGE_TIERS = [
  { key: "bronze", label: "Bronze", threshold: 40, xp: 25 },
  { key: "silver", label: "Silver", threshold: 80, xp: 35 },
  { key: "gold", label: "Gold", threshold: 120, xp: 50 },
  { key: "platinum", label: "Platinum", threshold: 160, xp: 70 },
  { key: "diamond", label: "Diamond", threshold: 200, xp: 95 },
  { key: "elite", label: "Elite", threshold: 240, xp: 125 },
  { key: "champion", label: "Champion", threshold: 280, xp: 160 },
  { key: "unreal", label: "Unreal", threshold: 320, xp: 200 },
];

function getSportAvatarKey(sportKey, prestigeKey) {
  return `sport_avatar_${sportKey}_${prestigeKey}`;
}

function getSportAvatarImageSrc(sportKey, prestigeKey, appearance) {
  return sportAvatarArtworkSrc(sportKey, prestigeKey, appearance);
}

function getSportAvatarXpForKey(key) {
  if (typeof key !== "string" || !key.startsWith("sport_avatar_")) return 0;

  const tier = SPORT_AVATAR_PRESTIGE_TIERS.find((t) =>
    key.endsWith(`_${t.key}`)
  );

  return tier ? safeNumber(tier.xp) : 0;
}

function getSportAvatarProgressPct(sessionCount, currentTier, nextTier) {
  if (!nextTier) return 100;

  const floor = currentTier ? safeNumber(currentTier.threshold) : 0;
  const ceiling = safeNumber(nextTier.threshold);
  const range = Math.max(1, ceiling - floor);
  const raw = ((safeNumber(sessionCount) - floor) / range) * 100;

  return clamp(Math.round(raw), 0, 100);
}

function getSportBadgeFaceText(card) {
  const title = String(card?.title || "").trim();
  return title.replace(/\s+Mastery$/i, "").toUpperCase();
}

function getSportBadgeProgressPct(card, badgeStats) {
  const value = safeNumber(getByPath({ stats: badgeStats }, card.statKey));
  const tiers = Array.isArray(card?.tiers) ? card.tiers : [];
  if (!tiers.length) return 0;

  const earnedIndex = getHighestEarnedTierIndex(card, value);
  const nextTier = earnedIndex + 1 < tiers.length ? tiers[earnedIndex + 1] : null;
  const currentTier = earnedIndex >= 0 ? tiers[earnedIndex] : null;

  if (!nextTier) return 100;

  const floor = currentTier ? safeNumber(currentTier.threshold) : 0;
  const ceiling = safeNumber(nextTier.threshold);
  const range = Math.max(1, ceiling - floor);
  const raw = ((value - floor) / range) * 100;

  return clamp(Math.round(raw), 0, 100);
}

function normaliseClaimedRewards(meta) {
  // Supports legacy format: ["badge_key", ...]
  // New format: [{ key: "badge_key", claimedAtYmd: "YYYY-MM-DD" }, ...]
  const raw = Array.isArray(meta?.claimedRewards) ? meta.claimedRewards : [];
  const out = [];
  for (const item of raw) {
    if (!item) continue;
    if (typeof item === "string") {
      out.push({ key: item, claimedAtYmd: null });
    } else if (typeof item === "object" && typeof item.key === "string") {
      out.push({ key: item.key, claimedAtYmd: typeof item.claimedAtYmd === "string" ? item.claimedAtYmd : null });
    }
  }
  return out;
}

function computeClaimedRewardsXp(plan) {
  const claimed = normaliseClaimedRewards(plan?.meta);
  let sum = 0;
  for (const c of claimed) {
    if (!c?.key) continue;
    sum += getRewardXpForKey(c.key);
  }
  return sum;
}

function badgeStatusLabel(status) {
  if (status === "claimed") return "Claimed";
  if (status === "claimable") return "Claim";
  return "Locked";
}

function getByPath(obj, path) {
  if (!obj || !path) return undefined;
  return String(path)
    .split(".")
    .reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function getHighestEarnedTierIndex(card, value) {
  const tiers = Array.isArray(card?.tiers) ? card.tiers : [];
  let idx = -1;

  tiers.forEach((tier, i) => {
    const threshold = Number(tier.threshold);

    if (card.comparator === "lte") {
      if (
        value != null &&
        Number.isFinite(Number(value)) &&
        Number(value) <= threshold
      ) {
        idx = i;
      }
    } else {
      if (Number(value) >= threshold) {
        idx = i;
      }
    }
  });

  return idx;
}

function getHighestClaimedTierIndex(card, claimedRewardsSet) {
  const tiers = Array.isArray(card?.tiers) ? card.tiers : [];
  let idx = -1;

  tiers.forEach((tier, i) => {
    if (claimedRewardsSet.has(tier.key)) idx = i;
  });

  return idx;
}

function getBadgeCardState(card, badgeStats, claimedRewardsSet) {
  if (card.badgeGroup === "sport_mastery") {
    return sportsMasteryState(card, getByPath({ stats: badgeStats }, card.statKey), claimedRewardsSet);
  }
  return performanceBadgeState(card, getByPath({ stats: badgeStats }, card.statKey), claimedRewardsSet, badgeStats);
}

function formatBadgeThreshold(card, threshold) {
  if (card.comparator !== "lte") return `${threshold}+`;

  return formatTimeMMSS(threshold);
}

function getBadgeFaceText(card) {
  const title = String(card?.title || "").trim();

  // Cardio pace / distance badges
  // Examples:
  // "Run 5K"
  // "Run 5K Pace"
  // "Swim 1500m Pace"
  const m = title.match(/^(Run|Bike|Walk|Row|Swim)\s+(.+?)(?:\s+Pace)?$/i);
  if (m) {
    return m[2].toUpperCase();
  }

  // Streak cards
  const s = title.match(/^Streak:\s+(.+)$/i);
  if (s) return s[1].toUpperCase();

  // Fallback: no face text
  return "";
}

function getTierRequirementText(card, tier) {
  const threshold = safeNumber(tier?.threshold);
  const xp = safeNumber(tier?.xp);

  if (tier?.statKey) return `${threshold}+ ${tier.unit} · +${xp} XP`;
  if (card?.comparator === "lte") {
    return `${formatBadgeThreshold(card, threshold)} or faster · +${xp} XP`;
  }

  const statKey = String(card?.statKey || "");

  if (statKey.includes(".count.")) {
    return `${threshold}+ times · +${xp} XP`;
  }

  if ((statKey === "stats.streak.currentDays" || statKey === "stats.streak.longestDays")) {
    return `${threshold}+ days · +${xp} XP`;
  }

  if (statKey === "stats.lifts.totalVolumeKg") {
    return `${threshold}+ kg · +${xp} XP`;
  }

  if (statKey === "stats.lifts.totalSets") {
    return `${threshold}+ sets · +${xp} XP`;
  }

  if (statKey === "stats.lifts.totalReps") {
    return `${threshold}+ reps · +${xp} XP`;
  }

  if (statKey === "stats.sessions.maxStrengthSetsInSession") {
    return `${threshold}+ sets · +${xp} XP`;
  }

  if (
    statKey === "stats.behaviour.earlyBirdSessions" ||
    statKey === "stats.behaviour.nightSessions"
  ) {
    return `${threshold}+ sessions · +${xp} XP`;
  }

  if ((statKey === "stats.intelligence.paceImprovementPct4w" || statKey === "stats.intelligence.paceImprovementBestPct")) {
    return `${threshold}%+ · +${xp} XP`;
  }

  if (statKey === "stats.intelligence.progressiveOverloadEvents") {
    return `${threshold}+ events · +${xp} XP`;
  }

  return `${threshold}+ · +${xp} XP`;
}

function getBadgeXpForKey(key) {
  const def = BADGE_DEFS.find((b) => b.key === key);
  return def ? safeNumber(def.xp) : 0;
}

function getRewardXpForKey(key) {
  return getBadgeXpForKey(key) || getSportAvatarXpForKey(key);
}

function computeClaimedRewardsXpByDate(plan) {
  const claimed = normaliseClaimedRewards(plan?.meta);
  const map = {};

  for (const c of claimed) {
    if (!c?.claimedAtYmd) continue;
    const xp = getRewardXpForKey(c.key);
    if (!xp) continue;
    map[c.claimedAtYmd] = (map[c.claimedAtYmd] || 0) + xp;
  }

  return map;
}

function readProviderReturn() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  const provider = params.get("integration") || "";
  const status = params.get("status") || "";
  if (provider !== "strava" || !["connected", "failed", "denied"].includes(status)) return null;
  return {
    provider,
    status,
    detail: params.get("detail") || "",
    profileId: params.get("profile") || "",
  };
}

function clearProviderReturnFromUrl() {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  let changed = false;
  for (const key of ["integration", "status", "detail", "profile"]) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  if (changed) {
    window.history.replaceState({}, "", `${url.pathname}${url.search}${url.hash}`);
  }
}

// -------- Main app ----------
export default function App() {
  const ENABLE_SW_TOAST = false; // keep false to avoid sticky update toast UX

  const [providerReturn] = useState(() => readProviderReturn());
  const [initialNavigation] = useState(() => {
    try { return readLogNavigation(window.sessionStorage, ymd(new Date())); }
    catch { return { tab: "dashboard", date: ymd(new Date()) }; }
  });
  const [tab, setTab] = useState(() => providerReturn ? "connections" : initialNavigation.tab);
  const [progressInitialView, setProgressInitialView] = useState("dashboard");

  useEffect(() => {
    if (providerReturn) clearProviderReturnFromUrl();
  }, [providerReturn]);
  const [copyDialog, setCopyDialog] = useState(null); // { blockId, days: string[] }
  const [rewardsSubTab, setRewardsSubTab] = useState("badges"); // "badges" | "avatars" | "shop" | "info"
  const [badgeCategoryView, setBadgeCategoryView] = useState("performance"); // "performance" | "sport_mastery"
  const [avatarCategoryView, setAvatarCategoryView] = useState("xp"); // "xp" | "sport_mastery"
  const [badgeView, setBadgeView] = useState("earned"); // "earned" | "all"
  const [claimModal, setClaimModal] = useState(null); // { title, desc }
const [claimFx, setClaimFx] = useState(null); // reserved for future
const [claimXpDisplay, setClaimXpDisplay] = useState(null);
  const [showXpLedger, setShowXpLedger] = useState(false);
  const [lastClaimedKey, setLastClaimedKey] = useState("");
  const [showBodyReadinessExplain, setShowBodyReadinessExplain] = useState(false);

  const [readinessNowTick, setReadinessNowTick] = useState(Date.now());

  // --- Rotating Motivation & Health tip (changes on tab switch) ---
const MOTIVATION_QUOTES = [
  "Small steps count. Show up and win the day ⭐",
  "🚀 You don’t have to be perfect — just consistent.",
  "Strong body, strong mind. Let’s go 🔥",
  "Future you is built by today you 💥",
  "Effort is a superpower 🏃 Use it.",
  "Finish what you start — even if it’s a little ✅",
  "📈 Be proud of progress, not perfection.",
];

const HEALTH_TIPS = [
  "Drink plenty of water today 💧",
  "Sleep matters 😴 it’s as important as activity.",
  "Try new things 🧠 it builds a stronger brain.",
  "Eat nutrient-rich foods: veg 🥦 fruit 🍎 protein 🍗",
  "Get fresh air early in the day if you can 🌤️",
];

const [motivationLine, setMotivationLine] = useState("");
const [healthTip, setHealthTip] = useState("");
const [motivationKey, setMotivationKey] = useState(0);
const [healthKey, setHealthKey] = useState(0);

useEffect(() => {
  if (tab !== "dashboard") return;
  setMotivationLine(pickRandom(MOTIVATION_QUOTES));
 …86798 tokens truncated…p.followingAvatar.name}</strong>
                  <small>
                    {rewardsRoadmap.followingAvatar.packLabel} · unlocks at{" "}
                    {rewardsRoadmap.followingAvatar.unlockAtXp.toLocaleString("en-GB")} XP
                  </small>
                </div>
              ) : null}
            </div>

            <div className="mini muted mt12">
              Earned XP comes from training, tasks, consistency and progression.
              Bonus XP comes from claimed rewards and awards. Both contribute to Total XP.
            </div>
          </div>

          {/* XP rules – how XP is earned */}
          <div className="panel mt16">
            <div className="rowBetween">
              <div>
                <div className="h3">How you earn XP</div>
                <div className="muted mt4">
                  Quick reference for what gives XP. Expand to see the details.
                </div>
              </div>
              <SecondaryButton onClick={() => setShowXpRules((v) => !v)}>
                {showXpRules ? "Hide" : "Show"}
              </SecondaryButton>
            </div>

            {showXpRules && (
              <div className="stack mt8 mini" style={{ maxHeight: 420, overflow: "auto" }}>
                <div><b>Strength / HIIT:</b> +2 XP per completed set, +5 XP when the block is logged</div>
                <div><b>Cardio:</b> XP from time + distance (runs / cycles / walks / swims / rows).
                  XP is based on minutes and km (auto) - +1 XP per 2 minutes & +1 XP per 0.5km, plus 5 XP per logged cardio block. If you only know time
                  and not distance, use a Duration block instead.</div>
                <div><b>Duration:</b> XP from minutes (2 XP per 10 minutes, plus 5 XP per logged duration block)</div>
                <div><b>Sessions:</b> +10 XP when a structured Session is completed. Drill counts/results do not add XP.</div>
                <div><b>Tasks:</b> XP per task completed (as shown on the task log)</div>
                <div><b>Progression bonuses:</b> beat your last time/effort (+20 XP for Cardio blocks and +10 XP for Strength movements)</div>
                <div><b>Streak bonuses:</b> keep days green 🔥 (2→5XP, 3→10XP, 5→20XP, 10→50XP,
                      30→100XP, 60→200XP, 90→300XP, 180→600XP, 365→2000XP)</div>
                <div><b>Badges / reward awards:</b> these add Bonus XP. Bonus XP increases Total XP and progression unlocks, but does not count in Group Earned XP competition.</div>
                <div><b>Day complete:</b> +10 XP when all workout blocks (not tasks) for that day are logged</div>
              </div>
            )}
          </div>

          <div className="panel mt16">
            <div className="rowBetween">
              <div>
                <div className="h3">XP Ledger</div>
                <div className="muted mt4">
                  This is the XP receipt. Earned XP is behaviour/training XP; Bonus XP is reward/award XP. Total XP is both together.
                </div>
              </div>
              <button type="button" className="btn" onClick={() => setShowXpLedger(v => !v)}>
                {showXpLedger ? "Hide XP ledger" : "Show XP ledger"}
              </button>
            </div>

            {showXpLedger && (
  <div
    className="mt12"
    style={{ maxHeight: 360, overflowX: "auto", overflowY: "auto", width: "100%", }}
  >
    <table className="table" style={{ minWidth: 760 }}>
  <thead>
    <tr>
      <th>Date</th>
      <th style={{ textAlign: "right" }}>Earned</th>
      <th style={{ textAlign: "right" }}>Bonus</th>
      <th style={{ textAlign: "right" }}>Total</th>
      <th style={{ textAlign: "right" }}>Balance</th>
      <th style={{ textAlign: "right" }}>Strength</th>
      <th style={{ textAlign: "right" }}>Cardio</th>
      <th style={{ textAlign: "right" }}>Duration</th>
      <th style={{ textAlign: "right" }}>Session</th>
      <th style={{ textAlign: "right" }}>Tasks</th>
      <th style={{ textAlign: "right" }}>Day</th>
      <th style={{ textAlign: "right" }}>Daily</th>
      <th style={{ textAlign: "right" }}>Prog</th>
      <th style={{ textAlign: "right" }}>Streak</th>
      <th style={{ textAlign: "right" }}>Badges</th>
    </tr>
  </thead>
  <tbody>
    {(xpDebugRows || []).slice(0, 21).map((r, rowIndex) => (
      <tr key={`${r.date}-${r.kind || "xp"}-${rowIndex}`}>
        <td>{r.date}</td>
        <td style={{ textAlign: "right" }}>
          <b>{r.earnedXp || 0}</b>
        </td>
        <td style={{ textAlign: "right" }}>{r.bonusXp || 0}</td>
        <td style={{ textAlign: "right" }}>{r.totalXp || 0}</td>
        <td style={{ textAlign: "right" }}>
          {r.runningTotalXp ?? ""}
        </td>
        <td
  style={{
    textAlign: "right",
    borderLeft: "1px solid rgba(1,1,1,0.06)", // only on Strength
  }}
>
  {r.strengthXp || 0}
</td>

<td style={{ textAlign: "right" }}>
  {r.cardioXp || 0}
  {r.cardioMode === "casual" ? " *" : ""}
</td>

<td style={{ textAlign: "right" }}>{r.durationXp || 0}</td>
<td style={{ textAlign: "right" }}>{r.sessionXp || 0}</td>
<td style={{ textAlign: "right" }}>{r.tasksXp || 0}</td>

<td
  style={{
    textAlign: "right",
    borderRight: "1px solid rgba(1,1,1,0.06)", // only on Day
  }}
>
  {r.dayCompleteXp || 0}
</td>
        <td style={{ textAlign: "right" }}>{r.dailyBonusXp || 0}</td>
        <td style={{ textAlign: "right" }}>{r.progXp || 0}</td>
        <td style={{ textAlign: "right" }}>{r.streakXp || 0}</td>
        <td style={{ textAlign: "right" }}>{r.badgeClaimXp || 0}</td>
      </tr>
    ))}
  </tbody>
</table>
            </div>
            )}


            <div className="mini muted mt8">
  * Cardio rows marked with a star were treated as casual/commute (walk-only) days
  and earned 60% of normal cardio XP.
</div>
<div className="mini muted mt4">
  Earned XP includes logged activity, tasks, day completion, progression, streak and normal daily challenge XP. Bonus XP contains claimed badges, mastery/avatar reward XP and Group award rewards.
</div>
          </div>

        </div>
      )}
    </Card>
  </div>
)}

{tab === "connections" && (
  <ConnectionsSettings
    profiles={profiles}
    initialProfileId={providerReturn?.profileId || activeProfileId}
    connectionReturn={providerReturn}
    authorizeMutation={ensureUnlocked}
  />
)}

{["settings", "appsettings"].includes(tab) && (
          <div className="grid2cols settingsWorkspace">
            {tab === "settings" && (
            <Card className="pad" style={{ gridColumn: "1 / -1" }}>
              <div ref={peopleRef} />
              <div className="h2">People on this account</div>
              <div className="stack mt12">
                {profiles.map((p) => (
                  <div key={p.id} className="panel">
                    <div className="rowBetween">
                      <div className="h3">{p.name}</div>
                      <div className="tabs">
                        <SecondaryButton
                          onClick={async () => {
                            const name = prompt("Rename profile:", p.name);
                            if (!name) return;
                            if (!(await ensureUnlocked("rename a profile"))) return;
                            await renameProfile(p.id, name.trim());
                            await refreshAll();
                          }}
                        >
                          Rename
                        </SecondaryButton>
                        <SecondaryButton
                          disabled={profiles.length <= 1}
                          onClick={async () => {
                            if (!confirm("Remove (archive) this profile?")) return;
                            if (!(await ensureUnlocked("remove a profile"))) return;
                            await archiveProfile(p.id);
                            await refreshAll();
                          }}
                        >
                          Remove
                        </SecondaryButton>
                      </div>
                    </div>

                    <div className="mt12">
                      <div className="label">Bodyweight (kg) for calorie estimates</div>
                      <CommitOnBlurInput
                        type="number"
                        min={0}
                        step={0.1}
                        value={p.body_weight_kg ?? ""}
                        onCommit={async (v) => {
                          if (!(await ensureUnlocked("change bodyweight"))) return;
                          await setProfileBodyweight(
                            p.id,
                            v === "" ? null : Number(v)
                          );
                          await refreshAll();
                        }}
                        placeholder="optional"
                      />
                      <div className="muted mini mt4">
                        Saves when you leave the field or press Enter.
                      </div>
                    <div className="mt12">
                      <div className="label">Age mode (no DOB stored)</div>
                      <Select
                        value={p.age_group || "under16"}
                        onChange={async (v) => {
                          if (!(await ensureUnlocked("change age mode"))) return;
                          const { data } = await updateAgeGroup(p.id, v);
                          if (data) setProfiles((prev) => prev.map((pp) => (pp.id === data.id ? data : pp)));
                        }}
                        options={[
                          { value: "under16", label: "Under 16 (safer targets)" },
                          { value: "adult", label: "Adult (standard targets)" },
                        ]}
                      />
                      <div className="muted mt8">Used only to scale suggested progress steps.</div>
                    </div>

                    <div className="mt12">
                      <div className="label">Recovery mode</div>
                      <Select
                        value={
                          normaliseProfileRecoveryMode(
                            getProfileRecoveryModeForDate(
                              profileRecoveryPeriods,
                              p.id,
                              getTodayYMD(),
                              getTodayYMD()
                            )?.mode
                          ) || "normal"
                        }
                        onChange={async (value) => {
                          const nextMode =
                            normaliseProfileRecoveryMode(value) || "normal";
                          const currentMode =
                            normaliseProfileRecoveryMode(
                              getProfileRecoveryModeForDate(
                                profileRecoveryPeriods,
                                p.id,
                                getTodayYMD(),
                                getTodayYMD()
                              )?.mode
                            ) || "normal";

                          if (nextMode === currentMode) return;
                          if (!(await ensureUnlocked("change recovery mode"))) return;

                          const message =
                            nextMode === "injury"
                              ? `Switch ${p.name} to Injury Recovery? Physical training will pause, Today’s Physio will become the plan, and completing it will maintain the streak.`
                              : nextMode === "illness"
                              ? `Switch ${p.name} to Illness Recovery? Physical training will pause, rest/recovery will become the plan, and completing it will maintain the streak.`
                              : `End recovery mode for ${p.name} and resume the normal training plan?`;

                          if (!window.confirm(message)) return;

                          const { error } = await setProfileRecoveryMode(
                            p.id,
                            nextMode,
                            getTodayYMD()
                          );

                          if (error) {
                            window.alert(error.message || String(error));
                            return;
                          }

                          const { data: periods } =
                            await listProfileRecoveryPeriods(family.id);
                          setProfileRecoveryPeriods(periods || []);
                        }}
                        options={[
                          { value: "normal", label: "Normal training" },
                          { value: "injury", label: "Injury Recovery" },
                          { value: "illness", label: "Illness Recovery" },
                        ]}
                      />
                      <div className="muted mt8">
                        Injury Recovery pauses physical training and adds Today’s
                        Physio (10 XP). Illness Recovery pauses physical training
                        and replaces it with a recovery confirmation (5 XP).
                        Completing either maintains the streak. Tasks stay active.
                      </div>

                      {(() => {
                        const recoveryHistory = (profileRecoveryPeriods || [])
                          .filter((period) => period?.profile_id === p.id)
                          .slice()
                          .sort(
                            (a, b) =>
                              new Date(b?.started_at || 0).getTime() -
                              new Date(a?.started_at || 0).getTime()
                          )
                          .slice(0, 5);

                        if (!recoveryHistory.length) return null;

                        return (
                          <div className="mt12">
                            <div className="label">Recovery history</div>
                            <div className="muted mt4">
                              Adjust a period if recovery actually started or ended
                              at a different date or time.
                            </div>
                            {recoveryHistory.map((period) => (
                              <RecoveryTimingEditor
                                key={period.id}
                                period={period}
                                onSave={async (timing) => {
                                  if (!(await ensureUnlocked("change recovery timing"))) return;

                                  const { error } =
                                    await updateProfileRecoveryPeriodTiming(
                                      period.id,
                                      p.id,
                                      timing
                                    );

                                  if (error) {
                                    window.alert(error.message || String(error));
                                    return;
                                  }

                                  const { data: periods } =
                                    await listProfileRecoveryPeriods(family.id);
                                  setProfileRecoveryPeriods(periods || []);
                                  setExternalLogRevision((value) => value + 1);
                                }}
                              />
                            ))}
                          </div>
                        );
                      })()}
                    </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mini mt12">
                <div className="h3">Add profile</div>
                <SecondaryButton
                  onClick={async () => {
                    const name = prompt("Profile name?");
                    if (!name) return;
                    if (!(await ensureUnlocked("add a profile"))) return;
                    await addProfile(family.id, name.trim(), blankPlanForNewProfile());
                    await refreshAll();
                  }}
                >
                  Add
                </SecondaryButton>
              </div>
            </Card>
            )}

            {tab === "appsettings" && (
            <Card className="pad" style={{ gridColumn: "1 / -1" }}>
              <div ref={accountRef} />
              <section className="settingsDataNotes" aria-labelledby="settings-data-title">
                <div className="settingsDataNotes__intro">
                  <div className="settingsDataNotes__eyebrow">ACCOUNT &amp; DATA</div>
                  <div className="h2" id="settings-data-title">How your data works</div>
                  <div className="muted mt4">
                    A quick guide to profiles, privacy and syncing on this account.
                  </div>
                </div>
                <div className="settingsDataNotes__grid">
                  <div className="settingsDataNote">
                    <span className="settingsDataNote__icon" aria-hidden="true">01</span>
                    <div>
                      <strong>One family account</strong>
                      <span>Keep multiple people and their training profiles together.</span>
                    </div>
                  </div>
                  <div className="settingsDataNote">
                    <span className="settingsDataNote__icon" aria-hidden="true">02</span>
                    <div>
                      <strong>Private profile stats</strong>
                      <span>Each person’s activity and progress stay inside this account.</span>
                    </div>
                  </div>
                  <div className="settingsDataNote">
                    <span className="settingsDataNote__icon" aria-hidden="true">03</span>
                    <div>
                      <strong>Automatic sync</strong>
                      <span>Programs and logs stay up to date across signed-in devices.</span>
                    </div>
                  </div>
                </div>
              </section>

              <div className="panel mt16">
                <div className="h3">Parent Lock (PIN)</div>
                <div className="muted mt8">Optional. If set, you’ll be asked for the PIN when saving/applying changes in People / Plan / Settings.</div>
                <div className="mini mt8">
                  Status: {family?.pin_hash ? <b>ON</b> : <b>OFF</b>} {family?.pin_hash ? (Date.now() < pinUnlockedUntil ? <span className="muted">(unlocked temporarily)</span> : <span className="muted">(locked)</span>) : null}
                </div>
                <div className="row mt12">
                  <PrimaryButton
                    onClick={async () => {
                      if (!family?.id) return;
                      const current = family?.pin_hash ? window.prompt("Enter current PIN:") : null;
                      if (family?.pin_hash) {
                        if (current === null) return;
                        const h = await sha256Hex(`${current}:${family.id}`);
                        if (h !== family.pin_hash) {
                          window.alert("Incorrect current PIN.");
                          return;
                        }
                      }
                      const next = window.prompt("Set a new 4-digit PIN:");
                      if (!next) return;
                      if (!/^\d{4}$/.test(next)) {
                        window.alert("Please use exactly 4 digits (e.g. 1234).");
                        return;
                      }
                      const pinHash = await sha256Hex(`${next}:${family.id}`);
                      const { data, error } = await setFamilyPinHash(family.id, pinHash);
                      if (error) return window.alert(error.message || String(error));
                      setFamily(data);
                      setPinUnlockedUntil(0);
                      window.alert("PIN set.");
                    }}
                  >
                    {family?.pin_hash ? "Change PIN" : "Set PIN"}
                  </PrimaryButton>
                  <div style={{ width: 10 }} />
                  <SecondaryButton
                    disabled={!family?.pin_hash}
                    onClick={async () => {
                      if (!family?.id) return;
                      const ok = window.confirm("Remove the PIN lock?");
                      if (!ok) return;
                      const { data, error } = await clearFamilyPin(family.id);
                      if (error) return window.alert(error.message || String(error));
                      setFamily(data);
                      setPinUnlockedUntil(0);
                    }}
                  >
                    Remove PIN
                  </SecondaryButton>
                  <div style={{ width: 10 }} />
                  <SecondaryButton
                    disabled={!family?.pin_hash}
                    onClick={() => setPinUnlockedUntil(0)}
                  >
                    Lock now
                  </SecondaryButton>
                </div>
              </div>

              <div className="panel mt16">
                <div className="avatarFrameSettings">
                  <div className="avatarFrameSettings__heading">
                    <div>
                      <div className="h3">Avatar frames</div>
                      <div className="muted mt4">
                        Prestige frame effects unlock at 10,000 XP and decorate 10,000 XP+ avatars.
                      </div>
                    </div>
                  </div>

                  <div className="avatarFrameSettings__control mt12">
                    <div>
                      <div className="label">Prestige frame effects</div>
                      <div className="mini muted mt4">
                        {prestigeFrameState.earned
                          ? "Choose whether the effect appears around eligible avatars."
                          : `${prestigeFrameState.remainingXp.toLocaleString("en-GB")} XP left to unlock.`}
                      </div>
                    </div>
                    <div className="avatarFrameSettings__actions">
                      <span
                        className={`avatarFrameStatus ${prestigeFrameState.earned ? "earned" : "locked"}`}
                      >
                        Status: <b>{prestigeFrameState.earned ? "Earned" : "Not yet"}</b>
                      </span>
                      {prestigeFrameState.earned ? (
                        <SecondaryButton
                          onClick={async () => {
                            if (!(await ensureUnlocked("change avatar frame settings"))) return;
                            await savePlanMetaNoPin({
                              avatarFramesEnabled: !avatarFramesEnabled,
                            });
                          }}
                        >
                          {avatarFramesEnabled ? "Turn effects off" : "Turn effects on"}
                        </SecondaryButton>
                      ) : (
                        <SecondaryButton disabled>
                          Unlock at {PRESTIGE_FRAME_UNLOCK_XP.toLocaleString("en-GB")} XP
                        </SecondaryButton>
                      )}
                    </div>
                  </div>

                  {!prestigeFrameState.earned ? (
                    <div
                      className="avatarFrameProgress mt12"
                      role="progressbar"
                      aria-label="Prestige frame unlock progress"
                      aria-valuemin={0}
                      aria-valuemax={PRESTIGE_FRAME_UNLOCK_XP}
                      aria-valuenow={prestigeFrameState.xp}
                    >
                      <div className="avatarFrameProgress__track" aria-hidden="true">
                        <span style={{ width: `${prestigeFrameState.progressPct}%` }} />
                      </div>
                      <div className="mini muted">
                        {prestigeFrameState.xp.toLocaleString("en-GB")} / {PRESTIGE_FRAME_UNLOCK_XP.toLocaleString("en-GB")} XP
                      </div>
                    </div>
                  ) : (
                    <div className="avatarFrameEarned mt16">
                      <div className="rowBetween avatarFramePicker__heading">
                        <div className="label">Choose a frame colour</div>
                        <div className="mini muted">{selectedAvatarFrameOption.label}</div>
                      </div>
                      <div className="avatarFramePreviewRow mt8" role="group" aria-label="Prestige frame colours">
                        {PRESTIGE_FRAME_OPTIONS.map((frame) => (
                          <button
                            key={frame.key}
                            type="button"
                            className={`avatarFramePreview avatarFrame-${frame.key} ${selectedAvatarFrame === frame.key ? "active" : ""}`}
                            onClick={async () => {
                              if (!(await ensureUnlocked("change avatar frame"))) return;
                              await savePlanMetaNoPin({
                                avatarFrame: frame.key,
                              });
                            }}
                            aria-label={`Use ${frame.label}`}
                            aria-pressed={selectedAvatarFrame === frame.key}
                            title={frame.label}
                          />
                        ))}
                      </div>

                      <div className="avatarFrameDemo mt16">
                        <div className="avatarFrameDemo__copy">
                          <div className="label">Preview on {activeProfile?.name || "this profile"}</div>
                          <div className="mini muted mt4">
                            {avatarFramesEnabled
                              ? "This is how the selected frame will look on an eligible avatar."
                              : "Preview only — turn effects on to use this frame in the app."}
                          </div>
                        </div>
                        <div
                          className={`avatarFrameDemo__stage selectedAvatarPanelPrestige avatarFrame-${selectedAvatarFrame}`}
                          aria-label={`${selectedAvatarFrameOption.label} preview`}
                        >
                          {headerAvatarImg ? (
                            <img
                              src={headerAvatarImg}
                              alt={headerAvatar?.label || "Current avatar"}
                              className="avatarFrameDemo__avatar selectedAvatarImg selectedAvatarImgPrestige"
                            />
                          ) : (
                            <span className="avatarFrameDemo__emoji" aria-hidden="true">
                              {headerAvatar?.emoji || "🙂"}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="panel mt16">
                <div className="h3">Tutorial</div>
                <div className="muted mt8">
                  Replay the short guide to weekly planning, rest days and logging activities.
                </div>
                <div className="row mt12">
                  <SecondaryButton
                    onClick={() => {
                      setTutorialStep(0);
                      setTab("dashboard");
                      persistTutorialState("in_progress", 0);
                    }}
                  >
                    Restart tutorial
                  </SecondaryButton>
                </div>
              </div>

              <AccountPrivacyPanel
                ensureUnlocked={ensureUnlocked}
                onDeleted={() => {
                  setAuthed(false);
                  setFamily(null);
                  setProfiles([]);
                  setPlan(null);
                  setAllLogs([]);
                  setLogForDay(null);
                  setActiveProfileId("");
                  try { localStorage.removeItem("wt_activeProfileId"); } catch {}
                  window.location.assign("/");
                }}
              />

              <div className="panel mt16">
                <div className="h3">Sign out</div>
                <div className="muted mt8">Use this on shared devices.</div>
                <div className="row mt12">
                  <SecondaryButton onClick={doSignOut}>Sign out</SecondaryButton>
                </div>
              </div>
            </Card>
            )}

          </div>
        )}

              {historyModal && (
  <div
    className="historyOverlay"
    role="dialog"
    aria-modal="true"
    onClick={() => setHistoryModal(null)}
  >
    <div className="historyModal" onClick={(e) => e.stopPropagation()}>
      <div className="historyModalTop">
        <div>
          <div className="historyTitle">{historyModal.title}</div>
          <div className="muted small">
            {historyModal.kind === "movement"
  ? "Strength trend"
  : historyModal.kind === "cardio"
  ? "Cardio trend"
  : historyModal.kind === "duration"
  ? "Duration trend"
  : "Task consistency"}
          </div>
        </div>

        <button
          type="button"
          className="iconBtn"
          onClick={() => setHistoryModal(null)}
          aria-label="Close"
        >
          ✕
        </button>
      </div>

      <div className="historyRanges">
        {[
          ["4w", "4W"],
          ["8w", "8W"],
          ["12w", "12W"],
          ["6m", "6M"],
        ].map(([k, txt]) => (
          <button
            key={k}
            type="button"
            className={"pillToggleBtn " + (historyRange === k ? "active" : "")}
            onClick={() => setHistoryRange(k)}
          >
            {txt}
          </button>
        ))}
      </div>

      {historyModal.kind === "movement" && (
  <div className="historyRanges" style={{ marginTop: 6 }}>
    {[
      ["weight", "Weight"],
      ["reps", "Reps"],
      ["time", "Time"],
    ].map(([k, label]) => (
      <button
        key={k}
        type="button"
        className={"pillToggleBtn " + (historyStrengthShow[k] ? "active" : "")}
        onClick={() =>
          setHistoryStrengthShow((s) => ({ ...s, [k]: !s[k] }))
        }
      >
        {label}
      </button>
    ))}
  </div>
)}

{historyModal.kind === "cardio" && (
  <>
    <div className="historyRanges" style={{ marginTop: 6 }}>
      {[
        ["pace", "Pace"],
        ["distance", "Distance"],
        ["time", "Time"],
        ["speed", "Speed"],
      ].map(([k, label]) => (
        <button
          key={k}
          type="button"
          className={"pillToggleBtn " + (historyCardioMetric === k ? "active" : "")}
          onClick={() => setHistoryCardioMetric(k)}
        >
          {label}
        </button>
      ))}
    </div>

    <div className="historyRanges" style={{ marginTop: 6 }}>
      {[
        ["km", "KM"],
        ["mi", "Miles"],
      ].map(([u, label]) => (
        <button
          key={u}
          type="button"
          className={"pillToggleBtn " + (historyCardioUnit === u ? "active" : "")}
          onClick={() => setHistoryCardioUnit(u)}
        >
          {label}
        </button>
      ))}
    </div>
  </>
)}

      <div className="chart" style={{ height: 240 }}>
        {historySeries.length === 0 ? (
          <div className="dashed" style={{ padding: 18 }}>
            No history in this range yet.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
  <LineChart data={historySeries} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
    <CartesianGrid strokeDasharray="3 3" />
    <XAxis dataKey="x" tick={{ fontSize: 12 }} />
    <YAxis tick={{ fontSize: 12 }} />

    <Tooltip
      formatter={(val, key) => {
        const n = Number(val);

        if (historyModal.kind === "movement") {
          if (key === "weight") return [n, "Weight (kg)"];
          if (key === "reps") return [n, "Reps"];
          if (key === "timeSec") return [n, "Time (sec)"];
          return [n, key];
        }

        if (historyModal.kind === "duration") {
          return [n, "Minutes"];
        }

        if (historyModal.kind === "task") {
          return [n === 1 ? "Done" : "Missed", "Task"];
        }

        // cardio
        if (historyModal.kind === "cardio") {
          if (key === "pace_km" || key === "pace_mi") {
            const totalSec = Math.round(n * 60);
            const mm = String(Math.floor(totalSec / 60)).padStart(2, "0");
            const ss = String(totalSec % 60).padStart(2, "0");
            const unit = key === "pace_mi" ? "/mi" : "/km";
            return [`${mm}:${ss} ${unit}`, "Pace"];
          }
          if (key === "dist_km") return [n.toFixed(2), "Distance (km)"];
          if (key === "dist_mi") return [n.toFixed(2), "Distance (mi)"];
          if (key === "time_min") return [n.toFixed(0), "Time (min)"];
          if (key === "speed_kmh") return [n.toFixed(2), "Speed (km/h)"];
          if (key === "speed_mph") return [n.toFixed(2), "Speed (mph)"];
        }

        return [n, key];
      }}
    />

    {/* Strength: multi-line */}
    {historyModal.kind === "movement" && (
      <>
        {historyStrengthShow.weight && (
          <Line type="monotone" dataKey="weight" dot={{ r: 3 }} strokeWidth={3} stroke="#0ea5e9" connectNulls />
        )}
        {historyStrengthShow.reps && (
          <Line type="monotone" dataKey="reps" dot={{ r: 3 }} strokeWidth={3} stroke="#22c55e" connectNulls />
        )}
        {historyStrengthShow.time && (
          <Line type="monotone" dataKey="timeSec" dot={{ r: 3 }} strokeWidth={3} stroke="#f59e0b" connectNulls />
        )}
      </>
    )}

    {/* Duration: single line */}
    {historyModal.kind === "duration" && (
      <Line type="monotone" dataKey="minutes" dot={false} strokeWidth={3} />
    )}

    {/* Task: single line (0/1) */}
    {historyModal.kind === "task" && (
      <Line type="stepAfter" dataKey="done" dot={false} strokeWidth={3} />
    )}

    {/* Cardio: single line based on metric + unit */}
    {historyModal.kind === "cardio" && (() => {
      const key =
        historyCardioMetric === "pace"
          ? (historyCardioUnit === "mi" ? "pace_mi" : "pace_km")
          : historyCardioMetric === "distance"
          ? (historyCardioUnit === "mi" ? "dist_mi" : "dist_km")
          : historyCardioMetric === "speed"
          ? (historyCardioUnit === "mi" ? "speed_mph" : "speed_kmh")
          : "time_min";

      return <Line type="monotone" dataKey={key} dot={false} strokeWidth={3} />;
    })()}
  </LineChart>
</ResponsiveContainer>
        )}
      </div>
    </div>
  </div>
)}
                             <footer className="footer">Workout Tracker beta: custom plans • XP, streaks &amp; rewards.</footer>
      </div>

      {claimModal && (
        <div
          className={"claimOverlay" + (claimModal.kind === "badge" ? " claimOverlayBadge" : "")}
          role="dialog"
          aria-modal="true"
          onClick={() => setClaimModal(null)}
        >
          {claimModal.kind === "badge" ? (
            <div className="claimStage">
              <button
                type="button"
                className="iconBtn claimClose"
                onClick={() => setClaimModal(null)}
                aria-label="Close"
              >
                ✕
              </button>

              <div className="claimDim" />
              <div className="claimFlash" />
              <div className="claimRing" />

              <div className="claimConfetti" aria-hidden="true">
                {(claimModal.confetti || []).map((p) => (
                  <div
                    key={p.id}
                    className="confetti"
                    style={{
                      "--dx": `${p.x}px`,
                      "--dy": `${p.y}px`,
                      "--rot": `${p.r}deg`,
                      "--dur": `${p.d}ms`,
                    }}
                  />
                ))}
              </div>

              <div className="claimBadgeFly" aria-hidden="true">
                <div className={"claimBadge" + (claimModal.stage ? " " + claimModal.stage : "")}>
                  {claimModal.emoji}
                </div>
              </div>

              <div className="claimCopy">
                <div className="claimTitle">{claimModal.title}</div>
                <div className="claimSub">{claimModal.desc}</div>

                <div className="claimXpRow">
                  <div className="claimXpPlus">+{safeNumber(claimModal.xpAward)} XP</div>
                  <div className="claimXpTotal">
                    XP:{" "}
                    <span className="mono">
                      {claimXpDisplay ?? safeNumber(claimModal.xpTo) ?? xp}
                    </span>
                  </div>
                </div>

                <div className="mini muted mt8">Tap anywhere to close.</div>
              </div>
            </div>
          ) : (
            <div className="historyModal" onClick={(e) => e.stopPropagation()}>
              <div className="historyModalTop">
                <div>
                  <div className="historyTitle">{claimModal.title}</div>
                  <div className="muted small mt4">{claimModal.desc}</div>
                </div>
                <button
                  type="button"
                  className="iconBtn"
                  onClick={() => setClaimModal(null)}
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>

              <div className="panel mt12">
                <div className="bigNumber rewardBoom" style={{ textAlign: "center" }}>
                  🎉
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <StyleTag />
    </div>
  );
}

function AddMovement({ onAdd, defaultKind }) {
  const [name, setName] = useState("");
  const [mode, setMode] = useState(defaultKind === "time" ? "time" : "strength");
  const [allowWeight, setAllowWeight] = useState(defaultKind !== "time");
  const [fixedSeconds, setFixedSeconds] = useState(
    defaultKind === "time" ? "60" : ""
  );
  const [allowCount, setAllowCount] = useState(defaultKind === "time");
  const [countLabel, setCountLabel] = useState(
    defaultKind === "time" ? "hits" : "count"
  );
  const [note, setNote] = useState("");

  useEffect(() => {
    setMode(defaultKind === "time" ? "time" : "strength");
    setAllowWeight(defaultKind !== "time");
    setFixedSeconds(defaultKind === "time" ? "60" : "");
    setAllowCount(defaultKind === "time");
    setCountLabel(defaultKind === "time" ? "hits" : "count");
  }, [defaultKind]);

  return (
    <div className="stack mt12">
      <div>
        <div className="label">Name</div>
        <Input
          value={name}
          onChange={setName}
          placeholder="e.g. Pull-ups"
        />
      </div>

      <div>
        <div className="label">Coach note (optional)</div>
        <Textarea
          value={note}
          onChange={setNote}
          placeholder="e.g. Keep elbows tucked. Control down. Strong core."
          rows={3}
        />
      </div>

      <div className="grid2">
        <div>
          <div className="label">Mode</div>
          <Select
            value={mode}
            onChange={setMode}
            options={[
              { value: "strength", label: "Reps (+ optional weight)" },
              { value: "time", label: "Time (seconds)" },
            ]}
          />
        </div>
        <div className="box">
          <label className="check">
            <input
              type="checkbox"
              checked={allowWeight}
              onChange={(e) => setAllowWeight(e.target.checked)}
              disabled={mode !== "strength"}
            />
            Allow weight
          </label>
          <div className="muted">For dumbbells etc.</div>
        </div>
      </div>

      {mode === "time" && (
        <div className="grid2">
          <div>
            <div className="label">Fixed seconds (optional)</div>
            <Input
              value={fixedSeconds}
              onChange={setFixedSeconds}
              type="number"
              min={0}
              step={1}
              placeholder="e.g. 60"
            />
          </div>
          <div className="box">
            <label className="check">
              <input
                type="checkbox"
                checked={allowCount}
                onChange={(e) => setAllowCount(e.target.checked)}
              />
              Allow count
            </label>
            <div className="muted">Hits/rounds etc.</div>
          </div>
          {allowCount && (
            <div>
              <div className="label">Count label</div>
              <Input
                value={countLabel}
                onChange={setCountLabel}
                placeholder="hits"
              />
            </div>
          )}
        </div>
      )}

      <PrimaryButton
        onClick={() => {
          if (!name.trim()) return;
          onAdd({
            name: name.trim(),
            note: note.trim() || "",
            mode,
            allowWeight: mode === "strength" ? allowWeight : false,
            fixedSeconds:
              mode === "time" && safeNumber(fixedSeconds) > 0
                ? safeNumber(fixedSeconds)
                : undefined,
            allowCount: mode === "time" ? allowCount : false,
            countLabel:
              mode === "time" && allowCount ? countLabel.trim() : undefined,
          });
          setName("");
          setNote("");
        }}
      >
        Add movement
      </PrimaryButton>
    </div>
  );
}


function AddType({ onAdd }) {
  const [name, setName] = useState("");
  const [kind, setKind] = useState("task");
  const [movementsEnabled, setMovementsEnabled] = useState(false);

  // If "Tick-box tasks" kind is selected, force movements off
  useEffect(() => {
    if (kind === "task") {
      setMovementsEnabled(false);
    }
  }, [kind]);

  return (
    <div className="stack mt12">
      <div className="grid2">
        <div>
          <div className="label">Type name</div>
          <Input
            value={name}
            onChange={setName}
            placeholder="e.g. Pilates"
          />
        </div>
        <div>
          <div className="label">Kind</div>
          <Select
            value={kind}
            onChange={setKind}
            options={[
              { value: "strength", label: "Strength (movements + reps/weight)" },
              { value: "time", label: "Time (movements + seconds)" },
              { value: "cardio", label: "Cardio (distance + time)" },
              { value: "custom", label: "Custom (duration only)" },
              { value: "task", label: "Tick-box tasks (yes/no)" },
            ]}
          />
        </div>
      </div>

      <div className="mini">
        Movements enabled: <b>{movementsEnabled ? "Yes" : "No"}</b>
      </div>

      <SecondaryButton
        onClick={() => {
          if (!name.trim()) return;

          const id = slugifyId(name.trim());
          const isTask = kind === "task";

          onAdd({
            id,
            name: name.trim(),
            kind,
            movementsEnabled: !isTask && movementsEnabled,
            fields: isTask
              ? { tasks: true }
              : {
                  movements: true,
                  restSeconds: kind === "strength" || kind === "time",
                  cardioTarget: kind === "cardio",
                  durationMinutes: kind === "custom",
                },
          });

          setName("");
          setKind("task");
          setMovementsEnabled(false);
        }}
      >
        Add type
      </SecondaryButton>
    </div>
  );
}


function StyleTag() {
  return (
    <style>{`
      .movementDivider {
  height: 1px;
  background: #e5e7eb; /* light grey */
  margin: 16px 14px 0 14px; /* top spacing + inset from edges */
}
/* Rewards: header avatar + badge grid */
.titleRow{display:flex;align-items:center;gap:10px}

.rewardsSummaryColumn{
  flex:1;
  display:flex;
  flex-direction:column;
  gap:8px;
  min-width:0;
}

.rewardsXpBreakdown{
  border:1px solid #dbe4ee;
  background:linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
  border-radius:18px;
  overflow:hidden;
  box-shadow:0 1px 0 rgba(15,23,42,.03);
}

.rewardsXpTotal{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
  padding:12px 14px 10px;
  border-bottom:1px solid #e2e8f0;
}

.rewardsXpTotal span,
.rewardsXpSplit span{
  display:block;
  font-size:11px;
  font-weight:900;
  color:#64748b;
  letter-spacing:.02em;
  text-transform:uppercase;
}

.rewardsXpTotal strong{
  font-size:24px;
  line-height:1;
  color:#0f172a;
}

.rewardsXpSplit{
  display:grid;
  grid-template-columns:1fr 1fr;
}

.rewardsXpSplit > div{
  padding:10px 14px 12px;
  min-width:0;
}

.rewardsXpSplit > div + div{
  border-left:1px solid #e2e8f0;
}

.rewardsXpSplit strong{
  display:block;
  margin-top:4px;
  font-size:16px;
  color:#0f172a;
}

.rewardsAvatarMilestonePanel{
  overflow:hidden;
}

.rewardsAvatarMilestone{
  border:1px solid #dbe4ee;
  background:
    radial-gradient(circle at 92% 10%,rgba(249,115,22,.10),transparent 34%),
    linear-gradient(180deg,#ffffff 0%,#f8fafc 100%);
  border-radius:16px;
  padding:14px;
}

.rewardsMilestoneEyebrow{
  font-size:11px;
  font-weight:900;
  letter-spacing:.08em;
  color:#f97316;
  text-transform:uppercase;
}

.rewardsMilestoneTitle{
  margin-top:3px;
  font-size:20px;
  line-height:1.15;
  font-weight:950;
  color:#0f172a;
}

.rewardsMilestoneMeta{
  margin-top:5px;
  font-size:12px;
  color:#64748b;
}

.rewardsMilestoneProgress{
  height:10px;
  margin-top:14px;
  border-radius:999px;
  background:#e2e8f0;
  overflow:hidden;
}

.rewardsMilestoneProgressFill{
  height:100%;
  border-radius:999px;
  background:linear-gradient(90deg,#fb923c,#f97316);
  transition:width .25s ease;
}

.rewardsMilestoneProgressText{
  display:flex;
  justify-content:space-between;
  align-items:center;
  gap:12px;
  margin-top:7px;
  font-size:11px;
  color:#64748b;
}

.rewardsMilestoneProgressText strong{
  color:#0f172a;
  text-align:right;
}

.rewardsRoadmapGrid{
  display:grid;
  grid-template-columns:repeat(2,minmax(0,1fr));
  gap:10px;
}

.rewardsRoadmapItem{
  min-width:0;
  padding:12px;
  border:1px solid #e2e8f0;
  border-radius:15px;
  background:#fff;
}

.rewardsRoadmapItem span{
  display:block;
  font-size:10px;
  font-weight:900;
  letter-spacing:.07em;
  text-transform:uppercase;
  color:#64748b;
}

.rewardsRoadmapItem strong{
  display:block;
  margin-top:4px;
  font-size:16px;
  line-height:1.2;
  color:#0f172a;
}

.rewardsRoadmapItem small{
  display:block;
  margin-top:4px;
  color:#64748b;
  line-height:1.3;
}

.rewardsRoadmapItemCurrent{
  border-color:rgba(249,115,22,.35);
  background:rgba(249,115,22,.055);
}

.rewardsRoadmapItemAvatar{
  border-color:rgba(14,165,233,.26);
  background:rgba(14,165,233,.045);
}

@media(max-width:720px){
  .rewardsXpTotal{
    align-items:center;
  }
  .rewardsXpTotal strong{
    font-size:21px;
  }
  .rewardsRoadmapGrid{
    grid-template-columns:1fr;
  }
  .rewardsMilestoneProgressText{
    align-items:flex-start;
    flex-direction:column;
    gap:3px;
  }
  .rewardsMilestoneProgressText strong{
    text-align:left;
  }
}
.avatarChip{
  width:28px;
  height:28px;
  border-radius:999px;
  display:inline-flex;
  align-items:center;
  justify-content:center;
  background:rgba(0,0,0,0.25);
  border:1px solid rgba(255,255,255,0.15);
  font-size:16px;
  position:relative;
  overflow:visible;
  padding:0;
  color:inherit;
  cursor:pointer;
}
.avatarChip:focus-visible{outline:3px solid rgba(59,211,255,.72);outline-offset:3px}

.avatarChipState{
  transition:
    box-shadow .22s ease,
    border-color .22s ease,
    background .22s ease,
    filter .22s ease,
    transform .22s ease,
    opacity .22s ease;
}

.headerAvatarImg,
.headerAvatarEmoji{
  transition:
    filter .22s ease,
    opacity .22s ease,
    transform .22s ease;
}

/* Neutral */
.avatarState-neutral{
  box-shadow:none;
}

/* Energised = subtle cyan glow */
.avatarState-energised{
  border-color:rgba(0,229,255,0.42);
  box-shadow:
    0 0 0 1px rgba(0,229,255,0.12) inset,
    0 0 10px rgba(0,229,255,0.18);
}

.avatarState-energised .headerAvatarImg,
.avatarState-energised .headerAvatarEmoji{
  filter:brightness(1.04) saturate(1.04);
}

/* Legend = stronger prestige ring, still controlled */
.avatarState-legend{
  border-color:rgba(255,215,0,0.55);
  box-shadow:
    0 0 0 1px rgba(255,215,0,0.18) inset,
    0 0 0 2px rgba(0,229,255,0.12),
    0 0 16px rgba(255,215,0,0.22);
  transform:translateY(-1px);
}

.avatarState-legend .headerAvatarImg,
.avatarState-legend .headerAvatarEmoji{
  filter:brightness(1.06) saturate(1.08);
}

/* Fatigued = slightly dimmed / desaturated */
.avatarState-fatigued{
  border-color:rgba(255,77,77,0.26);
  background:rgba(0,0,0,0.32);
  box-shadow:
    0 0 0 1px rgba(255,77,77,0.08) inset;
}

.avatarState-fatigued .headerAvatarImg,
.avatarState-fatigued .headerAvatarEmoji{
  filter:grayscale(.28) brightness(.88);
  opacity:.86;
}

/* Badge cards (kids-first: big badge, small text) */
/* Badge cards */
.badgeCard{
  transition:transform .12s ease;
  display:flex;
  flex-direction:column;
  gap:10px;
}
.badgeCard.claimable:hover{transform:translateY(-1px)}

.badgeTitle{
  font-weight:800;
  font-size:16px;
}

.badgeMid{
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:14px;
}

.badgeAction{
  display:flex;
  align-items:center;
  justify-content:flex-end;
  min-width:88px;
}

.badgeBig{
  width:132px;
  height:104px;
  border-radius:22px;
  display:flex;
  align-items:center;
  justify-content:flex-start;
  position:relative;
  overflow:visible;
  background:none;
  border:none;
  font-size:0;
}

.badgeBig.off{
  opacity:.9;
}

:root{
  --badge-size: 132px;
  --badge-stack-offset: 22px;
}

.wtBadge{
  position:relative;
  width:calc(var(--badge-size) + 40px);
  height:var(--badge-size);
}

.sportMasteryCard .wtBadge{ width:calc(var(--badge-size) + 48px); }
.sportMasteryCard .wtBadgeBgLayer{ transform:translateX(calc(var(--layerIndex) * 12px)); }
.sportMasteryCard .wtBadgeForeground{ transform:translateX(calc(var(--frontOffset) * .5454545)); }
.sportMasteryAchievements{ display:flex; flex-wrap:wrap; gap:6px; margin-top:10px; }
.sportMasteryStars{ display:flex; align-items:center; justify-content:center; gap:8px; color:#f3c857; margin-top:8px; flex-wrap:wrap; }
.sportMasteryStars > span:first-child{ letter-spacing:3px; font-size:22px; }
.sportMasteryHistory{ margin-top:12px; }
.sportMasteryHistory summary{ cursor:pointer; font-weight:650; padding:8px 0; }
.sportMasteryMilestones .badgeTierGrid{ grid-template-columns:repeat(auto-fit,minmax(100px,1fr)); }
.sportMasteryCard .badgeMid{ gap:8px; flex-wrap:wrap; }
@media (prefers-reduced-motion:reduce){ .sportMasteryCard *{ animation:none !important; transition:none !important; } }

.wtBadgeBgLayer{
  position:absolute;
  top:0;
  left:0;
  width:var(--badge-size);
  height:var(--badge-size);
  display:block;
  z-index:calc(var(--layerIndex));
  transform:translateX(calc(var(--layerIndex) * var(--badge-stack-offset)));
}

.wtBadgeBgLayer-locked{
  filter:grayscale(1) brightness(1.08) contrast(.92) opacity(.95);
}

.wtBadgeBgLayer-next{
  filter:grayscale(1) brightness(1.05) opacity(.92);
}

.wtBadgeForeground{
  position:absolute;
  top:0;
  left:0;
  width:var(--badge-size);
  height:var(--badge-size);
  transform:translateX(var(--frontOffset));
  z-index:999;
  pointer-events:none;
}

.wtBadgeFaceText{
  position:absolute;
  left:50%;
  top:35%;
  transform:translate(-50%, -50%);
  width:78%;
  max-width:78%;
  font-size:12px;
  font-weight:900;
  letter-spacing:.05em;
  line-height:1.05;
  text-transform:uppercase;
  text-align:center;
  color:rgba(255,255,255,.18);
  text-shadow:0 1px 0 rgba(0,0,0,.25);
  white-space:normal;
  overflow-wrap:anywhere;
  word-break:break-word;
  z-index:1;
  pointer-events:none;
}

.wtBadgeIcon{
  position:absolute;
  left:50%;
  top:52%;
  transform:translate(-50%, -50%);
  width:80px;
  height:80px;
  object-fit:contain;
  filter:drop-shadow(0 6px 12px rgba(0,0,0,0.6));
  z-index:2;
}

.wtBadgeIcon--pending{
  filter:grayscale(1) brightness(1.12) opacity(.55);
}

.wtBadgePlaque{
  position:absolute;
  left:50%;
  bottom:8px;
  transform:translateX(-50%);
  min-width:42px;
  padding:2px 8px;
  border-radius:999px;
  background:#111827;
  color:#f59e0b;
  font-size:10px;
  font-weight:900;
  letter-spacing:.05em;
  line-height:1.2;
  text-align:center;
  box-shadow:0 2px 6px rgba(0,0,0,.28);
  z-index:3;
}

.badgeDesc{
  font-size:13px;
  line-height:1.35;
  color:#475569;
  min-height:50px;
  padding:10px 12px;
  border-radius:14px;
  background:#eef2f7;
  border:1px solid rgba(15,23,42,.06);
}

.badgeDescIntro{
  font-size:12px;
  color:#6b7280;
  margin-bottom:4px;
}

.badgeDescProgress{
  font-size:13px;
}

.badgeTierGrid{
  display:grid;
  grid-template-columns:1fr 1fr;
  gap:8px;
}

.badgeTierChip{
  border-radius:999px;
  padding:6px 10px;
  border:1px solid rgba(15,23,42,.08);
  background:#f3f4f6;
  color:#475569;
}

.badgeTierChip--locked{
  background:#f3f4f6;
  color:#6b7280;
  border-color:rgba(15,23,42,.08);
}

.badgeTierChip--next{
  background:rgba(245,158,11,.12);
  color:#92400e;
  border-color:rgba(245,158,11,.28);
}

.badgeTierChip--earned{
  background:rgba(245,158,11,.14);
  color:#92400e;
  border-color:rgba(245,158,11,.28);
}

.badgeTierChip--claimed{
  background:rgba(16,185,129,.14);
  color:#065f46;
  border-color:rgba(16,185,129,.28);
}

.badgeTierChipName{
  font-size:11px;
  font-weight:900;
  line-height:1.1;
}

.badgeTierChipMeta{
  margin-top:2px;
  font-size:11px;
  line-height:1.15;
}
.wtBadgeDistance{
  position:absolute;
  inset:22%;
  display:flex;
  align-items:center;
  justify-content:center;
  text-transform:uppercase;
  color:#FFFFFF;
  opacity:0.18;
  text-shadow:0 0 6px rgba(0,0,0,0.55);
  z-index:1;
  pointer-events:none;
}

/* Short label like "5K" can be bigger */
.wtBadgeDistance--short{
  font-size:calc(var(--badge-size) * 0.28);
  font-weight:800;
  letter-spacing:0.14em;
}

/* Longer label like "10K" needs to be a bit smaller/tighter */
.wtBadgeDistance--long{
  font-size:calc(var(--badge-size) * 0.24);
  font-weight:800;
  letter-spacing:0.10em;
}

.wtBadgeTierPlaque{
  position:absolute;
  left:50%;
  bottom:6%;                 /* lower on badge */
  transform:translateX(-50%);
  
  padding:1px 6px;           /* tighter pill */
  border-radius:999px;
  
  font-size:8px;             /* smaller text */
  font-weight:700;
  text-transform:uppercase;
  letter-spacing:0.08em;     /* slightly tighter */
  
  background:rgba(0,0,0,0.72);  /* slightly stronger for contrast */
  color:#F5F5F5;
  
  box-shadow:0 2px 4px rgba(0,0,0,0.5);
  pointer-events:none;
  z-index:3;
  
  line-height:1.1;           /* removes vertical extra space */
}

/* Tier colour accents – text colour only so it doesn’t shout */
.wtBadgeTierPlaque.tier-bronze { color:#F2B178; }
.wtBadgeTierPlaque.tier-silver { color:#E5ECF7; }
.wtBadgeTierPlaque.tier-gold { color:#FFE27A; }
.wtBadgeTierPlaque.tier-platinum { color:#C4E8FF; }
.wtBadgeTierPlaque.tier-diamond { color:#9DF5FF; }

/* Locked: greyed out */
.badgeCard.locked .wtBadgeBgLayer,
.badgeCard.locked .wtBadgeIcon,
.badgeCard.locked .wtBadgeDistance,
.badgeCard.locked .wtBadgeTierPlaque{
  filter:grayscale(0.95) brightness(0.7);
  opacity:0.75;
}

/* Claimable: subtle glow 
.badgeCard.claimable .wtBadgeBg{
  filter:drop-shadow(0 0 12px rgba(0,229,255,0.55));
}*/

/* Claimed: slightly stronger glow 
.badgeCard.claimed .wtBadgeBg{
  filter:drop-shadow(0 0 18px rgba(0,229,255,0.75));
}*/
.badgeCard.claimable .badgeBig.off{opacity:.45}
.badgeCard.locked .badgeBig.off{opacity:.18}
.badgeBig.on{
  opacity:1;
  filter:none;
  box-shadow: 0 0 0 1px rgba(255,255,255,0.35) inset, 0 10px 30px rgba(0,0,0,0.08);
}
.badgeDesc{
  width:100%;
  background: rgba(0,0,0,0.04);
  border:1px solid rgba(0,0,0,0.06);
  border-radius:14px;
  padding:10px 12px;
  font-size:12px;
  color: rgba(0,0,0,0.65);
}

.badgeTierRow{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
  margin-top:6px;
}

.badgeTierChip{
  padding:4px 8px;
  border-radius:999px;
  background:rgba(255,255,255,0.85);
  border:1px solid rgba(0,0,0,0.04);
  font-size:10px;
  line-height:1.25;
  display:flex;
  flex-direction:column;
  align-items:flex-start;
}

.badgeTierChipTier{
  font-weight:600;
}

.badgeTierChipMeta{
  opacity:0.7;
}

.badgeTierChip--unlocked{
  background:rgba(0,200,120,0.14);
  border-color:rgba(0,200,120,0.5);
}

.badgeTierChip--next{
  box-shadow:0 0 0 1px rgba(255,165,0,0.65);
}

/* "Ignite" flash on the badge card */
.badgeCard.flash{animation:badgePop .85s cubic-bezier(.2,.9,.2,1)}
.badgeCard.flash .badgeBig{animation:badgeShine .9s ease}
@keyframes badgePop{
  0%{transform:scale(1)}
  22%{transform:scale(1.04) rotate(-1deg)}
  45%{transform:scale(0.99) rotate(0.5deg)}
  100%{transform:scale(1)}
}
@keyframes badgeShine{
  0%{filter:brightness(1)}
  30%{filter:brightness(1.35)}
  100%{filter:brightness(1)}
}

/* Epic claim overlay */
.claimOverlay{
  position:fixed; inset:0;
  display:flex; align-items:center; justify-content:center;
  z-index:2000;
}
.claimOverlayBadge{cursor:pointer}
.claimStage{position:absolute; inset:0}
.claimDim{
  position:absolute; inset:0;
  background: rgba(0,0,0,0.42);
  animation:dimIn .22s ease forwards;
}
@keyframes dimIn{from{opacity:0}to{opacity:1}}
.claimFlash{
  position:absolute; inset:0;
  background: radial-gradient(circle at 50% 45%, rgba(255,255,255,0.65), rgba(255,255,255,0) 55%);
  opacity:0;
  animation:flashPulse .9s ease forwards;
}
@keyframes flashPulse{
  0%{opacity:0}
  18%{opacity:1}
  55%{opacity:.25}
  100%{opacity:0}
}
.claimRing{
  position:absolute;
  left:50%; top:45%;
  width:18px; height:18px;
  border-radius:999px;
  border: 3px solid rgba(255,255,255,0.9);
  transform:translate(-50%,-50%) scale(0.4);
  opacity:0;
  animation:ringOut .9s ease forwards;
}
@keyframes ringOut{
  0%{opacity:0; transform:translate(-50%,-50%) scale(0.4)}
  18%{opacity:1}
  100%{opacity:0; transform:translate(-50%,-50%) scale(26)}
}

.claimBadgeFly{
  position:fixed;
  transform:translate(-50%,-50%);
  animation:badgeFlyIn 0.95s cubic-bezier(.2,.95,.2,1) forwards;
  pointer-events:none;
  left:50%; top:45%;
}
.claimBadge{
  width:130px; height:130px;
  border-radius:34px;
  display:flex; align-items:center; justify-content:center;
  font-size:78px; line-height:1;
  background: rgba(255,255,255,0.10);
  border: 1px solid rgba(255,255,255,0.22);
  box-shadow: 0 20px 70px rgba(0,0,0,0.35);
  backdrop-filter: blur(6px);
}
.claimBadge.shake{ animation: claimShake 260ms ease-in-out; }
.claimBadge.boom{ animation: claimBoom 520ms cubic-bezier(.2,.95,.2,1); }

@keyframes claimShake{
  0%{transform:translateX(0) rotate(0)}
  20%{transform:translateX(-6px) rotate(-4deg)}
  40%{transform:translateX(6px) rotate(4deg)}
  60%{transform:translateX(-4px) rotate(-3deg)}
  80%{transform:translateX(4px) rotate(3deg)}
  100%{transform:translateX(0) rotate(0)}
}

@keyframes claimBoom{
  0%{transform:scale(.6)}
  55%{transform:scale(1.18)}
  100%{transform:scale(1)}
}
@keyframes badgeFlyIn{
  0%{transform:translate(-50%,-50%) scale(0.6)}
  35%{transform:translate(-50%,-50%) scale(1.2)}
  60%{transform:translate(-50%,-50%) scale(1)}
  100%{transform:translate(-50%,-50%) scale(1)}
}

.claimConfetti{position:absolute; inset:0; pointer-events:none}
.confetti{
  position:absolute;
  left:50%; top:45%;
  width:10px; height:14px;
  border-radius:3px;
  background: rgba(255,255,255,0.9);
  transform:translate(-50%,-50%);
  animation:confettiFly var(--dur) ease-out forwards;
  opacity:0.95;
}
@keyframes confettiFly{
  0%{transform:translate(-50%,-50%) rotate(0deg) scale(0.9); opacity:1}
  100%{transform:translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)) scale(0.6); opacity:0}
}

.claimCopy{
  position:fixed;
  left:50%; top:68%;
  transform:translate(-50%,-50%);
  text-align:center;
  color:white;
  width:min(520px, calc(100vw - 28px));
  animation:copyIn .45s ease forwards;
}
@keyframes copyIn{from{opacity:0; transform:translate(-50%,-50%) translateY(10px)}to{opacity:1; transform:translate(-50%,-50%) translateY(0)}}
.claimTitle{font-size:26px; font-weight:900; letter-spacing:0.2px}
.claimSub{margin-top:6px; font-size:14px; opacity:0.9}
.claimXpRow{margin-top:14px; display:flex; gap:12px; align-items:center; justify-content:center; flex-wrap:wrap}
.claimXpPlus{
  padding:10px 14px;
  border-radius:999px;
  background: rgba(255,255,255,0.16);
  border: 1px solid rgba(255,255,255,0.25);
  font-weight:800;
}
.claimXpTotal{
  padding:10px 14px;
  border-radius:999px;
  background: rgba(0,0,0,0.24);
  border: 1px solid rgba(255,255,255,0.18);
  font-weight:800;
}
.claimClose{
  position:fixed;
  right:18px; top:18px;
  background: rgba(0,0,0,0.35);
  border: 1px solid rgba(255,255,255,0.18);
  color: white;
}

/* avatar picker */
.avatarRoster{
  display:grid;
  grid-template-columns:repeat(2, minmax(0, 1fr));
  gap:10px;
  align-items:start;
}

.avatarPick{
  width:100%;
  min-height:148px;
  padding:5px 4px 4px;
  border-radius:18px;
  display:flex;
  flex-direction:column;
  align-items:center;
  justify-content:flex-start;
  gap:4px;
  border:1px solid rgba(255,255,255,0.14);
  background:rgba(0,0,0,0.18);
  transition:
    transform .18s ease,
    box-shadow .18s ease,
    border-color .18s ease,
    background .18s ease,
    filter .18s ease;
  overflow:hidden;
  position:relative;
  min-width:0;
}

.avatarPick:hover{
  transform:translateY(-2px);
  border-color:rgba(0,224,255,0.45);
  background:rgba(255,255,255,0.06);
  box-shadow:0 8px 18px rgba(0,224,255,0.16);
}

.avatarPick.active{
  border:1px solid rgba(0,224,255,0.65);
  background:rgba(0,224,255,0.10);
  box-shadow:
    0 0 0 1px rgba(0,224,255,0.22) inset,
    0 0 18px rgba(0,224,255,0.28);
}

.avatarPickArt{
  width:100%;
  min-height:96px;
  display:flex;
  align-items:center;
  justify-content:center;
  flex:1 1 auto;
  margin-bottom:2px;
}

.avatarPickImg{
  width:95px;
  height:95px;
  object-fit:contain;
  display:block;
  transition: transform .18s ease, filter .18s ease, opacity .18s ease;
}

.avatarPickLabel{
  width:100%;
  min-height:22px;
  font-size:11px;
  line-height:1.1;
  font-weight:800;
  text-align:center;
  color:#0f172a;
  white-space:normal;
  overflow-wrap:anywhere;
  word-break:break-word;
  text-wrap:balance;
  margin-top:auto;
  display:flex;
  align-items:flex-end;
  justify-content:center;
  transition: transform .18s ease, opacity .18s ease;
}

.avatarPickLockText{
  font-size:10px;
  font-weight:800;
  letter-spacing:.02em;
  color:#64748b;
  text-transform:uppercase;
  opacity:.9;
}

.avatarPickEmoji{
  font-size:28px;
  line-height:1;
}

/* Pack 4+ feels more premium */
.avatarPackPremium .avatarPick{
  min-height:124px;
  border-color:rgba(0,229,255,0.18);
  background:
    linear-gradient(180deg, rgba(0,229,255,0.07), rgba(0,0,0,0.18));
}

.avatarPackPremium .avatarPickArt{
  width:85px;
  height:85px;
  border-radius:18px;
  background:rgba(255,255,255,0.05);
  box-shadow:0 0 0 1px rgba(255,255,255,0.04) inset;
}

.avatarPackPremium .avatarPick:hover{
  border-color:rgba(0,229,255,0.55);
  box-shadow:0 10px 24px rgba(0,229,255,0.20);
}

.avatarPackPremium .avatarPick.active{
  box-shadow:
    0 0 0 1px rgba(0,229,255,0.28) inset,
    0 0 24px rgba(0,229,255,0.34);
}

/* Pack 10+ prestige avatar system */
.avatarPackPrestige{
  gap:12px;
}

.avatarPackPrestige .avatarPick{
  min-height:164px;
  border-color:rgba(255,215,0,0.24);
  background:
    radial-gradient(circle at 50% 18%, rgba(0,229,255,0.13), transparent 42%),
    linear-gradient(180deg, rgba(255,215,0,0.08), rgba(0,0,0,0.22));
}

.avatarPackPrestige .avatarPickArt{
  width:112px;
  height:112px;
  border-radius:20px;
  background:
    radial-gradient(circle at 50% 35%, rgba(255,255,255,0.10), transparent 58%),
    rgba(255,255,255,0.04);
}

.avatarPackPrestige .avatarPickImg{
  width:112px;
  height:112px;
}

.avatarPackPrestige .avatarPick:hover:not(.lockedPreview):not(:disabled){
  transform:translateY(-7px) scale(1.065);
  border-color:rgba(255,215,0,0.62);
  box-shadow:
    0 16px 34px rgba(0,229,255,0.20),
    0 0 24px rgba(255,215,0,0.20),
    0 0 0 1px rgba(255,215,0,0.18) inset;
}

.avatarPackPrestige .avatarPick:hover:not(.lockedPreview):not(:disabled) .avatarPickImg{
  transform:scale(1.08);
}

.avatarPackPrestige .avatarPick.active{
  border-color:rgba(255,215,0,0.82);
  box-shadow:
    0 0 0 1px rgba(255,215,0,0.32) inset,
    0 0 0 2px rgba(0,229,255,0.18),
    0 0 30px rgba(255,215,0,0.28);
}

.avatarPickSubtitle{
  display:block;
  margin-top:3px;
  font-size:9px;
  line-height:1.05;
  font-weight:800;
  letter-spacing:.03em;
  text-transform:uppercase;
  color:#64748b;
}

.avatarPickLabelLocked{
  color:#64748b;
  opacity:.82;
}

.avatarPickLabelLocked span:first-child{
  letter-spacing:.08em;
  text-transform:uppercase;
  font-size:10px;
}

.avatarPickLabelLocked .avatarPickSubtitle{
  color:#94a3b8;
  opacity:.72;
}

.avatarPackPrestige .avatarPickLabelLocked span:first-child{
  color:rgba(255,255,255,0.74);
}

.avatarPackPrestige .avatarPickLabelLocked .avatarPickSubtitle{
  color:rgba(255,215,0,0.62);
}

.avatarPackPrestige .avatarPickSubtitle{
  color:#475569;
}

.selectedAvatarPanel{
  position:relative;
  overflow:hidden;
  color:inherit;
  cursor:pointer;
  width:100%;
}
.selectedAvatarPanel:focus-visible{outline:3px solid rgba(59,211,255,.72);outline-offset:3px}

.selectedAvatarPanelPrestige{
  border-color:color-mix(in srgb, var(--avatar-frame-b, #FFD700) 52%, transparent) !important;
  background:
    radial-gradient(
      circle at 50% 35%,
      color-mix(in srgb, var(--avatar-frame-a, #00E5FF) 16%, transparent),
      transparent 46%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--avatar-frame-b, #FFD700) 10%, transparent),
      rgba(15,17,23,0.08)
    ) !important;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--avatar-frame-b, #FFD700) 16%, transparent) inset,
    0 16px 34px rgba(15,23,42,0.10),
    0 0 28px color-mix(in srgb, var(--avatar-frame-a, #00E5FF) 18%, transparent);
}

.selectedAvatarPanelPrestige::before{
  content:"";
  position:absolute;
  inset:-35%;
  background:
    conic-gradient(
      from 0deg,
      transparent 0deg,
      color-mix(in srgb, var(--avatar-frame-b, #FFD700) 0%, transparent) 70deg,
      color-mix(in srgb, var(--avatar-frame-b, #FFD700) 24%, transparent) 95deg,
      color-mix(in srgb, var(--avatar-frame-a, #00E5FF) 24%, transparent) 118deg,
      transparent 150deg,
      transparent 360deg
    );
  animation:prestigeFrameSweep 4.8s linear infinite;
  pointer-events:none;
  opacity:.75;
}

.selectedAvatarPanelPrestige::after{
  content:"";
  position:absolute;
  inset:10px;
  border-radius:18px;
  border:1px solid rgba(255,255,255,0.16);
  pointer-events:none;
}

.selectedAvatarImg{
  position:relative;
  z-index:1;
}

.selectedAvatarImgPrestige{
  filter:drop-shadow(0 10px 18px rgba(0,0,0,0.20));
  animation:prestigeAvatarIdle 4.2s ease-in-out infinite;
}

.avatarChipPrestige{
  width:42px;
  height:42px;
  background:
    radial-gradient(circle, rgba(0,229,255,0.16), rgba(0,0,0,0.24) 68%);
  border-color:rgba(255,215,0,0.58);
  box-shadow:
    0 0 0 1px rgba(255,215,0,0.20) inset,
    0 0 12px rgba(255,215,0,0.22),
    0 0 16px rgba(0,229,255,0.16);
}

.avatarChipPrestige .headerAvatarImg{
  filter:drop-shadow(0 2px 5px rgba(0,0,0,0.30));
}

.avatarFrame-prestige_cyan_gold{
  --avatar-frame-a:#00E5FF;
  --avatar-frame-b:#FFD700;
}

.avatarFrame-prestige_red_black{
  --avatar-frame-a:#FF4D4D;
  --avatar-frame-b:#111827;
}

.avatarFrame-prestige_neon_lime{
  --avatar-frame-a:#00FF88;
  --avatar-frame-b:#D9FF00;
}

.avatarFrame-prestige_pink_cyan{
  --avatar-frame-a:#FF4DF3;
  --avatar-frame-b:#00E5FF;
}

.avatarFrame-prestige_ice_blue{
  --avatar-frame-a:#7DD3FC;
  --avatar-frame-b:#DBEAFE;
}

.selectedAvatarPanelPrestige.avatarFrame-prestige_cyan_gold,
.avatarChipPrestige.avatarFrame-prestige_cyan_gold,
.avatarFramePreview.avatarFrame-prestige_cyan_gold{
  border-color:rgba(255,215,0,0.62);
  box-shadow:
    0 0 0 1px rgba(255,215,0,0.18) inset,
    0 0 18px rgba(0,229,255,0.22),
    0 0 24px rgba(255,215,0,0.16);
}

.selectedAvatarPanelPrestige.avatarFrame-prestige_red_black,
.avatarChipPrestige.avatarFrame-prestige_red_black,
.avatarFramePreview.avatarFrame-prestige_red_black{
  border-color:rgba(255,77,77,0.68);
  box-shadow:
    0 0 0 1px rgba(255,77,77,0.18) inset,
    0 0 20px rgba(255,77,77,0.24);
}

.selectedAvatarPanelPrestige.avatarFrame-prestige_neon_lime,
.avatarChipPrestige.avatarFrame-prestige_neon_lime,
.avatarFramePreview.avatarFrame-prestige_neon_lime{
  border-color:rgba(0,255,136,0.68);
  box-shadow:
    0 0 0 1px rgba(0,255,136,0.18) inset,
    0 0 20px rgba(0,255,136,0.24);
}

.selectedAvatarPanelPrestige.avatarFrame-prestige_pink_cyan,
.avatarChipPrestige.avatarFrame-prestige_pink_cyan,
.avatarFramePreview.avatarFrame-prestige_pink_cyan{
  border-color:rgba(255,77,243,0.68);
  box-shadow:
    0 0 0 1px rgba(255,77,243,0.16) inset,
    0 0 18px rgba(255,77,243,0.18),
    0 0 22px rgba(0,229,255,0.16);
}

.selectedAvatarPanelPrestige.avatarFrame-prestige_ice_blue,
.avatarChipPrestige.avatarFrame-prestige_ice_blue,
.avatarFramePreview.avatarFrame-prestige_ice_blue{
  border-color:rgba(125,211,252,0.74);
  box-shadow:
    0 0 0 1px rgba(125,211,252,0.18) inset,
    0 0 22px rgba(125,211,252,0.22);
}

.avatarFramePreviewRow{
  display:flex;
  gap:8px;
  flex-wrap:wrap;
}

.avatarFramePreview{
  width:46px;
  height:34px;
  border-radius:12px;
  border:2px solid rgba(148,163,184,0.36);
  background:
    radial-gradient(circle at 50% 45%, rgba(255,255,255,0.18), transparent 44%),
    linear-gradient(135deg, var(--avatar-frame-a, #00E5FF), var(--avatar-frame-b, #FFD700));
  cursor:pointer;
  transition:
    transform .18s ease,
    box-shadow .18s ease,
    border-color .18s ease;
}

.avatarFramePreview:hover{
  transform:translateY(-2px);
}

.avatarFramePreview.active{
  border-color:rgba(15,23,42,0.72);
  box-shadow:
    0 0 0 2px rgba(255,255,255,0.9),
    0 0 20px rgba(0,229,255,0.26);
}

@keyframes prestigeFrameSweep{
  from{transform:rotate(0deg);}
  to{transform:rotate(360deg);}
}

@keyframes prestigeAvatarIdle{
  0%,100%{transform:scale(1);}
  50%{transform:scale(1.035);}
}

/* Pack 5+ mythic hover pop */
.avatarPackMythic .avatarPick{
  min-height:136px;
}

.avatarPackMythic .avatarPickArt{
  width:95px;
  height:95px;
}

.avatarPackMythic .avatarPick:hover:not(.lockedPreview):not(:disabled){
  transform:translateY(-6px) scale(1.06);
  border-color:rgba(0,229,255,0.7);
  background:
    linear-gradient(180deg, rgba(0,229,255,0.11), rgba(0,0,0,0.22));
  box-shadow:
    0 14px 28px rgba(0,229,255,0.22),
    0 0 0 1px rgba(0,229,255,0.16) inset;
  z-index:2;
}

.avatarPackMythic .avatarPick:hover:not(.lockedPreview):not(:disabled) .avatarPickArt{
  transform:scale(1.08);
}

.avatarPackMythic .avatarPick:hover:not(.lockedPreview):not(:disabled) .avatarPickImg{
  transform:scale(1.08);
}

.avatarPackMythic .avatarPick:hover:not(.lockedPreview):not(:disabled) .avatarPickLabel{
  transform:translateY(-1px);
}

/* Locked preview state */
.avatarPick.lockedPreview,
.avatarPick:disabled{
  cursor:not-allowed;
  opacity:.92;
}

.avatarPick.lockedPreview:hover,
.avatarPick:disabled:hover{
  transform:none;
  box-shadow:none;
  border-color:rgba(255,255,255,0.14);
}

.avatarPick.lockedPreview .avatarPickArt,
.avatarPick.lockedPreview .avatarPickImg,
.avatarPick:disabled .avatarPickArt,
.avatarPick:disabled .avatarPickImg{
  filter: grayscale(1) blur(2.4px) brightness(.42) contrast(1.25);
  opacity: .46;
}

/* Pack 10 locked avatars should feel classified / silhouette-only */
.avatarPackPrestige .avatarPick.lockedPreview .avatarPickImg,
.avatarPackPrestige .avatarPick:disabled .avatarPickImg{
  filter: grayscale(1) blur(3.8px) brightness(.22) contrast(1.65);
  opacity: .34;
}

.avatarPackPrestige .avatarPick.lockedPreview .avatarPickArt,
.avatarPackPrestige .avatarPick:disabled .avatarPickArt{
  background:
    radial-gradient(circle at 50% 42%, rgba(15,23,42,0.82), rgba(15,23,42,0.96) 68%);
  box-shadow:
    inset 0 0 26px rgba(0,0,0,0.55),
    0 0 0 1px rgba(255,255,255,0.05);
}

.avatarPackPrestige .avatarPick.lockedPreview::after,
.avatarPackPrestige .avatarPick:disabled::after{
  content: "LOCKED";
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 4px 7px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 900;
  letter-spacing: .08em;
  color: rgba(255,255,255,0.72);
  background: rgba(15,23,42,0.72);
  border: 1px solid rgba(255,255,255,0.10);
}

.avatarPick.lockedPreview .avatarPickLabel,
.avatarPick:disabled .avatarPickLabel{
  color:#64748b;
  opacity:.9;
}

.avatarRosterLocked{
  opacity:.98;
}

@media (min-width:700px){
  .avatarRoster{
    grid-template-columns:repeat(3, minmax(0, 1fr));
  }
}

@media (max-width:380px){
  .avatarRoster{
    gap:8px;
  }

  .avatarPick{
    min-height:136px;
    padding:8px 6px 8px;
  }

  .avatarPickArt{
    width:100%;
    min-height:86px;
    display:flex;
    align-items:center;
    justify-content:center;
    flex:1 1 auto;
  }

  .avatarPickImg{
    width:86px;
    height:86px;
  }

  .avatarPickLabel{
    font-size:10px;
    line-height:1.1;
    min-height:20px;
    margin-top:auto;
  }
}

      .page{min-height:100vh;background:#f8fafc}
      .wrap{max-width:1200px;margin:0 auto;padding:16px}
      .header{display:flex;flex-direction:column;gap:12px;margin-bottom:12px}
      .headerBottom{display:flex;flex-direction:column;gap:12px}
      @media(min-width:900px){.headerBottom{flex-direction:row;align-items:flex-end;justify-content:space-between;gap:16px}}
      .small{font-weight:700;color:#475569;font-size:12px}
      .title{margin:0;font-size:28px;letter-spacing:-0.02em}
      .pills{display:flex;flex-wrap:wrap;gap:8px;margin-top:8px}
      .pill{display:inline-flex;align-items:center;border:1px solid #e2e8f0;background:#f1f5f9;border-radius:999px;padding:6px 10px;font-size:12px;color:#334155}
      .pillBtn{cursor:pointer;background:#f1f5f9}
      .pillBtn:hover{background:#e2e8f0}
           .header-right{display:flex;flex-direction:column;gap:10px;min-width:0}
      @media(min-width:900px){.header-right{flex-direction:row;align-items:center}}
      .tabs{display:flex;flex-wrap:wrap;gap:8px;min-width:0;max-width:100%}
      /* Prevent button text wrapping */
      .btn, button { white-space: nowrap; }

      /* Make the +Session / Reset day buttons big enough on desktop */
      .logTopActions, .logActions, .dateActions {
        display:flex;
        gap:10px;
        align-items:center;
        flex-wrap:nowrap;
        min-width:0;
        max-width:100%;
      }
      .logTopActions .btn, .logActions .btn, .dateActions .btn { min-width: 120px; }
      @media(max-width:720px){
        .logTopActions .btn, .logActions .btn, .dateActions .btn { min-width: 0; }
      }

      .tabsRow{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        align-items:center;
        justify-content:flex-end;
        min-width:0;
        max-width:100%;
      }
      .iconBtn{width:44px;height:44px;border-radius:14px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;display:inline-flex;align-items:center;justify-content:center}
      .iconBtn:hover{filter:brightness(0.98)}
      .iconBtn:active{transform:scale(0.99)}
      .iconSvg{width:20px;height:20px}
      .iconEmoji{font-size:20px;line-height:1}
      .selectWide{min-width:220px;max-width:100%}
      @media(max-width:720px){
      .selectWide{width:100%;min-width:0}
      }
      .card{border:1px solid #e2e8f0;background:#fff;border-radius:18px;box-shadow:0 1px 2px rgba(15,23,42,.06)}
      .pad{padding:16px}
      .btn{border-radius:14px;padding:10px 14px;font-weight:800;border:1px solid #e2e8f0;background:#fff;color:#0f172a}
      .btnDisabled{opacity:.45;filter:grayscale(1);cursor:not-allowed}
      .btn:disabled{opacity:.45;filter:grayscale(1);cursor:not-allowed}
      .btn-primary{background:#0f172a;color:#fff;border-color:#0f172a}
      .btn-secondary{background:#fff}
      .btn:hover{filter:brightness(0.98)}
      .btn:active{transform:scale(0.99)}
      .btn-disabled{opacity:.55}
      .input{width:100%;border-radius:14px;border:1px solid #e2e8f0;padding:10px 12px;font-size:14px;outline:none}
      .input:focus{border-color:#94a3b8}
      .gridLog input[type="number"]{font-size:20px;font-weight:800}
      .label{font-size:12px;font-weight:600;color:#475569;margin-bottom:4px}
      .muted{color:#64748b;font-size:14px}
      .badgeNotice{
  display:inline-flex;
  align-items:center;
  gap:6px;
  padding:6px 10px;
  border-radius:999px;
  background:rgba(255,255,255,0.9);
  font-size:12px;
  color:#f39c12;
}
      .badgeXpPill{
  display:inline-flex;
  align-items:center;
  padding:4px 10px;
  border-radius:999px;
  background:rgba(255,255,255,0.9);
  font-size:12px;
  font-weight:600;
  color:#445066;
  box-shadow:0 0 0 1px rgba(15,23,42,0.06);
}

.badgeViewTabs{
  display:flex;
  flex-wrap:wrap;
  gap:6px;
}

.subTabPill{
  border-radius:999px;
  border:1px solid rgba(15,23,42,0.08);
  background:rgba(255,255,255,0.9);
  padding:4px 10px;
  font-size:12px;
  cursor:pointer;
  transition:background 0.16s ease, border-color 0.16s ease, transform 0.08s ease;
}

.subTabPill.on{
  background:#fff7e6;
  border-color:#f6a623;
  font-weight:600;
  transform:translateY(-1px);
}

.subTabPill.off{
  opacity:0.8;
}
      .h2{font-size:18px;font-weight:900;color:#64748b}        /* section titles muted */
      .h3{font-size:14px;font-weight:900}                      /* block titles */
      .movementName{font-size:16px;font-weight:800;color:#0f172a;margin-top:12px;margin-bottom:4px}
      .movementHeaderTop{display:flex;align-items:center;justify-content:space-between;gap:10px}

.historyPill{
  border-radius:999px;
  border:1px solid #e2e8f0;
  background:rgba(255,255,255,0.6);
  padding:6px 10px;
  font-size:12px;
  font-weight:700;
  color:#64748b;
  cursor:pointer;
  line-height:1;
}
.historyPill:hover{background:#fff;color:#0f172a}

.historyOverlay{
  position:fixed;
  inset:0;
  background:rgba(15,23,42,0.45);
  display:flex;
  align-items:center;
  justify-content:center;
  padding:16px;
  z-index:9999;
}

.historyModal{
  width:min(720px, 100%);
  background:#fff;
  border-radius:18px;
  border:1px solid #e2e8f0;
  box-shadow:0 12px 35px rgba(15,23,42,.18);
  padding:14px;
}

.historyModalTop{
  display:flex;
  align-items:flex-start;
  justify-content:space-between;
  gap:12px;
}

.historyTitle{
  font-size:16px;
  font-weight:900;
  color:#0f172a;
}

.historyRanges{
  display:flex;
  flex-wrap:wrap;
  gap:8px;
  margin-top:12px;
  margin-bottom:10px;
}
      .movementTarget{font-size:13px;font-weight:500;color:#64748b;margin-top:4px;margin-bottom:4px}
      .mt8{margin-top:8px}
      .mt12{margin-top:12px}
      .mt16{margin-top:16px}
      .stack{display:flex;flex-direction:column;gap:12px}
      .row{display:flex;flex-direction:column;gap:10px}
      .planWorkspaceNav{margin-bottom:12px;}
      @media (min-width: 900px){
  .row{ flex-direction:row; align-items:flex-start; justify-content:space-between; }
  .rowRight{ justify-content:flex-end; }

/* Log header alignment */
  .logTopRow{
    align-items:center;
    justify-content:space-between;   /* keep everything on one line */
  }

  /* Small inline "Saving…" indicator in the log header */
.logTopActions .syncStatus {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  color: var(--mutedText, #a0aec0);
  margin-right: 8px;
}

.syncDot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  background: var(--accent, #00E5FF); /* falls back to cyan if --accent not set */
  animation: syncPulse 1s ease-in-out infinite;
}

.syncText {
  line-height: 1;
}

@keyframes syncPulse {
  0% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.4);
    opacity: 0.4;
  }
  100% {
    transform: scale(1);
    opacity: 1;
  }
}

  .logTopRow .rowLeft{
    flex:1 1 auto;                   /* let the date side take remaining space */
    min-width:0;
  }

  .logTopRow .logTopActions{
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:flex-end;
    gap:10px;
    flex-wrap:nowrap;                /* no wrapping */
    flex:0 0 auto;                   /* keep buttons snug to the right */
  }
}
      .rowLeft{display:grid;grid-template-columns:1fr;gap:10px}
      @media(min-width:600px){.rowLeft{grid-template-columns:180px 260px}}
      .rowBetween{display:flex;align-items:center;justify-content:space-between;gap:10px}
      .planProgrammeActions,
      .planCheckpointActions{
        display:flex;
        flex-direction:row;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
        flex-wrap:wrap;
      }
      .planProgrammeActions .pill,
      .planProgrammeActions .btn,
      .planCheckpointActions .btn{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        box-sizing:border-box;
        text-align:center;
      }
      .planProgrammeUndoWrap{display:grid;gap:3px;text-align:center}
      .programDraftBanner{margin-top:16px;padding:14px;border:1px solid #a6cbbd;border-radius:12px;background:#f0f9f4;color:#173d30;display:grid;gap:10px}
      .programDraftBanner p{margin:6px 0;font-size:13px;line-height:1.5}
      .programDraftBanner .planProgrammeActions{justify-content:flex-start}
      .planProgrammeUndoWrap small{color:#64748b;font-size:9px;font-weight:750}
      .planAddedPrograms{
        display:grid;
        gap:6px;
        margin-top:12px;
        padding:10px 12px;
        border:1px solid #456783;
        border-left:5px solid #142d42;
        border-radius:11px;
        background:linear-gradient(90deg,#eaf2f8,#f7fafc);
        color:#17344c;
      }
      .planAddedPrograms>strong{font-size:11px;letter-spacing:.05em;text-transform:uppercase}
      .planAddedPrograms>div{display:flex;gap:7px;flex-wrap:wrap}
      .planAddedProgram{display:flex;align-items:center;max-width:100%;gap:4px;padding:3px;border-radius:999px;background:#17344c}
      .planAddedProgram>span{min-width:0;padding:4px 7px;overflow-wrap:anywhere;color:#fff;font-size:11px;font-weight:850}
      .planAddedProgram .planAddedProgramRemove{min-height:28px;padding:4px 8px;border-color:#7190a8;background:#f5f8fa;color:#17344c;font-size:10px}
      .planAddedPrograms small{color:#566f84;font-size:10px;font-weight:700}
      .field{min-width:180px}
      /* Log layout – match width with header + top slots */
      .gridLog{
        display:grid;
        gap:12px;
        width:100%;
        box-sizing:border-box;
      }
      @media(min-width:900px){
        .gridLog{
          grid-template-columns: minmax(0, 1.25fr) minmax(0, 0.75fr);
          align-items:flex-start;
        }
      }
      .grid2cols{display:grid;gap:12px}
      @media(min-width:1000px){.grid2cols{grid-template-columns:1fr 1fr}}
      .gridPlan{display:grid;gap:12px}
      @media(min-width:1000px){.gridPlan{grid-template-columns:1fr .9fr}}
      .panel{border:1px solid #e2e8f0;background:#f1f5f9;border-radius:18px;padding:14px}
      .panelTop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}
      .setRow{display:grid;grid-template-columns:1fr;gap:10px;border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px}
      @media(min-width:900px){.setRow{grid-template-columns:120px 1fr 1fr}}
      .setLabel{font-size:13px;font-weight:700;color:#475569;margin-bottom:4px}
      .setRowSimple{
        transition: background-color .18s ease, transform .1s ease;
      }
      .setRowSimple-complete{
        background:#e0f2fe;
        border-radius:14px;
        padding:8px 10px;
        transform:translateY(-1px);
      }
      .notes{grid-column:1/-1}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      @media(max-width:720px){.grid2{grid-template-columns:1fr}}
           @media(max-width:720px){
              .wrap{
          padding:8px;
          overflow-x:hidden;
          max-width:100vw;
        }

        .bodyReadinessCard,
        .readinessHero,
        .readinessTimelineWrap,
        .readinessTimelineBars{
          min-width:0;
          max-width:100%;
        }

        .card,
        .panel,
        .mini,
        .box,
        .stat,
        .reward,
        .planRow,
        .challenge{
          min-width:0;
          max-width:100%;
          box-sizing:border-box;
        }

                .headerBottom,
        .header-right,
        .tabsRow,
        .tabs,
        .gridLog,
        .logTopRow,
        .rowLeft,
        .logTopActions,
        .dateActions,
        .rowBetween,
        .panelTop,
        .sessionRow,
        .sessionBlock,
        .readinessHero,
        .readinessMetricCard,
        .readinessTimelineWrap,
        .readinessTimelineBars{
          min-width:0;
          max-width:100%;
          box-sizing:border-box;
        }

        .selectWide{
          width:100%;
          min-width:0;
        }

        .tabsRow{
          width:100%;
          justify-content:stretch;
        }

        .tabs{
          display:grid;
          grid-template-columns:repeat(4, minmax(0, 1fr));
          width:100%;
          overflow:visible;
        }

        .tabs .btn{
          width:100%;
          min-width:0;
          padding-left:8px;
          padding-right:8px;
        }

        .logTopRow{
          align-items:flex-start;
        }

        .logTopActions,
        .dateActions{
          width:100%;
          justify-content:flex-start;
          flex-wrap:wrap;
        }

        .logTopActions .btn,
        .dateActions .btn{
          min-width:0;
        }

        .rowBetween{
          min-width:0;
        }
      }
            html, body { max-width:100%; overflow-x:hidden; }
      .grid3{display:grid;grid-template-columns:1fr;gap:10px}
      @media(min-width:900px){.grid3{grid-template-columns:1fr 1fr 1fr}}
      .stat{border:1px solid #e2e8f0;background:#fff;border-radius:18px;padding:12px}
      .stat-label{font-size:12px;font-weight:900;color:#475569}
      .stat-value{font-size:18px;font-weight:900;color:#0f172a;margin-top:4px}
      .mini{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:12px}
      .big{font-size:18px;font-weight:900;margin-top:6px}
      .challenge{display:flex;align-items:center;justify-content:space-between;border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px 12px}
      .challenge-box{font-weight:900;color:#94a3b8}
      .challenge-box.done{color:#0f172a}
      .chart{height:220px}
      .planRow{display:flex;flex-direction:column;gap:10px;border:1px solid #e2e8f0;background:#fff;border-radius:18px;padding:14px}
      @media(min-width:900px){.planRow{flex-direction:row;align-items:center;justify-content:space-between}}
      .planLeft{flex:1}
      .planName{font-weight:900}
      .planBtns{display:flex;gap:10px;flex-wrap:wrap}
            .planViewToggle{
        display:flex;
        gap:8px;
        margin-top:12px;
      }
      .pillToggleBtn{
        border-radius:999px;
        border:1px solid #e2e8f0;
        background:#fff;
        padding:6px 14px;
        font-size:13px;
        font-weight:600;
        color:#475569;
        cursor:pointer;
      }
      .pillToggleBtn.active{
        background:#0f172a;
        color:#fff;
        border-color:#0f172a;
      }
      .reward{display:flex;align-items:center;justify-content:space-between;gap:12px;border:1px solid #e2e8f0;background:#fff;border-radius:18px;padding:14px}
      .reward.locked{opacity:.6}
      .reward-title{font-weight:900}
      .reward-desc{color:#64748b;font-size:13px;margin-top:2px}
      .box{border:1px solid #e2e8f0;background:#fff;border-radius:18px;padding:12px}
      .check{display:flex;align-items:center;gap:10px;font-weight:900}
      .dashed{border:2px dashed #cbd5e1;border-radius:18px;padding:16px;text-align:center;color:#475569;background:#fff}


/* Focused mobile Log */
.logBlockTypeTitle{
  margin-bottom:8px;
  color:#64748b;
  font-size:11px;
  line-height:1.2;
  font-weight:950;
  letter-spacing:.09em;
  text-transform:uppercase;
}
.logUserBlockTitle{
  color:#0f172a;
  font-size:18px;
  line-height:1.2;
  font-weight:950;
  letter-spacing:-.02em;
}
.inMomentTarget{
  display:grid;
  gap:2px;
  padding:9px 11px;
  border:1px solid rgba(0,229,255,.23);
  border-radius:12px;
  background:linear-gradient(135deg,rgba(0,229,255,.055),rgba(0,255,136,.035));
}
.inMomentTarget b{
  color:#0f6673;
  font-size:10px;
  letter-spacing:.06em;
  text-transform:uppercase;
}
.inMomentTarget span{color:#263645;font-size:12px;font-weight:750}
.inMomentTarget small{color:#64748b;font-size:10px}

.focusedLogBlock{
  margin-top:9px;
  overflow:hidden;
  border:1px solid #dbe4ed;
  border-radius:15px;
  background:#fff;
  transition:border-color .18s ease,background .18s ease,opacity .18s ease;
}
.focusedLogBlock.isOpen{border-color:rgba(0,174,196,.42)}
.focusedLogBlock.isProgramAdded{
  border-color:#335b7c;
  box-shadow:inset 4px 0 0 #152d42;
  background:linear-gradient(90deg,#f1f6fa 0,#fff 34%);
}
.focusedLogBlock.isProgramAdded.isOpen{border-color:#254d6e}
.focusedLogBlock.isProgramAdded.isComplete{background:linear-gradient(90deg,#e7f5f3 0,#effff6 34%)}
.focusedLogBlock.isComplete{
  border-color:rgba(0,172,91,.34);
  background:#effff6;
}
.focusedLogBlock.isCancelled{
  border-color:rgba(255,77,77,.34);
  background:#fff5f5;
}
.focusedLogBlock.isSuspended{
  border-color:#d4dce5;
  background:#f5f7f9;
  opacity:.82;
}
.focusedLogBlockSummary{
  box-sizing:border-box;
  white-space:normal;
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  border:0;
  padding:11px 12px;
  text-align:left;
  background:transparent;
  color:inherit;
  cursor:pointer;
}
.focusedLogBlockSummary__copy{min-width:0;flex:1}
.focusedLogBlockSource{
  margin-bottom:3px;
  color:#315a7b;
  font-size:9px;
  line-height:1.25;
  font-weight:950;
  letter-spacing:.055em;
  text-transform:uppercase;
}
.focusedLogBlockTitle{
  overflow-wrap:anywhere;
  white-space:normal;
  color:#0f172a;
  font-size:17px;
  line-height:1.2;
  font-weight:950;
  letter-spacing:-.02em;
}
.focusedLogBlockMeta{
  margin-top:3px;
  color:#5f7082;
  font-size:10px;
  line-height:1.35;
  font-weight:800;
}
.focusedLogBlockState{
  flex:0 0 28px;
  width:28px;
  height:28px;
  display:grid;
  place-items:center;
  border-radius:9px;
  background:#edf3f7;
  color:#304253;
  font-size:15px;
  font-weight:950;
}
.focusedLogBlock.isComplete .focusedLogBlockState{
  background:#00b767;
  color:#fff;
}
.focusedLogBlock.isCancelled .focusedLogBlockState{
  background:#ff4d4d;
  color:#fff;
}
.focusedLogBlock.isSuspended .focusedLogBlockState{
  background:#dbe3ea;
  color:#687789;
}
.focusedLogBlockBody{padding:10px 12px 12px}
.blockHistoryRow{
  display:flex;
  justify-content:flex-end;
}
.blockBottomControls{
  display:flex;
  align-items:flex-end;
  justify-content:space-between;
  gap:12px;
}
.blockBottomControls--end{justify-content:flex-end}
.blockBottomControls__field{width:min(180px,100%)}
.blockBottomControls__history{min-height:30px;display:flex;align-items:center}
.blockCancelControl{
  min-height:38px;
  display:inline-flex;
  align-items:center;
  gap:7px;
  border:1px solid #d5dde6;
  border-radius:10px;
  padding:8px 11px;
  background:#f7f9fb;
  color:#617184;
  font-size:12px;
  font-weight:800;
  cursor:pointer;
}
.blockCancelControl input{margin:0}
.blockCancelControl.isCancelled{
  border-color:rgba(255,77,77,.42);
  background:#fff2f2;
  color:#b42323;
}

.focusedMovement{
  margin-top:9px;
  overflow:hidden;
  border:1px solid #dbe4ed;
  border-radius:14px;
  background:#fff;
  transition:border-color .18s ease,background .18s ease;
}
.focusedMovement.isOpen{border-color:rgba(0,174,196,.42)}
.focusedMovement.isComplete{
  border-color:rgba(0,172,91,.32);
  background:#f0fff7;
}
.focusedMovementSummary{
  box-sizing:border-box;
  white-space:normal;
  width:100%;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:12px;
  border:0;
  padding:11px 12px;
  text-align:left;
  background:transparent;
  color:inherit;
  cursor:pointer;
}
.focusedMovementSummary__copy{min-width:0;flex:1}
.focusedMovement .movementName{overflow-wrap:anywhere;white-space:normal;margin:0;color:#0f172a;font-size:16px;font-weight:900}
.focusedMovementPlan{overflow-wrap:anywhere;white-space:normal;margin-top:2px;color:#526477;font-size:10px;font-weight:800}
.focusedMovement .movementTarget{margin:4px 0 0;font-size:11px;line-height:1.35}
.movementProgressionBand{
  width:100%;
  min-width:0;
  display:flex;
  align-items:center;
  justify-content:space-between;
  gap:8px;
  margin:7px 0 10px;
  padding:4px 4px 4px 10px;
  border:1px solid rgba(0,174,196,.34);
  border-radius:999px;
  background:#fbfdff;
  box-sizing:border-box;
}
.movementProgressionBand__copy{
  min-width:0;
  flex:1 1 auto;
  display:flex;
  align-items:baseline;
  gap:6px;
  overflow-wrap:anywhere;
  color:#526477;
  font-size:10px;
  line-height:1.3;
}
.movementProgressionBand__label{
  flex:0 0 auto;
  color:#08738a;
  font-size:9px;
  font-weight:900;
  letter-spacing:.06em;
  text-transform:uppercase;
}
.movementProgressionBand__history{
  flex:0 0 auto;
  margin:0;
  white-space:nowrap;
}
.focusedMovementStatus{
  flex:0 0 28px;
  width:28px;
  height:28px;
  display:grid;
  place-items:center;
  border-radius:9px;
  background:#edf3f7;
  color:#304253;
  font-size:16px;
  font-weight:950;
}
.focusedMovement.isComplete .focusedMovementStatus{
  background:#00b767;
  color:#fff;
}
.focusedMovementBody{padding:0 12px 12px}
.focusedMovementBody .movementHeaderTop{min-height:26px}

.historyPill{
  border-color:rgba(0,229,255,.45);
  background:#0f1117;
  color:#00e5ff;
}
.historyPill:hover{
  border-color:#00ff88;
  background:#171b23;
  color:#00ff88;
}
.historyOverlay{background:rgba(3,7,12,.72);backdrop-filter:blur(5px)}
.historyModal{
  border-color:rgba(0,229,255,.23);
  background:#0f1117;
  color:#edf7fb;
  box-shadow:0 24px 70px rgba(0,0,0,.46);
}
.historyTitle{color:#f6fbff}
.historyModal .muted{color:#91a2b4}
.historyModal .pillToggleBtn{
  border-color:#2a3946;
  background:#171b23;
  color:#aebdca;
}
.historyModal .pillToggleBtn.active{
  border-color:#00e5ff;
  background:#062b31;
  color:#00e5ff;
}
.historyModal .chart{
  border-radius:14px;
  padding:6px;
  background:#f8fafc;
}
.historyModal .iconBtn{
  border-color:#2b3945;
  background:#171b23;
  color:#00e5ff;
}

@media(max-width:720px){
  .todaySummaryCard{display:none}

  .logTopRow{
    display:flex;
    flex-direction:row;
    align-items:center;
    gap:7px;
  }
  .logTopRow .rowLeft{
    flex:1 1 auto;
    width:auto;
    min-width:0;
  }
  .logTopRow .rowLeft .field{
    min-width:0;
    width:100%;
  }
  .logTopRow .rowLeft .field > .label{display:none}
  .logTopRow .rowLeft .input{
    width:100%;
    min-width:0;
    height:38px;
    padding:7px 9px;
  }
  .logTopRow .logTopActions{
    width:auto;
    flex:0 0 auto;
    display:flex;
    flex-direction:row;
    align-items:center;
    justify-content:flex-end;
    flex-wrap:nowrap;
    gap:6px;
  }
  .logTopActions .dayStatusDot{flex:0 0 auto}
  .logTopActions .syncStatus{display:none}
  .resetDayButton{
    min-width:0 !important;
    min-height:34px;
    padding:6px 9px !important;
    border-radius:10px !important;
    font-size:11px !important;
    white-space:nowrap;
  }

  .blockCancelControl{
    position:relative;
    width:30px;
    height:30px;
    min-width:30px;
    min-height:30px;
    display:grid !important;
    place-items:center;
    border:1px solid #cbd5df !important;
    border-radius:10px !important;
    padding:0 !important;
    margin:0 !important;
    background:#eef2f5 !important;
    color:#64748b !important;
    overflow:hidden;
  }
  .blockCancelControl input{
    position:absolute;
    width:1px;
    height:1px;
    opacity:0;
    pointer-events:none;
  }
  .blockCancelControl span{display:none}
  .blockCancelControl::before{
    content:"C";
    font-size:12px;
    font-weight:950;
  }
  .blockCancelControl.isCancelled{
    border-color:#ff4d4d !important;
    background:#ff4d4d !important;
    color:#fff !important;
  }
  label[title^="Mark this block as cancelled"]:has(input:checked),
  label[title^="Mark this Session as cancelled"]:has(input:checked){
    border-color:#ff4d4d !important;
    background:#ffebeb !important;
    color:#c62828 !important;
  }

  .logUserBlockTitle{font-size:17px}
  .logWorkspaceCard{
    padding:8px;
    border-radius:14px;
  }
  .logWorkspaceCard .panel{
    padding:8px;
    border-radius:14px;
  }
  .panel .logBlockTypeTitle{margin-bottom:4px}
  .focusedLogBlock{margin-top:7px;border-radius:12px}
  .focusedLogBlockSummary{padding:8px}
  .focusedLogBlockBody{padding:10px 6px 7px}
  .focusedLogBlockTitle{font-size:16px}
  .focusedMovement{margin-top:6px;border-radius:11px}
  .focusedMovementSummary{padding:8px}
  .focusedMovementBody{padding:0 5px 7px}
  .movementProgressionBand{align-items:stretch;margin:5px 0 7px;border-radius:12px;padding:4px 4px 4px 7px}
  .movementProgressionBand__copy{align-items:flex-start;flex-direction:column;gap:1px}
  .movementProgressionBand__history{align-self:center}
  .movementSetRow{
    grid-template-columns:38px minmax(0,1fr);
    gap:5px;
    padding:5px;
    border:0;
    border-radius:9px;
  }
  .movementSetRow.setRowSimple-complete{padding:5px;border:0}
  .movementSetFields{gap:5px}
  .movementSetField .input{height:36px;padding:5px 6px}
  .planProgrammeActions,
  .planCheckpointActions{
    width:100%;
  }
  .planProgrammeActions{flex-wrap:wrap}
  .planCheckpointActions{flex-wrap:nowrap}
  .planProgrammeActions > *,
  .planCheckpointActions > *{
    flex:1 1 0;
    min-width:0;
  }
  .planProgrammeActions .pill,
  .planProgrammeActions .btn,
  .planCheckpointActions .btn{
    min-height:40px;
    padding-inline:8px;
    line-height:1.2;
    white-space:normal;
  }
  .planProgrammeActions .planProgrammeUndo{
    order:2;
    width:100%;
  }
  .planProgrammeUndoWrap{
    order:2;
    flex:1 0 100%;
  }
}

      .authCard{max-width:520px;margin:60px auto}
      .footer{margin:18px 0 30px;text-align:center;color:#94a3b8;font-size:12px}
      .motivator{margin-bottom:12px;background:linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%)}
      .motGrid{display:grid;grid-template-columns:1fr;gap:10px}
      @media(min-width:900px){.motGrid{grid-template-columns:1fr 1fr 1fr}}
      .motItem{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px 12px;font-weight:800;color:#0f172a;font-size:13px}

    `}</style>
  );
}
