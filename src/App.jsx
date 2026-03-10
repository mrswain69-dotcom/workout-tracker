import React, { useEffect, useMemo, useRef, useState } from "react";
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
  getOrCreateFamily,
  listProfiles,
  addProfile,
  renameProfile,
  setProfileBodyweight,
  updateAgeGroup,
  archiveProfile,
  getPlan,
  upsertPlan,
  getProfilePlan,
  upsertProfilePlan,
  getLog,
  upsertLog,
  listLogs,
  listPlanTemplates,
  createPlanTemplate,
  updatePlanTemplate,
  deletePlanTemplate,
  setFamilyPinHash,
  clearFamilyPin,
} from "./db";

import { BADGE_CARDS, BADGE_DEFS } from "./config/badges";
import { buildBadgeStatsV2 } from "./engine/badgeStatsV2";

import { AVATAR_PACKS } from "./config/avatars";

// -------- Utilities ----------
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
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

// Counts consecutive *green* days up to today (inclusive), using block-based day status.
function getCurrentPlanStreak(records, todayYmd) {
  if (!Array.isArray(records) || !records.length) return 0;

  // Build date -> log map
  const map = new Map();
  for (const r of records) {
    const date = r?.date_ymd || r?.date;
    const log = r?.log;
    if (!date || !log) continue;
    map.set(date, log);
  }

    // Collect all streak-counting dates:
  // - normal plan-complete days (green)
  // - days explicitly marked as streakSaved
  const completeDates = [];
  for (const [date, log] of map.entries()) {
    if (date > todayYmd) continue;
    const streakDay =
      isDayGreen(log) || (log.meta && log.meta.streakSaved);
    if (streakDay) {
      completeDates.push(date);
    }
  }

  if (!completeDates.length) return 0;

  // Sort and find the latest completed date
  completeDates.sort((a, b) => (a < b ? -1 : 1));
  const latest = completeDates[completeDates.length - 1];

  const todayDate = new Date(todayYmd + "T00:00:00");
  const latestDate = new Date(latest + "T00:00:00");
  const diffFromToday = Math.round((todayDate - latestDate) / 86400000);

  // If the latest complete day is more than 1 day ago, streak is broken
  if (diffFromToday > 1) return 0;

  // Walk backwards from the latest completed day
  let cursor = latest;
  let streak = 0;

  while (true) {
    const log = map.get(cursor);
    if (!log) break;

    const streakDay =
      isDayGreen(log) || (log.meta && log.meta.streakSaved);
    if (!streakDay) break;

    streak += 1;

    const d = new Date(cursor + "T00:00:00");
    d.setDate(d.getDate() - 1);
    const prev = ymd(d);
    if (!map.has(prev)) break;
    cursor = prev;
  }

  return streak;
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
// Build a simple target string for a strength movement given:
// - the movement config
// - the last logged sets in history
// - any planned reps text from the plan
function buildTargetInfoForMovement({ movement, lastSets, plannedRepsText }) {
  const baseText = (plannedRepsText || "").trim();

  // If there is no history yet, just show the plan text (if any)
  if (!lastSets || !Array.isArray(lastSets) || lastSets.length === 0) {
    return {
      text: baseText || "",
    };
  }

  // Take the last non-empty values we can find
  let lastReps = null;
  let lastWeight = null;
  let lastTime = null;

  for (const s of lastSets) {
    if (!s) continue;
    if (s.reps !== undefined && s.reps !== null && s.reps !== "") {
      lastReps = s.reps;
    }
    if (s.weight !== undefined && s.weight !== null && s.weight !== "") {
      lastWeight = s.weight;
    }
    if (
      s.timeSeconds !== undefined &&
      s.timeSeconds !== null &&
      s.timeSeconds !== ""
    ) {
      lastTime = s.timeSeconds;
    }
  }

  // Build a human-readable "last time" summary
  let historyBits = [];

  if (movement.trackDuration && lastTime != null) {
    historyBits.push(`${lastTime}s`);
  }
  if (lastReps != null) {
    historyBits.push(`${lastReps} reps`);
  }
  if (movement.trackWeight && lastWeight != null) {
    historyBits.push(`${lastWeight} kg`);
  }

  const historyText = historyBits.length
    ? `Last: ${historyBits.join(" @ ")}`
    : "";

  // Combine plan text with history, if both exist
  if (baseText && historyText) {
    return { text: `${baseText} — ${historyText}` };
  }
  if (baseText) {
    return { text: baseText };
  }
  if (historyText) {
    return { text: historyText };
  }

  return { text: "" };
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

function createCardioBlock() {
  return {
    id: uid(),
    typeId: "cardio",
    label: "",
    note: "",
    // Built-in types: run, cycle, walk, swim, row, other
    cardioType: "run", // "run" | "cycle" | "walk" | "swim" | "row" | "other"
    cardioTypeOtherLabel: "",
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
  playTone(ctx, { freq: 440, duration: 0.08, type: "triangle", gain: 0.06, when: 0.0 });
  playTone(ctx, { freq: 660, duration: 0.09, type: "triangle", gain: 0.06, when: 0.08 });
  playTone(ctx, { freq: 880, duration: 0.10, type: "triangle", gain: 0.06, when: 0.17 });
}
function playWhoosh(ctx, combo = 1, theme = "classic") {
  const c = clamp(combo, 1, 10);
  const base = theme === "arcade" ? 320 : 240;
  const t = theme === "arcade" ? "square" : "sawtooth";
  playTone(ctx, { freq: base + c * 30, duration: 0.10, type: t, gain: 0.035, when: 0.0 });
  playTone(ctx, { freq: base + c * 45, duration: 0.10, type: t, gain: 0.03, when: 0.03 });
}
function playBling(ctx, combo = 1, theme = "classic") {
  const c = clamp(combo, 1, 10);
  const mult = 1 + c * 0.04;
  const type = theme === "arcade" ? "square" : "sine";
  playTone(ctx, { freq: 1046.5 * mult, duration: 0.055, type, gain: 0.055, when: 0.0 });
  playTone(ctx, { freq: 1318.5 * mult, duration: 0.065, type, gain: 0.05, when: 0.06 });
  playTone(ctx, { freq: 1567.98 * mult, duration: 0.075, type, gain: 0.045, when: 0.13 });
}
function playLevelUp(ctx, theme = "classic") {
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
    { id: "strength", name: "Strength / HIIT (sets)", kind: "strength", movementsEnabled: true, sets: 3, allowWeight: true },
    { id: "box", name: "Boxercise (timed rounds)", kind: "time", movementsEnabled: true, sets: 3, fixedSeconds: 60, allowCount: true, countLabel: "hits" },
    { id: "run", name: "Run (distance + time)", kind: "cardio", movementsEnabled: false, fields: { distanceKm: true, durationMin: true, avgSpeed: true } },
    { id: "swim", name: "Swim (distance + time)", kind: "cardio", movementsEnabled: false, fields: { distanceKm: true, durationMin: true, avgSpeed: true } },
    { id: "duration", name: "Duration only (minutes)", kind: "custom", movementsEnabled: false, fields: { durationMin: true } },
    { id: "recovery", name: "Recovery", kind: "recovery", movementsEnabled: false, fields: { recoveryDone: true, plannedMinutes: true } },
    // NEW: tick-box tasks (yes/no)
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

// -------- Day activities (primary + extras) ----------
// Primary activity still comes from dayTypeByWeekday / movementsByWeekday / cardioTargetByWeekday
// Extras are stored in plan.dayActivitiesByWeekday[weekday] as an array of blocks.
function getDayActivitiesForWeekday(plan, weekday) {
  if (!plan || !weekday) return [];

  // --- Plan V3: prefer blocksByWeekday if present ---
  const hasBlocks =
    plan.blocksByWeekday &&
    Array.isArray(plan.blocksByWeekday[weekday]);

  if (hasBlocks && plan.blocksByWeekday[weekday].length > 0) {
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
  const reps = safeNumber(s.reps);
  const time = safeNumber(s.timeSeconds);
  const count = safeNumber(s.count);
  const distanceKm = safeNumber(s.distanceKm);
  const durationMin = safeNumber(s.durationMin);
  return reps > 0 || time > 0 || count > 0 || distanceKm > 0 || durationMin > 0;
}
function setVolume(s) {
  const reps = safeNumber(s.reps);
  const w = safeNumber(s.weight);
  return reps * w;
}
function scoreSets(sets) {
  if (!Array.isArray(sets)) return 0;
  let score = 0;
  for (const s of sets) {
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
function findLastMovementSets(allLogs, movementId, beforeYmd) {
  if (!Array.isArray(allLogs)) return null;

  for (let i = allLogs.length - 1; i >= 0; i--) {
    const row = allLogs[i];
    if (!row?.date_ymd || row.date_ymd >= beforeYmd) continue;

    const log = row?.log;
    if (!log) continue;

    // --- V2: legacy per-day entries ---
    const legacySets = log?.entries?.[movementId] || null;
    if (Array.isArray(legacySets) && legacySets.some(setDidSomething)) {
      return legacySets;
    }

    // --- V3: per-block sets on log.blocks[].sets[movementId] ---
    const blocks = Array.isArray(log.blocks) ? log.blocks : [];
    for (const b of blocks) {
      if (!b) continue;
      const setsByMovement =
        b.sets && typeof b.sets === "object" ? b.sets : null;
      if (!setsByMovement) continue;

      const blockSets = setsByMovement[movementId];
      if (Array.isArray(blockSets) && blockSets.some(setDidSomething)) {
        return blockSets;
      }
    }
  }

  return null;
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
function findLastCardio(allLogs, beforeYmd) {
  if (!Array.isArray(allLogs)) return null;

  for (let i = allLogs.length - 1; i >= 0; i--) {
    const row = allLogs[i];
    const date = row?.date_ymd || row?.date;
    if (!date || date >= beforeYmd) continue;

    const log = row?.log;
    if (!log) continue;

    // V3: aggregate cardio across blocks
    if (Array.isArray(log.blocks) && log.blocks.length) {
      let totalDist = 0;
      let totalMin = 0;

      for (const b of log.blocks) {
        if (!b || !b.cardio) continue;
        const c = b.cardio;
        totalDist += safeNumber(c.distanceKm);
        totalMin += safeNumber(c.durationMin);
      }

      if (totalDist > 0 || totalMin > 0) {
        const avgSpeed =
          totalDist > 0 && totalMin > 0
            ? totalDist / (totalMin || 1)
            : safeNumber(log.cardio?.avgSpeedKmh);

        return {
          distanceKm: totalDist,
          durationMin: totalMin,
          avgSpeedKmh: avgSpeed,
        };
      }
    }

    // Legacy fallback: single cardio object on the log
    const cLegacy = log.cardio;
    if (
      cLegacy &&
      (safeNumber(cLegacy.distanceKm) > 0 ||
        safeNumber(cLegacy.durationMin) > 0)
    ) {
      return {
        distanceKm: safeNumber(cLegacy.distanceKm),
        durationMin: safeNumber(cLegacy.durationMin),
        avgSpeedKmh: safeNumber(cLegacy.avgSpeedKmh),
      };
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

function suggestCardioTarget({ lastCardio }) {
  if (!lastCardio) {
    return { text: "Log once to generate targets.", targetSpeedKmh: null };
  }

  const d = safeNumber(lastCardio.distanceKm);
  const t = safeNumber(lastCardio.durationMin);

  let s = 0;
  if (d > 0 && t > 0) {
    s = d / (t / 60); // km/h
  } else {
    s = safeNumber(lastCardio.avgSpeedKmh);
  }

  if (s > 0) {
    const targetSpeedKmh = s + 0.2;
    return {
      text: `Try +0.2 km/h avg speed (≈ ${targetSpeedKmh.toFixed(1)} km/h)`,
      targetSpeedKmh,
    };
  }

  if (d > 0) {
    return {
      text: `Try +0.1 km distance (≈ ${(d + 0.1).toFixed(1)} km)`,
      targetSpeedKmh: null,
    };
  }

  if (t > 0) {
    return {
      text: `Try +1 min duration (≈ ${t + 1} min)`,
      targetSpeedKmh: null,
    };
  }

  return { text: "Aim to beat last time.", targetSpeedKmh: null };
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
function PrimaryButton({ children, onClick, disabled }) {
  return (
    <button className={`btn btn-primary ${disabled ? "btn-disabled" : ""}`} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}
function SecondaryButton({ children, onClick, disabled }) {
  return (
    <button className={`btn btn-secondary ${disabled ? "btn-disabled" : ""}`} onClick={onClick} disabled={disabled}>
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

  async function handleAuth() {
    if (busy) return;
    setBusy(true);
    setMsg("");
    try {
      const fn = mode === "signup" ? signUp : signIn;
      const { error } = await fn(email.trim(), pw);
      if (error) setMsg(error.message);
      else onAuthed();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="page">
      <div className="wrap">

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
                <SecondaryButton onClick={() => setMode("signin")}>Sign in</SecondaryButton>
                <SecondaryButton onClick={() => setMode("signup")}>Sign up</SecondaryButton>
              </div>

              <div className="stack mt16">
                <div>
                  <div className="label">Email</div>
                  <Input value={email}
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
                <PrimaryButton
  disabled={busy}
  onClick={handleAuth}
>
  {mode === "signup" ? "Create account" : "Sign in"}
</PrimaryButton>
                {msg && <div className="muted">{msg}</div>}
                <div className="muted">
                  Sign in to manage your people, plan, logs and rewards.
                </div>
              </div>
            </>
          )}
        </Card>
      </div>
      <StyleTag />


      
    </div>
  );
}

// -------- Day status helpers (TOP-LEVEL, DO NOT MOVE) --------

function isDayGreen(log) {
  if (!log || !Array.isArray(log.blocks) || !log.blocks.length) return false;

  let any = false;

  for (const block of log.blocks) {
    if (!block) continue;

    // NEW: cancelled blocks do not count, and also don’t block the day.
    if (block.cancelled) {
      continue;
    }
    
    const typeId = block.typeId;

    // Ignore pure task blocks for day-complete logic and streaks
    if (typeId === "tasks") {
      continue;
    }

    let hasData = false;

        if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
      hasData =
        block.sets &&
        Object.values(block.sets).some(
          (arr) => Array.isArray(arr) && arr.some((s) => s && setDidSomething(s))
        );
    } else if (typeId === "cardio") {
      const c = block.cardio || {};
      hasData =
        Number(c.distanceKm) > 0 ||
        Number(c.durationMin) > 0;
    } else if (typeId === "duration") {
      hasData = Number(block?.duration?.minutes) > 0;
    } else if (typeId === "recovery") {
      hasData = !!block?.recoveryDone;
    }

    if (!hasData) return false;
    any = true;
  }

  // Must have at least one non-task block with data
  return any;
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
  if (!log) return null;

  // 1) Manual override wins
  const manualDay = safeNumber(log?.meta?.dayManualMin);
  if (manualDay > 0) return manualDay;

  const blocks = Array.isArray(log.blocks) ? log.blocks : [];

  // 2) New model: sum minutes from per-block cardio + duration
  let blockCardioMin = 0;
  let blockDurationMin = 0;

  if (blocks.length) {
    for (const b of blocks) {
      if (!b) continue;

      if (b.cardio && typeof b.cardio === "object") {
        blockCardioMin += safeNumber(b.cardio.durationMin);
      }

      if (b.duration && typeof b.duration === "object") {
        // duration blocks use duration.minutes
        blockDurationMin += safeNumber(b.duration.minutes);
      }
    }
  }

  if (blockCardioMin > 0 || blockDurationMin > 0) {
    // e.g. 5 km / 25 min run + 20 min yoga = 45
    return blockCardioMin + blockDurationMin;
  }

  // 3) Legacy fallback ONLY if we have no blocks snapshot
  // (old logs that just had log.cardio/log.custom)
  if (!blocks.length) {
    const cardioMin = safeNumber(log?.cardio?.durationMin);
    const customMin = safeNumber(log?.custom?.durationMin);
    const totalDur = cardioMin + customMin;
    if (totalDur > 0) return totalDur;
  }

  // 4) Finally, estimate from sets + rest interval (rough, motivation-only)
  const restSec =
    safeNumber(log?.meta?.restSec) || 60;

  const setsLogged = countSetsLoggedInLog(log);
  if (setsLogged <= 0) return null;

  const workPerSetMin = 1; // quick heuristic
  const est =
    setsLogged * workPerSetMin +
    Math.max(0, setsLogged) * (restSec / 60);

  return Math.round(est * 10) / 10;
}

function isTrainingBlockForRecoveryLogic(block) {
  if (!block || block.cancelled) return false;
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

    if (load > 0) hadTraining = true;
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

  const muscleReadiness = clamp(
    Math.round(
      88 -
        muscleLoad * 0.40 +
        recoveryCredit * 0.9 +
        sleepCredit * 0.65 +
        timeRecoveryBoost
    ),
    30,
    100
  );

  const nervousSystemReadiness = clamp(
    Math.round(
      86 -
        nervousLoad * 0.44 -
        consecutiveTrainingBefore * 3 +
        recoveryCredit * 0.75 +
        sleepCredit * 0.6 +
        timeRecoveryBoost
    ),
    35,
    100
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
    sum += getBadgeXpForKey(c.key);
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
  const value = getByPath({ stats: badgeStats }, card.statKey);
  const tiers = Array.isArray(card?.tiers) ? card.tiers : [];

  const highestEarnedIndex = getHighestEarnedTierIndex(card, value);
  const rawClaimedIndex = getHighestClaimedTierIndex(card, claimedRewardsSet);

  const highestClaimedIndex =
    highestEarnedIndex < 0 ? -1 : Math.min(rawClaimedIndex, highestEarnedIndex);

  const currentTier =
    highestEarnedIndex >= 0 ? tiers[highestEarnedIndex] : null;

  const nextTier =
    highestEarnedIndex + 1 < tiers.length ? tiers[highestEarnedIndex + 1] : null;

  const nextClaimable =
    highestEarnedIndex > highestClaimedIndex &&
    highestClaimedIndex + 1 < tiers.length
      ? tiers[highestClaimedIndex + 1]
      : null;

  const status =
    highestEarnedIndex > highestClaimedIndex
      ? "claimable"
      : highestEarnedIndex >= 0
      ? "claimed"
      : "locked";

  return {
    value,
    tiers,
    highestEarnedIndex,
    highestClaimedIndex,
    currentTier,
    nextTier,
    nextClaimable,
    status,
  };
}

function formatBadgeThreshold(card, threshold) {
  if (card.comparator !== "lte") return `${threshold}+`;

  const totalSeconds = safeNumber(threshold);
  const mins = Math.floor(totalSeconds / 60);
  const secs = String(totalSeconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
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

  if (card?.comparator === "lte") {
    return `${formatBadgeThreshold(card, threshold)} or faster · +${xp} XP`;
  }

  const statKey = String(card?.statKey || "");

  if (statKey.includes(".count.")) {
    return `${threshold}+ times · +${xp} XP`;
  }

  if (statKey === "stats.streak.currentDays") {
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

  if (statKey === "stats.intelligence.paceImprovementPct4w") {
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

function computeClaimedRewardsXpByDate(plan) {
  const claimed = normaliseClaimedRewards(plan?.meta);
  const map = {};

  for (const c of claimed) {
    if (!c?.claimedAtYmd) continue;
    const xp = getBadgeXpForKey(c.key);
    if (!xp) continue;
    map[c.claimedAtYmd] = (map[c.claimedAtYmd] || 0) + xp;
  }

  return map;
}

// -------- Main app ----------
export default function App() {
  const ENABLE_SW_TOAST = false; // keep false to avoid sticky update toast UX

  const [tab, setTab] = useState("log");
  const [copyDialog, setCopyDialog] = useState(null); // { blockId, days: string[] }
  const [rewardsSubTab, setRewardsSubTab] = useState("badges"); // "badges" | "avatars" | "shop" | "info"
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
  setMotivationLine(pickRandom(MOTIVATION_QUOTES));
  setHealthTip(pickRandom(HEALTH_TIPS));
  setMotivationKey((k) => k + 1);
  setHealthKey((k) => k + 1);
}, [tab]);

// ensure initial values exist
useEffect(() => {
  setMotivationLine((v) => v || pickRandom(MOTIVATION_QUOTES));
  setHealthTip((v) => v || pickRandom(HEALTH_TIPS));
}, []);

useEffect(() => {
  const tick = () => setReadinessNowTick(Date.now());

  let intervalId = null;

  const now = new Date();
  const msToNextHour =
    ((60 - now.getMinutes()) * 60 - now.getSeconds()) * 1000 -
    now.getMilliseconds();

  const timeoutId = setTimeout(() => {
    tick();
    intervalId = setInterval(tick, 60 * 60 * 1000);
  }, Math.max(1000, msToNextHour));

  return () => {
    clearTimeout(timeoutId);
    if (intervalId) clearInterval(intervalId);
  };
}, []);

  // --- Service worker update toast (prevents stale PWA UI after deploys) ---
  const [swUpdateReg, setSwUpdateReg] = useState(null);
  const [showSwToast, setShowSwToast] = useState(false);
  const [swToastDismissed, setSwToastDismissed] = useState(() => {
    try { return sessionStorage.getItem("kwt_sw_toast_dismissed") === "1"; } catch { return false; }
  });

  useEffect(() => {
    if (!ENABLE_SW_TOAST) return;
    const onUpdate = (e) => {
      const reg = e?.detail?.registration;
      // Only show if we actually have a waiting worker (real update) and user hasn't dismissed it.
      if (swToastDismissed) return;
      if (reg?.waiting) {
        setSwUpdateReg(reg);
        setShowSwToast(true);
      }
    };
    window.addEventListener('kwt-sw-update', onUpdate);
    return () => window.removeEventListener('kwt-sw-update', onUpdate);
  }, [swToastDismissed]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (!ENABLE_SW_TOAST) return;

    const onControllerChange = () => window.location.reload();
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
  }, []);

  const applySwUpdate = async () => {
    try {
      const reg = swUpdateReg;
      if (reg?.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      } else {
        window.location.reload();
      }
    } catch {
      window.location.reload();
    }
  };
  const dismissSwToast = () => {
    setShowSwToast(false);
    setSwToastDismissed(true);
    try { sessionStorage.setItem("kwt_sw_toast_dismissed", "1"); } catch {}
  };

  const accountRef = useRef(null);
  const peopleRef = useRef(null);
  const planRef = useRef(null);
  const chartsRef = useRef(null);

  const [pinUnlockedUntil, setPinUnlockedUntil] = useState(0);
  const [selectedPresetId, setSelectedPresetId] = useState("");
  const [planTemplates, setPlanTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [undoPlan, setUndoPlan] = useState(null);
  const [undoLabel, setUndoLabel] = useState("");
  
  const jumpTo = (nextTab, ref) => {
    setTab(nextTab);
    setTimeout(() => {
      try {
        if (ref?.current) ref.current.scrollIntoView({ behavior: "smooth", block: "start" });
        else window.scrollTo({ top: 0, behavior: "smooth" });
      } catch (e) {
        try { window.scrollTo(0, 0); } catch (e2) {}
      }
    }, 50);
  }; // log | stats | plan | rewards | settings
  const [sessionReady, setSessionReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const [family, setFamily] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [activeProfileId, setActiveProfileId] = useState(() => {
  try {
    const v = localStorage.getItem("wt_activeProfileId") || "";
    // Guard against accidental string values in storage
    if (!v || v === "undefined" || v === "null") return "";
    return v;
  } catch {
    return "";
  }
});

  // Persist selected profile across refreshes
  useEffect(() => {
    try {
      if (activeProfileId) localStorage.setItem("wt_activeProfileId", activeProfileId);
    } catch {}
  }, [activeProfileId]);

  const [plan, setPlan] = useState(null);
  
  // Keep a ref to the latest plan (used by async reward/XP recompute callbacks)
useEffect(() => { planRef.current = plan; }, [plan]);

  const [selectedDate, setSelectedDate] = useState(ymd(new Date()));
  const selectedWeekday = weekdayFromYMD(selectedDate);
  
    // Tick-box tasks (from weekly plan) for the currently selected log date
  const tasksActivityForSelectedDay = useMemo(() => {
    if (!plan) return null;

    // All extra activity blocks for this weekday (from weekly plan)
    const extras = getDayActivitiesForWeekday(plan, selectedWeekday) || [];

    // Activity types that are "task" style
    const taskTypeIds = new Set(
      (plan.activityTypes || [])
        .filter((t) => t?.kind === "task" || t?.id === "tasks")
        .map((t) => t.id)
    );

    // Return the first block whose type is a task-type
    return extras.find((b) => taskTypeIds.has(b.typeId)) || null;
  }, [plan, selectedWeekday]);

    // Cardio-style extra activities (from weekly plan) for the selected log date
  const cardioExtrasForSelectedDay = useMemo(() => {
    if (!plan) return [];

    const extras = getDayActivitiesForWeekday(plan, selectedWeekday) || [];

    // Activity types that are "cardio" (Run, Swim, anything custom you flag as cardio)
    const cardioTypeIds = new Set(
      (plan.activityTypes || [])
        .filter((t) => t?.kind === "cardio")
        .map((t) => t.id)
    );

    return extras.filter((b) => cardioTypeIds.has(b.typeId));
  }, [plan, selectedWeekday]);

  // All planned blocks (primary + extras) for the selected log weekday
  const plannedBlocksForSelectedDay = useMemo(() => {
    if (!plan) return [];
    return getDayActivitiesForWeekday(plan, selectedWeekday) || [];
  }, [plan, selectedWeekday]);
  
  // Plan editing should NOT depend on log date.
  const [planWeekday, setPlanWeekday] = useState("Mon");
  const [planViewMode, setPlanViewMode] = useState("edit"); // "edit" | "clean"

    // V3: blocks for the currently selected day on the PLAN tab
  const blocksForSelectedPlanDay = useMemo(() => {
    if (!plan) return [];
    return getBlocksForPlanWeekday(plan, planWeekday) || [];
  }, [plan, planWeekday]);

  function makeLogCacheKey(familyId, profileId, date) {
  if (!familyId || !profileId || !date) return null;
  return `${familyId}:${profileId}:${ymd(date)}`;
}

  const [logForDay, setLogForDay] = useState(null);
  const [isSavingLog, setIsSavingLog] = useState(false);
  const [allLogs, setAllLogs] = useState([]); // for stats
  const [logsReady, setLogsReady] = useState(false);

  // --- History pill / modal ---
const [historyModal, setHistoryModal] = useState(null); 
// shape: { kind: "movement" | "cardio" | "duration" | "task", id: string, title: string }

const [historyRange, setHistoryRange] = useState("8w"); // "4w" | "8w" | "12w" | "6m"
const [historySeries, setHistorySeries] = useState([]); // [{ x:"YYYY-MM-DD", y:number }]

  // Strength chart toggles (multi-line)
const [historyStrengthShow, setHistoryStrengthShow] = useState({
  weight: true,
  reps: true,
  time: false,
});

// Cardio chart toggles
const [historyCardioMetric, setHistoryCardioMetric] = useState("pace"); 
// "pace" | "distance" | "time" | "speed"

const [historyCardioUnit, setHistoryCardioUnit] = useState("km"); 
// "km" | "mi"
const [soundOn, setSoundOn] = useState(true);
const [victoryTheme, setVictoryTheme] = useState("classic"); // classic | arcade | chill
const [xp, setXp] = useState(0);

// Load/persist victory sound theme (Classic / Arcade / Chill)
useEffect(() => {
  try {
    const stored = localStorage.getItem("wt_victoryTheme");
    if (stored === "classic" || stored === "arcade" || stored === "chill") {
      setVictoryTheme(stored);
    }
  } catch {}
}, []);

const applyVictoryTheme = (theme) => {
  setVictoryTheme(theme);
  try {
    localStorage.setItem("wt_victoryTheme", theme);
  } catch {}
};

useEffect(() => {
  if (!claimModal || claimModal.kind !== "badge") return;
  const from = safeNumber(claimModal.xpFrom);
  const to = safeNumber(claimModal.xpTo);
  setClaimXpDisplay(from);

  const start = performance.now();
  const dur = 900;
  let raf = 0;

  const tick = (t) => {
    const p = Math.min(1, (t - start) / dur);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = Math.round(from + (to - from) * eased);
    setClaimXpDisplay(val);
    if (p < 1) raf = requestAnimationFrame(tick);
  };

  raf = requestAnimationFrame(tick);
  return () => cancelAnimationFrame(raf);
}, [claimModal]);
  const [bonusPop, setBonusPop] = useState(0);
  const [showXpLog, setShowXpLog] = useState(false);
  const [showXpRules, setShowXpRules] = useState(false);

  const audioCtxRef = useRef(null);
  function playBuildUpSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = audioCtxRef.current || new AudioContext();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;

    const o = ctx.createOscillator();
    const g = ctx.createGain();

    o.type = "sine";
    o.frequency.setValueAtTime(220, now);
    o.frequency.exponentialRampToValueAtTime(520, now + 0.22);

    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.12, now + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    o.connect(g);
    g.connect(ctx.destination);

    o.start(now);
    o.stop(now + 0.26);
  } catch {}
}
  // Draft inputs for one-off activities on the Log tab
  const [oneOffNameDraft, setOneOffNameDraft] = useState("");
  const [oneOffKindDraft, setOneOffKindDraft] = useState("custom");
  const [extraMovNameDraft, setExtraMovNameDraft] = useState("");
  const [extraMovModeDraft, setExtraMovModeDraft] = useState("strength");
  const [extraMovRepsDraft, setExtraMovRepsDraft] = useState("");
  const [extraMovTrackWeightDraft, setExtraMovTrackWeightDraft] =
    useState(true);
  const [extraMovCoachNoteDraft, setExtraMovCoachNoteDraft] = useState("");
  // Extra block type selection for today-only blocks
  const [showExtraBlockForm, setShowExtraBlockForm] = useState(false);
   const [extraBlockKind, setExtraBlockKind] = useState("strength"); // "strength" | "cardio" | "duration" | "recovery" | "activity"

  // Cardio extra-block drafts
  const [extraCardioNameDraft, setExtraCardioNameDraft] = useState("");
  const [extraCardioTypeDraft, setExtraCardioTypeDraft] = useState("run");
  const [extraCardioTargetDraft, setExtraCardioTargetDraft] = useState("");
  const [extraCardioCoachNoteDraft, setExtraCardioCoachNoteDraft] =
    useState("");

    // Duration extra-block drafts
  const [extraDurationNameDraft, setExtraDurationNameDraft] = useState("");
  const [extraDurationMinutesDraft, setExtraDurationMinutesDraft] =
    useState("");
  const [extraDurationCoachNoteDraft, setExtraDurationCoachNoteDraft] =
    useState("");

  // Recovery extra-block drafts
  const [extraRecoveryNameDraft, setExtraRecoveryNameDraft] = useState("Recovery");
  const [extraRecoveryModeDraft, setExtraRecoveryModeDraft] = useState("full");
  const [extraRecoveryMinutesDraft, setExtraRecoveryMinutesDraft] =
    useState("");
  const [extraRecoveryCoachNoteDraft, setExtraRecoveryCoachNoteDraft] =
    useState(
      "Recovery is where adaptation happens. Muscles repair. Energy restores. Smart athletes recover well so they can push harder next session."
    );

  // Activity / task extra-block drafts
const [extraActivityNameDraft, setExtraActivityNameDraft] = useState("");
const [extraActivityXpDraft, setExtraActivityXpDraft] = useState("");
const [extraActivityCoachNoteDraft, setExtraActivityCoachNoteDraft] =
  useState("");
  const loadDayLogReqRef = useRef(0);
  const lastLogByDateRef = useRef({}); // NEW: latest log we’ve saved per date

  // Strength-like blocks for the selected day (planned + extra one-day)
  let allStrengthBlocksForDay = [];

  const strengthBlocksFromLog =
    Array.isArray(logForDay?.blocks) && logForDay.blocks.length
      ? logForDay.blocks.filter(
          (b) =>
            b &&
            Array.isArray(b.movements) &&
            b.movements.length > 0
        )
      : [];

  if (strengthBlocksFromLog.length) {
    // Prefer the per-day snapshot (plan + extras) if we have it
    allStrengthBlocksForDay = strengthBlocksFromLog;
  } else {
    // No log yet for this day – fall back to showing planned strength/HIIT/box blocks
    allStrengthBlocksForDay = plannedBlocksForSelectedDay.filter(
      (b) =>
        b &&
        (b.typeId === "strength" ||
          b.typeId === "hiit" ||
          b.typeId === "box")
    );
  }

  const hasAnyStrengthBlocks = allStrengthBlocksForDay.length > 0;

    // Cardio blocks (planned + extra for this day)
  const cardioPlannedBlocks = plannedBlocksForSelectedDay.filter(
    (b) =>
      b &&
      (b.typeId === "run" ||
        b.typeId === "swim" ||
        b.typeId === "cardio")
  );

  const cardioExtraBlocks = Array.isArray(logForDay?.blocks)
    ? logForDay.blocks.filter(
        (b) =>
          b &&
          b.isExtra &&
          (b.typeId === "cardio" ||
            b.typeId === "run" ||
            b.typeId === "swim")
      )
    : [];

  const allCardioBlocksForDay = [
    ...cardioPlannedBlocks,
    ...cardioExtraBlocks,
  ];

  const hasAnyCardioBlocks = allCardioBlocksForDay.length > 0;

  // Duration blocks (planned + extra for this day)
  const durationPlannedBlocks = plannedBlocksForSelectedDay.filter(
    (b) => b && b.typeId === "duration"
  );

  const durationExtraBlocks = Array.isArray(logForDay?.blocks)
    ? logForDay.blocks.filter(
        (b) => b && b.isExtra && b.typeId === "duration"
      )
    : [];

  const allDurationBlocksForDay = [
    ...durationPlannedBlocks,
    ...durationExtraBlocks,
  ];

  const hasAnyDurationBlocks = allDurationBlocksForDay.length > 0;

    // Recovery blocks (planned + extra for this day)
  const recoveryPlannedBlocks = plannedBlocksForSelectedDay.filter(
    (b) => b && b.typeId === "recovery"
  );

  const recoveryExtraBlocks = Array.isArray(logForDay?.blocks)
    ? logForDay.blocks.filter(
        (b) => b && b.isExtra && b.typeId === "recovery"
      )
    : [];

  const allRecoveryBlocksForDay = [
    ...recoveryPlannedBlocks,
    ...recoveryExtraBlocks,
  ];

  const hasAnyRecoveryBlocks = allRecoveryBlocksForDay.length > 0;

  // Tasks blocks (planned + extra for this day)
const tasksPlannedBlocks = plannedBlocksForSelectedDay.filter(
  (b) => b && b.typeId === "tasks"
);

const tasksExtraBlocks = Array.isArray(logForDay?.blocks)
  ? logForDay.blocks.filter(
      (b) => b && b.isExtra && b.typeId === "tasks"
    )
  : [];

const allTasksBlocksForDay = [
  ...tasksPlannedBlocks,
  ...tasksExtraBlocks,
];

const hasAnyTasksBlocks = allTasksBlocksForDay.length > 0;
  
  function pickRandom(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return "";
  return arr[Math.floor(Math.random() * arr.length)];
}

  // --- Boot: session ---
  useEffect(() => {
    (async () => {
      if (!isSupabaseReady()) {
        setSessionReady(true);
        setAuthed(false);
        return;
      }
      const { session } = await getSession();
      setAuthed(!!session);
      setSessionReady(true);
    })();
  }, []);

  const ensureAudio = async () => {
    if (!soundOn) return null;
    if (!audioCtxRef.current) audioCtxRef.current = createAudio();
    const ctx = audioCtxRef.current;
    try {
      if (ctx && ctx.state === "suspended") await ctx.resume();
    } catch {}
    return ctx;
  };


  const doSignOut = async () => {
    await signOut();
    setAuthed(false);
    setActiveProfileId("");
    try { localStorage.removeItem("wt_activeProfileId"); } catch {}
  };

  // --- After auth: family + profiles + plan ---
  async function refreshAll() {
    const { family: fam, error } = await getOrCreateFamily("Swain Family");
    if (error) throw error;
    setFamily(fam);

    const { data: templs } = await listPlanTemplates(fam.id);
    setPlanTemplates(templs || []);

    const { data: profs } = await listProfiles(fam.id);
    let profList = profs || [];

    if (profList.length === 0) {
      // auto-create Wilf + Xander
      await addProfile(fam.id, "Wilf");
      await addProfile(fam.id, "Xander");
      const again = await listProfiles(fam.id);
      profList = again.data || [];
    }
    setProfiles(profList);
    const storedProfileId = (() => {
  try {
    const v = localStorage.getItem("wt_activeProfileId") || "";
    if (!v || v === "undefined" || v === "null") return "";
    return v;
  } catch {
    return "";
  }
})();
    const nextProfileId =
      (storedProfileId && profList.some((p) => p.id === storedProfileId))
        ? storedProfileId
        : (activeProfileId && profList.some((p) => p.id === activeProfileId))
          ? activeProfileId
          : (profList[0]?.id || "");
    setActiveProfileId(nextProfileId);
    // IMPORTANT:
    // Weekly plans are per-profile (stored on the profile row or keyed per profile).
    // Don't fetch/write a shared family plan here. Plan loading is handled by the
    // per-profile effect below so switching profiles always shows the right plan.
  }

  useEffect(() => {
    if (!authed) return;
    refreshAll().catch(() => {});
  }, [authed]);

  // When entering the Plan tab, default the plan editor to the same weekday
  // as the currently selected log date (nice UX, but then independent).
  useEffect(() => {
    if (tab !== "plan") return;
    if (selectedWeekday) setPlanWeekday(selectedWeekday);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

// --- Load logs when profile changes ---
  useEffect(() => {
  if (!family?.id || !activeProfileId) {
    setLogsReady(false);
    setAllLogs([]);
    return;
  }

  // Important: clear immediately so we don't display previous profile streak/logs
  setLogsReady(false);
  setAllLogs([]);

  (async () => {
    const { data } = await listLogs(family.id, activeProfileId, 2000);

    // Defensive: if db query ever returns mixed profiles, filter client-side
    const rows = (data || []).filter(
      (r) => !r.profile_id || r.profile_id === activeProfileId
    );

    setAllLogs(rows.map((r) => ({ date_ymd: r.date_ymd, log: r.log_json })));
    setLogsReady(true);
  })().catch(() => {
    // Even if it fails, mark as "done" so we don't get stuck.
    setLogsReady(true);
  });
}, [family?.id, activeProfileId]);


// --- Load day log ---
useEffect(() => {
  // Wait until we actually have a plan for this profile/day
  if (!family?.id || !activeProfileId || !selectedDate || !plan) return;

  const cacheKey = makeLogCacheKey(family.id, activeProfileId, selectedDate);
  const cached = cacheKey ? lastLogByDateRef.current[cacheKey] : undefined;
  if (cached) {
    setLogForDay(cached);
  }

  const reqId = ++loadDayLogReqRef.current;

  (async () => {
    const { data, error } = await getLog(
      family.id,
      activeProfileId,
      selectedDate
    );
    if (reqId !== loadDayLogReqRef.current) return;

    if (error) {
      console.error("getLog failed", error);
      if (!cached) setLogForDay(null);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    // Prefer the new log_json column, but fall back to legacy log if needed
    const fromDb = row?.log_json || row?.log || null;

    // Prefer our cached latest (from recent saves), fall back to DB, or null.
    const rawLatest = cached || fromDb || null;

    // Snap the log to the *current* plan structure for this weekday so:
    // - blocks always line up with the active plan
    // - any blocks from older plans are carried over as one-day extras
    const snapped =
      rawLatest && typeof ensureBlocksSnapshot === "function"
        ? ensureBlocksSnapshot({ ...rawLatest })
        : rawLatest;

    setLogForDay(snapped);

    // Keep the cache in sync with whatever we decided is latest.
    if (cacheKey) {
      const prev = lastLogByDateRef.current || {};
      if (snapped) {
        lastLogByDateRef.current = { ...prev, [cacheKey]: snapped };
      } else {
        const copy = { ...prev };
        delete copy[cacheKey];

        lastLogByDateRef.current = copy;
      }
    }
  })().catch((e) => {
    if (reqId !== loadDayLogReqRef.current) return;
    console.error("getLog exception", e);
    if (!cached) setLogForDay(null);
  });
}, [family?.id, activeProfileId, selectedDate, plan]);

const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

const todayYmd = useMemo(() => getTodayYMD(), [readinessNowTick]);

const isAdult = activeProfile?.age_group === "adult";

const badgeStats = useMemo(() => {
  const result = buildBadgeStatsV2({
    allLogs,
    todayYmd,
    isAdult,
  });

  console.log("BADGE_STATS_V2", result);

  return result;
}, [allLogs, todayYmd, isAdult]);

  function updateProfilePlanInState(profileId, nextPlan) {
    setProfiles((prev) =>
      (prev || []).map((p) => (p.id === profileId ? { ...p, plan_json: nextPlan } : p))
    );
  }

    // Mirror the latest plan per profile into localStorage (safety net for refresh)
  function cachePlanLocally(profileId, nextPlan) {
    if (!profileId || !nextPlan) return;
    try {
      localStorage.setItem(
        `wt_plan_profile_${profileId}`,
        JSON.stringify(nextPlan)
      );
    } catch {
      // ignore storage errors
    }
  }

  function getCachedPlan(profileId) {
    if (!profileId) return null;
    try {
      const raw = localStorage.getItem(`wt_plan_profile_${profileId}`);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function normalisePlanForRuntime(plan) {
    if (!plan) return null;

    // 1) Ensure activityTypes includes all built-ins
    const builtIns = builtInTypes();
    const existing = Array.isArray(plan.activityTypes) ? plan.activityTypes : [];
    const byId = {};

    for (const t of builtIns) {
      byId[t.id] = { ...t };
    }
    for (const t of existing) {
      if (t && t.id) {
        byId[t.id] = { ...byId[t.id], ...t };
      }
    }

    const activityTypes = Object.values(byId);

    // 2) Ensure blocksByWeekday exists and normalise each block
    const outBlocksByWeekday = {};
    const src = plan.blocksByWeekday || {};

    for (const w of weekdays) {
      const raw = Array.isArray(src[w]) ? src[w] : [];
      outBlocksByWeekday[w] = raw.map((b, idx) => {
        const typeId = b?.typeId || "strength";

        if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
          const movements = Array.isArray(b.movements) ? b.movements : [];
          const defaultMovement = createStrengthBlock().movements[0];

  const normMovements = (movements.length ? movements : [defaultMovement]).map(
    (m, mIdx) => ({
      id: m?.id || uid(),
      name: m?.name || "",
      sets: safeNumber(m?.sets) || 3,
      reps: m?.reps ?? "",
      trackWeight: !!m?.trackWeight,
      trackDuration: !!m?.trackDuration,
      initialTarget: m?.initialTarget ?? "",
      coachNote:
        typeof m?.coachNote === "string" ? m.coachNote : "",
    })
  );


          return {
            id: b?.id || `${w}_block_${idx}`,
            typeId,
            label: b?.label || "",
            note: typeof b?.note === "string" ? b.note : "",
            restSec: typeof b?.restSec === "number" ? b.restSec : 60,
            movements: normMovements,
          };
        }

        if (typeId === "cardio") {
          return {
            id: b?.id || `${w}_block_${idx}`,
            typeId: "cardio",
            label: b?.label || "",
            note: typeof b?.note === "string" ? b.note : "",
            cardioType: b?.cardioType || "run",
            cardioTypeOtherLabel: b?.cardioTypeOtherLabel || "",
            targetText: b?.targetText || "",
          };
        }

        if (typeId === "duration") {
          return {
            id: b?.id || `${w}_block_${idx}`,
            typeId: "duration",
            label: b?.label || "",
            note: typeof b?.note === "string" ? b.note : "",
            plannedMinutes:
              typeof b?.plannedMinutes === "number" ||
              typeof b?.plannedMinutes === "string"
                ? String(b.plannedMinutes)
                : "",
          };
        }

        if (typeId === "recovery") {
          return {
            id: b?.id || `${w}_block_${idx}`,
            typeId: "recovery",
            label: b?.label || "Recovery",
            note:
              typeof b?.note === "string"
                ? b.note
                : "Recovery is where adaptation happens. Muscles repair. Energy restores. Smart athletes recover well so they can push harder next session.",
            recoveryMode:
              b?.recoveryMode === "light" ? "light" : "full",
            plannedMinutes:
              typeof b?.plannedMinutes === "number" ||
              typeof b?.plannedMinutes === "string"
                ? String(b.plannedMinutes)
                : "",
          };
        }
        
        if (typeId === "tasks") {
          const tasks = Array.isArray(b?.tasks) ? b.tasks : [];
          return {
            id: b?.id || `${w}_block_${idx}`,
            typeId: "tasks",
            label: b?.label || "",
            note: typeof b?.note === "string" ? b.note : "",
                tasks: tasks.map((t) => ({
      id: t?.id || uid(),
      label: t?.label || "",
      xpValue: safeNumber(t?.xpValue) || 5,
      coachNote:
        typeof t?.coachNote === "string" ? t.coachNote : "",
    })),
          };
        }

        // Fallback: unknown type → treat as duration block
        return {
          id: b?.id || `${w}_block_${idx}`,
          typeId: "duration",
          label: b?.label || "",
          note: typeof b?.note === "string" ? b.note : "",
          plannedMinutes: "",
        };
      });
    }

    return {
      ...plan,
      activityTypes,
      blocksByWeekday: outBlocksByWeekday,
    };
  }

  function setAndCachePlan(profileId, nextPlan) {
    const normalised = normalisePlanForRuntime(nextPlan);
    setPlan(normalised);
    updateProfilePlanInState(profileId, normalised);
    cachePlanLocally(profileId, normalised);
  }

   // --- Load weekly plan for the selected profile ---
  useEffect(() => {
    // We need both a profile and a family to be able to read/write the DB plan
    if (!activeProfileId || !family?.id) return;

    const familyId = family.id;
    const profileId = activeProfileId;

// 1) Try local cached copy first (fast), BUT still fetch DB after (authoritative)
const cached = getCachedPlan(profileId);
if (cached) {
  setAndCachePlan(profileId, cached);
  // DO NOT return — we still want to fetch the DB plan to catch updates from other devices
}

    // 2) Always try the DB plan (authoritative for extras)
    (async () => {
          const { data, error } = await getProfilePlan(familyId, profileId);
    if (error) {
      console.error("getProfilePlan failed", error);
      // If we have cached, just keep it; otherwise we’ll fall back to a default plan.
      if (!cached) {
        const p = defaultPlanForFamily();
        await upsertProfilePlan(familyId, profileId, p);
        setAndCachePlan(profileId, p);
      }
      return;
    }

    if (data?.plan_json) {
      const dbPlan = normalisePlanForRuntime(data.plan_json);

      // Only overwrite if it’s actually different
      const cachedStr = cached ? JSON.stringify(cached) : "";
      const dbStr = dbPlan ? JSON.stringify(dbPlan) : "";

      if (!cached || cachedStr !== dbStr) {
        setAndCachePlan(profileId, dbPlan);
      }
      return;
    }

    // No DB plan and no cached copy: create default + persist
    if (!cached) {
      const p = defaultPlanForFamily();
      await upsertProfilePlan(familyId, profileId, p);
      setAndCachePlan(profileId, p);
    }
    })();
  }, [activeProfileId, family?.id]);  // IMPORTANT: do not depend on activeProfile here


  // Names we’ve used before for one-off activities (for dropdown suggestions)
  const knownOneOffNames = useMemo(() => {
    const names = new Set();

    // From historic logs: meta.oneOffActivities
    for (const r of allLogs || []) {
      const arr = r?.log?.meta?.oneOffActivities;
      if (Array.isArray(arr)) {
        for (const a of arr) {
          if (a?.name && typeof a.name === "string") {
            names.add(a.name);
          }
        }
      }
    }

    // Also include labels from extra day activities in the weekly plan
    const actsByDay = plan?.dayActivitiesByWeekday || {};
    Object.values(actsByDay).forEach((arr) => {
      (arr || []).forEach((a) => {
        if (a?.label && typeof a.label === "string") {
          names.add(a.label);
        }
      });
    });

    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [allLogs, plan]);
  
  const xpToNext = 100 - (xp % 100);
  const level = 1 + Math.floor(xp / 100);
  const unlocked = { arcade: level >= 3, chill: level >= 5 };

  // Avatars: 1 unlock every 1000 XP (every 10 levels)
  const avatarTier = Math.floor(xp / 1000); // 0 = none yet, 1 = first avatar, etc.
  const nextAvatarAt = (avatarTier + 1) * 1000;
  const xpToNextAvatar = nextAvatarAt - xp;

// Rewards meta (stored in profile plan JSON so it syncs across devices)
const claimedRewardsNorm = useMemo(
  () => normaliseClaimedRewards(plan?.meta),
  [JSON.stringify(plan?.meta?.claimedRewards || [])]
);
const claimedRewardsSet = useMemo(
  () => new Set((claimedRewardsNorm || []).map((c) => c.key)),
  [claimedRewardsNorm]
);
const totalBadgeXp = useMemo(() => {
  let total = 0;
  for (const c of claimedRewardsNorm || []) {
    if (!c || !c.key) continue;
    total += getBadgeXpForKey(c.key);
  }
  return total;
}, [claimedRewardsNorm]);

const unlockedAvatarPacksArr = Array.isArray(plan?.meta?.unlockedAvatarPacks)
  ? plan.meta.unlockedAvatarPacks
  : [];

// Only treat packs as "unlocked" if this profile's XP meets the threshold
const unlockedAvatarPacksSet = useMemo(() => {
  const allowed = new Set();
  for (const key of unlockedAvatarPacksArr) {
    const pack = AVATAR_PACKS.find((p) => p.key === key);
    if (!pack) continue;
    if (xp >= pack.unlockAtXp) {
      allowed.add(key);
    }
  }
  return allowed;
}, [unlockedAvatarPacksArr.join("|"), xp]);

const selectedAvatarId =
  typeof plan?.meta?.avatarId === "string" ? plan.meta.avatarId : "";

const headerAvatar = useMemo(() => {
  // Only allow avatars from packs this profile has truly unlocked at its current XP
  for (const pack of AVATAR_PACKS) {
    if (!unlockedAvatarPacksSet.has(pack.key)) continue;
    for (const a of pack.avatars || []) {
      if (a.id === selectedAvatarId) return a;
    }
  }
  return null;
}, [selectedAvatarId, unlockedAvatarPacksArr.join("|"), xp]);

const headerAvatarEmoji = headerAvatar?.emoji || headerAvatar?.label || "🙂";
const headerAvatarImg = headerAvatar?.imgSrc || "";

  const hasUnclaimedBadges = useMemo(() => {
  return BADGE_CARDS.some((card) => {
    const state = getBadgeCardState(card, badgeStats, claimedRewardsSet);
    return state.status === "claimable";
  });
}, [badgeStats, claimedRewardsSet]);

  const canUseTheme = (t) =>
    t === "classic" ||
    (t === "arcade" && unlocked.arcade) ||
    (t === "chill" && unlocked.chill);

  const dayTypeId = plan?.dayTypeByWeekday?.[selectedWeekday] || "strength";
  const activityType = (plan?.activityTypes || builtInTypes()).find((t) => t.id === dayTypeId) || builtInTypes()[0];
  const movements = plan?.movementsByWeekday?.[selectedWeekday] || [];

  const planDay = { ...activityType, movements };

  // Plan editor uses its own weekday selector.
  const planDayTypeId = plan?.dayTypeByWeekday?.[planWeekday] || "strength";
  const planActivityType = (plan?.activityTypes || builtInTypes()).find((t) => t.id === planDayTypeId) || builtInTypes()[0];
  const planMovements = plan?.movementsByWeekday?.[planWeekday] || [];
  const planDayEditor = { ...planActivityType, movements: planMovements };
  const activityTypesForPlan = (plan?.activityTypes || builtInTypes());
  const dayActivitiesForPlanWeekday = getDayActivitiesForWeekday(plan || defaultPlanForFamily(), planWeekday);
  const extraActivitiesForPlanWeekday = dayActivitiesForPlanWeekday.slice(1);
  const blocksForPlanWeekday = getBlocksForPlanWeekday(
  plan || defaultPlanForFamily(),
  planWeekday
);
  const taskBlocksForPlanWeekday = extraActivitiesForPlanWeekday.filter((block) => {
    const t = activityTypesForPlan.find((x) => x.id === block.typeId);
    return t && (t.kind === "task" || t.id === "tasks");
  });
  const tasksActivityForPlanWeekday = taskBlocksForPlanWeekday[0] || null;

const planDayForWeekday = (weekday) => {
  const typeId = plan?.dayTypeByWeekday?.[weekday] || "strength";

  const t =
    (plan?.activityTypes || builtInTypes()).find((x) => x.id === typeId) ||
    builtInTypes()[0];
  const movs = plan?.movementsByWeekday?.[weekday] || [];
  return { ...t, movements: movs };
};

// -------- XP rules (block-based engine) ----------

const XP_RULES = {
  // Per-block rules
  strengthSet: 2,            // +2 XP per completed strength/HIIT set
  cardioPerMin: 1 / 2,       // +1 XP per 2 minutes (rounded up)
  cardioPerKm: 1 / 0.5,      // +1 XP per 0.5km (rounded up)
  durationPerMin: 2 / 10,    // +2 XP per 10 minutes
  taskDefault: 5,            // fallback if a task has no xpValue
  blockComplete: 5,          // +5 XP per completed workout block (non-task)

  // Progression bonuses
  progression: 10,           // beat last strength session
  cardioProgression: 20,     // beat last cardio session

  // Day-complete bonus
  dayCompleteBonus: 10,

  // Streak bonuses (per completed day in a streak)
  streak: {
    1: 0,
    2: 5,
    3: 10,
    5: 20,
    10: 50,
    30: 100,
    60: 200,
    90: 300,
    180: 600,
    365: 2000,
  },
};

const CARDIO_MODE = {
  PROGRESSIVE: "progressive",
  CASUAL: "casual",
};

const CARDIO_MODE_MULTIPLIER = {
  [CARDIO_MODE.PROGRESSIVE]: 1,
  [CARDIO_MODE.CASUAL]: 0.6, // casual / commute-style sessions earn a bit less XP
};

// Helper to decide if today&apos;s cardio looks more like &quot;casual&quot;.
// For now this is simple: all-cardio-walk days are treated as casual.
// Later we can evolve this to use personal pace baselines per user.

// Count completed sets in a single block (any reps/weight/time/etc)
function countCompletedSetsInBlock(block) {
  if (!block || !block.sets || typeof block.sets !== "object") return 0;
  let count = 0;
  for (const movementId of Object.keys(block.sets)) {
    const arr = Array.isArray(block.sets[movementId]) ? block.sets[movementId] : [];
    count += arr.filter(setDidSomething).length;
  }
  return count;
}

function playSparkleSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = audioCtxRef.current || new AudioContext();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;

    // A quick cluster of high "sparkle" pings
    const freqs = [880, 1046.5, 1318.5, 1568];
    freqs.forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = "triangle";
      o.frequency.setValueAtTime(f, now + i * 0.03);

      g.gain.setValueAtTime(0.0001, now + i * 0.03);
      g.gain.exponentialRampToValueAtTime(0.08, now + i * 0.03 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.03 + 0.12);

      o.connect(g);
      g.connect(ctx.destination);

      o.start(now + i * 0.03);
      o.stop(now + i * 0.03 + 0.14);
    });
  } catch {}
}


function blockHasData(block) {
  if (!block) return false;
  const typeId = block.typeId;

  if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
    return countCompletedSetsInBlock(block) > 0;
  }

  if (typeId === "cardio") {
    const c = block.cardio || {};
    const km = safeNumber(c.distanceKm);
    const min = safeNumber(c.durationMin);
    return km > 0 || min > 0;
  }

  if (typeId === "duration") {
    const d = block.duration || {};
    const mins = safeNumber(d.minutes);
    return mins > 0;
  }

  if (typeId === "recovery") {
    return !!block.recoveryDone;
  }

  if (typeId === "tasks") {
    const done = block.tasksDone || {};
    return Object.values(done).some(Boolean);
  }

  return false;
}

// Any activity at all on this day?
function dayHasAnyBlockActivity(log) {
  if (!log || !Array.isArray(log.blocks)) return false;
  return log.blocks.some(blockHasData);
}

// ---- XP per-block helpers ----

function xpForStrengthBlock(block) {
  const sets = countCompletedSetsInBlock(block);
  if (!sets) return 0;
  return sets * XP_RULES.strengthSet;
}

function xpForCardioBlock(block) {
  const c = block.cardio || {};
  const km = safeNumber(c.distanceKm);
  const min = safeNumber(c.durationMin);

  if (!km && !min) return 0;

  const xpByMin = min > 0 ? Math.ceil(min * XP_RULES.cardioPerMin) : 0;
  const xpByKm = km > 0 ? Math.ceil(km * XP_RULES.cardioPerKm) : 0;

  // Time + distance both earn XP (not either/or)
  return xpByMin + xpByKm;
}

function xpForDurationBlock(block) {
  const d = block.duration || {};
  const mins = safeNumber(d.minutes);
  if (!mins) return 0;
  return Math.ceil(mins * XP_RULES.durationPerMin);
}

function xpForRecoveryBlock(block) {
  return block?.recoveryDone ? 5 : 0;
}

function findPlanBlockForLogBlock(plan, logBlockId) {
  if (!plan || !plan.blocksByWeekday) return null;
  for (const weekday of Object.keys(plan.blocksByWeekday)) {
    const arr = plan.blocksByWeekday[weekday] || [];
    for (const b of arr) {
      if (b && b.id === logBlockId) return b;
    }
  }
  return null;
}

function xpForTasksBlock(block, plan) {
  const done = block?.tasksDone || {};
  const doneIds = Object.entries(done)
    .filter(([, v]) => !!v)
    .map(([id]) => id);

  if (!doneIds.length) return 0;

  let total = 0;
  const planBlock = findPlanBlockForLogBlock(plan, block?.id);

  if (planBlock && Array.isArray(planBlock.tasks)) {
    const taskMap = new Map(
      planBlock.tasks
        .filter((t) => t && t.id)
        .map((t) => [t.id, t])
    );

    for (const id of doneIds) {
      const def = taskMap.get(id);
      const xpValue = safeNumber(def?.xpValue);
      total += xpValue > 0 ? xpValue : XP_RULES.taskDefault;
    }
  } else {
    // Fallback: every completed task = default XP
    total = doneIds.length * XP_RULES.taskDefault;
  }

  return total;
}

// Core XP for the blocks themselves (no day bonus / streak)
function baseXpForLog(log, plan) {
  if (!log || !Array.isArray(log.blocks)) return 0;
  let total = 0;

  for (const block of log.blocks) {
    if (!block) continue;
    switch (block.typeId) {
           case "strength":
      case "hiit":
      case "box": {
        const blockXp = xpForStrengthBlock(block);
        total += blockXp;
        if (blockXp > 0) total += XP_RULES.blockComplete;
        break;
      }
      case "cardio": {
        const blockXp = xpForCardioBlock(block);
        total += blockXp;
        if (blockXp > 0) total += XP_RULES.blockComplete;
        break;
      }
      case "duration": {
        const blockXp = xpForDurationBlock(block);
        total += blockXp;
        if (blockXp > 0) total += XP_RULES.blockComplete;
        break;
      }
      case "recovery": {
        const blockXp = xpForRecoveryBlock(block);
        total += blockXp;
        break;
      }
      case "tasks":
        total += xpForTasksBlock(block, plan);
        break;
      default:
        // other types: no XP for now
        break;
    }
  }

  return total;
}

function completionBonusForLog(log) {
  return isDayGreen(log) ? XP_RULES.dayCompleteBonus : 0;
}

// ---- Streaks ----

function computeStreakBonusMap(records) {
  if (!Array.isArray(records) || !records.length) return {};

  // Build date -> log map
  const map = new Map();
  for (const r of records) {
    const date = r?.date_ymd || r?.date;
    const log = r?.log;
    if (!date || !log) continue;
    map.set(date, log);
  }

  // Collect all "green" days
  const completeDates = [];
  for (const [date, log] of map.entries()) {
    if (isDayGreen(log)) completeDates.push(date);
  }

  if (!completeDates.length) return {};

  // Sort ascending
  completeDates.sort((a, b) => (a < b ? -1 : 1));

  // Walk the streaks in order, awarding XP per completed day
  const bonusByDate = {};
  let streak = 0;
  let prevDate = null;

  for (const date of completeDates) {
    if (!prevDate) {
      streak = 1;
    } else {
      const prev = new Date(prevDate + "T00:00:00");
      const cur = new Date(date + "T00:00:00");
      const diffDays = Math.round((cur - prev) / 86400000);
      if (diffDays === 1) streak += 1;
      else streak = 1;
    }

    const streakBonus = XP_RULES.streak[streak] || 0;
    if (streakBonus > 0) bonusByDate[date] = streakBonus;

    prevDate = date;
  }

  return bonusByDate;
}

// ---- XP breakdown rows (Rewards tab + overall XP) ----

const buildXpDebugRows = (records, plan) => {
  if (!Array.isArray(records) || !records.length) return [];

  const streakXpByDate = computeStreakBonusMap(records);
  const rows = [];

  for (const r of records) {
    const date = r?.date_ymd || r?.date;
    const log = r?.log;
    if (!date || !log) continue;

    const weekday = log.weekday || weekdayFromYMD(date);
    const complete = isDayGreen(log);
    const blocks = Array.isArray(log.blocks) ? log.blocks : [];

    let setsLogged = 0;
    let cardioKm = 0;
    let customMin = 0;
    let tasksDone = 0;

    // Cardio mode classification (progressive vs casual)
    let anyCardio = false;
    let allCardioAreWalk = true;
    let cardioMode = CARDIO_MODE.PROGRESSIVE;

    let setsXp = 0;
    let movementsXp = 0; // not used in V3 but kept for compatibility
    let extraXp = 0;

    // XP buckets (so ledger can show exactly where XP came from)
    let strengthXp = 0;
    let cardioXp = 0;
    let durationXp = 0;
    let recoveryXp = 0;
let tasksXp = 0;
let dayCompleteXp = 0;

// Bonuses
let strengthProgressXp = 0;
let cardioProgressXp = 0;

let progressCount = 0;

// Walk all blocks once and accumulate stats / XP

    for (const block of blocks) {
      if (!block) continue;

      switch (block.typeId) {
        case "strength":
        case "hiit":
        case "box": {
          // Strength / HIIT sets + progression
          const setsByMovement =
            block.sets && typeof block.sets === "object" ? block.sets : {};
          const movements = Array.isArray(block.movements)
            ? block.movements
            : [];

          for (const mov of movements) {
            const movementSets = Array.isArray(setsByMovement[mov.id])
              ? setsByMovement[mov.id]
              : [];
            const completedSets = movementSets.filter(setDidSomething);
            if (!completedSets.length) continue;

            setsLogged += completedSets.length;

            const lastSets = findLastMovementSets(records, mov.id, date);
            const lastScore = scoreSets(lastSets || []);
            const curScore = scoreSets(movementSets);
            if (curScore > lastScore && lastScore > 0) {
              progressCount += 1;
            }
          }

          const blockXp = xpForStrengthBlock(block);
          strengthXp += blockXp;
          setsXp += blockXp; // treat all base strength XP as "sets XP"

          // +5 XP per completed strength/HIIT block
          if (blockXp > 0) strengthXp += XP_RULES.blockComplete;
          
          break;
        }

          case "cardio": {
          const c = block.cardio || {};
          anyCardio = true;
          const ct = block.cardioType || "run";
          if (ct !== "walk") allCardioAreWalk = false;

          const km = safeNumber(c.distanceKm);
          const min = safeNumber(c.durationMin);
          cardioKm += km;
          customMin += min;

          const blockXp = xpForCardioBlock(block);
          cardioXp += blockXp;

          // +5 XP per completed cardio block
          if (blockXp > 0) cardioXp += XP_RULES.blockComplete;

          break;
        }

        case "duration": {
          const d = block.duration || {};
          const mins = safeNumber(d.minutes);
          customMin += mins;

          const blockXp = xpForDurationBlock(block);
          durationXp += blockXp;

          // +5 XP per completed duration block
          if (blockXp > 0) durationXp += XP_RULES.blockComplete;

          break;
        }

        case "recovery": {
          const blockXp = xpForRecoveryBlock(block);
          recoveryXp += blockXp;
          break;
        }

        case "tasks": {
          const done = block.tasksDone || {};
          tasksDone += Object.values(done).filter(Boolean).length;

          const blockXp = xpForTasksBlock(block, plan);
          tasksXp += blockXp;
          break;
        }

        default:
          break;
      }
    }

            if (progressCount > 0) {
      strengthProgressXp = progressCount * XP_RULES.progression;
    }

    // Cardio progression: compare today's summed cardio vs previous
    let effectiveCardio = null;
    if (cardioKm > 0 || customMin > 0) {
      const avgSpeed =
        cardioKm > 0 && customMin > 0
          ? cardioKm / (customMin || 1)
          : safeNumber(log.cardio?.avgSpeedKmh);

      effectiveCardio = {
        distanceKm: cardioKm,
        durationMin: customMin,
        avgSpeedKmh: avgSpeed,
      };

      const lastCardio = findLastCardio(records, date);
      if (lastCardio && isCardioImproved(effectiveCardio, lastCardio)) {
        cardioProgressXp = XP_RULES.cardioProgression;
      }
    }

    // Apply cardio mode multiplier (progressive vs casual/commute)
    if (anyCardio) {
      if (allCardioAreWalk) {
        cardioMode = CARDIO_MODE.CASUAL;
      } else {
        cardioMode = CARDIO_MODE.PROGRESSIVE;
      }
      cardioXp = Math.round(
        cardioXp * (CARDIO_MODE_MULTIPLIER[cardioMode] || 1)
      );
    }

        dayCompleteXp = completionBonusForLog(log);

    const streakXp = streakXpByDate[date] || 0;

    const claimedBadgeXpByDate = computeClaimedRewardsXpByDate(plan);
    const badgeClaimXp = claimedBadgeXpByDate[date] || 0;
const dailyBonusXp = log?.meta?.challengeClaimed ? 15 : 0;

const nonBonusXp = strengthXp + cardioXp + durationXp + recoveryXp + tasksXp + dayCompleteXp;
const progXp = strengthProgressXp + cardioProgressXp;

const totalXp = nonBonusXp + progXp + streakXp + dailyBonusXp + badgeClaimXp;

rows.push({
  date,
  weekday,
  kind: "blocks",
  complete,
  // Totals
  totalXp,
  nonBonusXp,
  // Base buckets
  strengthXp,
  cardioXp,
  durationXp,
  recoveryXp,
  tasksXp,
  dayCompleteXp,
  // Bonuses
  dailyBonusXp,
  strengthProgressXp,
  cardioProgressXp,
  progXp,
  streakXp,
  badgeClaimXp,

  // Kept for older bits of UI that expect these names
  baseXp: nonBonusXp,
  progressXp: strengthProgressXp,
  cardioProgressXp,
  extraXp: cardioXp, // legacy column used as "cardio" previously
  bonus: dayCompleteXp,

  oneOffDone: false,
  oneOffXp: 0,

  setsXp,
  movementsXp,

  tasksDone,
  tasksXp_legacy: 0,

  // Cardio mode for debugging / ledger display
  cardioMode: anyCardio ? cardioMode : null,

  setsLogged,
  cardioKm,
  customMin,
});
  }

  
  // Add synthetic rows for badge-claims on days with no log record,
  // so XP totals and the ledger still reflect the claim immediately.
    const _claimedBadgeXpByDateAll = computeClaimedRewardsXpByDate(plan);
    const _existingDates = new Set(rows.map((r) => r.date));
  for (const [d, xp] of Object.entries(_claimedBadgeXpByDateAll)) {
    if (!xp) continue;
    if (_existingDates.has(d)) continue;
    rows.push({
      date: d,
      weekday: weekdayFromYMD(d),
      kind: "badge_claim",
      complete: false,
      totalXp: xp,
      nonBonusXp: 0,
      strengthXp: 0,
      cardioXp: 0,
      durationXp: 0,
      tasksXp: 0,
      dayCompleteXp: 0,
      dailyBonusXp: 0,
      strengthProgressXp: 0,
      cardioProgressXp: 0,
      progXp: 0,
      streakXp: 0,
      badgeClaimXp: xp,
      baseXp: 0,
      progressXp: 0,
      extraXp: xp,
      bonus: 0,
      oneOffDone: false,
      oneOffXp: 0,
      setsXp: 0,
      movementsXp: 0,
      tasksDone: 0,
      tasksXp_legacy: 0,
      setsLogged: 0,
      cardioKm: 0,
      customMin: 0,
      cardioMode: null,
    });
  }

  // newest first
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Running balance like a bank statement:
  // newest row shows current total XP, then steps down as you go back in time.
  let running = rows.reduce((sum, r) => sum + (r.totalXp || 0), 0);
  for (const r of rows) {
    r.runningTotalXp = running;
    running -= r.totalXp || 0;
  }

  return rows;
};


const computeXpFromLogs = (records, plan) => {
  const rows = buildXpDebugRows(records, plan);
  // rows already include badgeClaimXp per day (based on claim date)
  return rows.reduce((sum, r) => sum + (r.totalXp || 0), 0);
};

useEffect(() => {
  setXp(computeXpFromLogs(allLogs, plan));
}, [allLogs, plan]);

// XP breakdown per day (for cross-checking / XP log)
const xpDebugRows = useMemo(
  () => buildXpDebugRows(allLogs, plan),
  [allLogs, plan]
);

  const records = useMemo(() => {
    const base = {
      bestXpDay: null,
      bestXpValue: 0,
      longestCombo: 0,
      longestComboDate: null,
    };

    if (!Array.isArray(allLogs) || !allLogs.length) return base;

    // Most XP in a single day
    if (Array.isArray(xpDebugRows) && xpDebugRows.length) {
      let best = xpDebugRows[0];
      for (const row of xpDebugRows) {
        if ((row.totalXp || 0) > (best.totalXp || 0)) best = row;
      }
      base.bestXpDay = best.date;
      base.bestXpValue = best.totalXp || 0;
    }

    // Longest combo / set streak – prefer gamify.comboMax if present
    for (const r of allLogs) {
      const date = r.date_ymd || r.date;
      const log = r.log;
      if (!date || !log) continue;
      const combo = safeNumber(log?.gamify?.comboMax);
      if (combo > base.longestCombo) {
        base.longestCombo = combo;
        base.longestComboDate = date;
      }
    }

    return base;
  }, [allLogs, xpDebugRows]); 

const selectedDayStatus = useMemo(() => {
  // returns: "green" | "amber" | "grey"
  const d = selectedDate;
  if (!d) return "grey";

  const rec = Array.isArray(allLogs)
    ? allLogs.find((r) => (r?.date_ymd || r?.date) === d)
    : null;

  const isToday = d === todayYmd;

  if (!rec || !rec.log) {
    // No log exists
    return isToday ? "amber" : "grey";
  }

  const log = rec.log;
  let green = isDayGreen(log);
  const any = dayHasAnyBlockActivity(log);

  const hasRecoveryDone = hasRecoveryDoneForLog(log);
  if (green && hasRecoveryDone) {
    const eligibility = getRecoveryEligibilityForDateApp(allLogs, d);
    if (!eligibility?.qualifies) {
      green = false;
    }
  }

  if (green) return "green";
  if (any) return "amber";

  // Log exists but completely empty
  return isToday ? "amber" : "grey";
}, [selectedDate, allLogs, todayYmd]);

const currentPlanStreak = useMemo(() => {
  return getCurrentPlanStreak(allLogs, todayYmd);
}, [allLogs, todayYmd, activeProfileId]);

const todayPlanStatus = useMemo(() => {
  // Status for TODAY only: "green" complete, "amber" otherwise.
  const rec = Array.isArray(allLogs)
    ? allLogs.find((r) => (r?.date_ymd || r?.date) === todayYmd)
    : null;

  if (!rec || !rec.log) return "amber"; // today not logged yet

  const log = rec.log;
  let green = isDayGreen(log);
  const any = dayHasAnyBlockActivity(log);

  const hasRecoveryDone = hasRecoveryDoneForLog(log);
  if (green && hasRecoveryDone) {
    const eligibility = getRecoveryEligibilityForDateApp(allLogs, todayYmd);
    if (!eligibility?.qualifies) {
      green = false;
    }
  }

  if (green) return "green";
  if (any) return "amber";

  return "amber";
}, [allLogs, todayYmd]);

  
const recoveryEligibilityForSelectedDate = useMemo(() => {
  if (!selectedDate) return null;
  return getRecoveryEligibilityForDateApp(allLogs, selectedDate);
}, [allLogs, selectedDate]);

const todayLog = useMemo(() => {
  const row = Array.isArray(allLogs)
    ? allLogs.find((r) => (r?.date_ymd || r?.date) === todayYmd)
    : null;
  return row?.log || null;
}, [allLogs, todayYmd]);

const recoveryRecommendationToday = useMemo(() => {
  return getRecoveryRecommendationForTodayApp(allLogs, todayYmd, todayLog);
}, [allLogs, todayYmd, todayLog, readinessNowTick]);

const bodyReadiness = useMemo(() => {
  const score = recoveryRecommendationToday?.trainingReadinessScore || 0;
  const band = recoveryRecommendationToday?.band || getReadinessBand(score);

  const projectedScore =
    recoveryRecommendationToday?.projectedTrainingReadinessScore || 0;

  return {
    trainingReadinessScore: score,
    trainingReadinessScalePercent: getReadinessScalePercent(score),
    band,
    muscleReadiness: recoveryRecommendationToday?.muscleReadiness || 0,
    nervousSystemReadiness:
      recoveryRecommendationToday?.nervousSystemReadiness || 0,
    bodyEnergy: recoveryRecommendationToday?.bodyEnergy || 0,
    projectedTrainingReadinessScore: projectedScore,
    projectedTrainingReadinessScalePercent:
      getReadinessScalePercent(projectedScore),
    projectedBand:
      recoveryRecommendationToday?.projectedBand ||
      getReadinessBand(projectedScore),
    projectedMuscleReadiness:
      recoveryRecommendationToday?.projectedMuscleReadiness || 0,
    projectedNervousSystemReadiness:
      recoveryRecommendationToday?.projectedNervousSystemReadiness || 0,
    projectedBodyEnergy:
      recoveryRecommendationToday?.projectedBodyEnergy || 0,
        currentDayComplete:
      !!recoveryRecommendationToday?.currentDayComplete,
    expectedNextSessionHoursAhead:
      recoveryRecommendationToday?.expectedNextSessionHoursAhead || 24,
    expectedNextSessionTimeMs:
      recoveryRecommendationToday?.expectedNextSessionTimeMs || null,
    readinessTimeline48h:
      recoveryRecommendationToday?.readinessTimeline48h || [],
    recommendationText:
      recoveryRecommendationToday?.recommendationText ||
      "Ready to train if energy feels good.",
  };
}, [recoveryRecommendationToday, readinessNowTick]);

const selectedDayHasRecoveryBlock =
  hasAnyRecoveryBlocks;

const selectedDayHasHeavyTrainingBlocks =
  hasAnyStrengthBlocks || hasAnyCardioBlocks;

  async function ensureUnlocked(actionLabel = "save changes") {
    if (!family?.id) return false;
    if (!family?.pin_hash) return true;
    if (Date.now() < pinUnlockedUntil) return true;

    const pin = window.prompt(`Enter PIN to ${actionLabel}:`);
    if (pin === null) return false;

    const h = await sha256Hex(`${pin}:${family.id}`);
    if (h === family.pin_hash) {
      setPinUnlockedUntil(Date.now() + 10 * 60 * 1000); // 10 minutes
      return true;
    }
    window.alert("Incorrect PIN.");
    return false;
  }

    async function ensurePinForProfileSwitch() {
    if (!family?.id) return false;
    if (!family?.pin_hash) return true;

    const pin = window.prompt("Enter PIN to switch profile:");
    if (pin === null) return false;

    const h = await sha256Hex(`${pin}:${family.id}`);
    if (h === family.pin_hash) {
      // IMPORTANT: do NOT set pinUnlockedUntil here.
      // We want a PIN prompt on every profile switch.
      return true;
    }
    window.alert("Incorrect PIN.");
    return false;
  }

    const handleProfileChange = async (id) => {
    const ok = await ensurePinForProfileSwitch();
    if (!ok) return;

    // Clear current view so we don't show previous profile's plan/logs
    setActiveProfileId(id);
    setPlan(null);
    setAllLogs([]);
    setLogForDay(null);
  };

  async function applyPlan(nextPlan, label = "Plan applied") {
    if (!(await ensureUnlocked("apply changes"))) return;
    setUndoPlan(plan || null);
    setUndoLabel(label);
    setAndCachePlan(activeProfileId, nextPlan);
    if (!family?.id || !activeProfileId) return;
    await upsertProfilePlan(family.id, activeProfileId, nextPlan);
  }

  async function undoLastPlan() {
    if (!undoPlan) return;
    if (!(await ensureUnlocked("undo changes"))) return;
    const prev = undoPlan;
    setUndoPlan(null);
    setUndoLabel("");
    setAndCachePlan(activeProfileId, prev);
    if (!family?.id || !activeProfileId) return;
    await upsertProfilePlan(family.id, activeProfileId, prev);
  }

      async function savePlan(nextPlan) {
    if (!(await ensureUnlocked("save changes"))) return;

    // Normalise once so DB + cache both store the same canonical shape
    const normalised = normalisePlanForRuntime(nextPlan);

    // Update in-memory state + localStorage cache
    setAndCachePlan(activeProfileId, normalised);

    // Persist to Supabase
    if (!family?.id || !activeProfileId) return;
    await upsertProfilePlan(family.id, activeProfileId, normalised);
  }

  // Save ONLY meta fields to the profile plan without requiring the PIN unlock.
  // We store rewards/avatars in plan.meta so it syncs across devices.
  async function savePlanMetaNoPin(metaPatch) {
    if (!family?.id || !activeProfileId) return;
    const current = plan || buildDefaultPlan();
    const next = normalisePlanForRuntime({
      ...current,
      meta: { ...(current.meta || {}), ...(metaPatch || {}) },
    });

    // Update state + cache
    setAndCachePlan(activeProfileId, next);

    // Persist
    await upsertProfilePlan(family.id, activeProfileId, next);
  }

  


function playRewardSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = audioCtxRef.current || new AudioCtx();
    audioCtxRef.current = ctx;
    if (ctx.state === "suspended") ctx.resume();

    const now = ctx.currentTime;

    // Main "pop"
    const o1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    o1.type = "triangle";
    o1.frequency.setValueAtTime(520, now);
    o1.frequency.exponentialRampToValueAtTime(1040, now + 0.10);
    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.exponentialRampToValueAtTime(0.22, now + 0.02);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    o1.connect(g1);
    g1.connect(ctx.destination);

    // Sparkle "ding"
    const o2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    o2.type = "sine";
    o2.frequency.setValueAtTime(1560, now + 0.02);
    o2.frequency.exponentialRampToValueAtTime(2200, now + 0.18);
    g2.gain.setValueAtTime(0.0001, now + 0.02);
    g2.gain.exponentialRampToValueAtTime(0.12, now + 0.06);
    g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
    o2.connect(g2);
    g2.connect(ctx.destination);

    o1.start(now);
    o2.start(now);

    const stopAt = now + 0.28;
    o1.stop(stopAt);
    o2.stop(stopAt);

    let ended = 0;
    const done = () => {
      ended += 1;
      if (ended >= 2) ctx.close();
    };
    o1.onended = done;
    o2.onended = done;
  } catch {
    // ignore
  }
}


async function claimRewardKey(rewardKey, claimedAtYmd = getTodayYMD()) {
  const claimed = normaliseClaimedRewards(plan?.meta);
  if (claimed.some((c) => c.key === rewardKey)) return;

  const next = [
    ...claimed,
    { key: rewardKey, claimedAtYmd: typeof claimedAtYmd === "string" ? claimedAtYmd : null },
  ];

  // Store in meta (syncs across devices)
  await savePlanMetaNoPin({ claimedRewards: next });
}

    // ---------- V3 PLAN BLOCK EDIT HELPERS ----------

  // Always work on a plan that has blocksByWeekday initialised
  function getPlanWithBlocks() {
    return ensureBlocksByWeekday(plan || defaultPlanForFamily());
  }

  // Generic helper: update blocks for the currently selected plan weekday
  async function updatePlanBlocksForCurrentDay(label, updater) {
    const base = getPlanWithBlocks();

    const nextPlan = updateBlocksForPlanWeekday(
      base,
      planWeekday,
      (blocks) => {
        const safeBlocks = Array.isArray(blocks) ? blocks : [];
        return updater(safeBlocks);
      }
    );

    // Persist + normalise via existing save function (PIN-protected etc.)
    await savePlan(nextPlan);
  }

  function addBlockToDay(typeId) {
    let newBlock;

    if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
      newBlock = createStrengthBlock();
      newBlock.typeId = typeId;
    } else if (typeId === "cardio") {
      newBlock = createCardioBlock();
    } else if (typeId === "duration") {
      newBlock = createDurationBlock();
    } else if (typeId === "recovery") {
      newBlock = createRecoveryBlock();
    } else if (typeId === "tasks") {
      newBlock = createTasksBlock();
    } else {
      return;
    }

    updatePlanBlocksForCurrentDay("Add block", (blocks) => [
      ...blocks,
      newBlock,
    ]);
  }

  function removeBlockFromDay(blockId) {
    updatePlanBlocksForCurrentDay("Remove block", (blocks) =>
      blocks.filter((b) => b.id !== blockId)
    );
  }

  function updateBlockInDay(blockId, patchFn) {
    updatePlanBlocksForCurrentDay("Update block", (blocks) =>
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        const patch =
          typeof patchFn === "function" ? patchFn(b) : patchFn || {};
        return { ...b, ...patch };
      })
    );
  }

  function moveBlockInDay(blockId, direction) {
    // direction: -1 for up, +1 for down
    updatePlanBlocksForCurrentDay("Move block", (blocks) => {
      const safeBlocks = Array.isArray(blocks) ? blocks : [];
      const idx = safeBlocks.findIndex((b) => b && b.id === blockId);
      if (idx === -1) return safeBlocks;

      const target = idx + direction;
      if (target < 0 || target >= safeBlocks.length) return safeBlocks;

      const next = [...safeBlocks];
      const [item] = next.splice(idx, 1);
      next.splice(target, 0, item);
      return next;
    });
  }

function cloneBlockForPlan(block) {
  // Used when creating a genuinely new block (new IDs)
  if (!block) return null;

  const cloned = { ...block, id: uid() };

  if (Array.isArray(block.movements)) {
    cloned.movements = block.movements.map((m) => ({ ...m, id: uid() }));
  }

  if (Array.isArray(block.tasks)) {
    cloned.tasks = block.tasks.map((t) => ({ ...t, id: uid() }));
  }

  return cloned;
}

function cloneBlockForPlanPreserveIds(block) {
  // Used when copying the "same logical block" to other days (keep IDs stable)
  if (!block) return null;

  const cloned = { ...block }; // keep block.id

  if (Array.isArray(block.movements)) {
    cloned.movements = block.movements.map((m) => ({ ...m })); // keep movement.id
  }

  if (Array.isArray(block.tasks)) {
    cloned.tasks = block.tasks.map((t) => ({ ...t })); // keep task.id
  }

  return cloned;
}

  async function duplicateBlockToOtherWeekdays(blockId, targetWeekdays) {
    if (!Array.isArray(targetWeekdays) || !targetWeekdays.length) return;

    const base = getPlanWithBlocks();
    const currentBlocks = getBlocksForPlanWeekday(base, planWeekday) || [];
    const sourceBlock = currentBlocks.find((b) => b && b.id === blockId);
    if (!sourceBlock) return;

    const nextBlocksByWeekday = { ...(base.blocksByWeekday || {}) };

    for (const wd of targetWeekdays) {
      if (!wd) continue;
      const dayBlocks = Array.isArray(nextBlocksByWeekday[wd])
        ? [...nextBlocksByWeekday[wd]]
        : [];
      const cloned = cloneBlockForPlanPreserveIds(sourceBlock);
      if (cloned) {
        dayBlocks.push(cloned);
        nextBlocksByWeekday[wd] = dayBlocks;
      }
    }

    const nextPlan = {
      ...base,
      blocksByWeekday: nextBlocksByWeekday,
    };

    await savePlan(nextPlan, "Copy block to other days");
  }

  function toggleCopyDialogDay(day) {
    setCopyDialog((prev) => {
      if (!prev) return prev;
      const has = prev.days.includes(day);
      return {
        ...prev,
        days: has
          ? prev.days.filter((d) => d !== day)
          : [...prev.days, day],
      };
    });
  }

  function addMovement(blockId) {
    const newMovement = {
      id: uid(),
      name: "",
      sets: 3,
      reps: "",
      trackWeight: false,
      trackDuration: false,
      initialTarget: "",
    };

    updatePlanBlocksForCurrentDay("Add movement", (blocks) =>
      blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              movements: [
                ...(Array.isArray(b.movements) ? b.movements : []),
                newMovement,
              ],
            }
          : b
      )
    );
  }

  // alias used by the Plan UI button
  function addMovementToBlock(blockId) {
    addMovement(blockId);
  }

  function removeMovement(blockId, movementId) {
    updatePlanBlocksForCurrentDay("Remove movement", (blocks) =>
      blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              movements: (Array.isArray(b.movements) ? b.movements : []).filter(
                (m) => m.id !== movementId
              ),
            }
          : b
      )
    );
  }

  function removeMovementFromBlock(blockId, movementId) {
  removeMovement(blockId, movementId);
}

  function updateMovementField(blockId, movementId, field, value) {
    updatePlanBlocksForCurrentDay("Update movement", (blocks) =>
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        const movements = Array.isArray(b.movements) ? b.movements : [];
        return {
          ...b,
          movements: movements.map((m) =>
            m.id === movementId ? { ...m, [field]: value } : m
          ),
        };
      })
    );
  }


  function addTaskToBlock(blockId) {
    const newTask = { id: uid(), label: "", xpValue: 5 };

    updatePlanBlocksForCurrentDay("Add task", (blocks) =>
      blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              tasks: [...(Array.isArray(b.tasks) ? b.tasks : []), newTask],
            }
          : b
      )
    );
  }

  function removeTask(blockId, taskId) {
    updatePlanBlocksForCurrentDay("Remove task", (blocks) =>
      blocks.map((b) =>
        b.id === blockId
          ? {
              ...b,
              tasks: (Array.isArray(b.tasks) ? b.tasks : []).filter(
                (t) => t.id !== taskId
              ),
            }
          : b
      )
    );
  }

  // Alias used by the Plan page "Remove" button
  function removeTaskFromBlock(blockId, taskId) {
    removeTask(blockId, taskId);
  }

  function updateTaskField(blockId, taskId, field, value) {
    updatePlanBlocksForCurrentDay("Update task", (blocks) =>
      blocks.map((b) => {
        if (b.id !== blockId) return b;
        const tasks = Array.isArray(b.tasks) ? b.tasks : [];
        return {
          ...b,
          tasks: tasks.map((t) =>
            t.id === taskId ? { ...t, [field]: value } : t
          ),
        };
      })
    );
  }
  
async function saveLog(nextLog) {
  // Normalise what we store
  const logToStore = nextLog ? { ...nextLog } : null;

  // 1) Update in-memory state for the selected day (Log tab)
  setLogForDay(logToStore);

  // 2) Update our per-day cache so navigation feels instant
  const cacheKey = makeLogCacheKey(family?.id, activeProfileId, selectedDate);
  if (cacheKey) {
    const prev = lastLogByDateRef.current || {};
    if (logToStore) {
      lastLogByDateRef.current = { ...prev, [cacheKey]: logToStore };
    } else {
      const copy = { ...prev };
      delete copy[cacheKey];
      lastLogByDateRef.current = copy;
    }
  }

  // 3) Optimistically update the full logs collection so XP, stats and
  //    rewards all see the new data immediately (single source of truth).
  setAllLogs((prev) => {
    const existing = Array.isArray(prev) ? prev : [];
    // If we don't have the minimum identity info, just keep what we had.
    if (!family?.id || !activeProfileId || !selectedDate) return existing;

    const dayKey = selectedDate;
    const idx = existing.findIndex(
      (r) => (r?.date_ymd || r?.date) === dayKey
    );

    // If we have a log for this day, upsert it into the array.
    if (logToStore) {
      const updatedRow = { date_ymd: dayKey, log: logToStore };
      if (idx >= 0) {
        const copy = existing.slice();
        copy[idx] = updatedRow;
        return copy;
      }
      return [...existing, updatedRow];
    }

    // If the log was cleared, remove any existing row for that day.
    if (idx >= 0) {
      const copy = existing.slice();
      copy.splice(idx, 1);
      return copy;
    }

    return existing;
  });

  // 4) Persist to the database
  if (!family?.id || !activeProfileId || !selectedDate) return [];

  setIsSavingLog(true);
  try {
    const { error } = await upsertLog(
      family.id,
      activeProfileId,
      selectedDate,
      logToStore
    );
    if (error) {
      console.error("upsertLog failed", error);
      return;
    }

    // 5) Refresh logs list (used for stats + XP) so we stay in sync with DB
    const { data } = await listLogs(family.id, activeProfileId, 2000);
    const mapped = (data || []).map((r) => ({
      date_ymd: r.date_ymd,
      log: r.log_json,
    }));
    setAllLogs(mapped);
    // Keep XP in sync immediately after any log save
    setXp(computeXpFromLogs(mapped, planRef.current));
    return mapped;
  } finally {
    setIsSavingLog(false);
  }
}

function blankLogForDay() {
  const restFromPlan =
    safeNumber(plan?.restSecByWeekday?.[selectedWeekday]) || 60;

  // Plan V2: snapshot the planned blocks for this weekday.
  // This does NOT change XP or UI yet – it's just stored on the log
  // so we can later attach per-block distances, durations, etc.
  const plannedBlocks =
    plan && selectedWeekday
      ? getDayActivitiesForWeekday(
          plan || defaultPlanForFamily(),
          selectedWeekday
        ) || []
      : [];

  return {
    // Timing/session meta lives in meta.
    meta: {
      restSec: restFromPlan, // actual rest used (editable)
      sessions: [],
      dayManualMin: "", // optional override for whole day
      oneOffActivities: [],
      extraMovements: [], // per-day strength/time movements
    },
    weekday: selectedWeekday,
    typeId: dayTypeId,
    entries: {},
    tasks: {}, // tick-box tasks done for this day
    cardio: { distanceKm: "", durationMin: "", avgSpeedKmh: "" },
    custom: { durationMin: "" },
    gamify: { comboMax: 0 },

        // Plan V2: per-block snapshot for this day.
    // We now keep ID / type / label / note plus empty cardio & duration slots
    // so later we can bind UI + XP onto these.
            blocks: plannedBlocks.map((b) => ({
      id: b.id,
      typeId: b.typeId,
      label: b.label || "",
      note: b.note || "",

      // IMPORTANT: preserve cardio metadata so badge stats can identify sport
      cardioType: b.cardioType || "",
      cardioTypeOtherLabel: b.cardioTypeOtherLabel || "",
      targetText: b.targetText || "",

      recoveryMode: b.recoveryMode || "full",
      recoveryDone: false,

      cardio: {
        distanceKm: "",
        durationMin: "",
        avgSpeedKmh: "",
      },
      duration: {
        minutes: "",
      },
    })),
  };
}

function ensureBlocksSnapshot(baseLog) {
  // If we don't have a log, or no plan / weekday, just return as-is
  if (!baseLog || !plan || !selectedWeekday) return baseLog;

  const existingBlocks = Array.isArray(baseLog.blocks) ? baseLog.blocks : [];

  // Rebuild the per-block snapshot from the current plan for this weekday
  const plannedBlocks =
    getDayActivitiesForWeekday(
      plan || defaultPlanForFamily(),
      selectedWeekday
    ) || [];

  // Index existing blocks by id so we can merge
  const existingById = new Map();
  for (const b of existingBlocks) {
    if (b && b.id) {
      existingById.set(b.id, b);
    }
  }

  const mergedBlocks = [];

  // 1) Ensure every planned block has a corresponding block in the log
  for (const pb of plannedBlocks) {
    if (!pb || !pb.id) continue;

    const existing = existingById.get(pb.id);

    const baseCardio =
      existing && existing.cardio && typeof existing.cardio === "object"
        ? existing.cardio
        : {
            distanceKm: "",
            durationMin: "",
            avgSpeedKmh: "",
          };

    const baseDuration =
      existing && existing.duration && typeof existing.duration === "object"
        ? existing.duration
        : { minutes: "" };

           mergedBlocks.push({
      ...(existing || {}),
      id: pb.id,
      typeId: pb.typeId,
      label: pb.label || (existing && existing.label) || "",
      note:
        typeof pb.note === "string"
          ? pb.note
          : typeof existing?.note === "string"
          ? existing.note
          : "",

      // IMPORTANT: preserve cardio metadata for planned cardio blocks
      cardioType:
        pb.cardioType ||
        existing?.cardioType ||
        "",
      cardioTypeOtherLabel:
        pb.cardioTypeOtherLabel ||
        existing?.cardioTypeOtherLabel ||
        "",
      targetText:
        pb.targetText ||
        existing?.targetText ||
        "",

      recoveryMode:
        pb.recoveryMode ||
        existing?.recoveryMode ||
        "full",
      recoveryDone: !!existing?.recoveryDone,

      cardio: baseCardio,
      duration: baseDuration,
      movements: Array.isArray(pb.movements)
        ? pb.movements
        : existing?.movements || [],
      tasks: Array.isArray(pb.tasks) ? pb.tasks : existing?.tasks || [],
    });

    // Mark as consumed so we know what’s left over (extras)
    existingById.delete(pb.id);
  }

  // 2) Carry over any blocks that aren’t part of the plan (extras etc.)
  for (const [id, b] of existingById.entries()) {
    if (!b) continue;

    const baseCardio =
      b.cardio && typeof b.cardio === "object"
        ? b.cardio
        : { distanceKm: "", durationMin: "", avgSpeedKmh: "" };

    const baseDuration =
      b.duration && typeof b.duration === "object"
        ? b.duration
        : { minutes: "" };

    mergedBlocks.push({
      ...b,
      // This block no longer belongs to the active weekly plan.
      // Treat it as a one-day extra so it still renders in the log UI.
      isExtra: true,
      cardio: baseCardio,
      duration: baseDuration,
    });
  }

  // 3) Bridge any legacy strength entries into block-based extra blocks
  const legacyEntries =
    baseLog.entries && typeof baseLog.entries === "object"
      ? baseLog.entries
      : null;

  if (legacyEntries) {
    // Track which movementIds already have block-based sets to avoid duplicates
    const movementAlreadyCovered = new Set();
    for (const b of mergedBlocks) {
      if (!b || !b.sets || typeof b.sets !== "object") continue;
      for (const [mid, sets] of Object.entries(b.sets)) {
        if (Array.isArray(sets) && sets.some(setDidSomething)) {
          movementAlreadyCovered.add(mid);
        }
      }
    }

    for (const [mid, sets] of Object.entries(legacyEntries)) {
      if (
        !Array.isArray(sets) ||
        !sets.length ||
        !sets.some(setDidSomething) ||
        movementAlreadyCovered.has(mid)
      ) {
        continue;
      }

      // Create a one-day extra strength block for this movement
      const movement = {
        id: mid,
        name: "Legacy movement",
        mode: "strength",
        reps: "",
        trackWeight: false,
        coachNote: "",
      };

      const setsCopy = sets.map((s) => ({ ...s }));

      mergedBlocks.push({
        id: `legacy::${mid}`,
        typeId: "strength",
        isExtra: true,
        label: "",
        note: "",
        movements: [movement],
        sets: { [mid]: setsCopy },
        cardio: {
          distanceKm: "",
          durationMin: "",
          avgSpeedKmh: "",
        },
        duration: { minutes: "" },
      });
    }
  }

  return { ...baseLog, blocks: mergedBlocks };
}

// --- Per-block log helpers (Plan V2, Stage 2) ---
// Safely retrieve the log entry for a specific block on this day.
function getBlockLog(log, blockId) {
  if (!log || !blockId) return null;
  const blocks = Array.isArray(log.blocks) ? log.blocks : [];
  const found = blocks.find((b) => b && b.id === blockId);
  if (!found) return null;

  // Ensure cardio/duration objects always exist so callers can rely on them.
  const cardio =
    found.cardio && typeof found.cardio === "object"
      ? found.cardio
      : { distanceKm: "", durationMin: "", avgSpeedKmh: "" };

  const duration =
    found.duration && typeof found.duration === "object"
      ? found.duration
      : { minutes: "" };

  return {
    ...found,
    cardio,
    duration,
  };
}

// Pure helper: returns a *new* log object with the given block patched.
// Callers must then pass the result to saveLog(nextLog).
function updateBlockLog(log, blockId, patch) {
  if (!log || !blockId || !patch || typeof patch !== "object") return log;

  const blocks = Array.isArray(log.blocks) ? log.blocks : [];
  const nextBlocks = blocks.map((b) => {
    if (!b || b.id !== blockId) return b;

    const baseCardio =
      b.cardio && typeof b.cardio === "object"
        ? b.cardio
        : { distanceKm: "", durationMin: "", avgSpeedKmh: "" };

    const baseDuration =
      b.duration && typeof b.duration === "object"
        ? b.duration
        : { minutes: "" };

    const next = { ...b, ...patch };

    if (patch.cardio) {
      next.cardio = { ...baseCardio, ...patch.cardio };
    } else if (!b.cardio) {
      // Ensure shape exists even if not explicitly patched.
      next.cardio = baseCardio;
    }

    if (patch.duration) {
      next.duration = { ...baseDuration, ...patch.duration };
    } else if (!b.duration) {
      next.duration = baseDuration;
    }

    return next;
  });

  return { ...log, blocks: nextBlocks };
}
  
async function claimDailyBonus(e, anchorEl) {
  const qualifies = isDayGreen(logForDay);

  if (!qualifies) {
    window.alert(
      "Finish logging today’s plan first (fill in your sets / movements), then claim the bonus!"
    );
    return;
  }
  if (logForDay?.meta?.challengeClaimed) return;

  const rect = anchorEl ? anchorEl.getBoundingClientRect() : null;

  const xpFrom = xp;
  const xpTo = xpFrom + 15;

  // Optimistically bump XP so the UI updates immediately
  setXp(xpTo);

  playBuildUpSound();

  const next = logForDay ? { ...logForDay } : blankLogForDay();
  next.meta = { ...(next.meta || {}), challengeClaimed: true };
  const refreshedLogs = await saveLog(next);

  // Immediate XP recompute using refreshed logs (state may lag a tick)
  const logsForXp = refreshedLogs || allLogs;
  setXp(computeXpFromLogs(logsForXp, planRef.current));

  const confetti = Array.from({ length: 22 }).map((_, i) => ({
    id: i,
    x: Math.random() * 160 - 80,
    y: Math.random() * 95 - 120,
    r: Math.random() * 360,
    d: 750 + Math.random() * 520,
  }));

  setClaimModal({
    kind: "badge",
    stage: "shake",
    title: "Daily Bonus Claimed!",
    desc: "+15 XP Loot!",
    badgeKey: "daily_bonus_15",
    emoji: "🎁",
    xpAward: 15,
    xpFrom,
    xpTo,
    fromRect: rect ? { x: rect.left, y: rect.top, w: rect.width, h: rect.height } : null,
    confetti,
  });

  setTimeout(() => {
    playRewardSound();
    playSparkleSound();
    setClaimModal((prev) => (prev ? { ...prev, stage: "boom" } : prev));
  }, 260);

  setBonusPop(Date.now());
}

async function resetDay() {
  await resetSelectedDayLog();
}

  async function resetSelectedDayLog() {
  if (!(await ensureUnlocked("reset this day"))) return;

  const blank = blankLogForDay();

  // Clear our in-memory "latest log for date" cache so it can’t resurrect
  const cacheKey = makeLogCacheKey(family?.id, activeProfileId, selectedDate);
  if (cacheKey) {
    const copy = { ...(lastLogByDateRef.current || {}) };
    delete copy[cacheKey];
    lastLogByDateRef.current = copy;
  }

  // Persist the reset to Supabase
  await saveLog(blank);
}

  async function addOrUpdateSet(exId, idx, patch) {
    const ctx = await ensureAudio();
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const entries = { ...(next.entries || {}) };
    const cur = Array.isArray(entries[exId]) ? entries[exId] : [{}, {}, {}];
    const sets = [0, 1, 2].map((i) => ({ reps: "", weight: "", timeSeconds: "", count: "", notes: "", ...(cur[i] || {}) }));
    sets[idx] = { ...sets[idx], ...patch };
    entries[exId] = sets;
    next.entries = entries;
    next.gamify = { ...(next.gamify || {}), comboMax: calcComboMax(next) };
    await saveLog(next);

    if (ctx) {
      const combo = clamp((next.gamify?.comboMax || 1), 1, 10);
      playWhoosh(ctx, combo, victoryTheme);
      playBling(ctx, combo, victoryTheme);
    }
  }

  async function updateCardio(patch) {
    const ctx = await ensureAudio();
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const cardio = { ...(next.cardio || { distanceKm: "", durationMin: "", avgSpeedKmh: "" }), ...patch };
    const dist = safeNumber(cardio.distanceKm);
    const min = safeNumber(cardio.durationMin);
    const avg = min > 0 ? dist / (min / 60) : 0;
    cardio.avgSpeedKmh = avg ? avg.toFixed(2) : "";
    next.cardio = cardio;
    await saveLog(next);
    if (ctx) playBling(ctx, 1, victoryTheme);
  }

  async function updateCustom(patch) {
    const ctx = await ensureAudio();
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    next.custom = { ...(next.custom || { durationMin: "" }), ...patch };
    await saveLog(next);
    if (ctx) playBling(ctx, 1, victoryTheme);
  }

  async function toggleStreakSaver(checked) {
    // Turning ON requires the parent PIN; turning OFF is free.
    if (checked) {
      const ok = await ensureUnlocked("save streak for this day");
      if (!ok) return;
    }

    const next = logForDay ? { ...logForDay } : blankLogForDay();
    next.meta = { ...(next.meta || {}), streakSaved: checked };
    await saveLog(next);
    setLogForDay(next);
  }

async function updateCardioForBlock(blockId, cardioPatch) {
  const ctx = await ensureAudio();

  // Take a stable snapshot of today’s log (or a fresh blank one)
  const base = ensureBlocksSnapshot(
    logForDay ? { ...logForDay } : blankLogForDay()
  );

  // Find the existing block so we can merge current cardio values
  const blocks = Array.isArray(base.blocks) ? base.blocks : [];
  const existingBlock = blocks.find((b) => b && b.id === blockId);

  const baseCardio =
    existingBlock && existingBlock.cardio && typeof existingBlock.cardio === "object"
      ? existingBlock.cardio
      : { distanceKm: "", durationMin: "", avgSpeedKmh: "" };

  const mergedCardio = { ...baseCardio, ...(cardioPatch || {}) };

  const distance = safeNumber(mergedCardio.distanceKm);
  const minutes = safeNumber(mergedCardio.durationMin);

  // Only auto-calc average speed if the user hasn't explicitly set it
  if (cardioPatch.avgSpeedKmh === undefined) {
    if (distance > 0 && minutes > 0) {
      const hours = minutes / 60;
      const spd = hours > 0 ? distance / hours : 0;
      mergedCardio.avgSpeedKmh = spd ? spd.toFixed(2) : "";
    } else {
      // If either distance or time is cleared, clear the speed too
      mergedCardio.avgSpeedKmh = "";
    }
  }

  // Patch the specific block’s cardio data
  const next = updateBlockLog(base, blockId, { cardio: mergedCardio });

  // Keep the day-level cardio summary in sync for stats / summary panel
  if (Array.isArray(next.blocks) && next.blocks.length) {
    let totalKm = 0;
    let totalMin = 0;

    for (const b of next.blocks) {
      if (!b || !b.cardio) continue;
      totalKm += safeNumber(b.cardio.distanceKm);
      totalMin += safeNumber(b.cardio.durationMin);
    }

    if (totalKm > 0 || totalMin > 0) {
      const spd = totalMin > 0 ? totalKm / (totalMin / 60) : 0;
      next.cardio = {
        distanceKm: totalKm ? String(totalKm) : "",
        durationMin: totalMin ? String(totalMin) : "",
        avgSpeedKmh: spd ? spd.toFixed(2) : "",
      };
    } else {
      // Nothing logged – clear the day-level cardio summary
      next.cardio = { distanceKm: "", durationMin: "", avgSpeedKmh: "" };
    }
  }

  await saveLog(next);
  setLogForDay(next);
  if (ctx) playBling(ctx, 1, victoryTheme);
}

    async function updateDurationForBlock(blockId, durationPatch) {
    const ctx = await ensureAudio();
    const base = ensureBlocksSnapshot(
      logForDay ? { ...logForDay } : blankLogForDay()
    );

    // Patch the specific block's duration
    const next = updateBlockLog(base, blockId, { duration: durationPatch });

    // Keep legacy custom.durationMin summary in sync
    if (Array.isArray(next.blocks) && next.blocks.length) {
      let totalMin = 0;
      for (const b of next.blocks) {
        if (!b || !b.duration) continue;
        totalMin += safeNumber(b.duration.minutes);
      }
      next.custom = {
        ...(next.custom || {}),
        durationMin: totalMin ? String(totalMin) : "",
      };
    }

    await saveLog(next);
    setLogForDay(next);
    if (ctx) playBling(ctx, 1, victoryTheme);
  }

  async function toggleRecoveryForBlock(blockId, recoveryDone) {
    const ctx = await ensureAudio();
    const base = ensureBlocksSnapshot(
      logForDay ? { ...logForDay } : blankLogForDay()
    );

    const next = updateBlockLog(base, blockId, {
      recoveryDone: !!recoveryDone,
    });

    await saveLog(next);
    setLogForDay(next);

    if (ctx && recoveryDone) playBling(ctx, 1, victoryTheme);
  }  
  
async function toggleBlockCancelled(blockId, cancelled) {
  // Turning ON requires the parent PIN; turning OFF is free.
  if (cancelled) {
    const ok = await ensureUnlocked("mark this block as cancelled");
    if (!ok) return;
  }

  const base = ensureBlocksSnapshot(
    logForDay ? { ...logForDay } : blankLogForDay()
  );

  const next = updateBlockLog(base, blockId, { cancelled });
  await saveLog(next);
  setLogForDay(next);
}

  async function updateStrengthSetsForMovement(
    blockId,
    movementId,
    nextSetsForMovement
  ) {
    const ctx = await ensureAudio();

        // Start from existing log or a fresh blank one
    const baseLog = ensureBlocksSnapshot(
      logForDay ? { ...logForDay } : blankLogForDay()
    );

    // Current block log (if any)
    const blockLog = getBlockLog(baseLog, blockId) || {};
    const existingSets =
      blockLog.sets && typeof blockLog.sets === "object" ? blockLog.sets : {};

    // Normalise sets for this movement
    let normalised = Array.isArray(nextSetsForMovement)
      ? nextSetsForMovement.map((s) => ({ ...s }))
      : [];

    const nextSetsMap = {
      ...existingSets,
      [movementId]: normalised,
    };

    const nextLog = updateBlockLog(baseLog, blockId, {
      sets: nextSetsMap,
    });

    await saveLog(nextLog);
    setLogForDay(nextLog);
    if (ctx) playBling(ctx, 1, victoryTheme);
  }

  async function toggleTaskForBlock(blockId, taskId, done) {
    if (!family?.id || !activeProfileId || !selectedDate) return;

    // Start from the current log or a blank one
    const baseLog = ensureBlocksSnapshot(
      logForDay ? { ...logForDay } : blankLogForDay()
    );

    // --- 1) Update the block-level log (V3 way) ---
    const blockLog = getBlockLog(baseLog, blockId) || {};
    const currentTasks = blockLog.tasksDone || {};

    const nextTasks = { ...currentTasks };
    if (done) {
      nextTasks[taskId] = true;
    } else {
      delete nextTasks[taskId];
    }

    const nextLog = updateBlockLog(baseLog, blockId, {
      tasksDone: nextTasks,
    });

    // --- 2) Mirror into legacy log.tasks for XP + completion engine ---
    const tasksMap = { ...(nextLog.tasks || {}) };

    if (done) {
      // Mark as done; keep any existing metadata
      tasksMap[taskId] = {
        ...(tasksMap[taskId] || {}),
        done: true,
      };
    } else {
      // Remove when unticked so it doesn't count
      delete tasksMap[taskId];
    }

    nextLog.tasks = tasksMap;

    // --- 3) Persist + little reward sound ---
    await saveLog(nextLog);

    const ctx = await ensureAudio();
    if (ctx) {
      playBling(ctx, 1, victoryTheme);
    }
  }

  // ---------------- History helpers ----------------
const historyRangeDays = (r) => {
  if (r === "4w") return 28;
  if (r === "12w") return 84;
  if (r === "6m") return 183;
  return 56; // default 8w
};

const ymdMinusDays = (ymdStr, days) => {
  // ymdStr like "2026-02-13"
  const d = new Date(ymdStr + "T00:00:00");
  d.setDate(d.getDate() - days);
  return ymd(d);
};

const extractMovementSetsFromLog = (log, movementId) => {
  if (!log) return null;

  // V2 legacy
  const legacy = log?.entries?.[movementId];
  if (Array.isArray(legacy) && legacy.some(setDidSomething)) return legacy;

  // V3 blocks
  const blocks = Array.isArray(log.blocks) ? log.blocks : [];
  for (const b of blocks) {
    const setsByMovement = b?.sets && typeof b.sets === "object" ? b.sets : null;
    if (!setsByMovement) continue;
    const s = setsByMovement[movementId];
    if (Array.isArray(s) && s.some(setDidSomething)) return s;
  }
  return null;
};

const strengthPointForSets = (sets) => {
  // Return all three metrics (max per day)
  let weight = 0;
  let reps = 0;
  let timeSec = 0;

  for (const s of sets || []) {
    weight = Math.max(weight, safeNumber(s.weight));
    reps = Math.max(reps, safeNumber(s.reps));
    timeSec = Math.max(timeSec, safeNumber(s.timeSeconds));
  }

  return { weight, reps, timeSec };
};

const extractCardioFromLogByBlockId = (log, blockId) => {
  if (!log) return null;
  const blocks = Array.isArray(log.blocks) ? log.blocks : [];
  const b = blocks.find((x) => x?.id === blockId);
  if (!b || !b.cardio) return null;
  const distKm = safeNumber(b.cardio.distanceKm);
  const min = safeNumber(b.cardio.durationMin);
  if (distKm <= 0 || min <= 0) return null;
  return { distKm, min };
};

const paceMinPerKm = (distKm, min) => {
  if (distKm <= 0 || min <= 0) return null;
  return min / distKm; // numeric minutes per km
};

const extractDurationFromLogByBlockId = (log, blockId) => {
  if (!log) return null;
  const blocks = Array.isArray(log.blocks) ? log.blocks : [];
  const b = blocks.find((x) => x?.id === blockId);
  const minutes = safeNumber(b?.duration?.minutes);
  if (minutes <= 0) return null;
  return { minutes };
};

const extractTaskDoneFromLog = (log, blockId, taskId) => {
  if (!log) return false;
  const blocks = Array.isArray(log.blocks) ? log.blocks : [];
  const b = blocks.find((x) => x?.id === blockId);
  const tasksDone = b?.tasksDone && typeof b.tasksDone === "object" ? b.tasksDone : null;
  return !!tasksDone?.[taskId];
};

// Build a quick “has history?” index so we only show the pill when data exists
const historyIndex = useMemo(() => {
  const movementHas = {};
  const cardioHas = {};
  const durationHas = {};
  const taskHas = {};

  for (const row of Array.isArray(allLogs) ? allLogs : []) {
    const log = row?.log;
    if (!log) continue;

    // Strength: mark movement IDs that have any sets
    const blocks = Array.isArray(log.blocks) ? log.blocks : [];
   for (const b of blocks) {
  const setsByMovement = b?.sets && typeof b.sets === "object" ? b.sets : null;
  if (setsByMovement) {
    for (const [mid, sets] of Object.entries(setsByMovement)) {
      if (Array.isArray(sets) && sets.some(setDidSomething)) {
        movementHas[mid] = true;
      }
    }
  }

  // Cardio: mark block IDs that have cardio dist+time
  if (b?.id && b?.cardio) {
    const dist = safeNumber(b.cardio.distanceKm);
    const min = safeNumber(b.cardio.durationMin);
    if (dist > 0 && min > 0) cardioHas[b.id] = true;
  }

  // Duration: mark block IDs with duration minutes
  if (b?.id && b?.duration) {
    const mins = safeNumber(b.duration.minutes);
    if (mins > 0) durationHas[b.id] = true;
  }

  // Tasks: mark individual task IDs that have been completed
  if (b?.id && b?.tasksDone && typeof b.tasksDone === "object") {
    for (const [tid, val] of Object.entries(b.tasksDone)) {
      if (val) taskHas[`${b.id}::${tid}`] = true;
    }
  }
}

    // Legacy strength entries
    const entries = log?.entries && typeof log.entries === "object" ? log.entries : null;
    if (entries) {
      for (const [mid, sets] of Object.entries(entries)) {
        if (Array.isArray(sets) && sets.some(setDidSomething)) {
          movementHas[mid] = true;
        }
      }
    }
  }

  return { movementHas, cardioHas, durationHas, taskHas };
}, [allLogs]);

// When modal opens or range changes, rebuild chart series
useEffect(() => {
  if (!historyModal) return;

  const days = historyRangeDays(historyRange);
  const today = ymd(new Date());
  const cutoff = ymdMinusDays(today, days);

  // For most charts we only add points where data exists.
  // For task charts we add a point for EVERY day so missed days show clearly.
  const next = [];

  if (historyModal.kind === "movement") {
    for (const row of Array.isArray(allLogs) ? allLogs : []) {
      const d = row?.date_ymd || row?.date;
      if (!d || d < cutoff) continue;

      const sets = extractMovementSetsFromLog(row.log, historyModal.id);
      if (!sets) continue;

      const p = strengthPointForSets(sets);
      if ((p.weight || 0) > 0 || (p.reps || 0) > 0 || (p.timeSec || 0) > 0) {
        next.push({ x: d, weight: p.weight, reps: p.reps, timeSec: p.timeSec });
      }
    }
  }

  if (historyModal.kind === "cardio") {
    for (const row of Array.isArray(allLogs) ? allLogs : []) {
      const d = row?.date_ymd || row?.date;
      if (!d || d < cutoff) continue;

      const c = extractCardioFromLogByBlockId(row.log, historyModal.id);
      if (!c) continue;

      const distKm = c.distKm;
      const min = c.min;

      const paceKm = paceMinPerKm(distKm, min);
      const distMi = distKm * 0.621371;
      const paceMi = distMi > 0 ? (min / distMi) : null;

      const speedKmh = distKm > 0 ? (distKm / (min / 60)) : null;
      const speedMph = distMi > 0 ? (distMi / (min / 60)) : null;

      next.push({
        x: d,
        pace_km: paceKm,
        pace_mi: paceMi,
        dist_km: distKm,
        dist_mi: distMi,
        time_min: min,
        speed_kmh: speedKmh,
        speed_mph: speedMph,
      });
    }
  }

  if (historyModal.kind === "duration") {
    for (const row of Array.isArray(allLogs) ? allLogs : []) {
      const d = row?.date_ymd || row?.date;
      if (!d || d < cutoff) continue;

      const dur = extractDurationFromLogByBlockId(row.log, historyModal.id);
      if (!dur) continue;

      next.push({ x: d, minutes: dur.minutes });
    }
  }

  if (historyModal.kind === "task") {
    const [blockId, taskId] = String(historyModal.id).split("::");
    // Iterate all days in range so gaps show as 0
    let cur = cutoff;
    while (cur <= today) {
      // find that day's log row
      const row = (Array.isArray(allLogs) ? allLogs : []).find((r) => (r?.date_ymd || r?.date) === cur);
      const done = row?.log ? extractTaskDoneFromLog(row.log, blockId, taskId) : false;
      next.push({ x: cur, done: done ? 1 : 0 });
      cur = ymdAddDays(cur, 1);
    }
  }

  next.sort((a, b) => (a.x < b.x ? -1 : 1));
  setHistorySeries(next);
}, [historyModal, historyRange, allLogs]);
  
  // --- One-off activities on the Log page ---

  function getOneOffActivities(log) {
    if (!log?.meta?.oneOffActivities || !Array.isArray(log.meta.oneOffActivities)) return [];
    return log.meta.oneOffActivities;
  }

  // Extra strength/time movements logged only on this date
  function getExtraMovements(log) {
    if (!log?.meta?.extraMovements || !Array.isArray(log.meta.extraMovements)) return [];
    return log.meta.extraMovements;
  }

  async function addOneOffActivity(name, kind) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;

    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = { ...(next.meta || {}) };
    const current = Array.isArray(meta.oneOffActivities)
      ? meta.oneOffActivities.slice()
      : [];

    current.push({
      id: uid(),
      name: trimmed,
      kind: kind || "custom",
      done: false,
    });

    meta.oneOffActivities = current;
    next.meta = meta;
    await saveLog(next);
  }

async function addExtraMovementForToday(draft) {
  const name = (draft?.name || "").trim();
  if (!name) return;

  const mode = draft?.mode === "time" ? "time" : "strength";
  const repsText = (draft?.reps || "").trim();
  const coachNote = (draft?.coachNote || "").trim();
  const trackWeight = !!draft?.trackWeight;

  // Start from today’s log with a blocks snapshot
  const baseLog = ensureBlocksSnapshot(
    logForDay ? { ...logForDay } : blankLogForDay()
  );

  const existingBlocks = Array.isArray(baseLog.blocks)
    ? baseLog.blocks.slice()
    : [];

  const blockId = uid();
  const movementId = uid();

  const movement = {
    id: movementId,
    name,
    // How many sets are "planned" for the grid
    sets: 3,
    // Text target – can be reps, “30s x 8”, etc.
    reps: repsText,
    // Strength vs time flavour
    trackWeight,
    trackDuration: mode === "time",
    initialTarget: repsText,
    coachNote,
  };

  const newBlock = {
    id: blockId,
    typeId: "strength",      // stays in Strength / HIIT lane
    isExtra: true,           // flag so we know it’s one-day-only
    label: "",               // no block-level label by default
    note: "",                // you could wire a block-level note later
    movements: [movement],
    sets: {},                // sets will be filled via updateStrengthSetsForMovement
    cardio: {
      distanceKm: "",
      durationMin: "",
      avgSpeedKmh: "",
    },
    duration: {
      minutes: "",
    },
  };

  const nextLog = {
    ...baseLog,
    blocks: [...existingBlocks, newBlock],
  };

  // Optional: keep a lightweight history entry under meta.extraMovements
  const meta = { ...(nextLog.meta || {}) };
  const prevList = Array.isArray(meta.extraMovements)
    ? meta.extraMovements
    : [];
  meta.extraMovements = [
    ...prevList,
    {
      id: blockId,
      name,
      mode,
    },
  ];
  nextLog.meta = meta;

  await saveLog(nextLog);
}

async function addExtraCardioBlockForToday(draft) {
  const name = (draft?.name || "").trim();
  if (!name) return;

  const cardioType = draft?.cardioType || "run";
  const targetText = (draft?.targetText || "").trim();
  const coachNote = (draft?.coachNote || "").trim();

  const baseLog = ensureBlocksSnapshot(
    logForDay ? { ...logForDay } : blankLogForDay()
  );

  const existingBlocks = Array.isArray(baseLog.blocks)
    ? baseLog.blocks.slice()
    : [];

  const blockId = uid();

  const newBlock = {
    id: blockId,
    typeId: "cardio",
    isExtra: true,
    label: name || "Cardio block",
    note: coachNote,
    cardioType,
    cardioTypeOtherLabel: "",
    targetText,
    cardio: {
      distanceKm: "",
      durationMin: "",
      avgSpeedKmh: "",
    },
    duration: {
      minutes: "",
    },
  };

  const nextLog = {
    ...baseLog,
    blocks: [...existingBlocks, newBlock],
  };

  await saveLog(nextLog);
}

async function addExtraDurationBlockForToday(draft) {
  const name = (draft?.name || "").trim();
  if (!name) return;

  const plannedMinutes = draft?.plannedMinutes || "";
  const coachNote = (draft?.coachNote || "").trim();

  const baseLog = ensureBlocksSnapshot(
    logForDay ? { ...logForDay } : blankLogForDay()
  );

  const existingBlocks = Array.isArray(baseLog.blocks)
    ? baseLog.blocks.slice()
    : [];

  const blockId = uid();

  const newBlock = {
    id: blockId,
    typeId: "duration",
    isExtra: true,
    label: name || "Duration block",
    note: coachNote,
    plannedMinutes,
    cardio: {
      distanceKm: "",
      durationMin: "",
      avgSpeedKmh: "",
    },
    duration: {
      minutes: "",
    },
  };

  const nextLog = {
    ...baseLog,
    blocks: [...existingBlocks, newBlock],
  };

  await saveLog(nextLog);
}

async function addExtraRecoveryBlockForToday(draft) {
  const name = (draft?.name || "").trim() || "Recovery";
  const recoveryMode = draft?.recoveryMode === "light" ? "light" : "full";
  const plannedMinutes =
    draft?.plannedMinutes === "" || draft?.plannedMinutes == null
      ? ""
      : String(draft.plannedMinutes);
  const coachNote = (
    draft?.coachNote ||
    "Recovery is where adaptation happens. Muscles repair. Energy restores. Smart athletes recover well so they can push harder next session."
  ).trim();

  const baseLog = ensureBlocksSnapshot(
    logForDay ? { ...logForDay } : blankLogForDay()
  );

  const existingBlocks = Array.isArray(baseLog.blocks)
    ? baseLog.blocks.slice()
    : [];

  const newBlock = {
    id: uid(),
    typeId: "recovery",
    isExtra: true,
    label: name,
    note: coachNote,
    recoveryMode,
    recoveryDone: false,
    cardio: {
      distanceKm: "",
      durationMin: "",
      avgSpeedKmh: "",
    },
    duration: {
      minutes: "",
    },
    plannedMinutes,
  };

  const nextLog = {
    ...baseLog,
    blocks: [...existingBlocks, newBlock],
  };

  await saveLog(nextLog);
}

async function addExtraActivityBlockForToday(draft) {
  const name = (draft?.name || "").trim();
  if (!name) return;

  const rawXp = draft?.xpValue;
  const xpValue =
    rawXp === "" || rawXp === null || rawXp === undefined
      ? 0
      : Number(rawXp) || 0;
  const coachNote = (draft?.coachNote || "").trim();

  const baseLog = ensureBlocksSnapshot(
    logForDay ? { ...logForDay } : blankLogForDay()
  );

  const existingBlocks = Array.isArray(baseLog.blocks)
    ? baseLog.blocks.slice()
    : [];

  // Reuse a single extra tasks block if it already exists
  let extraTasksBlock = existingBlocks.find(
    (b) => b && b.isExtra && b.typeId === "tasks"
  );

  if (!extraTasksBlock) {
    extraTasksBlock = {
      id: uid(),
      typeId: "tasks",
      isExtra: true,
      label: "Extra activities",
      note: "",
      tasks: [],
    };
    existingBlocks.push(extraTasksBlock);
  }

  const currentTasks = Array.isArray(extraTasksBlock.tasks)
    ? extraTasksBlock.tasks.slice()
    : [];

  const taskId = uid();

  currentTasks.push({
    id: taskId,
    name,
    xpValue,
    coachNote,
  });

  const updatedBlock = {
    ...extraTasksBlock,
    tasks: currentTasks,
  };

  const nextBlocks = existingBlocks.map((b) =>
    b && b.id === updatedBlock.id ? updatedBlock : b
  );

  const nextLog = {
    ...baseLog,
    blocks: nextBlocks,
  };

  await saveLog(nextLog);
}
  
// Click handler for the "+ Add extra block" button on the Log tab
async function addExtraMovement() {
  const selectedDayHasRecovery =
    Array.isArray(logForDay?.blocks) &&
    logForDay.blocks.some((b) => b && b.typeId === "recovery");

  const addingHeavyBlock =
    extraBlockKind === "strength" || extraBlockKind === "cardio";

  if (selectedDayHasRecovery && addingHeavyBlock) {
    const proceed = window.confirm(
      "This day is marked as Recovery.\n\nAdding high intensity training may reduce recovery and impact tomorrow’s performance.\n\nContinue anyway?"
    );
    if (!proceed) return;
  }
  if (extraBlockKind === "strength") {
    const name = (extraMovNameDraft || "").trim();
    if (!name) return;

    const draft = {
      name,
      mode: extraMovModeDraft || "strength",
      reps: extraMovRepsDraft || "",
      trackWeight: extraMovTrackWeightDraft,
      coachNote: extraMovCoachNoteDraft || "",
    };

    await addExtraMovementForToday(draft);

    setExtraMovNameDraft("");
    setExtraMovModeDraft("strength");
    setExtraMovRepsDraft("");
    setExtraMovTrackWeightDraft(true);
    setExtraMovCoachNoteDraft("");
    return;
  }

  if (extraBlockKind === "cardio") {
    const name = (extraCardioNameDraft || "").trim();
    if (!name) return;

    const draft = {
      name,
      cardioType: extraCardioTypeDraft || "run",
      targetText: extraCardioTargetDraft || "",
      coachNote: extraCardioCoachNoteDraft || "",
    };

    await addExtraCardioBlockForToday(draft);

    setExtraCardioNameDraft("");
    setExtraCardioTypeDraft("run");
    setExtraCardioTargetDraft("");
    setExtraCardioCoachNoteDraft("");
    return;
  }

    if (extraBlockKind === "duration") {
    const name = (extraDurationNameDraft || "").trim();
    if (!name) return;

    const draft = {
      name,
      plannedMinutes: extraDurationMinutesDraft || "",
      coachNote: extraDurationCoachNoteDraft || "",
    };

    await addExtraDurationBlockForToday(draft);

    setExtraDurationNameDraft("");
    setExtraDurationMinutesDraft("");
    setExtraDurationCoachNoteDraft("");
    return;
  }

  if (extraBlockKind === "recovery") {
    const name = (extraRecoveryNameDraft || "").trim() || "Recovery";

    const draft = {
      name,
      recoveryMode: extraRecoveryModeDraft || "full",
      plannedMinutes: extraRecoveryMinutesDraft || "",
      coachNote: extraRecoveryCoachNoteDraft || "",
    };

    await addExtraRecoveryBlockForToday(draft);

    setExtraRecoveryNameDraft("Recovery");
    setExtraRecoveryModeDraft("full");
    setExtraRecoveryMinutesDraft("");
    setExtraRecoveryCoachNoteDraft(
      "Recovery is where adaptation happens. Muscles repair. Energy restores. Smart athletes recover well so they can push harder next session."
    );
    return;
  }

  if (extraBlockKind === "activity") {
    const name = (extraActivityNameDraft || "").trim();
    if (!name) return;

    const draft = {
      name,
      xpValue: extraActivityXpDraft,
      coachNote: extraActivityCoachNoteDraft || "",
    };

    await addExtraActivityBlockForToday(draft);

    setExtraActivityNameDraft("");
    setExtraActivityXpDraft("");
    setExtraActivityCoachNoteDraft("");
    return;
  }
}

  // Remove an extra movement block from today's log
async function removeExtraMovement(blockId) {
  const baseLog = logForDay ? { ...logForDay } : blankLogForDay();

  const blocks = Array.isArray(baseLog.blocks) ? baseLog.blocks : [];
  const nextBlocks = blocks.filter(
    (b) => !b || !b.isExtra || b.id !== blockId
  );

  const nextLog = {
    ...baseLog,
    blocks: nextBlocks,
  };

  // Keep meta.extraMovements in sync if we’re still using it
  const meta = { ...(nextLog.meta || {}) };
  if (Array.isArray(meta.extraMovements)) {
    meta.extraMovements = meta.extraMovements.filter((m) => m.id !== blockId);
  }
  nextLog.meta = meta;

  await saveLog(nextLog);
}

  async function removeOneOffActivity(id) {
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = { ...(next.meta || {}) };
    const list = Array.isArray(meta.oneOffActivities)
      ? meta.oneOffActivities.slice()
      : [];

    meta.oneOffActivities = list.filter((a) => a.id !== id);
    next.meta = meta;
    await saveLog(next);
  }
  
  async function removeOneOffActivity(id) {
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = { ...(next.meta || {}) };
    const list = Array.isArray(meta.oneOffActivities)
      ? meta.oneOffActivities.slice()
      : [];

    meta.oneOffActivities = list.filter((a) => a.id !== id);
    next.meta = meta;
    await saveLog(next);
  }

  // Promote a one-off into the weekly plan for this weekday
  async function addOneOffToWeeklyPlan(activity) {
    if (!activity?.name) return;
    if (!(await ensureUnlocked("add this activity to the weekly plan"))) return;

    const weekday = selectedWeekday;
    const basePlan = plan || defaultPlanForFamily();
    const typeId = basePlan?.dayTypeByWeekday?.[weekday] || "strength";
    const t =
      (basePlan.activityTypes || builtInTypes()).find((x) => x.id === typeId) ||
      builtInTypes()[0];

    // If this day uses movements (strength / time style), add as a new movement
    if (t.movementsEnabled) {
      const baseMovements = basePlan.movementsByWeekday?.[weekday] || [];
      const mode =
        activity.kind === "cardio"
          ? "time"
          : activity.kind === "strength"
          ? "strength"
          : activity.kind === "time"
          ? "time"
          : "custom";

      const newMov = {
        id: uid(),
        name: activity.name,
        mode,
        allowWeight: mode === "strength",
        allowCount: mode === "time",
      };

      const next = {
        ...basePlan,
        movementsByWeekday: {
          ...(basePlan.movementsByWeekday || {}),
          [weekday]: [...baseMovements, newMov],
        },
      };
      await savePlan(next);
      return;
    }

    // Otherwise, store it as an extra activity block on that day
    const byDay = { ...(basePlan.dayActivitiesByWeekday || {}) };
    const dayList = Array.isArray(byDay[weekday]) ? byDay[weekday].slice() : [];

    dayList.push({
      id: uid(),
      typeId,
      label: activity.name,
    });

    byDay[weekday] = dayList;

    const next = {
      ...basePlan,
      dayActivitiesByWeekday: byDay,
    };
    await savePlan(next);
  }

    async function updateTask(taskId, done) {
    const ctx = await ensureAudio();
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const tasks = { ...(next.tasks || {}) };
    tasks[taskId] = { ...(tasks[taskId] || {}), done };
    next.tasks = tasks;
    await saveLog(next);
    if (ctx) playBling(ctx, 1, victoryTheme);
  }

  // -------- Stats from allLogs ----------
  const stats = useMemo(() => {
  const bestByExercise = new Map(); // placeholder for later per-ex stats
  let totalSessions = 0;
  let totalStrengthVolume = 0; // here: total completed strength sets
  let bestCardioSpeed = 0;
  let bestCardioDistance = 0;
  let mostActiveDayMinutes = 0;
  let mostActiveWeekMinutes = 0;

  const weekly = new Map();
  const monthToStrength = new Map();
  const sessionDays = new Set();
  const strengthByDay = new Map();

  for (const row of allLogs) {
    const d = row.date_ymd;
    const log = row.log;
    if (!log) continue;

    const wk = weekKey(d);
    const blocks = Array.isArray(log.blocks) ? log.blocks : [];
    const w =
      weekly.get(wk) || {
        sessions: 0,
        strengthVolume: 0, // we'll treat this as "sets"
        cardioKm: 0,
        durationMin: 0,
        strengthBlocks: 0,
        cardioBlocks: 0,
        durationBlocks: 0,
        tasksBlocks: 0,
        totalMinutes: 0, // NEW: total estimated workout minutes in this week
      };

    let didAnything = false;
    let dayStrengthSets = 0;
    let dayDurationMin = 0; // NEW: cardio/duration minutes for this day

    for (const b of blocks) {
      if (!b) continue;
      const typeId = b.typeId;

      if (typeId === "strength" || typeId === "hiit" || typeId === "box") {
        const sets = countCompletedSetsInBlock(b);
        if (sets > 0) {
          didAnything = true;
          dayStrengthSets += sets;
          totalStrengthVolume += sets;
          w.strengthVolume += sets;
          w.strengthBlocks += 1;

          // Month-level strength volume
          const mk = `${d.slice(0, 7)}`; // YYYY-MM
          monthToStrength.set(mk, (monthToStrength.get(mk) || 0) + sets);
        }
      } else if (typeId === "cardio") {
        const c = b.cardio || {};
        const km = safeNumber(c.distanceKm);
        const min = safeNumber(c.durationMin);

        if (km > 0 || min > 0) {
          didAnything = true;
          if (km > 0) {
            w.cardioKm += km;
            bestCardioDistance = Math.max(bestCardioDistance, km);
          }
          if (km > 0 && min > 0) {
            const spd = km / (min / 60);
            bestCardioSpeed = Math.max(bestCardioSpeed, spd);
          }
          if (min > 0) {
            w.durationMin += min;
            dayDurationMin += min;
          }
          w.cardioBlocks += 1;
        }
      } else if (typeId === "duration") {
        const mins = safeNumber(b?.duration?.minutes);
        if (mins > 0) {
          didAnything = true;
          w.durationMin += mins;
          w.durationBlocks += 1;
          dayDurationMin += mins;
        }
      } else if (typeId === "tasks") {
        const done = b.tasksDone || {};
        const anyTasks = Object.values(done).some(Boolean);
        if (anyTasks) {
          didAnything = true;
          w.tasksBlocks += 1;
        }
      } else {
        // ignore other types for now
      }
    }

    if (dayStrengthSets > 0) {
      strengthByDay.set(d, (strengthByDay.get(d) || 0) + dayStrengthSets);
    }

    if (didAnything) {
      totalSessions += 1;
      w.sessions += 1;
      sessionDays.add(d);
    }

    // Estimate total minutes for this day:
    // - Strength sets → minutes via simple heuristic
    // - Plus any logged cardio/duration minutes
    let dayMinutes = 0;
    const restSec =
      safeNumber(log?.meta?.restSec) || 60; // default 60s between sets
    const workPerSetMin = 0.5; // rough 30s work per set

    if (dayStrengthSets > 0) {
      const estStrengthMin =
        dayStrengthSets * workPerSetMin +
        Math.max(0, dayStrengthSets - 1) * (restSec / 60);
      dayMinutes += estStrengthMin;
    }

    dayMinutes += dayDurationMin;

    if (dayMinutes > 0) {
      if (dayMinutes > mostActiveDayMinutes) {
        mostActiveDayMinutes = dayMinutes;
      }
      w.totalMinutes += dayMinutes;
    }

    weekly.set(wk, w);
  }

  // Most active week: max totalMinutes across all weeks
  for (const [, v] of weekly.entries()) {
    const wkMin = v.totalMinutes || 0;
    if (wkMin > mostActiveWeekMinutes) {
      mostActiveWeekMinutes = wkMin;
    }
  }

    // Longest daily activity streak (all-time),
  // counting any real activity OR an explicit streak saver.
  const streakDays = new Set(sessionDays);
  for (const row of allLogs) {
    const d = row.date_ymd || row.date;
    const log = row.log;
    if (!d || !log) continue;
    if (log.meta && log.meta.streakSaved) {
      streakDays.add(d);
    }
  }

  let longestActivityStreak = 0;
  if (streakDays.size) {
    const ordered = Array.from(streakDays).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0
    );
    let prev = null;
    let run = 0;
    for (const d of ordered) {
      if (!prev) {
        run = 1;
      } else {
        const prevDate = new Date(prev + "T00:00:00");
        prevDate.setDate(prevDate.getDate() + 1);
        const expect = ymd(prevDate);
        run = d === expect ? run + 1 : 1;
      }
      if (run > longestActivityStreak) longestActivityStreak = run;
      prev = d;
    }
  }
    
  const weeklyChart = Array.from(weekly.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .slice(-16)
    .map(([wk, v]) => ({
      week: wk,
      strengthVolume: Math.round(v.strengthVolume),
      cardioKm: Number((v.cardioKm || 0).toFixed(2)),
      sessions: v.sessions,
    }));

  // improved this month vs last (strength volume)
  const now = new Date();
  const thisMk = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, "0")}`;
  const last = new Date(now);
  last.setMonth(now.getMonth() - 1);
  const lastMk = `${last.getFullYear()}-${String(
    last.getMonth() + 1
  ).padStart(2, "0")}`;
  const thisVol = monthToStrength.get(thisMk) || 0;
  const lastVol = monthToStrength.get(lastMk) || 0;
    const improved =
    lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null;

  // Plan-based streak (same as the Plan Streak tile, includes streak saver)
  const streak = getCurrentPlanStreak(allLogs, todayYmd);

  return {
    totalMinutes: "",
    totalSessions,
    totalStrengthVolume,
    bestCardioSpeed,
    bestCardioDistance,
    weeklyChart,
    streak,
    longestActivityStreak,
    improved,
    // fields we’ll adjust in the next section
    mostActiveDayMinutes,
    mostActiveWeekMinutes,
    bestByExercise,
  };
}, [allLogs, todayYmd]);

  const exerciseOptions = useMemo(() => {
    // collect movement ids + names from plan movements
    const map = new Map();
    const mv = plan?.movementsByWeekday || {};
    Object.values(mv).flat().forEach((m) => map.set(m.id, m));
    return Array.from(map.values());
  }, [plan]);

  const [selectedExerciseForChart, setSelectedExerciseForChart] = useState("");

  useEffect(() => {
    if (!selectedExerciseForChart && exerciseOptions.length) setSelectedExerciseForChart(exerciseOptions[0].id);
  }, [exerciseOptions, selectedExerciseForChart]);

  const exerciseProgress = useMemo(() => {
    const exId = selectedExerciseForChart;
    if (!exId) return [];
    const pts = [];
    for (const row of allLogs) {
      const d = row.date_ymd;
      const log = row.log;
      const sets = log?.entries?.[exId] || [];
      if (!sets.length) continue;
      let bestVol = 0, bestReps = 0, bestTime = 0;
      for (const s of sets) {
        bestReps = Math.max(bestReps, safeNumber(s.reps));
        bestTime = Math.max(bestTime, safeNumber(s.timeSeconds));
        const vol = safeNumber(s.weight) > 0 ? safeNumber(s.reps) * safeNumber(s.weight) : safeNumber(s.reps);
        bestVol = Math.max(bestVol, vol);
      }
      if (bestVol || bestReps || bestTime) pts.push({ date: d, bestVol: Math.round(bestVol), bestReps, bestTime });
    }
    return pts.slice(-60);
  }, [allLogs, selectedExerciseForChart]);


const cardioProgress = useMemo(() => {
  const pts = [];
  for (const row of allLogs) {
    const d = row.date_ymd;
    const log = row.log;
    if (!log) continue;

    let totalKm = 0;
    let totalMin = 0;

    // Prefer per-block cardio
    if (Array.isArray(log.blocks) && log.blocks.length) {
      for (const b of log.blocks) {
        if (!b || b.typeId !== "cardio" || !b.cardio) continue;
        totalKm += safeNumber(b.cardio.distanceKm);
        totalMin += safeNumber(b.cardio.durationMin);
      }
    }

    // Legacy fallback
    if (totalKm <= 0 || totalMin <= 0) {
      const km = safeNumber(log?.cardio?.distanceKm);
      const min = safeNumber(log?.cardio?.durationMin);
      totalKm = km;
      totalMin = min;
    }

    if (totalKm <= 0 || totalMin <= 0) continue;

    const spd = totalKm / (totalMin / 60);
    pts.push({
      date: d,
      km: Number(totalKm.toFixed(2)),
      speed: Number(spd.toFixed(2)),
    });
  }
  return pts.slice(-60);
}, [allLogs]);

    // --- Status dot for the currently selected day on the Log tab ---
  const selectedDayDotColor =
    selectedDayStatus === "green"
      ? "var(--good, #2ecc71)"
      : selectedDayStatus === "amber"
      ? "var(--warn, #f39c12)"
      : "var(--muted, #9aa0a6)";

  const selectedDayTitle = (() => {
    if (selectedDayStatus === "green") {
      return selectedDate === todayYmd
        ? "Today: plan completed"
        : "Plan completed on this day";
    }
    if (selectedDayStatus === "amber") {
      return selectedDate === todayYmd
        ? "Today: plan not completed yet"
        : "Plan started but not complete";
    }
    return selectedDate === todayYmd
      ? "Today: no activity logged"
      : "No activity logged on this day";
  })();

  
  const motivationMessages = useMemo(() => {
  // Slot 1 dot colour
  const dotColor =
    todayPlanStatus === "green"
      ? "var(--good, #2ecc71)"
      : todayPlanStatus === "amber"
      ? "var(--warn, #f39c12)"
      : "var(--muted, #9aa0a6)";

  const slot1 = (
    <div className="motBlock motStreak" key="streak">
      <div className="rowBetween">
        <div className="motTitle">Plan Streak</div>
        <div
          title={
            todayPlanStatus === "green"
              ? "Today: completed"
              : "Today: not completed yet"
          }
          style={{
            width: 14,
            height: 14,
            borderRadius: 999,
            background: dotColor,
            flex: "0 0 auto",
            boxShadow: "0 0 0 3px rgba(0,0,0,0.08)",
          }}
        />
      </div>

      <div className="motStreakRow">
        <div className="motStreakNum">{currentPlanStreak}</div>
        <div className="motStreakUnit">
          day{currentPlanStreak === 1 ? "" : "s"}
        </div>
      </div>
    </div>
  );

  const slot2 = (
    <span key={`mot-${motivationKey}`} className="motFade">
      {motivationLine}
    </span>
  );

  const slot3 = (
    <span key={`health-${healthKey}`} className="motFade">
      {healthTip}
    </span>
  );

  return [slot1, slot2, slot3];
}, [
  todayPlanStatus,
  currentPlanStreak,
  motivationLine,
  healthTip,
  motivationKey,
  healthKey,
]);

  if (!sessionReady) return <div className="page"><div className="wrap">
      {ENABLE_SW_TOAST && showSwToast && !swToastDismissed ? (
        <div className="sw-toast" role="status">
          <div className="sw-toast__inner">
            <div className="sw-toast__text">✨ Update available. Refresh to get the latest version.</div>
            <div className="sw-toast__actions">
              <button className="sw-toast__btn" onClick={dismissSwToast}>Later</button>
              <button className="sw-toast__btn sw-toast__btn--primary" onClick={applySwUpdate}>Refresh</button>
            </div>
          </div>
        </div>
      ) : null}

<div className="muted">Loading…</div></div><StyleTag/></div>;
  if (!authed) return <AuthScreen onAuthed={() => setAuthed(true)} />;

  return (
    <div className="page">
      <div className="wrap">
        <header className="header">
  <div className="brandRow">
    <div className="brandLockup">
      <img className="brandMark" src="/icons/icon-192.png" alt="Workout Tracker" />
      <div className="brandText">
        <div className="brandTitle">Workout Tracker</div>
        <div className="brandTag">Build Strength. Build Habits.</div>
      </div>
    </div>

    <div className="brandActions">
      <button type="button" className="iconBtn" onClick={() => setTab("settings")} aria-label="Settings">
        <span className="iconEmoji">⚙️</span>
      </button>

      <button type="button" className="iconBtn" onClick={doSignOut} aria-label="Sign out">
        <svg className="iconSvg" viewBox="0 0 24 24" fill="none">
          <path d="M10 7V6a2 2 0 0 1 2-2h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-7a2 2 0 0 1-2-2v-1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="M3 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          <path d="m6 9-3 3 3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  </div>

  <div className="headerBottom">
    <h1 className="title">
  <span className="titleRow">
    <span className="avatarChip" aria-hidden="true">
    {headerAvatarImg ? (
      <img
        src={headerAvatarImg}
        alt={headerAvatarEmoji}
        style={{ width: 24, height: 24, objectFit: "contain" }}
      />
    ) : (
      headerAvatarEmoji
    )}
  </span>
    <span>{activeProfile?.name || "Profile"}</span>
  </span>
</h1>

    <div className="header-right">
      <div className="selectWide">
        <Select
          value={activeProfileId}
          onChange={handleProfileChange}
          options={profiles.map((p) => ({ value: p.id, label: p.name }))}
        />
      </div>

      <div className="tabsRow">
        <div className="tabs">
          {["log", "stats", "plan", "rewards"].map((t) => (
            <SecondaryButton key={t} onClick={() => setTab(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </SecondaryButton>
          ))}
        </div>
      </div>
    </div>
  </div>
</header>



        <Card className="pad motivator">
          <div className="motGrid">
            {motivationMessages.map((m, i) => (
              <div key={i} className="motItem">{m}</div>
            ))}
          </div>
        </Card>



        {tab === "log" && (
          <div className="gridLog" key={`${activeProfileId}_${selectedDate}`}>
            <Card className="pad">
              <div className="row logTopRow">
                <div className="rowLeft">
                  <div className="field">
                    <div className="label">Date</div>
                    <input
  type="date"
  value={selectedDate}
  onChange={(e) => setSelectedDate(e.target.value)}
  onKeyDown={(e) => {
    if (
      e.key === "ArrowUp" ||
      e.key === "ArrowDown" ||
      e.key === "PageUp" ||
      e.key === "PageDown"
    ) {
      e.preventDefault();
    }
  }}
  className="input"
/>
                  </div>
                </div>

                                  <div className="rowRight logTopActions">
    <div
      className="dayStatusDot"
      title={selectedDayTitle}
      style={{ background: selectedDayDotColor }}
    />
    {isSavingLog && (
      <div className="syncStatus">
        <span className="syncDot" />
        <span className="syncText">Saving…</span>
      </div>
    )}
    <SecondaryButton
      onClick={resetDay}
      disabled={isSavingLog}
    >
      Reset day
    </SecondaryButton>
  </div>
                </div>

                               {/* --- V3 block-based logging panels --- */}

                {/* Strength / HIIT / Box blocks log */}
                {hasAnyStrengthBlocks && (
                  <div className="panel mt16">
                    <div className="h2">Strength / HIIT log</div>

                    {allStrengthBlocksForDay.map((block) => {
                      const blockLog = getBlockLog(logForDay, block.id) || {};
                      const isCancelled = !!blockLog.cancelled;
                      const setsByMovement =
                        blockLog.sets && typeof blockLog.sets === "object"
                          ? blockLog.sets
                          : {};

                      const movements = Array.isArray(block.movements)
                        ? block.movements
                        : [];

                      const restSec = safeNumber(block.restSec) || 60;

                      // Count completed sets for estimated time
                      let totalCompletedSets = 0;
                      for (const mov of movements) {
                        const ms = Array.isArray(setsByMovement[mov.id])
                          ? setsByMovement[mov.id]
                          : [];
                        totalCompletedSets += ms.filter(setDidSomething).length;
                      }

                      const estimatedMinutes =
                        totalCompletedSets > 0
                          ? Math.round(
                              (totalCompletedSets * restSec * 2) / 60
                            )
                          : 0;

                      const actualMinutes =
                        blockLog.duration && blockLog.duration.minutes != null
                          ? blockLog.duration.minutes
                          : "";

                      return (
  <div key={block.id} className="mt12">
    <div className="row between" style={{ alignItems: "center" }}>
      {block.label ? (
        <div
          className="h3"
          style={{ opacity: isCancelled ? 1 : 0.7 }}
        >
          {block.label}
        </div>
      ) : (
        <div className="h3 muted" style={{ opacity: isCancelled ? 1 : 0.7 }}>
          Untitled block
        </div>
      )}

      <label
        className="mini"
        style={{
          opacity: isCancelled ? 1 : 0.5,
        }}
        title="Mark this block as cancelled when it was impossible to do (e.g. weather, cancelled match). It won’t block your streak."
      >
        <input
          type="checkbox"
          checked={isCancelled}
          onChange={(e) => toggleBlockCancelled(block.id, e.target.checked)}
        />
        <span>Cancelled</span>
      </label>
    </div>

    {block.note ? (
      <div className="muted mt4">{block.note}</div>
    ) : null}

                          {block.isExtra && (
                            <div className="row space mt4">
                              <div className="muted mini">
                                One-day extra movement
                              </div>
                              <SecondaryButton
                                className="btnSmall"
                                onClick={() => removeExtraMovement(block.id)}
                              >
                                Remove
                              </SecondaryButton>
                            </div>
                          )}

                          {/* Movements grid */}
                          {block.movements.map((planMov) => {
                            const mov = planMov;
                            const movementSets = Array.isArray(
                              setsByMovement[mov.id]
                            )
                              ? setsByMovement[mov.id]
                              : [];

                            // Number of rows:
// - planned sets for normal blocks
// - minimum 1 row for extra one-off blocks
// - plus any user-added sets
const basePlannedSets = block.isExtra ? 1 : (mov.sets || 3);
const rowCount = Math.max(
  basePlannedSets,
  movementSets.length || 0
);

                            const rows = [];

// --- Target logic for this movement ---
const lastSets = findLastMovementSets(
  allLogs,
  mov.id,
  ymd(selectedDate)
);

const targetInfo = buildTargetInfoForMovement({
  movement: mov,
  lastSets,
  plannedRepsText: mov.reps,
});

                            for (let i = 0; i < rowCount; i++) {
                              const set = movementSets[i] || {};
                              const baseSet = {
                                reps: "",
                                weight: "",
                                timeSeconds: "",
                                ...set,
                              };

                              const didSomething =
                                !!baseSet.reps ||
                                !!baseSet.weight ||
                                !!baseSet.timeSeconds;

                              const rowClass = didSomething
                                ? "mt12 setRowSimple setRowSimple-complete"
                                : "mt12 setRowSimple";

                              rows.push(
                                <div key={i} className={rowClass}>
                                  {/* Set title – OUTSIDE any input box */}
                                  <div className="setLabel">
                                    Set {i + 1}
                                  </div>

                                  {/* Inputs grid */}
                                  <div className="grid3 mt4">
                                    <div>
                                      <div className="label">Reps</div>
                                      <Input
                                        type="number"
                                        min={0}
                                        value={
                                          baseSet.reps != null
                                            ? baseSet.reps
                                            : ""
                                        }
                                        onChange={(v) => {
                                          const nextSets = [...movementSets];
                                          nextSets[i] = {
                                            ...baseSet,
                                            reps: v,
                                          };
                                          updateStrengthSetsForMovement(
                                            block.id,
                                            mov.id,
                                            nextSets
                                          );
                                        }}
                                      />
                                    </div>

                                    {mov.trackWeight && (
                                      <div>
                                        <div className="label">
                                          Weight (kg)
                                        </div>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={
                                            baseSet.weight != null
                                              ? baseSet.weight
                                              : ""
                                          }
                                          onChange={(v) => {
                                            const nextSets = [...movementSets];
                                            nextSets[i] = {
                                              ...baseSet,
                                              weight: v,
                                            };
                                            updateStrengthSetsForMovement(
                                              block.id,
                                              mov.id,
                                              nextSets
                                            );
                                          }}
                                        />
                                      </div>
                                    )}

                                    {mov.trackDuration && (
                                      <div>
                                        <div className="label">
                                          Time (sec)
                                        </div>
                                        <Input
                                          type="number"
                                          min={0}
                                          value={
                                            baseSet.timeSeconds != null
                                              ? baseSet.timeSeconds
                                              : ""
                                          }
                                          onChange={(v) => {
                                            const nextSets = [...movementSets];
                                            nextSets[i] = {
                                              ...baseSet,
                                              timeSeconds: v,
                                            };
                                            updateStrengthSetsForMovement(
                                              block.id,
                                              mov.id,
                                              nextSets
                                            );
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            }

                            return (
                              <div key={mov.id} className="mt12">
                               <div className="movementHeader">
  <div className="movementHeaderTop">
    <div className="movementName">{mov.name}</div>

    {historyIndex?.movementHas?.[mov.id] && (
      <button
        type="button"
        className="historyPill"
        onClick={() => {
          setHistoryRange("8w");
          setHistoryModal({ kind: "movement", id: mov.id, title: mov.name });
        }}
      >
        History
      </button>
    )}
  </div>
                                  {mov.coachNote ? (
                                    <div className="movementCoachNote">
                                      {mov.coachNote}
                                    </div>
                                  ) : null}
                                  <div className="movementTarget">
                                    {targetInfo?.text ||
                                      "Log once to generate targets."}
                                  </div>
                                </div>

                                {rows}

<div className="mt8 row gap8">
  <SecondaryButton
    onClick={() => {
      const existing = Array.isArray(setsByMovement[mov.id])
        ? setsByMovement[mov.id]
        : [];
      let nextSets;
      // For extra one-day strength blocks, if no sets are stored yet,
      // create two rows at once so the first tap visibly adds a new row.
      if (block.isExtra && existing.length === 0) {
        nextSets = [
          {
            reps: "",
            weight: "",
            timeSeconds: "",
          },
          {
            reps: "",
            weight: "",
            timeSeconds: "",
          },
        ];
      } else {
        nextSets = [
          ...existing,
          {
            reps: "",
            weight: "",
            timeSeconds: "",
          },
        ];
      }
      updateStrengthSetsForMovement(
        block.id,
        mov.id,
        nextSets
      );
    }}
  >
    + Add set
  </SecondaryButton>
  {Array.isArray(setsByMovement[mov.id]) &&
  setsByMovement[mov.id].length > basePlannedSets && (
    <SecondaryButton
      className="btnSmall"
      onClick={() => {
        const existing = Array.isArray(setsByMovement[mov.id])
          ? setsByMovement[mov.id]
          : [];
        if (!existing.length) return;
        const nextSets = existing.slice(0, existing.length - 1);
        updateStrengthSetsForMovement(
          block.id,
          mov.id,
          nextSets
        );
      }}
    >
      Remove last set
    </SecondaryButton>
  )}
</div>
                                <div className="movementDivider" />
                              </div>
                            );    
                          })}

{/* estimated and actual time block for strength */}
                                                              <div className="muted mini mt8">
                            Estimated time:{" "}
                            {estimatedMinutes > 0
                              ? `${estimatedMinutes} min`
                              : "0 min (log some sets)"}{" "}
                            • Rest per set: {restSec}s
                          </div>

                          <div className="mt8" style={{ maxWidth: 180 }}>
                            <div className="label">
                              Actual minutes (optional)
                            </div>
                            <Input
                              type="number"
                              min={0}
                              step={0.5}
                              value={actualMinutes}
                              onChange={(v) =>
                                updateDurationForBlock(block.id, {
                                  minutes: v,
                                })
                              }
                              placeholder={
                                estimatedMinutes > 0
                                  ? String(estimatedMinutes)
                                  : ""
                              }
                            />
                          </div>
    
                        </div>
                      );
                    })}
                  </div>
                )}
              
{/* Cardio blocks log */}
{hasAnyCardioBlocks && (
  <div className="panel mt16">
    <div className="h2">Cardio log</div>

    {allCardioBlocksForDay.map((block) => {
      const blockLog = getBlockLog(logForDay, block.id) || {};
      const isCancelled = !!blockLog.cancelled;
      const cardio =
        (blockLog && blockLog.cardio) || {
          distanceKm: "",
          durationMin: "",
          avgSpeedKmh: "",
        };
      const label =
        block.label ||
        (block.typeId === "run"
          ? "Run block"
          : block.typeId === "swim"
          ? "Swim block"
          : "Cardio block");

      const distKm = safeNumber(cardio.distanceKm);
      const timeMin = safeNumber(cardio.durationMin);

      let avgSpeedKmh = 0;
      if (distKm > 0 && timeMin > 0) {
        // derive avg speed from distance + time
        avgSpeedKmh = distKm / (timeMin / 60);
      } else {
        // fallback to stored avgSpeed if present
        avgSpeedKmh = safeNumber(cardio.avgSpeedKmh);
      }

      const paceFromSpeed = getPaceFromSpeedKmh(avgSpeedKmh);

      return (
        <div key={block.id} className="mt12">
          <div className="rowBetween">
  <div className="h3">{label}</div>

  {historyIndex?.cardioHas?.[block.id] && (
    <button
      type="button"
      className="historyPill"
      onClick={() => {
        setHistoryRange("12w");
        setHistoryModal({ kind: "cardio", id: block.id, title: label });
      }}
    >
      History
    </button>
  )}
</div>
          {block.note ? (
            <div className="muted mt4">{block.note}</div>
          ) : null}

          {/* Cancelled toggle */}
    <div className="row between mt4">
      <div className="muted small">
        {isCancelled ? "Marked as cancelled – won’t block your streak." : "\u00A0"}
      </div>
      <label
        className="mini"
        style={{
          opacity: isCancelled ? 1 : 0.5,
        }}
        title="Mark this block as cancelled when it was impossible to do (e.g. weather, cancelled match). It won’t block your streak."
      >
        <input
          type="checkbox"
          checked={isCancelled}
          onChange={(e) => toggleBlockCancelled(block.id, e.target.checked)}
        />
        <span>Cancelled</span>
      </label>
    </div>

          {block.isExtra && (
            <div className="row space mt4">
              <div className="muted mini">One-day extra cardio</div>
              <SecondaryButton
                className="btnSmall"
                onClick={() => removeExtraMovement(block.id)}
              >
                Remove
              </SecondaryButton>
            </div>
          )}
            <div className="grid3 mt8">
  <div>
    <div className="label">Distance (km)</div>
    <input
  className="input"
  type="number"
  min={0}
  step={0.01}
  value={cardio.distanceKm ?? ""}
  onChange={(e) =>
    updateCardioForBlock(block.id, {
      distanceKm: e.target.value,
    })
  }
  placeholder="e.g. 2.50"
/>
  </div>

  <div>
    <div className="label">Time (minutes)</div>
    <input
  className="input"
  type="number"
  min={0}
  step={0.5}
  value={cardio.durationMin ?? ""}
  onChange={(e) =>
    updateCardioForBlock(block.id, {
      durationMin: e.target.value,
    })
  }
  placeholder="e.g. 14.5"
/>
  </div>

      <div>
    <div className="label">Average speeds:</div>
    <div className="muted mt4">
      <div>{avgSpeedKmh ? `${avgSpeedKmh.toFixed(2)} km/h` : "— km/h"}</div>
      <div>
        {avgSpeedKmh
          ? `${(avgSpeedKmh * 0.621371).toFixed(2)} mph`
          : "— mph"}
      </div>
      <div className="muted mt4">
        {paceFromSpeed?.perKm
          ? `Average time per km: ${paceFromSpeed.perKm}`
          : "Average time per km: —"}
      </div>
      <div className="muted mt4">
        {paceFromSpeed?.perMile
          ? `Average time per mile: ${paceFromSpeed.perMile}`
          : "Average time per mile: —"}
      </div>
    </div>
  </div>
</div>
          </div>
        );
      })}
  </div>
)}

{/* Recovery blocks log */}
{hasAnyRecoveryBlocks && (
  <div className="panel mt16">
    <div className="h2">Recovery log</div>

    {allRecoveryBlocksForDay.map((block) => {
      const blockLog = getBlockLog(logForDay, block.id) || {};
      const isCancelled = !!blockLog.cancelled;
      const recoveryDone = !!blockLog.recoveryDone;
      const label = block.label || "Recovery block";

      return (
        <div key={block.id} className="mt12">
          <div className="rowBetween">
  <div className="h3">{label}</div>

  {block.isExtra && (
    <div className="row space">
      <div className="muted mini">One-day extra recovery</div>
      <SecondaryButton
        className="btnSmall"
        onClick={() => removeExtraMovement(block.id)}
      >
        Remove
      </SecondaryButton>
    </div>
  )}
</div>

          {block.note ? (
            <div className="muted mt4">{block.note}</div>
          ) : null}

          <div className="row between mt4">
            <div className="muted small">
              {recoveryDone
                ? "Recovery respected today."
                : "Tick when recovery was genuinely respected today."}
            </div>
            <label
              className="mini"
              style={{ opacity: isCancelled ? 0.5 : 1 }}
              title="Mark recovery complete when the day was genuinely used for recovery."
            >
              <input
                type="checkbox"
                checked={recoveryDone}
                disabled={isCancelled}
                onChange={(e) =>
                  toggleRecoveryForBlock(block.id, e.target.checked)
                }
              />
              <span>Recovery respected</span>
            </label>
          </div>

          <div className="muted mt8">
            Full recovery: complete rest or very light movement.
            Light recovery: walking, mobility, stretching, easy cycling.
          </div>

          {recoveryDone && selectedDate === (selectedDate || "") && recoveryEligibilityForSelectedDate && (
            <div className="muted mt8">
              {recoveryEligibilityForSelectedDate.qualifies
                ? "Eligible recovery day: counts as intelligent recovery."
                : "Recovery logged, but this one does not qualify for streak protection yet."}
            </div>
          )}
        </div>
      );
    })}
  </div>
)}
              
{/* Duration blocks log */}
{hasAnyDurationBlocks && (
  <div className="panel mt16">
    <div className="h2">Duration log</div>

    {allDurationBlocksForDay.map((block) => {
      const blockLog = getBlockLog(logForDay, block.id) || {};
      const isCancelled = !!blockLog.cancelled;
      const duration =
        (blockLog && blockLog.duration) || {
          minutes: "",
        };
      const label = block.label || "Duration block";

      return (
          <div key={block.id} className="mt12">
            <div className="rowBetween">
  <div className="h3">{label}</div>

  {historyIndex?.durationHas?.[block.id] && (
    <button
      type="button"
      className="historyPill"
      onClick={() => {
        setHistoryRange("12w");
        setHistoryModal({ kind: "duration", id: block.id, title: label });
      }}
    >
      History
    </button>
  )}
</div>
            {block.note ? (
              <div className="muted mt4">{block.note}</div>
            ) : null}

            {/* Cancelled toggle */}
    <div className="row between mt4">
      <div className="muted small">
        {isCancelled ? "Marked as cancelled – won’t block your streak." : "\u00A0"}
      </div>
      <label
        className="mini"
        style={{
          opacity: isCancelled ? 1 : 0.5,
        }}
        title="Mark this block as cancelled when it was impossible to do (e.g. weather, cancelled match). It won’t block your streak."
      >
        <input
          type="checkbox"
          checked={isCancelled}
          onChange={(e) => toggleBlockCancelled(block.id, e.target.checked)}
        />
        <span>Cancelled</span>
      </label>
    </div>

            {block.isExtra && (
              <div className="row space mt4">
                <div className="muted mini">One-day extra duration</div>
                <SecondaryButton
                  className="btnSmall"
                  onClick={() => removeExtraMovement(block.id)}
                >
                  Remove
                </SecondaryButton>
              </div>
            )}

<div className="grid3 mt8">
  <div>
    <div className="label">Minutes</div>
    <input
  className="input"
  type="number"
  min={0}
  step={0.5}
  value={duration.minutes ?? ""}
  onChange={(e) =>
    updateDurationForBlock(block.id, {
      minutes: e.target.value,
    })
  }
  placeholder="e.g. 30"
/>
  </div>
</div>
          </div>
        );
      })}

    <div className="muted mt8">
      Good for Pilates, yoga, mobility, etc.
    </div>
  </div>
)}

{/* Tasks blocks log */}
{hasAnyTasksBlocks && (
  <div className="panel mt16">
    <div className="h2">Tasks log</div>

    {allTasksBlocksForDay.map((block) => {
      const blockLog = getBlockLog(logForDay, block.id) || {};
      const tasksDone = blockLog.tasksDone || {};
      const label = block.label || "Tasks block";
      const tasks = Array.isArray(block.tasks) ? block.tasks : [];

      return (
        <div key={block.id} className="mt12">
          <div className="h3">{label}</div>
          {block.note ? (
            <div className="muted mt4">{block.note}</div>
          ) : null}

          {block.isExtra && (
            <div className="row space mt4">
              <div className="muted mini">One-day extra activity</div>
              <SecondaryButton
                className="btnSmall"
                onClick={() => removeExtraMovement(block.id)}
              >
                Remove
              </SecondaryButton>
            </div>
          )}

          {tasks.length === 0 ? (
            <div className="muted mt4">
              No tasks configured for this block yet.
            </div>
          ) : (
            <div className="stack mt8">
              {tasks.map((t) => {
                const done = !!tasksDone[t.id];

                return (
                  <label key={t.id} className="check">
                    <input
                      type="checkbox"
                      checked={done}
                      onChange={(e) =>
                        toggleTaskForBlock(
                          block.id,
                          t.id,
                          e.target.checked
                        )
                      }
                    />
                    <div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <span>
  {t.label || t.name || "Untitled task"}
</span>

{historyIndex?.taskHas?.[`${block.id}::${t.id}`] && (
  <button
    type="button"
    className="historyPill"
    onClick={() => {
      setHistoryRange("12w");
      setHistoryModal({
        kind: "task",
        id: `${block.id}::${t.id}`,
        title: t.label || t.name || "Task history",
      });
    }}
  >
    History
  </button>
)}
                        {typeof t.xpValue === "number" &&
                        t.xpValue > 0 ? (
                          <span
                            className="muted mini"
                            style={{
                              padding: "2px 8px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            {t.xpValue} XP
                          </span>
                        ) : null}
                      </div>

                      {t.coachNote ? (
                        <div
                          className="muted mt4"
                          style={{
                            fontWeight: 400,
                            marginTop: 4,
                          }}
                        >
                          {t.coachNote}
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      );
    })}
  </div>
)}
              
{/* Extra movements + One-off activities (legacy, still useful) */}
<div className="stack mt16">
  {recoveryRecommendationToday?.recommended && !selectedDayHasRecoveryBlock && (
  <div className="panel readinessBanner">
    <div className="h2">⚡ Recovery Recommended Today</div>
    <div className="muted mt8">
  {bodyReadiness.recommendationText}
</div>

<div className="muted mt8">
  Forecast by next session: {bodyReadiness.projectedTrainingReadinessScore}/100 —{" "}
  {bodyReadiness.projectedBand.label}
</div>
    <div className="muted mt8">
      Readiness {recoveryRecommendationToday.trainingReadinessScore}/100 — {recoveryRecommendationToday.band.label}
      {" "}• {recoveryRecommendationToday.consecutiveTrainingBefore} consecutive training day
      {recoveryRecommendationToday.consecutiveTrainingBefore === 1 ? "" : "s"}
      {" "}• recent load {recoveryRecommendationToday.weightedLoad.totalLoad}
    </div>
    <div className="mt8">
      <PrimaryButton
        onClick={async () => {
          await addExtraRecoveryBlockForToday({
            name: "Recovery",
            recoveryMode: "full",
            plannedMinutes: "",
            coachNote:
              "Recovery is where adaptation happens. Muscles repair. Energy restores. Smart athletes recover well so they can push harder next session.",
          });
        }}
      >
        + Add Recovery Block
      </PrimaryButton>
    </div>
  </div>
)}

{/* Extra blocks for this specific date */}
<div className="panel">
  <div className="h2">Extra block for today</div>
    <div className="muted mt4">
    Add a one-day-only Strength, Cardio, Duration or Recovery block that shows in today&apos;s log
    but doesn&apos;t change the weekly plan. Use Cardio for anything with distance + time
    (runs, cycles, walks, swims, rows). Use Duration for movement where you only want
    to record minutes (no distance). Use Recovery for an unplanned rest or light recovery day.
  </div>

  <button
    type="button"
    className="btn secondary mt8"
    onClick={() => setShowExtraBlockForm((v) => !v)}
  >
    {showExtraBlockForm ? "Hide extra block form" : "+ Extra block for today"}
  </button>

  {showExtraBlockForm && (
    <>
  {/* Block type selector */}
  <div className="row mt8">
    <div style={{ minWidth: 220 }}>
      <div className="label">Block type</div>
      <Select
        value={extraBlockKind}
        onChange={setExtraBlockKind}
        options={[
          { value: "strength", label: "Strength / HIIT / Box" },
          { value: "cardio", label: "Cardio (run / cycle / walk / swim / row)" },
          { value: "duration", label: "Duration (minutes only)" },
          { value: "recovery", label: "Recovery" },
          { value: "activity", label: "Activity / task" },
        ]}
      />
    </div>
  </div>

  {/* Strength extra form */}
  {extraBlockKind === "strength" && (
    <>
      <div className="row mt8">
        <div style={{ flex: 1 }}>
          <div className="label">Name</div>
          <Input
            value={extraMovNameDraft}
            onChange={setExtraMovNameDraft}
            placeholder="e.g. Extra push-ups"
          />
        </div>
        <div style={{ width: 8 }} />
        <div style={{ minWidth: 180 }}>
          <div className="label">Mode</div>
          <Select
            value={extraMovModeDraft}
            onChange={setExtraMovModeDraft}
            options={[
              { value: "strength", label: "Strength (reps + weight)" },
              { value: "time", label: "Timed (seconds + count)" },
            ]}
          />
        </div>
      </div>

      <div className="row mt8">
        <div style={{ flex: 1 }}>
          <div className="label">Target (reps / duration)</div>
          <Input
            value={extraMovRepsDraft}
            onChange={setExtraMovRepsDraft}
            placeholder="e.g. 3 x 10, or 30s x 8"
          />
        </div>
        <div style={{ width: 8 }} />
        <label className="checkbox mt24">
          <input
            type="checkbox"
            checked={extraMovTrackWeightDraft}
            onChange={(e) => setExtraMovTrackWeightDraft(e.target.checked)}
          />
          <span className="ml4">Track weight</span>
        </label>
      </div>

      <div className="mt8">
        <div className="label">Coach note (optional)</div>
        <Textarea
          value={extraMovCoachNoteDraft}
          onChange={setExtraMovCoachNoteDraft}
          placeholder="Any cues or notes for this extra movement..."
        />
      </div>
    </>
  )}

  {/* Cardio extra form */}
  {extraBlockKind === "cardio" && (
    <>
            <div className="row mt8">
        <div style={{ flex: 1 }}>
          <div className="label">Name</div>
          <Input
            value={extraCardioNameDraft}
            onChange={setExtraCardioNameDraft}
            placeholder="e.g. Extra run / walk"
          />
        </div>
        <div style={{ width: 8 }} />
        <div style={{ minWidth: 180 }}>
          <div className="label">Cardio type</div>
          <Select
            value={extraCardioTypeDraft}
            onChange={setExtraCardioTypeDraft}
            options={[
              { value: "run", label: "Run" },
              { value: "cycle", label: "Cycle" },
              { value: "walk", label: "Walk" },
              { value: "swim", label: "Swim" },
              { value: "row", label: "Row" },
              { value: "other", label: "Other" },
            ]}
          />
        </div>
      </div>

      <div className="mt8">
        <div className="label">Target (optional)</div>
        <Input
          value={extraCardioTargetDraft}
          onChange={setExtraCardioTargetDraft}
          placeholder='e.g. "2 km easy"'
        />
      </div>

      <div className="mt8">
        <div className="label">Coach note (optional)</div>
        <Textarea
          value={extraCardioCoachNoteDraft}
          onChange={setExtraCardioCoachNoteDraft}
          placeholder="Any cues or notes for this extra cardio block..."
        />
      </div>
    </>
  )}

  {/* Duration extra form */}
  {extraBlockKind === "duration" && (
    <>
      <div className="row mt8">
        <div style={{ flex: 1 }}>
          <div className="label">Name</div>
          <Input
            value={extraDurationNameDraft}
            onChange={setExtraDurationNameDraft}
            placeholder="e.g. Extra yoga session"
          />
        </div>
      </div>

      <div className="row mt8">
        <div style={{ maxWidth: 180 }}>
          <div className="label">Target minutes (optional)</div>
          <Input
            type="number"
            min={0}
            step={0.5}
            value={extraDurationMinutesDraft}
            onChange={setExtraDurationMinutesDraft}
            placeholder="e.g. 20"
          />
        </div>
      </div>

      <div className="mt8">
        <div className="label">Coach note (optional)</div>
        <Textarea
          value={extraDurationCoachNoteDraft}
          onChange={setExtraDurationCoachNoteDraft}
          placeholder="Any cues or notes for this duration block..."
        />
      </div>
    </>
  )}

    {/* Recovery extra form */}
  {extraBlockKind === "recovery" && (
    <>
      <div className="row mt8">
        <div style={{ flex: 1 }}>
          <div className="label">Name</div>
          <Input
            value={extraRecoveryNameDraft}
            onChange={setExtraRecoveryNameDraft}
            placeholder="e.g. Recovery"
          />
        </div>
        <div style={{ width: 8 }} />
        <div style={{ minWidth: 180 }}>
          <div className="label">Recovery type</div>
          <Select
            value={extraRecoveryModeDraft}
            onChange={setExtraRecoveryModeDraft}
            options={[
              { value: "full", label: "Full recovery" },
              { value: "light", label: "Light recovery" },
            ]}
          />
        </div>
      </div>

      <div className="row mt8">
        <div style={{ flex: 1 }}>
          <div className="label">Planned minutes (optional)</div>
          <Input
            type="number"
            min={0}
            value={extraRecoveryMinutesDraft}
            onChange={setExtraRecoveryMinutesDraft}
            placeholder="e.g. 20"
          />
        </div>
      </div>

      <div className="mt8">
        <div className="label">Coach note</div>
        <Textarea
          value={extraRecoveryCoachNoteDraft}
          onChange={setExtraRecoveryCoachNoteDraft}
          placeholder="Recovery guidance..."
        />
      </div>

      <div className="muted mt8">
        Use this for an unplanned recovery day when fatigue, soreness, workload or body signals suggest backing off is the smart choice.
      </div>
    </>
  )}

  {extraBlockKind === "activity" && (
  <>
    <div className="row mt8">
      <div style={{ flex: 1 }}>
        <div className="label">Activity name</div>
        <Input
          value={extraActivityNameDraft}
          onChange={setExtraActivityNameDraft}
          placeholder="e.g. Extra PE lesson, bonus walk"
        />
      </div>
    </div>

    <div className="row mt8">
      <div style={{ maxWidth: 160 }}>
        <div className="label">XP (optional)</div>
        <Input
          type="number"
          min={0}
          step={5}
          value={extraActivityXpDraft}
          onChange={setExtraActivityXpDraft}
          placeholder="e.g. 20"
        />
      </div>
    </div>

    <div className="mt8">
      <div className="label">Coach note (optional)</div>
      <Textarea
        value={extraActivityCoachNoteDraft}
        onChange={setExtraActivityCoachNoteDraft}
        placeholder="Any notes or context for this activity..."
      />
    </div>
  </>
)}

  <PrimaryButton className="mt8" onClick={addExtraMovement}>
    + Add extra block
  </PrimaryButton>
</>
  )}
                </div>
              </div> 
            </Card>

            <div className="stack">
              <Card className="pad">
                <div className="rowBetween">
                  <div className="h3">Today summary</div>
                  <Pill>Lvl {level} • XP {xp}</Pill>
                </div>

                <div className="grid2 mt12">
                  <SummaryStat label="Total minutes" value={computeTotalMinutesForDay(logForDay) ?? "—"} />
                  <SummaryStat
  label="Sets logged"
  value={countSetsLoggedInLog(logForDay) || 0}
/>
                    <SummaryStat
    label="Cardio km"
    value={
      (() => {
        const km = computeCardioKmForDay(logForDay);
        return km != null ? km.toFixed(2) : "—";
      })()
    }
  />
                </div>

                <div className="mini mt12">
                <div className="label">Estimated calories</div>
<div className="big">
  {(() => {
    const kcal = estimateCalories({
      bodyWeightKg: activeProfile?.body_weight_kg,
      log: logForDay,
    });
    return kcal === null
      ? "Record activity or Add bodyweight in Settings"
      : `${kcal} kcal`;
  })()}
</div>
                  <div className="muted">Estimate only.</div>
                </div>
              </Card>
              
  <Card className="pad bodyReadinessCard">
  <div className="rowBetween">
    <div className="h3">Body Readiness Status</div>
    <Pill>{bodyReadiness.band.label}</Pill>
  </div>

  <div className={`readinessHero readiness-${bodyReadiness.band.tone} mt12`}>
    <div className="readinessScoreSolo">
      {bodyReadiness.trainingReadinessScore}
    </div>

    <div className="readinessScaleWrap mt12">
      <div className="readinessScaleLegend">
        <span>Low</span>
        <span>Reduced</span>
        <span>Moderate</span>
        <span>High</span>
        <span>Prime</span>
      </div>

      <div className="readinessScaleBand">
        <div
  className="readinessMarker"
  style={{ left: `${bodyReadiness.trainingReadinessScalePercent}%` }}
  title={`Current: ${bodyReadiness.trainingReadinessScore}`}
/>
<div
  className="readinessMarker readinessMarkerForecast"
  style={{ left: `${bodyReadiness.projectedTrainingReadinessScalePercent}%` }}
  title={`Forecast: ${bodyReadiness.projectedTrainingReadinessScore}`}
/>
      </div>
    </div>

    <div className="muted mt12">
  {bodyReadiness.recommendationText}
</div>

<div className="muted mt8">
  Forecast by next session (rest + normal sleep):{" "}
  <b>
    {bodyReadiness.projectedTrainingReadinessScore}/100 —{" "}
    {bodyReadiness.projectedBand.label}
  </b>
  {" "}in ~{bodyReadiness.expectedNextSessionHoursAhead}h (expected next session).
</div>

<div className="readinessTimelineWrap mt8">
  <div className="readinessTimelineBars">
    {(bodyReadiness.readinessTimeline48h || []).map((point) => (
      <div
        key={point.hour}
        className={[
          "readinessTimelineBar",
          `readinessTimelineBar-${point.band.tone}`,
          point.sleeping ? "isSleep" : "",
          point.isExpectedNextSession ? "isNextSession" : "",
        ].join(" ")}
        style={{ height: `${Math.max(10, point.score)}px` }}
        title={`+${point.hour}h • ${point.score}/100 • ${point.band.label}${point.sleeping ? " • Sleep" : ""}${point.isExpectedNextSession ? " • Next expected session" : ""}`}
      />
    ))}
  </div>

  <div className="readinessTimelineAxis">
    <span>Now</span>
    <span>24h</span>
    <span>48h</span>
  </div>
</div>

<div className="muted mt8">
  Forecast uses recent load, projected recovery by hour, assumed sleep, and the expected time of the next session.
</div>
  </div>

  <div className="readinessMetricsGrid mt16">
    <div className="readinessMetricCard">
      <div className="readinessMetricTitle">Muscle Readiness</div>
      <div className="readinessGauge">
        <svg viewBox="0 0 120 70" className="readinessGaugeSvg">
          <path
            d="M 15 55 A 45 45 0 0 1 105 55"
            className="readinessGaugeTrack"
          />
          <path
            d="M 15 55 A 45 45 0 0 1 105 55"
            className="readinessGaugeFill"
            style={{
              strokeDasharray: `${bodyReadiness.muscleReadiness * 1.42} 999`,
            }}
          />
        </svg>
        <div className="readinessGaugeValue">{bodyReadiness.muscleReadiness}%</div>
      </div>
    </div>

    <div className="readinessMetricCard">
      <div className="readinessMetricTitle">Nervous System Readiness</div>
      <div className="readinessGauge">
        <svg viewBox="0 0 120 70" className="readinessGaugeSvg">
          <path
            d="M 15 55 A 45 45 0 0 1 105 55"
            className="readinessGaugeTrack"
          />
          <path
            d="M 15 55 A 45 45 0 0 1 105 55"
            className="readinessGaugeFill"
            style={{
              strokeDasharray: `${bodyReadiness.nervousSystemReadiness * 1.42} 999`,
            }}
          />
        </svg>
        <div className="readinessGaugeValue">
          {bodyReadiness.nervousSystemReadiness}%
        </div>
      </div>
    </div>

    <div className="readinessMetricCard">
      <div className="readinessMetricTitle">Body Energy</div>
      <div className="readinessGauge">
        <svg viewBox="0 0 120 70" className="readinessGaugeSvg">
          <path
            d="M 15 55 A 45 45 0 0 1 105 55"
            className="readinessGaugeTrack"
          />
          <path
            d="M 15 55 A 45 45 0 0 1 105 55"
            className="readinessGaugeFill"
            style={{
              strokeDasharray: `${bodyReadiness.bodyEnergy * 1.42} 999`,
            }}
          />
        </svg>
        <div className="readinessGaugeValue">{bodyReadiness.bodyEnergy}%</div>
      </div>
    </div>
  </div>

  <div className="mt16">
    <SecondaryButton
      onClick={() => setShowBodyReadinessExplain((v) => !v)}
    >
      {showBodyReadinessExplain ? "Hide explanation" : "What do these mean?"}
    </SecondaryButton>
  </div>

  {showBodyReadinessExplain && (
    <div className="panel mt12">
      <div className="h3">How Body Readiness works</div>

      <div className="mt8">
        <b>Training Readiness Score</b>
        <div className="muted mt4">
          A combined estimate of how ready the body looks for productive
training right now. The system also forecasts likely next-session
readiness if the user now rests and gets normal sleep until around
the same time tomorrow.
        </div>
      </div>

      <div className="mt8">
        <b>Muscle Readiness</b>
        <div className="muted mt4">
          Estimated from recent strength, HIIT and other muscular load.
          Low suggests the muscles may still be carrying fatigue.
        </div>
      </div>

      <div className="mt8">
        <b>Nervous System Readiness</b>
        <div className="muted mt4">
          Estimated from hard-session clustering and repeated intensity.
          Low suggests sharpness and output quality may be suppressed.
        </div>
      </div>

      <div className="mt8">
        <b>Body Energy</b>
        <div className="muted mt4">
          Estimated from recent cardio, total workload and general recovery.
          Low suggests the body may benefit from reduced load or recovery.
        </div>
      </div>

      <div className="mt8">
        <b>Score guide</b>
        <div className="muted mt4">
          Low = red, Reduced = amber, Moderate = green, High = blue, Prime = purple.
        </div>
      </div>
    </div>
  )}
</Card>
                            <Card className="pad">
                <div className="h3">Today’s mission</div>
                <div className="stack mt12">
                  {planDay.kind === "strength" || planDay.kind === "time" ? (
                    (planDay.movements || []).map((ex) => {
                      const lastSets = findLastMovementSets(allLogs, ex.id, ymd(selectedDate));
                      const lastTxt = summarizeStrengthSets(lastSets);
                      const initialTarget = { text: ex.targetText || null, reps: ex.targetReps || null, weight: ex.targetWeight || null };
                      const t = suggestStrengthTarget({ ex, lastSets, initialTarget, ageGroup: activeProfile?.age_group || "under16" });
                      return (
                        <div key={ex.id} className="mini">
                          <div className="label">{ex.name}</div>
                          <div className="muted">Last: {lastTxt}</div>
                          <div><b>Target:</b> {t.text}</div>
                        </div>
                      );
                    })
                  ) : planDay.kind === "cardio" ? (
  (() => {
    const last = findLastCardio(allLogs, ymd(selectedDate));
    const lastTxt = summarizeCardio(last);
    const t = suggestCardioTarget({ lastCardio: last });

    const intervalHint =
      plan?.cardioTargetByWeekday?.[selectedWeekday] ||
      plan?.runSettings?.[selectedWeekday]?.text ||
      "";

    // Derive smartwatch-style pace from the target speed, if we have one
    const pace =
      t && t.targetSpeedKmh ? getPaceFromSpeedKmh(t.targetSpeedKmh) : null;

    return (
      <div className="mini">
        <div className="label">Cardio</div>
        <div className="muted">Last: {lastTxt}</div>

        <div>
          <b>Target:</b> {t.text}
        </div>

        {pace ? (
          <div className="muted mt4">
            Smartwatch target: ~{pace.perKm} /km or {pace.perMile} /mile
          </div>
        ) : null}

        {intervalHint ? (
          <div className="muted mt8">{intervalHint}</div>
        ) : null}
      </div>
    );
  })()
) : (
                    <div className="muted">Log your session and keep your streak alive.</div>
                  )}
                      {plannedBlocksForSelectedDay.length > 0 && (
      <div className="muted">
        <b>Planned blocks:</b>{" "}
        {plannedBlocksForSelectedDay
          .map((b, idx) => {
            const allTypes = plan?.activityTypes || builtInTypes();
            const typeName =
              allTypes.find((t) => t.id === b.typeId)?.name || "Activity";

            if (b.label && b.label.trim()) {
              return b.label.trim();
            }

            // Fallbacks when there’s no custom label
            if (idx === 0) return typeName;        // primary block
            return `${typeName} ${idx + 1}`;       // extra blocks
          })
          .join(" · ")}
      </div>
    )}

                </div>
              </Card>

<Card className="pad">
                <div className="h3">Mini challenges</div>
                <div className="stack mt12">
                  <div className="challenge">
  <div>
    Daily Bonus <span className="muted">(+15 XP)</span>
  </div>
  <div className="row" style={{ gap: 10 }}>
    {logForDay?.meta?.challengeClaimed ? (
      <div className="pill">Claimed</div>
    ) : (
      <button
        type="button"
        className={"btn " + (isDayGreen(logForDay) ? "" : "btnDisabled")}
        disabled={!isDayGreen(logForDay)}
        onClick={(e) => claimDailyBonus(e, e.currentTarget)}
      >
        Claim
      </button>
    )}
  </div>
</div>
                  <Challenge text="Complete today’s plan" done={isDayGreen(logForDay)} />
                  <Challenge text="Hit a combo streak (5 sets in a row)" done={(logForDay?.gamify?.comboMax || 0) >= 5} />
                  <Challenge text="XP to next level" done={xpToNext <= 25} />
                  {bonusPop ? <div key={bonusPop} className="confettiBurst" aria-hidden="true" /> : null}
                </div>
              </Card>

              <Card className="pad mt12">
  <div className="h3">Streak saver</div>
  <div className="muted small">
    Use this only if the planned activity was genuinely impossible (e.g. weather, cancelled match) 
    but an equivalent extra movement was done. It will keep your streak for this day.
  </div>

  <div className="row mt8" style={{ alignItems: "center", justifyContent: "space-between" }}>
    <label
      className="check"
      style={{
        opacity: logForDay?.meta?.streakSaved ? 1 : 0.6,
        fontSize: 12,
      }}
      title="Tap to save today’s streak when the plan couldn’t happen, but you did a replacement movement."
    >
      <input
        type="checkbox"
        checked={!!logForDay?.meta?.streakSaved}
        onChange={(e) => toggleStreakSaver(e.target.checked)}
      />
      <span className={logForDay?.meta?.streakSaved ? "" : "muted"}>
        Save streak (PIN)
      </span>
    </label>
  </div>
</Card>
              
            </div>
          </div>
        )}

        {tab === "stats" && (
          <div className="grid2cols">
            <Card className="pad">
              <div className="h2">Highlights</div>
              <div className="grid2 mt12">
                <SummaryStat label="Streak" value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`} />
<SummaryStat
  label="Most active day"
  value={
    stats.mostActiveDayMinutes
      ? `${Math.round(stats.mostActiveDayMinutes)} min`
      : "—"
  }
/>
<SummaryStat
  label="Most active week"
  value={
    stats.mostActiveWeekMinutes
      ? `${Math.round(stats.mostActiveWeekMinutes)} min`
      : "—"
  }
/>
                <SummaryStat label="Best cardio speed" value={stats.bestCardioSpeed ? `${stats.bestCardioSpeed.toFixed(2)} km/h` : "—"} />
                <SummaryStat label="Best cardio distance" value={stats.bestCardioDistance ? `${stats.bestCardioDistance.toFixed(2)} km` : "—"} />
              </div>

              <div className="mt16">
                <div className="h3">Most improved this month</div>
                <div className="mt8">{stats.improved === null ? "Log sessions across two months to see improvement." : `${stats.improved}% vs last month (strength volume)`}</div>
              </div>
              <div className="mt16">
  <div className="h3">Records</div>
  <div className="mini muted mt4">
    All-time bests for this profile.
  </div>
  <div className="stack mt8 mini">
    <div>
      🏆 <b>Most XP in a day</b>:{" "}
      {records.bestXpValue
        ? `${records.bestXpValue} XP on ${records.bestXpDay}`
        : "—"}
    </div>
    <div>
      🥇 <b>Longest set streak</b>:{" "}
      {records.longestCombo
        ? `${records.longestCombo} sets (best combo day)`
        : "—"}
    </div>
    <div>
      🥈 <b>Longest daily activity streak</b>:{" "}
      {stats.longestActivityStreak
        ? `${stats.longestActivityStreak} days`
        : "—"}
    </div>
    <div>
      🥉 <b>Fastest average speed</b>:{" "}
      {stats.bestCardioSpeed
        ? `${stats.bestCardioSpeed.toFixed(2)} km/h`
        : "—"}
    </div>
    <div>
      📈 <b>Biggest improvement</b>:{" "}
      <span className="muted">
        per-exercise improvement badges are coming later.
      </span>
    </div>
  </div>
</div>

            </Card>

            <Card className="pad">
              <div ref={chartsRef} />
              <div className="h2">Weekly chart</div>
              <div className="chart mt12">
                {stats.weeklyChart.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={stats.weeklyChart} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="strengthVolume" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="cardioKm" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="muted">No chart data yet.</div>
                )}
              </div>

              <div className="mt16 rowBetween">
                <div className="h2">Exercise progress</div>
                <div className="selectWide">
                  <Select value={selectedExerciseForChart} onChange={setSelectedExerciseForChart} options={exerciseOptions.map((e) => ({ value: e.id, label: e.name }))} />
                </div>
              </div>

              <div className="chart mt12">
                {exerciseProgress.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={exerciseProgress} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="bestVol" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="bestReps" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="bestTime" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="muted">Log this exercise to see progress.</div>
                )}
              </div>

              <div className="mt16">
                <div className="h2">Cardio progress</div>
                <div className="chart mt12">
                  {cardioProgress.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={cardioProgress} margin={{ top: 10, right: 20, bottom: 0, left: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="km" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="speed" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="muted">Log a few cardio days to see the chart.</div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

{tab === "plan" && (
  <div className="gridPlan">
    {/* LEFT COLUMN: Day selector + inline blocks */}
    <Card className="pad planSide" ref={planRef}>
      <div className="h2">Edit day blocks</div>
      <div className="muted mt8">
        Select a weekday, then add or edit blocks. A day has no type — it’s
        just an ordered list of blocks.
      </div>

      <div className="weekPills mt12">
        {weekdays.map((d) => (
          <button
            key={d}
            className={"weekPill " + (planWeekday === d ? "active" : "")}
            onClick={() => setPlanWeekday(d)}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="row mt16" style={{ alignItems: "center", gap: 8 }}>
        <div className="muted" style={{ flex: 1 }}>
          Blocks are the only unit of planning. Everything you log later will
          belong to one of these blocks.
        </div>
        <div className="pillToggle">
          <button
            className={
              "pillToggleBtn " + (planViewMode === "edit" ? "active" : "")
            }
            onClick={() => setPlanViewMode("edit")}
          >
            Edit view
          </button>
          <button
            className={
              "pillToggleBtn " + (planViewMode === "clean" ? "active" : "")
            }
            onClick={() => setPlanViewMode("clean")}
          >
            Clean view
          </button>
        </div>
      </div>

      <div className="mt16 stack">
        {blocksForSelectedPlanDay.length === 0 && (
          <div className="muted">
            No blocks yet for {planWeekday}. Add a strength, cardio, duration,
recovery, or tasks block below.
          </div>
        )}

        {blocksForSelectedPlanDay.map((block, idx) => {
          const typeId = block.typeId || "strength";

          if (planViewMode === "clean") {
            // Compact summary
            return (
              <div key={block.id} className="panel mt8">
                <div className="row between">
                  <div className="pill">
                    {typeId === "strength" && "Strength / HIIT"}
                    {typeId === "hiit" && "HIIT"}
                    {typeId === "box" && "Boxercise"}
                    {typeId === "cardio" && "Cardio"}
                    {typeId === "duration" && "Duration"}
                    {typeId === "recovery" && "Recovery"}
                    {typeId === "tasks" && "Tasks"}
                  </div>
                  <SecondaryButton
                    className="btnSmall"
                    onClick={() => removeBlockFromDay(block.id)}
                  >
                    Remove
                  </SecondaryButton>
                </div>
                <div className="mt8">
                  <b>{block.label || "(no name yet)"}</b>
                </div>
                {block.note && (
                  <div className="muted mt4">
                    {block.note.length > 120
                      ? block.note.slice(0, 120) + "…"
                      : block.note}
                  </div>
                )}
              </div>
            );
          }

          // EDIT VIEW
          return (
            <div key={block.id} className="panel mt12">
              <div className="row between">
                <div className="pillRow">
                  <span className="pill">
                    {typeId === "strength" && "Strength / HIIT"}
                    {typeId === "hiit" && "HIIT"}
                    {typeId === "box" && "Boxercise"}
                    {typeId === "cardio" && "Cardio"}
                    {typeId === "duration" && "Duration"}
                    {typeId === "recovery" && "Recovery"}
                    {typeId === "tasks" && "Tasks"}
                  </span>
                  {typeId === "strength" || typeId === "hiit" || typeId === "box" ? (
                    <Select
                      className="ml8"
                      value={typeId}
                      onChange={(v) =>
                        updateBlockInDay(block.id, () => ({ typeId: v }))
                      }
                      options={[
                        { value: "strength", label: "Strength" },
                        { value: "hiit", label: "HIIT" },
                        { value: "box", label: "Boxercise" },
                      ]}
                    />
                  ) : null}
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button
                    className="btnSmall"
                    type="button"
                    onClick={() => moveBlockInDay(block.id, -1)}
                  >
                    ↑
                  </button>
                  <button
                    className="btnSmall"
                    type="button"
                    onClick={() => moveBlockInDay(block.id, +1)}
                  >
                    ↓
                  </button>
                  <button
                    className="btnSmall"
                    type="button"
                    onClick={() => {
                      setCopyDialog((prev) =>
                        prev && prev.blockId === block.id
                          ? null
                          : { blockId: block.id, days: [] }
                      );
                    }}
                  >
                    Copy
                  </button>
                  <SecondaryButton
                    className="btnSmall"
                    onClick={() => removeBlockFromDay(block.id)}
                  >
                    Remove
                  </SecondaryButton>
                </div>
              </div>

              {copyDialog && copyDialog.blockId === block.id && (
                <div className="mt8">
                  <div className="label">Copy this block to days</div>
                  <div
                    className="row"
                    style={{ flexWrap: "wrap", gap: 6, marginTop: 4 }}
                  >
                    {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map(
                      (day) => {
                        const selected =
                          copyDialog.days &&
                          copyDialog.days.includes(day);
                        return (
                          <button
                            key={day}
                            type="button"
                            className="pill"
                            style={{
                              opacity: selected ? 1 : 0.6,
                              fontWeight: selected ? 600 : 400,
                            }}
                            onClick={() => toggleCopyDialogDay(day)}
                          >
                            {day} {selected ? "✓" : ""}
                          </button>
                        );
                      }
                    )}
                  </div>
                  <div className="row mt8" style={{ gap: 8 }}>
                    <PrimaryButton
                      className="btnSmall"
                      disabled={
                        !copyDialog.days || copyDialog.days.length === 0
                      }
                      onClick={async () => {
                        if (
                          !copyDialog.days ||
                          copyDialog.days.length === 0
                        )
                          return;
                        await duplicateBlockToOtherWeekdays(
                          block.id,
                          copyDialog.days
                        );
                        setCopyDialog(null);
                      }}
                    >
                      Copy
                    </PrimaryButton>
                    <SecondaryButton
                      className="btnSmall"
                      onClick={() => setCopyDialog(null)}
                    >
                      Cancel
                    </SecondaryButton>
                  </div>
                </div>
              )}
              
              {/* Common: name + coach  note */}
              <div className="mt12">
                <div className="label">Name</div>
                <Input
                  value={block.label || ""}
                  onChange={(v) =>
                    updateBlockInDay(block.id, () => ({ label: v }))
                  }
                  placeholder={
                    typeId === "cardio"
                      ? "e.g. Easy run"
                      : typeId === "duration"
                      ? "e.g. Yoga flow"
                      : typeId === "tasks"
                      ? "e.g. Recovery tasks"
                      : "e.g. Upper body"
                  }
                />
              </div>

              <div className="mt8">
                <div className="label">Coach note</div>
                <Textarea
                  value={block.note || ""}
                  onChange={(v) =>
                    updateBlockInDay(block.id, () => ({ note: v }))
                  }
                  placeholder="Optional notes, cues, or reminders…"
                />
              </div>

              {/* Type-specific config */}
              {(typeId === "strength" ||
                typeId === "hiit" ||
                typeId === "box") && (
                <>
                  <div className="mt12">
                    <div className="label">Rest between sets (seconds)</div>
                    <Input
                      type="number"
                      min={0}
                      step={5}
                      value={
                        typeof block.restSec === "number"
                          ? block.restSec
                          : 60
                      }
                      onChange={(v) =>
                        updateBlockInDay(block.id, () => ({
                          restSec: safeNumber(v) ?? 60,
                        }))
                      }
                    />
                  </div>

                  <div className="mt12">
                    <div className="row between">
                      <div className="label">Movements</div>
                      <SecondaryButton
                        className="btnSmall"
                        onClick={() => addMovementToBlock(block.id)}
                      >
                        + Add movement
                      </SecondaryButton>
                    </div>

                    {block.movements && block.movements.length > 0 ? (
                      <div className="stack mt8">
                        {block.movements.map((m, idx) => (
                          <React.Fragment key={m.id}>
                            <div className="movementRow">
                              <div className="row">
                                <div className="field flex1">
  <div className="label">Movement</div>
  <Input
    value={m.name || ""}
    onChange={(v) =>
      updateMovementField(
        block.id,
        m.id,
        "name",
        v
      )
    }
    placeholder="e.g. Squats"
  />
</div>
                                <div className="field w120">
                                  <div className="label">Sets</div>
                                  <Input
                                    type="number"
                                    min={1}
                                    max={20}
                                    value={m.sets || 3}
                                    onChange={(v) =>
                                      updateMovementField(
                                        block.id,
                                        m.id,
                                        "sets",
                                        safeNumber(v) || 1
                                      )
                                    }
                                  />
                                </div>
                                <div className="field w120">
                                  <div className="label">Reps / duration</div>
                                  <Input
                                    value={m.reps || ""}
                                    onChange={(v) =>
                                      updateMovementField(
                                        block.id,
                                        m.id,
                                        "reps",
                                        v
                                      )
                                    }
                                    placeholder="e.g. 10–12 or 30s"
                                  />
                                </div>
                              </div>
                              <div className="row mt4 movementRowBottom">
                                <label className="checkboxLabel">
                                  <input
                                    type="checkbox"
                                    checked={!!m.trackWeight}
                                    onChange={(e) =>
                                      updateMovementField(
                                        block.id,
                                        m.id,
                                        "trackWeight",
                                        e.target.checked
                                      )
                                    }
                                  />
                                  Track weight
                                </label>
                                <label className="checkboxLabel ml12">
                                  <input
                                    type="checkbox"
                                    checked={!!m.trackDuration}
                                    onChange={(e) =>
                                      updateMovementField(
                                        block.id,
                                        m.id,
                                        "trackDuration",
                                        e.target.checked
                                      )
                                    }
                                  />
                                  Track duration
                                </label>

                                <SecondaryButton
                                  className="btnTiny mlAuto"
                                  onClick={() =>
                                    removeMovementFromBlock(block.id, m.id)
                                  }
                                >
                                  Remove movement
                                </SecondaryButton>
                              </div>
                                        <div className="mt4">
            <div className="label">Coach note (optional)</div>
            <Textarea
              rows={2}
              value={m.coachNote || ""}
              onChange={(v) =>
                updateMovementField(block.id, m.id, "coachNote", v)
              }
              placeholder="Coaching notes or reminders for this movement"
            />
          </div>
                            </div>

                            {/* Divider between movements */}
                            {idx < (block.movements || []).length - 1 && (
                              <div className="movementDivider" />
                            )}
                          </React.Fragment>
                        ))}
                      </div>
                    ) : (
                      <div className="muted mt4">
                        No movements yet. Add your first movement above.
                      </div>
                    )}
                  </div>
                </>
              )}

              {typeId === "cardio" && (
                <>
                  <div className="mt12">
                     <div className="label">Cardio type</div>
                      <Select
                        value={block.cardioType || "run"}
                        onChange={(v) =>
                          updateBlockInDay(block.id, () => ({
                            cardioType: v,
                            cardioTypeOtherLabel:
                              v === "other" ? block.cardioTypeOtherLabel || "" : "",
                          }))
                        }
                        options={[
                          { value: "run", label: "Run" },
                          { value: "cycle", label: "Cycle" },
                          { value: "walk", label: "Walk" },
                          { value: "swim", label: "Swim" },
                          { value: "row", label: "Row" },
                          { value: "other", label: "Other" },
                        ]}
                      />
                    </div>

                  {block.cardioType === "other" && (
                    <div className="mt8">
                      <div className="label">Other cardio name</div>
                      <Input
                        value={block.cardioTypeOtherLabel || ""}
                        onChange={(v) =>
                          updateBlockInDay(block.id, () => ({
                            cardioTypeOtherLabel: v,
                          }))
                        }
                        placeholder="e.g. Row, Cross-trainer, Football match…"
                      />
                    </div>
                  )}

                  <div className="mt8">
                    <div className="label">Target</div>
                    <Input
                      value={block.targetText || ""}
                      onChange={(v) =>
                        updateBlockInDay(block.id, () => ({
                          targetText: v,
                        }))
                      }
                      placeholder='e.g. "2 km easy" or "3 × 400m fast"'
                    />
                  </div>
                </>
              )}

              {typeId === "duration" && (
                <>
                  <div className="mt12">
                    <div className="label">Planned minutes (optional)</div>
                    <Input
                      type="number"
                      min={0}
                      value={
                        block.plannedMinutes === "" || block.plannedMinutes == null
                          ? ""
                          : String(block.plannedMinutes)
                      }
                      onChange={(v) => {
                        const cleaned =
                          v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);

                        updateBlockInDay(block.id, () => ({
                          plannedMinutes: cleaned,
                        }));
                      }}
                      placeholder="e.g. 20"
                    />
                  </div>
                </>
              )}

              {typeId === "recovery" && (
                <>
                  <div className="mt12">
                    <div className="label">Recovery type</div>
                    <Select
                      value={block.recoveryMode || "full"}
                      onChange={(v) =>
                        updateBlockInDay(block.id, () => ({
                          recoveryMode: v === "light" ? "light" : "full",
                        }))
                      }
                      options={[
                        { value: "full", label: "Full recovery" },
                        { value: "light", label: "Light recovery" },
                      ]}
                    />
                  </div>

                  <div className="mt8">
                    <div className="label">Planned minutes (optional)</div>
                    <Input
                      type="number"
                      min={0}
                      value={
                        block.plannedMinutes === "" || block.plannedMinutes == null
                          ? ""
                          : String(block.plannedMinutes)
                      }
                      onChange={(v) => {
                        const cleaned =
                          v === "" ? "" : Math.max(0, parseInt(v, 10) || 0);

                        updateBlockInDay(block.id, () => ({
                          plannedMinutes: cleaned,
                        }));
                      }}
                      placeholder="e.g. 20"
                    />
                  </div>

                  <div className="muted mt8">
                    Recovery supports adaptation, muscle repair, nervous system reset and energy restore.
                  </div>
                </>
              )}
              
              {typeId === "tasks" && (
                <>
                  <div className="mt12">
                    <div className="label">Tasks</div>
                    <div className="stack mt8">
                      {(block.tasks || []).map((t) => (
                        <React.Fragment key={t.id}>
                          <div className="taskRow">
                            <div className="row">
                              <div className="field flex1">
                                <div className="label">Task</div>
                                <Input
                                  value={t.label || ""}
                                  onChange={(v) =>
                                    updateTaskField(block.id, t.id, "label", v)
                                  }
                                  placeholder="Task name (e.g. 30 mins reading)"
                                />
                              </div>
                              <div className="field w120">
                                <div className="label">XP</div>
                                <Input
                                  type="number"
                                  min={0}
                                  step={1}
                                  value={t.xpValue ?? 0}
                                  onChange={(v) =>
                                    updateTaskField(
                                      block.id,
                                      t.id,
                                      "xpValue",
                                      Number(v || 0)
                                    )
                                  }
                                />
                              </div>
                              <SecondaryButton
                                className="btnSmall ml8"
                                onClick={() =>
                                  removeTaskFromBlock(block.id, t.id)
                                }
                              >
                                Remove
                              </SecondaryButton>
                            </div>

                            {/* Coach note for this task */}
                            <div className="mt4">
                              <div className="label">Coach note (optional)</div>
                              <Textarea
                                rows={2}
                                value={t.coachNote || ""}
                                onChange={(v) =>
                                  updateTaskField(block.id, t.id, "coachNote", v)
                                }
                                placeholder="Coaching notes or reminders for this task"
                              />
                            </div>
                          </div>
                        </React.Fragment>
                      ))}
                    </div>

                    <PrimaryButton
                      className="mt8"
                      onClick={() => addTaskToBlock(block.id)}
                    >
                      + Add task
                    </PrimaryButton>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* Block add buttons */}
      <div className="mt16">
        <div className="label">Add block</div>
        <div className="row mt8" style={{ gap: 8, flexWrap: "wrap" }}>
          <PrimaryButton
            className="btnSmall"
            onClick={() => addBlockToDay("strength")}
          >
            + Strength / HIIT block
          </PrimaryButton>
          <PrimaryButton
            className="btnSmall"
            onClick={() => addBlockToDay("cardio")}
          >
            + Cardio block
          </PrimaryButton>
                    <PrimaryButton
            className="btnSmall"
            onClick={() => addBlockToDay("duration")}
          >
            + Duration block
          </PrimaryButton>
          <PrimaryButton
            className="btnSmall"
            onClick={() => addBlockToDay("recovery")}
          >
            + Recovery block
          </PrimaryButton>
          <PrimaryButton
            className="btnSmall"
            onClick={() => addBlockToDay("tasks")}
          >
            + Tasks block
          </PrimaryButton>
        </div>
      </div>
    </Card>

    {/* RIGHT COLUMN: Weekly plan + presets + activity type info */}
    <Card className="pad planSide">
      <div className="h2">Weekly plan overview</div>
      <div className="muted mt8">
        This shows all blocks for the week. Use it to sense-check balance and
        save or apply presets.
      </div>

      <div className="mt12 weeklyPlanSummary">
        {weekdays.map((d) => {
          const dayBlocks =
            plan?.blocksByWeekday?.[d] || [];
          return (
            <div key={d} className="weeklyPlanDay">
              <div className="weeklyPlanDayHeader">{d}</div>
              {dayBlocks.length === 0 ? (
                <div className="muted small mt4">No blocks</div>
              ) : (
                <ul className="weeklyPlanBlockList mt4">
                  {dayBlocks.map((b) => (
                    <li key={b.id} className="weeklyPlanBlockItem">
                      <span className="pill tiny">
                        {b.typeId === "strength" && "Strength"}
                        {b.typeId === "hiit" && "HIIT"}
                        {b.typeId === "box" && "Box"}
                        {b.typeId === "cardio" && "Cardio"}
                        {b.typeId === "duration" && "Duration"}
                        {b.typeId === "tasks" && "Tasks"}
                      </span>
                      <span className="ml4">
                        {b.label || "(no name)"}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

        {/* Preset plans */}
      <div className="panel mt16">
        <div className="h3">Preset plans</div>
        <div className="muted mt8">
          Pick a weekly preset, then apply it. This can overwrite your current week.
        </div>

        <div className="row mt12">
          <div style={{ flex: 1 }}>
            <Select
              value={selectedPresetId}
              onChange={setSelectedPresetId}
              options={[
                { value: "", label: "Choose a preset…" },
                ...presetPlans().map((p) => ({ value: p.id, label: p.name })),
              ]}
            />
            {selectedPresetId ? (
              <div className="muted mt8">
                {presetPlans().find((p) => p.id === selectedPresetId)?.note || ""}
              </div>
            ) : null}
          </div>
          <div style={{ width: 12 }} />
          <PrimaryButton
            disabled={!selectedPresetId}
            onClick={async () => {
              const preset = presetPlans().find((p) => p.id === selectedPresetId);
              if (!preset) return;
              const ok = window.confirm(
                `Apply preset "${preset.name}"?\n\nThis will overwrite your current weekly plan. You can undo right after applying.`
              );
              if (!ok) return;
              await applyPlan(
                { ...preset.plan, presetId: preset.id },
                `Preset applied: ${preset.name}`
              );
            }}
          >
            Apply preset
          </PrimaryButton>
        </div>

        {undoPlan ? (
          <div className="rowBetween mt12">
            <div className="mini">
              Undo available: <b>{undoLabel || "Recent change"}</b>
            </div>
            <SecondaryButton onClick={undoLastPlan}>Undo</SecondaryButton>
          </div>
        ) : null}
      </div>

      {/* Saved weekly plans */}
      <div className="panel mt16">
        <div className="rowBetween">
          <div>
            <div className="h3">Saved weekly plans</div>
            <div className="muted mt8">
              Save multiple weeks (templates) and switch between them.
            </div>
          </div>
        </div>

        <div className="row mt12">
          <div style={{ flex: 1 }}>
            <Select
              value={selectedTemplateId}
              onChange={setSelectedTemplateId}
              options={[
                { value: "", label: "Choose a saved plan…" },
                ...planTemplates.map((t) => ({ value: t.id, label: t.name })),
              ]}
            />
          </div>
          <div style={{ width: 12 }} />
          <PrimaryButton
            disabled={!selectedTemplateId}
            onClick={async () => {
              const tpl = planTemplates.find((t) => t.id === selectedTemplateId);
              if (!tpl) return;
              const ok = window.confirm(
                `Load saved plan "${tpl.name}"?\n\nThis will overwrite your current weekly plan. You can undo right after applying.`
              );
              if (!ok) return;
              await applyPlan(
                { ...(tpl.plan_json || {}), templateId: tpl.id },
                `Loaded saved plan: ${tpl.name}`
              );
            }}
          >
            Load
          </PrimaryButton>
        </div>

        <div className="row planTemplatesRow mt12">
<PrimaryButton
  onClick={async () => {
    const name = window.prompt("Name this saved weekly plan:");
    if (!name) return;
    if (!family?.id) return;
    if (!(await ensureUnlocked("save a template"))) return;

    const { data: created, error } = await createPlanTemplate(
      family.id,
      name,
      plan || {}
    );

    if (error) {
      window.alert(error.message || String(error));
      return;
    }

    if (created) {
      // Immediately add the new template to the local list
      setPlanTemplates((prev) => [created, ...(prev || [])]);
      // And select it so it’s obvious which one you just saved
      setSelectedTemplateId(created.id);
    }
  }}
>
  Save as new
</PrimaryButton>
          <div style={{ width: 10 }} />
          <SecondaryButton
            disabled={!selectedTemplateId}
            onClick={async () => {
              const tpl = planTemplates.find((t) => t.id === selectedTemplateId);
              if (!tpl) return;
              const ok = window.confirm(
                `Update "${tpl.name}" with your current plan?`
              );
              if (!ok) return;
              if (!(await ensureUnlocked("update a template"))) return;
              const { error } = await updatePlanTemplate(
                tpl.id,
                tpl.name,
                plan || {}
              );
              if (error) window.alert(error.message || String(error));
              const { data } = await listPlanTemplates(family.id);
              setPlanTemplates(data || []);
            }}
          >
            Update plan
          </SecondaryButton>
          <div style={{ width: 10 }} />
          <SecondaryButton
            disabled={!selectedTemplateId}
            onClick={async () => {
              const tpl = planTemplates.find((t) => t.id === selectedTemplateId);
              if (!tpl) return;
              const ok = window.confirm(
                `Delete saved plan "${tpl.name}"?`
              );
              if (!ok) return;
              if (!(await ensureUnlocked("delete a template"))) return;
              const { error } = await deletePlanTemplate(tpl.id);
              if (error) window.alert(error.message || String(error));
              const { data } = await listPlanTemplates(family.id);
              setPlanTemplates(data || []);
              setSelectedTemplateId("");
            }}
          >
            Delete plan
          </SecondaryButton>
        </div>
      </div>

      {/* Activity Types (collapsed by default) */}
      <div className="panel mt16">
        <details>
          <summary className="h3">Activity types</summary>
          <div className="muted mt8">
            Information about the different types of activity you can add:
          </div>
          <ul className="mt8">
            <li>
              <b>Strength / HIIT / Boxercise</b> — sets &amp; reps with optional
              weight and duration tracking.
            </li>
            <li>
              <b>Cardio</b> — runs, rides, swims, or other cardio with clear
              free-form targets.
            </li>
            <li>
              <b>Duration</b> — time-based activities like yoga, mobility, or
              stretching.
            </li>
            <li>
              <b>Tasks</b> — tick-box actions like stretching, journaling, or
              ice baths, each with its own XP value.
            </li>
          </ul>
        </details>
      </div>
    </Card>
  </div>
)}

        
{tab === "rewards" && (
  <div className="grid2cols">
    <Card className="pad" style={{ minWidth: 0 }}>
      <div className="row" style={{ gap: 16, alignItems: "stretch" }}>
        {/* Left: current avatar */}
        <div
          className="panel"
          style={{
            flex: 1,
            minHeight: 104,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {headerAvatarImg ? (
            <img
              src={headerAvatarImg}
              alt={headerAvatarEmoji}
              style={{
                width: 144,
                height: 144,
                objectFit: "contain",
                borderRadius: 16,
              }}
            />
          ) : (
            <div
              style={{
                fontSize: 40,
              }}
            >
              {headerAvatarEmoji}
            </div>
          )}
        </div>

        {/* Right: XP / Level / XP to next */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <SummaryStat label="XP" value={xp} />
          <SummaryStat label="Level" value={level} />
          <SummaryStat label="XP to next" value={xpToNext} />
        </div>
      </div>

      <div className="panel mt12">
        <div className="rowBetween">
          <div className="h3">Current Plan Streak</div>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: 999,
              background:
                todayPlanStatus === "green"
                  ? "var(--good, #2ecc71)"
                  : "var(--warn, #f39c12)",
            }}
          />
        </div>
        <div className="bigNumber mt8">
          {currentPlanStreak} day{currentPlanStreak === 1 ? "" : "s"}
        </div>
      </div>

      <div className="panel mt12">
        <div className="h3">Next big milestone</div>
        <div className="mini muted mt4">
          Avatar packs unlock every 1,000 XP.
        </div>
        <div className="mini mt8">
          {xp < nextAvatarAt ? (
            <>Next avatar unlock at <b>{nextAvatarAt}</b> XP ({xpToNextAvatar} XP to go).</>
          ) : (
            <>You’ve hit an avatar tier — claim your pack below.</>
          )}
        </div>
      </div>
    </Card>

    <Card className="pad" style={{ minWidth: 0 }}>
      <div className="rowBetween">
        <div className="h2">Rewards</div>
        <div className="tabs">
          {[
            ["badges", "Badges"],
            ["avatars", "Avatars"],
            ["shop", "Shop"],
            ["info", "Info"],
          ].map(([k, label]) => (
            <SecondaryButton
              key={k}
              onClick={() => setRewardsSubTab(k)}
            >
              {label}
            </SecondaryButton>
          ))}
        </div>
      </div>

            {hasUnclaimedBadges && (
        <div className="badgeNotice mt8">
          🎉 New badge earned — tap <b>Badges</b> to claim it!
        </div>
      )}

      {rewardsSubTab === "badges" && (
  <div className="mt16">
    <div className="rowBetween">
      <div className="muted">
        Earn badges from real workouts. Claim them to light them up.
      </div>
      <div className="badgeXpPill">
        Badge XP: {totalBadgeXp}
      </div>
    </div>

    <div className="badgeViewTabs mt8">
      <button
        type="button"
        className={
          "subTabPill " + (badgeView === "earned" ? "on" : "off")
        }
        onClick={() => setBadgeView("earned")}
      >
        Earned badges
      </button>
      <button
        type="button"
        className={
          "subTabPill " + (badgeView === "all" ? "on" : "off")
        }
        onClick={() => setBadgeView("all")}
      >
        All badges
      </button>
    </div>

          <div className="grid2 mt12">
          {BADGE_CARDS.map((card) => {
  const state = getBadgeCardState(card, badgeStats, claimedRewardsSet);

  const showInCurrentView =
    badgeView === "all" || state.highestEarnedIndex >= 0;

  if (!showInCurrentView) return null;

  const badgeKeyForFlash = state.nextClaimable?.key || card.id;
  const nextClaimableTier = state.nextClaimable;
  const earnedTier = state.currentTier;
  const claimedTierIndex = state.highestClaimedIndex;

  let effectiveTier = null;
  if (nextClaimableTier) {
    effectiveTier = nextClaimableTier.tier;
  } else if (earnedTier) {
    effectiveTier = earnedTier.tier;
  } else if (card.tiers?.[0]) {
    effectiveTier = card.tiers[0].tier;
  }

  // Build the visible stack from earned progress, not just claimed progress.
  // Rules:
  // - no earned tiers => show 1 locked bronze base
  // - earned but unclaimed tiers => show grey pending layers
  // - claimed tiers => show full-colour layers
  const layers = [];

  if (state.highestEarnedIndex >= 0) {
    card.tiers.slice(0, state.highestEarnedIndex + 1).forEach((tier, idx) => {
      const isClaimedLayer = claimedTierIndex >= idx;

      layers.push(
        <img
          key={`${isClaimedLayer ? "claimed" : "pending"}_${tier.key}`}
          className={
            "wtBadgeBgLayer" +
            (isClaimedLayer ? "" : " wtBadgeBgLayer-next")
          }
          src={`/badges/bg/bg_${card.family}_${tier.tier}.svg`}
          alt=""
          style={{ "--layerIndex": idx }}
        />
      );
    });
  } else {
    layers.push(
      <img
        key="locked_bronze_base"
        className="wtBadgeBgLayer wtBadgeBgLayer-locked"
        src={`/badges/bg/bg_${card.family}_bronze.svg`}
        alt=""
        style={{ "--layerIndex": 0 }}
      />
    );
  }

  const frontOffset = Math.max(0, layers.length - 1) * 22;
  const faceText = getBadgeFaceText(card);

  return (
    <div
      key={card.id}
      className={
        "panel badgeCard " +
        state.status +
        (lastClaimedKey === badgeKeyForFlash ? " flash" : "") +
        (state.status === "claimed" ? " lit" : "")
      }
    >
      <div className="badgeTitle">{card.title}</div>

      <div className="badgeMid">
        <div
          className={
            "badgeBig" + (state.status === "locked" ? " off" : "")
          }
          aria-hidden="true"
        >
          <div className="wtBadge">
            {layers}

            <div
              className="wtBadgeForeground"
              style={{ "--frontOffset": `${frontOffset}px` }}
            >
              {!!faceText && (
                <div className="wtBadgeFaceText">{faceText}</div>
              )}

              <img
                className={
                  "wtBadgeIcon" +
                  (state.status !== "claimed" ? " wtBadgeIcon--pending" : "")
                }
                src={`/badges/icons/${card.iconFile}`}
                alt=""
              />

              {!!effectiveTier && (
                <div className="wtBadgePlaque">
                  {effectiveTier.toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="badgeAction">
          {state.status === "claimable" && state.nextClaimable ? (
            <button
              className="btn btn-primary"
              onClick={async (e) => {
  const badgeKeyToClaim = state.nextClaimable?.key;
  if (!badgeKeyToClaim) return;

  const cardEl = e.currentTarget.closest(".badgeCard");
  const rect = cardEl ? cardEl.getBoundingClientRect() : null;

  const xpReward = safeNumber(state.nextClaimable?.xp);
  const xpFrom = xp;
  const xpTo = xpFrom + xpReward;

  setXp(xpTo);

  playBuildUpSound?.();

  await claimRewardKey(badgeKeyToClaim, getTodayYMD());

  setTimeout(() => setXp(computeXpFromLogs(allLogs, planRef.current)), 0);
  setTimeout(() => setXp(computeXpFromLogs(allLogs, planRef.current)), 200);

  setLastClaimedKey(badgeKeyToClaim);
  setTimeout(() => setLastClaimedKey(""), 900);

  const confetti = Array.from({ length: 18 }).map((_, i) => ({
    id: i,
    x: Math.random() * 140 - 70,
    y: Math.random() * 80 - 110,
    r: Math.random() * 360,
    d: 700 + Math.random() * 450,
  }));

    setClaimModal({
    kind: "badge",
    stage: "shake",
    title: "Badge claimed!",
    desc: `${card.title} unlocked`,
    badgeKey: badgeKeyToClaim,
    emoji: "🏅",
    xpAward: xpReward,
    xpFrom,
    xpTo,
    fromRect: rect
      ? {
          x: rect.left,
          y: rect.top,
          w: rect.width,
          h: rect.height,
        }
      : null,
    confetti,
  });

  setTimeout(() => {
    playRewardSound?.();
    playSparkleSound?.();
    setClaimModal((prev) =>
      prev ? { ...prev, stage: "boom" } : prev
    );
  }, 260);
}}
            >
              Claim
            </button>
          ) : (
            <div className="pill">{badgeStatusLabel(state.status)}</div>
          )}
        </div>
      </div>

      <div className="badgeDesc">
        {card.desc && (
    <div className="badgeDescIntro">
      {card.desc}
    </div>
  )}
        <div className="badgeDescProgress">
        {typeof card.getProgressText === "function"
          ? card.getProgressText({
              value: state.value,
              nextTier: state.nextTier,
              currentTier: state.currentTier,
              highestEarnedIndex: state.highestEarnedIndex,
              highestClaimedIndex: state.highestClaimedIndex,
              stats: badgeStats,
              meta: {
                earlyCutoffHour: badgeStats?.behaviour?.earlyCutoffHour,
                nightCutoffHour: badgeStats?.behaviour?.nightCutoffHour,
                paceImprovementSport: badgeStats?.intelligence?.paceImprovementSport,
              },
            })
          : card.desc}
          </div>
      </div>

      <div className="badgeTierGrid">
        {card.tiers.map((tier, idx) => {
          const tierName =
            tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);

          const isClaimedTier = claimedTierIndex >= idx;
          const isCurrentEarnedTier = state.highestEarnedIndex >= idx && !isClaimedTier;
          const isNextTier = state.nextTier?.key === tier.key;

          let chipClass = "badgeTierChip";
          if (isClaimedTier) chipClass += " badgeTierChip--claimed";
          else if (isCurrentEarnedTier) chipClass += " badgeTierChip--earned";
          else if (isNextTier) chipClass += " badgeTierChip--next";
          else chipClass += " badgeTierChip--locked";

          return (
            <div key={tier.key} className={chipClass}>
              <div className="badgeTierChipName">{tierName}</div>
              <div className="badgeTierChipMeta">
                {getTierRequirementText(card, tier)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
})}
          </div>

          <div className="mini muted mt12">
            V1 badges are for Runs. Next: Bike + Swim + PB badges + streak badges.
          </div>
        </div>
      )}

      {rewardsSubTab === "avatars" && (
        <div className="mt16">
          <div className="muted">
            Unlock avatar packs as your XP grows. Pick one to show next to your name.
          </div>

          <div className="stack mt12">
            {AVATAR_PACKS.map((pack) => {
              const unlockedNow = xp >= pack.unlockAtXp;
              const alreadyUnlocked = unlockedAvatarPacksSet.has(pack.key);

              return (
                <div key={pack.key} className="panel">
                  <div className="rowBetween">
                    <div>
                      <div className="h3">{pack.title}</div>
                      <div className="mini muted mt4">{pack.desc}</div>
                    </div>

                    {!alreadyUnlocked ? (
                      <button
                        type="button"
                        className={"btn " + (unlockedNow ? "" : "disabled")}
                        disabled={!unlockedNow}
                        onClick={async () => {
                          const next = Array.from(new Set([...(unlockedAvatarPacksArr || []), pack.key]));
                          await savePlanMetaNoPin({ unlockedAvatarPacks: next });
                          setClaimModal({
                            title: "Avatar pack unlocked!",
                            desc: `${pack.title} is now available.`,
                          });
                        }}
                      >
                        {unlockedNow ? "Claim" : `Locked (${pack.unlockAtXp} XP)`}
                      </button>
                    ) : (
                      <div className="pill">Unlocked</div>
                    )}
                  </div>

                  {alreadyUnlocked && (
                    <div className="mt12">
                      <div className="mini muted">Choose your avatar:</div>
                      <div className="row mt8" style={{ flexWrap: "wrap", gap: 8 }}>
{(pack.avatars || []).map((a) => (
                          <button
                            key={a.id}
                            type="button"
                            className={"avatarPick " + (selectedAvatarId === a.id ? "active" : "")}
                            onClick={async () => {
                              await savePlanMetaNoPin({ avatarId: a.id });
                              setClaimModal({
                                title: "Avatar selected!",
                                desc: "Check the header 👆",
                              });
                            }}
                          >
                            {a.imgSrc ? (
                              <img
                                src={a.imgSrc}
                                alt={a.label || "Avatar"}
                                style={{ width: 32, height: 32, objectFit: "contain" }}
                              />
                            ) : (
                              a.emoji || a.label
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {rewardsSubTab === "shop" && (
        <div className="mt16">
          <div className="h3">Rewards shop</div>
          <div className="muted">Pick a victory sound theme. Unlock more as you level up.</div>
          <div className="stack mt12">
            <RewardItem title="Classic" desc="Default sounds" active={victoryTheme === "classic"} locked={false} onPick={() => applyVictoryTheme("classic")} />
            <RewardItem title="Arcade" desc="8-bit vibes" active={victoryTheme === "arcade"} locked={!unlocked.arcade} onPick={() => unlocked.arcade && applyVictoryTheme("arcade")} />
            <RewardItem title="Chill" desc="Softer sounds" active={victoryTheme === "chill"} locked={!unlocked.chill} onPick={() => unlocked.chill && applyVictoryTheme("chill")} />
          </div>
          <div className="mini mt12">Unlock rules: Level 3 = Arcade, Level 5 = Chill. (100 XP per level)</div>
        </div>
      )}

      {rewardsSubTab === "info" && (
        <div className="mt16">
          <div className="panel">
            <div className="h3">Level roadmap</div>
            <div className="mini muted mt4">
              Every 100 XP = 1 level. Avatars unlock every 1000 XP (every 10 levels).
            </div>
            <div className="stack mt8 mini">
              <div>
                🎚 Current level: <b>{level}</b>
              </div>
              <div>
                🧬 Avatar unlocks reached: <b>{avatarTier}</b>
              </div>
              <div className="muted mt8">Milestones to aim for:</div>
              <div>• Level 3 – Unlock Arcade sounds</div>
              <div>• Level 5 – Unlock Chill sounds</div>
              <div>• Level 10 – First avatar pack</div>
              <div>• More badges + PBs coming soon</div>
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
                <div><b>Tasks:</b> XP per task completed (as shown on the task log)</div>
                <div><b>Progression bonuses:</b> beat your last time/effort (+20 XP for Cardio blocks and +10 XP for Strength movements)</div>
                <div><b>Streak bonuses:</b> keep days green 🔥 (2→5XP, 3→10XP, 5→20XP, 10→50XP,
                      30→100XP, 60→200XP, 90→300XP, 180→600XP, 365→2000XP)</div>
                <div><b>Badges:</b> claimable rewards add XP (see Badges tab)</div>
                <div><b>Day complete:</b> +10 XP when all workout blocks (not tasks) for that day are logged</div>
              </div>
            )}
          </div>

          <div className="panel mt16">
            <div className="rowBetween">
              <div>
                <div className="h3">XP Ledger</div>
                <div className="muted mt4">
                  This is the XP “receipt”. It shows XP earned per day from logs. Badge XP appears on the day you claim it.
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
      <th style={{ textAlign: "right" }}>Total</th>
      <th style={{ textAlign: "right" }}>Balance</th>
      <th style={{ textAlign: "right" }}>Non-bonus</th>
      <th style={{ textAlign: "right" }}>Strength</th>
      <th style={{ textAlign: "right" }}>Cardio</th>
      <th style={{ textAlign: "right" }}>Duration</th>
      <th style={{ textAlign: "right" }}>Tasks</th>
      <th style={{ textAlign: "right" }}>Day</th>
      <th style={{ textAlign: "right" }}>Daily</th>
      <th style={{ textAlign: "right" }}>Prog</th>
      <th style={{ textAlign: "right" }}>Streak</th>
      <th style={{ textAlign: "right" }}>Badges</th>
    </tr>
  </thead>
  <tbody>
    {(xpDebugRows || []).slice(0, 21).map((r) => (
      <tr key={r.date}>
        <td>{r.date}</td>
        <td style={{ textAlign: "right" }}>
          <b>{r.totalXp || 0}</b>
        </td>
        <td style={{ textAlign: "right" }}>
          {r.runningTotalXp ?? ""}
        </td>
        <td style={{ textAlign: "right" }}>{r.nonBonusXp || 0}</td>
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
  Tip: “Non-bonus” = Strength + Cardio + Duration + Tasks + Day. Bonuses are Daily, Prog, Streak and Badges.
</div>
          </div>

        </div>
      )}
    </Card>
  </div>
)}

{tab === "settings" && (
          <div className="grid2cols">
            <Card className="pad">
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
                      <Input
                        type="number"
                        min={0}
                        step={0.1}
                        value={p.body_weight_kg ?? ""}
                        onChange={async (v) => {
                          if (!(await ensureUnlocked("change bodyweight"))) return;
                          await setProfileBodyweight(p.id, v === "" ? null : Number(v));
                          await refreshAll();
                        }}
                        placeholder="optional"
                      />
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
                    await addProfile(family.id, name.trim());
                    await refreshAll();
                  }}
                >
                  Add
                </SecondaryButton>
              </div>
            </Card>

            <Card className="pad">
              <div ref={accountRef} />
              <div className="h2">Data notes</div>
              <div className="mini mt12">
                - This is a <b>single account</b> with multiple people.<br/>
                - Each person’s stats are private to this account.<br/>
                - Plan + logs sync across devices automatically.<br/>
              </div>

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
                <div className="h3">Export/Import</div>
                <div className="muted">For now, export/import can be added later (cloud is your backup).</div>
              </div>

              <div className="panel mt16">
                <div className="h3">Sign out</div>
                <div className="muted mt8">Use this on shared devices.</div>
                <div className="row mt12">
                  <SecondaryButton onClick={doSignOut}>Sign out</SecondaryButton>
                </div>
              </div>
            </Card>
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
          <Line type="monotone" dataKey="weight" dot={false} strokeWidth={3} stroke="#0ea5e9" connectNulls />
        )}
        {historyStrengthShow.reps && (
          <Line type="monotone" dataKey="reps" dot={false} strokeWidth={3} stroke="#22c55e" connectNulls />
        )}
        {historyStrengthShow.time && (
          <Line type="monotone" dataKey="timeSec" dot={false} strokeWidth={3} stroke="#f59e0b" connectNulls />
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
.avatarChip{
  width:28px;height:28px;border-radius:999px;
  display:inline-flex;align-items:center;justify-content:center;
  background: rgba(0,0,0,0.25);
  border: 1px solid rgba(255,255,255,0.15);
  font-size:16px;
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
  font-size:15px;
  font-weight:900;
  letter-spacing:.06em;
  text-transform:uppercase;
  color:rgba(255,255,255,.18);
  text-shadow:0 1px 0 rgba(0,0,0,.25);
  white-space:nowrap;
  z-index:1;
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
.avatarPick{
  min-width:44px;height:44px;border-radius:14px;
  display:inline-flex;align-items:center;justify-content:center;
  border:1px solid rgba(255,255,255,0.15);
  background: rgba(0,0,0,0.18);
  font-size:20px;
}
.avatarPick.active{
  border:1px solid rgba(255,255,255,0.35);
  background: rgba(255,255,255,0.08);
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
      .header-right{display:flex;flex-direction:column;gap:10px}
      @media(min-width:900px){.header-right{flex-direction:row;align-items:center}}
      .tabs{display:flex;flex-wrap:wrap;gap:8px}
      /* Prevent button text wrapping */
      .btn, button { white-space: nowrap; }

      /* Make the +Session / Reset day buttons big enough on desktop */
      .logTopActions, .logActions, .dateActions { display:flex; gap:10px; align-items:center; flex-wrap:nowrap; }
      .logTopActions .btn, .logActions .btn, .dateActions .btn { min-width: 120px; }

      .tabsRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;justify-content:flex-end}
      .iconBtn{width:44px;height:44px;border-radius:14px;border:1px solid #e2e8f0;background:#fff;color:#0f172a;display:inline-flex;align-items:center;justify-content:center}
      .iconBtn:hover{filter:brightness(0.98)}
      .iconBtn:active{transform:scale(0.99)}
      .iconSvg{width:20px;height:20px}
      .iconEmoji{font-size:20px;line-height:1}
      .selectWide{min-width:220px}
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
      @media (min-width: 900px){
  .row{ flex-direction:row; align-items:flex-start; justify-content:space-between; }
  .rowRight{ justify-content:flex-end; }
  .planTemplatesRow{flex-wrap:wrap;align-items:center;}

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
      @media(max-width:720px){.tabs{overflow-x:auto;-webkit-overflow-scrolling:touch} .tabs::-webkit-scrollbar{display:none}}
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
      .authCard{max-width:520px;margin:60px auto}
      .footer{margin:18px 0 30px;text-align:center;color:#94a3b8;font-size:12px}
      .motivator{margin-bottom:12px;background:linear-gradient(135deg,#ffffff 0%,#f1f5f9 100%)}
      .motGrid{display:grid;grid-template-columns:1fr;gap:10px}
      @media(min-width:900px){.motGrid{grid-template-columns:1fr 1fr 1fr}}
      .motItem{border:1px solid #e2e8f0;background:#fff;border-radius:14px;padding:10px 12px;font-weight:800;color:#0f172a;font-size:13px}

    `}</style>
  );
}

const COACHING_NOTES = {
  "Push-ups": "Strong plank body. Chest to just above the floor, then press up.",
  "Bodyweight Squats": "Feet shoulder-width. Sit back, knees track over toes. Stand tall.",
  "Goblet Squat": "Hold a dumbbell/kettlebell at chest. Keep chest up, squat deep with control.",
  "Reverse Lunges": "Step back, drop back knee towards floor, push through front foot.",
  "Lunges": "Long step, front knee over mid-foot, keep torso tall.",
  "Step-ups": "Use a stable step/bench. Drive through the whole foot; control down.",
  "Split Squat": "Stay in a split stance. Drop straight down and up (slow & controlled).",
  "Hip Hinge (RDL)": "Soft knees, push hips back, feel hamstrings, keep back neutral.",
  "Glute Bridge": "Heels close to bum. Squeeze glutes at the top for 1 second.",
  "Calf Raises": "Full range: down slow, up strong. Keep balance with a wall if needed.",
  "Dumbbell Row": "Flat back. Pull elbow to your pocket, squeeze shoulder blade.",
  "Shoulder Press": "Brace core. Press overhead without leaning back.",
  "Pull / Row variation": "Pick any row/pull movement and focus on smooth reps.",
  "Plank": "Elbows under shoulders. Ribs down, squeeze glutes, breathe.",
  "Side Plank": "Hips high, straight line head-to-heels. Hold steady, breathe.",
  "Hollow Hold": "Lower back pressed down. Hold a tight banana shape.",
  "Wall Sit": "Back flat to wall. Knees about 90°. Stay strong and breathe.",
  "Squat Jumps": "Soft landings. Jump up, absorb quietly, reset and repeat.",
  "Jump Rope": "Small bounces, wrists turn the rope. Stay light on feet.",
  "Mountain Climbers": "Hands under shoulders. Drive knees fast while keeping hips stable.",
  "Burpees": "Smooth rhythm. Step back if needed; quality over speed.",
  "1-2 (jab–cross) + move": "Snap punches, hands back to guard. Add a small step after.",
  "Hook–cross + duck": "Turn hips for the hook. Duck under (small bend), back to guard.",
  "Knees + teeps (shadow)": "Core tight. Knee up then extend for a light front kick. Control.",
  "Core finisher (30s on / 30s off)": "Pick: plank, dead-bug, bicycle. Keep it tidy.",
  "1-2-3-2 combo": "Jab–cross–hook–cross. Stay light, guard up.",
  "Punch–slip–punch": "Slip = tiny head movement. Return fire fast, then reset.",
  "Fast feet (shadow)": "Quick steps, light bounce. Hands up, breathe through nose if possible.",
};

function presetPlans() {
  // Build a fresh plan each call (new movement IDs) so presets don’t clash with older logs.
  const noteFor = (name) => COACHING_NOTES[name] || "";

  const movement = (name, mode, opts = {}) => ({
    id: uid(),
    name,
    mode,
    note: noteFor(name),
    ...opts,
  });

  
const strengthDay = (names) =>
  names.map((n) => {
    const noWeight = ["Push-ups", "Plank", "Side Plank", "Hollow Hold", "Burpees", "Jump Rope", "Mountain Climbers"];
    const allowWeight = !noWeight.includes(n);
    return movement(n, "strength", { allowWeight });
  });

const boxRounds = (names) =>
    names.map((n) =>
      movement(n, "time", {
        fixedSeconds: 60,
        allowCount: true,
        countLabel: "rounds",
      })
    );

  const baseTypes = builtInTypes();

  const makePlan = ({ dayTypeByWeekday, movementsByWeekday, restSecByWeekday, cardioTargetByWeekday, dayActivitiesByWeekday }) => ({
    version: 1,
    activityTypes: baseTypes,
    dayTypeByWeekday: dayTypeByWeekday || defaultPlanForFamily().dayTypeByWeekday,
    restSecByWeekday: restSecByWeekday || weekdays.reduce((acc, d) => ((acc[d] = 60), acc), {}),
    movementsByWeekday: movementsByWeekday || {},
    cardioTargetByWeekday: cardioTargetByWeekday || {},
    dayActivitiesByWeekday: dayActivitiesByWeekday || {},
  });

  // --- Presets ---
  const footballEngine = makePlan({
    dayTypeByWeekday: { Mon: "strength", Tue: "run", Wed: "strength", Thu: "box", Fri: "strength", Sat: "run", Sun: "duration" },
    restSecByWeekday: { Mon: 75, Tue: 0, Wed: 75, Thu: 45, Fri: 75, Sat: 0, Sun: 0 },
    movementsByWeekday: {
      Mon: strengthDay(["Goblet Squat", "Push-ups", "Dumbbell Row", "Plank"]),
      Wed: strengthDay(["Reverse Lunges", "Shoulder Press", "Hip Hinge (RDL)", "Side Plank"]),
      Thu: boxRounds(["1-2 (jab–cross) + move", "Hook–cross + duck", "Knees + teeps (shadow)", "Core finisher (30s on / 30s off)"]),
      Fri: strengthDay(["Step-ups", "Pull / Row variation", "Split Squat", "Hollow Hold"]),
    },
    cardioTargetByWeekday: {
      Tue: "Intervals: 5 min easy • 6×(1 min fast / 1 min easy) • 5 min easy",
      Sat: "Tempo: 10 min easy • 10–15 min steady (talk-test) • 5 min easy",
      Sun: "Easy walk / light cycle 20–40 min (optional)",
    },
  });

  const legsPower = makePlan({
    dayTypeByWeekday: { Mon: "strength", Tue: "duration", Wed: "strength", Thu: "duration", Fri: "strength", Sat: "duration", Sun: "duration" },
    restSecByWeekday: { Mon: 90, Tue: 0, Wed: 90, Thu: 0, Fri: 90, Sat: 0, Sun: 0 },
    movementsByWeekday: {
      Mon: strengthDay(["Goblet Squat", "Reverse Lunges", "Calf Raises", "Plank"]),
      Wed: strengthDay(["Hip Hinge (RDL)", "Step-ups", "Glute Bridge", "Side Plank"]),
      Fri: strengthDay(["Split Squat", "Squat Jumps", "Wall Sit", "Hollow Hold"]),
    },
    cardioTargetByWeekday: {
      Tue: "Zone 2: 20–30 min easy (you can talk).",
      Thu: "Mobility walk: 15–25 min + 5 min stretching.",
      Sat: "Optional: hills (walk up / easy down) 15–20 min.",
    },
  });

  const toneConditioning = makePlan({
    dayTypeByWeekday: { Mon: "strength", Tue: "run", Wed: "strength", Thu: "box", Fri: "strength", Sat: "duration", Sun: "duration" },
    restSecByWeekday: { Mon: 45, Tue: 0, Wed: 45, Thu: 30, Fri: 45, Sat: 0, Sun: 0 },
    movementsByWeekday: {
      Mon: strengthDay(["Push-ups", "Bodyweight Squats", "Mountain Climbers", "Plank"]),
      Wed: strengthDay(["Lunges", "Shoulder Press", "Dumbbell Row", "Hollow Hold"]),
      Thu: boxRounds(["1-2-3-2 combo", "Punch–slip–punch", "Fast feet (shadow)", "Core finisher (30s on / 30s off)"]),
      Fri: strengthDay(["Goblet Squat", "Burpees", "Jump Rope", "Side Plank"]),
    },
    cardioTargetByWeekday: {
      Tue: "Intervals: 5 min easy • 8×(30s fast / 60s easy) • 5 min easy",
      Sat: "Easy steady: 20–40 min (walk/jog/cycle).",
      Sun: "Recovery: 15–30 min easy movement + stretch.",
    },
  });

  const recoveryMobility = makePlan({
    dayTypeByWeekday: { Mon: "duration", Tue: "duration", Wed: "duration", Thu: "duration", Fri: "duration", Sat: "duration", Sun: "duration" },
    restSecByWeekday: weekdays.reduce((acc, d) => ((acc[d] = 0), acc), {}),
    movementsByWeekday: {},
    cardioTargetByWeekday: {
      Mon: "Mobility: 10–20 min stretching (hips/hamstrings/ankles).",
      Tue: "Easy walk: 20–40 min (relaxed).",
      Wed: "Core + posture: 10–15 min (light).",
      Thu: "Easy cycle / swim / walk: 20–40 min.",
      Fri: "Mobility: shoulders + back 10–20 min.",
      Sat: "Optional: fun activity 20–60 min.",
      Sun: "Rest: breathe + stretch 5–10 min.",
    },
  });

  return [
    {
      id: "football_engine",
      name: "Football Speed & Engine (5 days)",
      desc: "Intervals + conditioning + strength base. Great for players.",
      plan: footballEngine,
    },
    {
      id: "legs_power",
      name: "Leg Strength + Power",
      desc: "Leg strength focus with plyometrics + easy conditioning.",
      plan: legsPower,
    },
    {
      id: "tone_conditioning",
      name: "Muscular Conditioning / Tone",
      desc: "Higher reps, shorter rest, and cardio bias for fitness & tone.",
      plan: toneConditioning,
    },
    {
      id: "recovery_mobility",
      name: "Recovery & Mobility",
      desc: "Light movement + mobility every day to stay fresh.",
      plan: recoveryMobility,
    },
  ];
};

