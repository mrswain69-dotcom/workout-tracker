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

function getTodayYMD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Counts consecutive "plan complete" days up to today (inclusive).
function getCurrentPlanStreak(records, todayYmd, planDayForWeekdayFn) {
  if (!Array.isArray(records) || !records.length) return 0;

  // Build date -> log map
  const map = new Map();
  for (const r of records) {
    const date = r?.date_ymd || r?.date;
    const log = r?.log;
    if (!date || !log) continue;
    map.set(date, log);
  }

  // Find the most recent day (<= today) where the plan was complete
  const completeDates = [];
  for (const [date, log] of map.entries()) {
    if (date > todayYmd) continue;
    const weekday = log.weekday || weekdayFromYMD(date);
    const planDay = planDayForWeekdayFn(weekday);
    if (isDayComplete(log, planDay)) {
      completeDates.push(date);
    }
  }

  if (!completeDates.length) return 0;

// Sort and find the latest completed date
  completeDates.sort((a, b) => (a < b ? -1 : 1));
  const latest = completeDates[completeDates.length - 1];

  // If the latest completed day isn't today or yesterday, streak is broken.
  const todayDate = new Date(todayYmd + "T00:00:00");
  const latestDate = new Date(latest + "T00:00:00");
  const diffFromToday = Math.round(
    (todayDate - latestDate) / 86400000
  );
  if (diffFromToday > 1) {
    // Last complete day is more than 1 day ago -> no current streak
    return 0;
  }

  // Start from that latest completed date and walk backwards
  let cursor = latest;
  let streak = 0;

  while (true) {
    const log = map.get(cursor);
    if (!log) break;

    const weekday = log.weekday || weekdayFromYMD(cursor);
    const planDay = planDayForWeekdayFn(weekday);
    const complete = isDayComplete(log, planDay);
    if (!complete) break;

    streak += 1;

    const d = new Date(cursor + "T00:00:00");
    d.setDate(d.getDate() - 1);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    cursor = `${y}-${m}-${day}`;
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
function ymd(date) {
  const d = typeof date === "string" ? new Date(date) : date;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
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
    // NEW: tick-box tasks (yes/no)
    { id: "tasks", name: "Tick-box tasks (yes/no)", kind: "task", movementsEnabled: false, fields: { tasks: true } },
  ];
}


function defaultPlanForFamily() {
  const types = builtInTypes();
  // Default weekly assignment (you can change anything in Plan tab)
  const dayTypeByWeekday = {
    Mon: "strength",
    Tue: "run",
    Wed: "strength",
    Thu: "box",
    Fri: "strength",
    Sat: "duration",
    Sun: "duration",
  };

  const movements = {
    Mon: [
      { id: uid(), name: "Push-ups", mode: "strength", allowWeight: false },
      { id: uid(), name: "Bodyweight Squats", mode: "strength", allowWeight: false },
      { id: uid(), name: "Plank", mode: "time", allowCount: false },
    ],
    Wed: [
      { id: uid(), name: "Dumbbell Row", mode: "strength", allowWeight: true },
      { id: uid(), name: "Shoulder Press", mode: "strength", allowWeight: true },
      { id: uid(), name: "Hollow Hold", mode: "time", allowCount: false },
    ],
    Fri: [
      { id: uid(), name: "Lunges", mode: "strength", allowWeight: false },
      { id: uid(), name: "Goblet Squat", mode: "strength", allowWeight: true },
      { id: uid(), name: "Jump Rope", mode: "time", allowCount: true, countLabel: "skips" },
    ],
    Thu: [
      { id: uid(), name: "Cross-punch rally 1-2-3-4-5 (repeat)", mode: "time", fixedSeconds: 60, allowCount: true, countLabel: "hits" },
      { id: uid(), name: "Sit-up + cross punches (repeat)", mode: "time", fixedSeconds: 60, allowCount: true, countLabel: "rounds" },
      { id: uid(), name: "Cross, duck, cross combo (repeat)", mode: "time", fixedSeconds: 60, allowCount: true, countLabel: "rounds" },
    ],
  };

  return {
    version: 1,
    activityTypes: types, // can add custom types
    dayTypeByWeekday,
    // Rest interval (seconds) between sets/rounds for each weekday (editable)
    restSecByWeekday: weekdays.reduce((acc, d) => {
      acc[d] = 60;
      return acc;
    }, {}),
    movementsByWeekday: movements, // only for days where movementsEnabled
    cardioTargetByWeekday: {}, // optional "session focus" text for cardio days
    // NEW: optional extra activity blocks per weekday (e.g. Run + HIIT)
    // Shape: { [weekday]: [ { id, typeId, label } ] }
    dayActivitiesByWeekday: {},
  };
}

// -------- Day activities (primary + extras) ----------
// Primary activity still comes from dayTypeByWeekday / movementsByWeekday / cardioTargetByWeekday
// Extras are stored in plan.dayActivitiesByWeekday[weekday] as an array of blocks.
function getDayActivitiesForWeekday(plan, weekday) {
  if (!plan || !weekday) return [];

  const typeId = plan.dayTypeByWeekday?.[weekday] || "strength";
  const movements = plan.movementsByWeekday?.[weekday] || [];
  const restSec = plan.restSecByWeekday?.[weekday] ?? 60;
  const cardioTarget = plan.cardioTargetByWeekday?.[weekday] || "";

  const primary = {
    id: `${weekday}_main`,
    typeId,
    label: "",
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
        movements: block.movements || [],
        restSec: typeof block.restSec === "number" ? block.restSec : undefined,
        cardioTarget: block.cardioTarget,
        tasks: Array.isArray(block.tasks) ? block.tasks : [],
      })),
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
    const sets = row?.log?.entries?.[movementId] || null;
    if (Array.isArray(sets) && sets.some(setDidSomething)) return sets;
  }
  return null;
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
    if (!row?.date_ymd || row.date_ymd >= beforeYmd) continue;
    const c = row?.log?.cardio;
    if (c && (Number(c?.distanceKm) || Number(c?.durationMin))) return c;
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
function summarizeCardio(c) {
  if (!c) return "—";
  const d = Number(c.distanceKm || 0);
  const t = Number(c.durationMin || 0);
  const s = Number(c.avgSpeedKmh || 0);
  const bits = [];
  if (d) bits.push(`${d}km`);
  if (t) bits.push(`${t}min`);
  if (s) bits.push(`${s.toFixed(1)}km/h`);
  return bits.join(" • ") || "—";
}
function suggestCardioTarget({ lastCardio }) {
  if (!lastCardio) return { text: "Log once to generate targets." };
  const d = Number(lastCardio.distanceKm || 0);
  const t = Number(lastCardio.durationMin || 0);
  const s = Number(lastCardio.avgSpeedKmh || 0);
  if (s) return { text: `Try +0.2 km/h avg speed (≈ ${(s + 0.2).toFixed(1)} km/h)` };
  if (d) return { text: `Try +0.1 km distance (≈ ${(d + 0.1).toFixed(1)} km)` };
  if (t) return { text: `Try +1 min duration (≈ ${t + 1} min)` };
  return { text: "Aim to beat last time." };
}

function isDayComplete(log, planDay) {
  if (!log) return false;
  if (planDay.kind === "task") {
    const anyDone = Object.values(log?.tasks || {}).some((t) => t && t.done);
    return anyDone;
  }
  if (planDay.kind === "cardio") {
    return safeNumber(log.cardio?.distanceKm) > 0 && safeNumber(log.cardio?.durationMin) > 0;
  }
  if (planDay.kind === "custom") {
    return safeNumber(log.custom?.durationMin) > 0;
  }
  if (!planDay.movementsEnabled) return false;
  const ex = planDay.movements || [];
  if (!ex.length) return false;
  for (const e of ex) {
    const sets = log.entries?.[e.id] || [];
    if (sets.length < 3) return false;
    for (let i = 0; i < 3; i++) if (!setDidSomething(sets[i] || {})) return false;
  }
  return true;
}
// Can be deleted once new xp engine works
function awardXpForDay(log, planDay) {
  const base = 10;
  const completion = isDayComplete(log, planDay) ? 25 : 0;
  const combo = clamp(log?.gamify?.comboMax || 0, 0, 30);
  return base + completion + combo;
}
function estimateCalories({ kind, bodyWeightKg, log }) {
  const bw = safeNumber(bodyWeightKg);
  if (!bw) return null;
  const met = kind === "cardio" ? 8.3 : kind === "time" ? 8.0 : kind === "strength" ? 6.0 : 3.0;
  let minutes = 0;
  if (kind === "cardio") minutes = safeNumber(log?.cardio?.durationMin);
  else if (kind === "custom") minutes = safeNumber(log?.custom?.durationMin);
  else {
    const started = log?.startedAt ? new Date(log.startedAt) : null;
    const finished = log?.finishedAt ? new Date(log.finishedAt) : null;
    if (started && finished && finished > started) minutes = (finished - started) / 60000;
    else minutes = (Object.values(log?.entries || {}).flat().filter(setDidSomething).length) * 1.5;
  }
  if (!minutes) return null;
  const kcalPerMin = (met * 3.5 * bw) / 200;
  return Math.round(kcalPerMin * minutes);
}

// -------- UI primitives ----------
function Card({ children, className = "" }) {
  return <div className={`card ${className}`}>{children}</div>;
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
function Input({ value, onChange, placeholder, type = "text", min, step, readOnly }) {
  return (
    <input
      value={value}
      onChange={(e) => onChange && onChange(e.target.value)}
      placeholder={placeholder}
      type={type}
      min={min}
      step={step}
      readOnly={readOnly}
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
                  <Input value={email} onChange={setEmail} placeholder="you@email.com" type="email" />
                </div>
                <div>
                  <div className="label">Password</div>
                  <Input value={pw} onChange={setPw} placeholder="••••••••" type="password" />
                </div>
                <PrimaryButton
                  disabled={busy}
                  onClick={async () => {
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
                  }}
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

// -------- Main app ----------
export default function App() {
  const ENABLE_SW_TOAST = false; // keep false to avoid sticky update toast UX

  const [tab, setTab] = useState("log");

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
  
  // Plan editing should NOT depend on log date.
  const [planWeekday, setPlanWeekday] = useState("Mon");

  function makeLogCacheKey(familyId, profileId, date) {
  if (!familyId || !profileId || !date) return null;
  return `${familyId}:${profileId}:${ymd(date)}`;
}

  const [logForDay, setLogForDay] = useState(null);
  const [allLogs, setAllLogs] = useState([]); // for stats

  const [soundOn, setSoundOn] = useState(true);
  const [victoryTheme, setVictoryTheme] = useState("classic"); // classic | arcade | chill
  const [xp, setXp] = useState(0);
  const [bonusPop, setBonusPop] = useState(0);
  const [showXpLog, setShowXpLog] = useState(false);

  const audioCtxRef = useRef(null);
  // Draft inputs for one-off activities on the Log tab
  const [oneOffNameDraft, setOneOffNameDraft] = useState("");
  const [oneOffKindDraft, setOneOffKindDraft] = useState("custom");
  const [extraMovNameDraft, setExtraMovNameDraft] = useState("");
  const [extraMovModeDraft, setExtraMovModeDraft] = useState("strength");
  const loadDayLogReqRef = useRef(0);
  const lastLogByDateRef = useRef({}); // NEW: latest log we’ve saved per date

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
  if (!family?.id || !activeProfileId) return;

  // Important: clear immediately so we don't display previous profile streak/logs
  setAllLogs([]);

  (async () => {
    const { data } = await listLogs(family.id, activeProfileId, 2000);

    // Defensive: if db query ever returns mixed profiles, filter client-side
    const rows = (data || []).filter((r) => !r.profile_id || r.profile_id === activeProfileId);

    setAllLogs(rows.map((r) => ({ date_ymd: r.date_ymd, log: r.log_json })));
  })().catch(() => {});
}, [family?.id, activeProfileId]);


  // --- Load day log ---
  useEffect(() => {
  if (!family?.id || !activeProfileId || !selectedDate) return;

  const cacheKey = makeLogCacheKey(family.id, activeProfileId, selectedDate);
  const cached = cacheKey ? lastLogByDateRef.current[cacheKey] : undefined;
  if (cached) {
    setLogForDay(cached);
  }

  const reqId = ++loadDayLogReqRef.current;

  (async () => {
    const { data, error } = await getLog(family.id, activeProfileId, selectedDate);
    if (reqId !== loadDayLogReqRef.current) return;

    if (error) {
      console.error("getLog failed", error);
      if (!cached) setLogForDay(null);
      return;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const fromDb = row?.log_json || null;

    const latest = cached || fromDb;
    setLogForDay(latest);
  })().catch((e) => {
    if (reqId !== loadDayLogReqRef.current) return;
    console.error("getLog exception", e);
    if (!cached) setLogForDay(null);
  });
}, [family?.id, activeProfileId, selectedDate]);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0] || null;

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

  function setAndCachePlan(profileId, nextPlan) {
    setPlan(nextPlan);
    updateProfilePlanInState(profileId, nextPlan);
    cachePlanLocally(profileId, nextPlan);
  }

  // --- Load weekly plan for the selected profile ---
  useEffect(() => {
    if (!activeProfileId) return;

    // 1) Try local cached copy first (includes extra activities)
    const cached = getCachedPlan(activeProfileId);
    if (cached) {
      setAndCachePlan(activeProfileId, cached);
    }

    // 2) Always try the DB plan (authoritative for extras)
    (async () => {
      const { data, error } = await getProfilePlan(activeProfileId);
      if (error) {
        console.error("getProfilePlan failed", error);

        // If we have cached, keep it; otherwise fall back to profile row plan_json
        if (!cached && activeProfile?.plan_json) {
          setAndCachePlan(activeProfileId, activeProfile.plan_json);
        }
        return;
      }

      if (data?.plan_json) {
        setAndCachePlan(activeProfileId, data.plan_json);
        return;
      }

      // 3) If DB has no plan yet, fall back to profile row plan_json
      if (activeProfile?.plan_json) {
        setAndCachePlan(activeProfileId, activeProfile.plan_json);
        return;
      }

      // 4) No plan anywhere: create default + persist
      const p = defaultPlanForFamily();
      await upsertProfilePlan(activeProfileId, p);
      setAndCachePlan(activeProfileId, p);
    })();
  }, [activeProfileId]);  // IMPORTANT: do not depend on activeProfile here




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
  const canUseTheme = (t) => t === "classic" || (t === "arcade" && unlocked.arcade) || (t === "chill" && unlocked.chill);

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

// -------- XP rules (new engine) ----------
const XP_RULES = {
  perSet: 5,
  perMovementComplete: 5,
  perDayComplete: 5,
  progression: 10,
  cardioProgression: 20,
  extraMovement: 10,
  challengeDaily: 15,
  oneOff: 5,
  taskComplete: 5,
  streak: {
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

function computeStreakBonusMap(records) {
  if (!Array.isArray(records) || !records.length) return {};
  const rows = records
    .map((r) => ({
      date: r?.date_ymd || r?.date,
      log: r?.log,
    }))
    .filter((x) => x.date && x.log)
    .sort((a, b) => (a.date < b.date ? -1 : 1)); // oldest first

  const byDate = {};
  let streak = 0;
  let prevDate = null;

  for (const { date, log } of rows) {
    const weekday = log.weekday || weekdayFromYMD(date);
    const planDay = planDayForWeekday(weekday);
    const complete = isDayComplete(log, planDay);

    if (!complete) {
      streak = 0;
      prevDate = date;
      continue;
    }

    if (!prevDate) {
      streak = 1;
    } else {
      const dPrev = new Date(prevDate + "T00:00:00");
      const dCur = new Date(date + "T00:00:00");
      const diffDays = Math.round((dCur - dPrev) / 86400000);
      streak = diffDays === 1 ? streak + 1 : 1;
    }

    prevDate = date;

    const bonus = XP_RULES.streak[streak];
    if (bonus) byDate[date] = bonus;
  }

  return byDate;
}

const buildXpDebugRows = (records) => {
  if (!Array.isArray(records)) return [];

  const streakXpByDate = computeStreakBonusMap(records);
  const rows = [];

  for (const r of records) {
    const date = r?.date_ymd || r?.date;
    const log = r?.log;
    if (!date || !log) continue;

    const weekday = log.weekday || weekdayFromYMD(date);
    const planDay = planDayForWeekday(weekday);
    const kind = planDay.kind || "strength";

    const entries = log.entries || {};

    // Main plan movements + extra movements
    const mainMovements = Array.isArray(planDay.movements)
      ? planDay.movements
      : [];
    const extraMovementsArr = Array.isArray(log?.meta?.extraMovements)
      ? log.meta.extraMovements
      : [];

    let setsDone = 0;
    let movementsCompleted = 0;
    let extraCompleted = 0;
    let progressedMovement = false;

    // Count sets and completed movements for main plan
    for (const m of mainMovements) {
      const setsRaw = entries[m.id] || [];
      const sets = Array.isArray(setsRaw)
        ? setsRaw.filter(setDidSomething)
        : [];
      if (sets.length) {
        setsDone += sets.length;
        if (sets.length >= 3) movementsCompleted += 1;
      }
    }

    // Extra movements for today
    for (const em of extraMovementsArr) {
      const setsRaw = entries[em.id] || [];
      const sets = Array.isArray(setsRaw)
        ? setsRaw.filter(setDidSomething)
        : [];
      if (sets.length) {
        setsDone += sets.length;
        extraCompleted += 1;
      }
    }

    // Progression: beat previous session for any movement (once per day)
    const allMovements = [...mainMovements, ...extraMovementsArr];
    for (const m of allMovements) {
      const setsRaw = entries[m.id] || [];
      if (!Array.isArray(setsRaw) || !setsRaw.some(setDidSomething)) continue;
      const lastSets = findLastMovementSets(records, m.id, date);
      const lastScore = scoreSets(lastSets || []);
      const curScore = scoreSets(setsRaw);
      if (curScore > lastScore && lastScore > 0) {
        progressedMovement = true;
        break;
      }
    }

    const setsXp = setsDone * XP_RULES.perSet;
    const movementsXp = movementsCompleted * XP_RULES.perMovementComplete;
    const extraXp = extraCompleted * XP_RULES.extraMovement;

    const complete = isDayComplete(log, planDay);
    const dayCompleteXp = complete ? XP_RULES.perDayComplete : 0;

    let progressXp = progressedMovement ? XP_RULES.progression : 0;

    // Cardio progression (once per day)
    let cardioProgressXp = 0;
    if (planDay.kind === "cardio" && log.cardio) {
      const lastCardio = findLastCardio(records, date);
      if (isCardioImproved(log.cardio, lastCardio)) {
        cardioProgressXp = XP_RULES.cardioProgression;
      }
    }

        // Challenge + one-offs + streak
    const challengeBonus = log?.meta?.challengeClaimed
      ? XP_RULES.challengeDaily
      : 0;

    const oneOffList = Array.isArray(log?.meta?.oneOffActivities)
      ? log.meta.oneOffActivities
      : [];
    const oneOffDone = oneOffList.filter((a) => a && a.done).length;
    const oneOffXp = oneOffDone * XP_RULES.oneOff;

    // Tasks (tick-box activities) – award per ticked item
    const tasksDone = Object.values(log.tasks || {}).filter(
      (t) => t && t.done
    ).length;
    const tasksXp = tasksDone * XP_RULES.taskComplete;

    const streakXp = streakXpByDate[date] || 0;

    const baseXp =
      setsXp +
      movementsXp +
      dayCompleteXp +
      progressXp +
      cardioProgressXp +
      extraXp +
      tasksXp;

    const totalXp = baseXp + challengeBonus + oneOffXp + streakXp;

    // Extra hints (for charts / debugging)
    const setsLogged = Object.values(entries)
      .flat()
      .filter(setDidSomething).length;
    const cardioKm = safeNumber(log?.cardio?.distanceKm);
    const customMin = safeNumber(log?.custom?.durationMin);

    rows.push({
      date,
      weekday,
      kind,
      complete,
      baseXp,
      bonus: challengeBonus,
      oneOffDone,
      oneOffXp,
      streakXp,
      setsXp,
      movementsXp,
      dayCompleteXp,
      progressXp,
      cardioProgressXp,
      extraXp,
      tasksDone,
      tasksXp,
      totalXp,
      setsLogged,
      cardioKm,
      customMin,
    });
  }

  // newest first
  rows.sort((a, b) => (a.date < b.date ? 1 : -1));
  return rows;
};

const computeXpFromLogs = (records) => {
  const rows = buildXpDebugRows(records);
  return rows.reduce((sum, r) => sum + (r.totalXp || 0), 0);
};

useEffect(() => {
  setXp(computeXpFromLogs(allLogs));
}, [allLogs, plan]);

// XP breakdown per day (for cross-checking / XP log)
const xpDebugRows = useMemo(
  () => buildXpDebugRows(allLogs),
  [allLogs, plan]
);
  
  const todayYmd = useMemo(() => getTodayYMD(), []);

  const selectedDayStatus = useMemo(() => {
  // returns: "green" | "amber" | "grey"
  const d = selectedDate;
  if (!d) return "grey";

  const rec = Array.isArray(allLogs)
    ? allLogs.find((r) => (r?.date_ymd || r?.date) === d)
    : null;

  const isToday = d === todayYmd;

  // No log exists for this day
  if (!rec || !rec.log) {
    return isToday ? "amber" : "grey";
  }

  const log = rec.log;
  const weekday = log.weekday || weekdayFromYMD(d);
  const planDay = planDayForWeekday(weekday);

  const complete = isDayComplete(log, planDay);
  if (complete) return "green";

  // Logged but not complete
  return isToday ? "amber" : "grey";
}, [selectedDate, allLogs, plan, todayYmd]);


const currentPlanStreak = useMemo(() => {
  return getCurrentPlanStreak(allLogs, todayYmd, planDayForWeekday);
}, [allLogs, todayYmd, plan, activeProfileId]);

const todayPlanStatus = useMemo(() => {
  // Status for TODAY only: "green" complete, "amber" started/not complete, "amber" no log yet, "grey" not used for today.
  const rec = Array.isArray(allLogs)
    ? allLogs.find((r) => (r?.date_ymd || r?.date) === todayYmd)
    : null;

  if (!rec || !rec.log) return "amber"; // today not logged yet

  const log = rec.log;
  const weekday = log.weekday || weekdayFromYMD(todayYmd);
  const planDay = planDayForWeekday(weekday);

  const complete = isDayComplete(log, planDay);
  return complete ? "green" : "amber";
}, [allLogs, todayYmd, plan]);


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

  async function applyPlan(nextPlan, label = "Plan applied") {
    if (!(await ensureUnlocked("apply changes"))) return;
    setUndoPlan(plan || null);
    setUndoLabel(label);
    setAndCachePlan(activeProfileId, nextPlan);
    if (!family?.id) return;
    await upsertProfilePlan(activeProfileId, nextPlan);
  }

  async function undoLastPlan() {
    if (!undoPlan) return;
    if (!(await ensureUnlocked("undo changes"))) return;
    const prev = undoPlan;
    setUndoPlan(null);
    setUndoLabel("");
    setAndCachePlan(activeProfileId, prev);
    if (!family?.id) return;
    await upsertProfilePlan(activeProfileId, prev);
  }

  async function savePlan(nextPlan) {
    if (!(await ensureUnlocked("save changes"))) return;
    setAndCachePlan(activeProfileId, nextPlan);
    if (!family?.id) return;
    await upsertProfilePlan(activeProfileId, nextPlan);
  }
  
async function saveLog(nextLog) {
  // Normalise what we store
  const logToStore = nextLog ? { ...nextLog } : null;

  // 1) Update in-memory state for the selected day
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

  // 3) Persist to Supabase
  if (!family?.id || !activeProfileId) return;
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

  // 4) Refresh logs list (used for stats + XP)
  const { data } = await listLogs(family.id, activeProfileId, 2000);
  setAllLogs(
    (data || []).map((r) => ({
      date_ymd: r.date_ymd,
      log: r.log_json,
    }))
  );
}

  function blankLogForDay() {
  const restFromPlan = safeNumber(plan?.restSecByWeekday?.[selectedWeekday]) || 60;
  return {
    // Timing/session meta lives in meta.
    meta: {
      restSec: restFromPlan, // actual rest used (editable)
      sessions: [],
      dayManualMin: "", // optional override for whole day
      oneOffActivities: [],
      extraMovements: [], // NEW: per-day strength/time movements
    },
    weekday: selectedWeekday,
    typeId: dayTypeId,
    entries: {},
    tasks: {}, // tick-box tasks done for this day
    cardio: { distanceKm: "", durationMin: "", avgSpeedKmh: "" },
    custom: { durationMin: "" },
    gamify: { comboMax: 0 },
  };
}


  // --- Sessions (timing blocks) ---
  const getSessions = (l) => (l?.meta?.sessions && Array.isArray(l.meta.sessions) ? l.meta.sessions : []);

  async function addSession() {
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = {
  restSec: next?.meta?.restSec ?? (safeNumber(plan?.restSecByWeekday?.[selectedWeekday]) || 60),
  sessions: Array.isArray(next?.meta?.sessions) ? next.meta.sessions : [],
  dayManualMin: next?.meta?.dayManualMin ?? "",
  ...(next.meta || {}),
};
    const sessions = [...getSessions(next)];
    sessions.push({ id: uid(), startedAt: null, finishedAt: null, manualMin: "" });
    meta.sessions = sessions;
    next.meta = meta;
    await saveLog(next);
  }

  async function updateSession(sessionId, patch) {
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = {
  restSec: next?.meta?.restSec ?? (safeNumber(plan?.restSecByWeekday?.[selectedWeekday]) || 60),
  sessions: Array.isArray(next?.meta?.sessions) ? next.meta.sessions : [],
  dayManualMin: next?.meta?.dayManualMin ?? "",
  ...(next.meta || {}),
};
    const sessions = [...getSessions(next)].map((s) => (s.id === sessionId ? { ...s, ...patch } : s));
    meta.sessions = sessions;
    next.meta = meta;
    await saveLog(next);
  }
  async function removeSession(sessionId) {
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = {
  restSec: next?.meta?.restSec ?? (safeNumber(plan?.restSecByWeekday?.[selectedWeekday]) || 60),
  sessions: Array.isArray(next?.meta?.sessions) ? next.meta.sessions : [],
  dayManualMin: next?.meta?.dayManualMin ?? "",
  ...(next.meta || {}),
};
    const sessions = [...getSessions(next)].filter((s) => s.id !== sessionId);
    meta.sessions = sessions;
    next.meta = meta;
    await saveLog(next);
  }



  async function startSession(sessionId) {
    const ctx = await ensureAudio();
    if (ctx) playStartSound(ctx, victoryTheme);
    await updateSession(sessionId, { startedAt: new Date().toISOString(), finishedAt: null });
  }

  async function finishSession(sessionId) {
    const ctx = await ensureAudio();
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = { ...(next.meta || {}) };
    const sessions = [...getSessions(next)].map((s) =>
      s.id === sessionId ? { ...s, finishedAt: new Date().toISOString() } : s
    );
    meta.sessions = sessions;
    next.meta = meta;
    next.gamify = { ...(next.gamify || {}), comboMax: calcComboMax(next) };

    await saveLog(next);
    if (ctx) playBling(ctx, Math.max(1, next?.gamify?.comboMax || 1), victoryTheme);
  }

  
async function claimDailyBonus() {
  const qualifies = isDayComplete(logForDay, planDay);
  if (!qualifies) {
    window.alert("Finish logging today’s plan first (fill in your sets), then claim the bonus!");
    return;
  }
  if (logForDay?.meta?.challengeClaimed) return;

  const ctx = await ensureAudio();
  const next = logForDay ? { ...logForDay } : blankLogForDay();
  next.meta = { ...(next.meta || {}), challengeClaimed: true };
  await saveLog(next);

  setBonusPop(Date.now());
  if (ctx) playBling(ctx, 6, victoryTheme);
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

  async function updateOneOffActivity(id, patch) {
    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = { ...(next.meta || {}) };
    const list = Array.isArray(meta.oneOffActivities)
      ? meta.oneOffActivities.slice()
      : [];

    meta.oneOffActivities = list.map((a) =>
      a.id === id ? { ...a, ...patch } : a
    );
    next.meta = meta;
    await saveLog(next);
  }

  async function addExtraMovementForToday(name, mode) {
    const trimmed = (name || "").trim();
    if (!trimmed) return;

    const mMode = mode === "time" ? "time" : "strength";

    const next = logForDay ? { ...logForDay } : blankLogForDay();
    const meta = { ...(next.meta || {}) };
    const list = Array.isArray(meta.extraMovements)
      ? meta.extraMovements.slice()
      : [];

    list.push({
      id: uid(),
      name: trimmed,
      mode: mMode,
      allowWeight: mMode === "strength",
      allowCount: mMode === "time",
    });

    meta.extraMovements = list;
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
  
  function computeTotalMinutesForDay(log) {
    if (!log) return null;
    const manualDay = safeNumber(log?.meta?.dayManualMin);
    if (manualDay > 0) return manualDay;

    // Sum session times (manual overrides win, else start/end).
    const sess = getSessions(log);
    let hasAny = false;
    let sum = 0;
    for (const s of sess) {
      const m = safeNumber(s?.manualMin);
      if (m > 0) {
        sum += m;
        hasAny = true;
        continue;
      }
      if (s?.startedAt && s?.finishedAt) {
        const ms = new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
        const mins = ms > 0 ? ms / 60000 : 0;
        if (mins > 0) {
          sum += mins;
          hasAny = true;
        }
      }
    }
    if (hasAny) return Math.round(sum * 10) / 10;

    // Fall back to cardio/custom explicit duration
    const cardioMin = safeNumber(log?.cardio?.durationMin);
    if (cardioMin > 0) return cardioMin;
    const customMin = safeNumber(log?.custom?.durationMin);
    if (customMin > 0) return customMin;

    // Estimate from sets + rest interval (rough, motivation-only)
    const restSec = safeNumber(log?.meta?.restSec) || safeNumber(plan?.restSecByWeekday?.[selectedWeekday]) || 60;
    const setsLogged = Object.values(log?.entries || {}).flat().filter(setDidSomething).length;
    if (setsLogged <= 0) return null;
    const workPerSetMin = 0.5; // quick heuristic
    const est = setsLogged * workPerSetMin + Math.max(0, setsLogged - 1) * (restSec / 60);
    return Math.round(est * 10) / 10;
  }

  // -------- Stats from allLogs ----------
  const stats = useMemo(() => {
    const bestByExercise = new Map();
    let totalSessions = 0;
    let totalStrengthVolume = 0;
    let bestCardioSpeed = 0;
    let bestCardioDistance = 0;

    const weekly = new Map();
    const monthToStrength = new Map();
    const sessionDays = new Set();

    for (const row of allLogs) {
      const d = row.date_ymd;
      const log = row.log;
      if (!log) continue;

      const typeId = log.typeId || "strength";
      const at = (plan?.activityTypes || builtInTypes()).find((t) => t.id === typeId) || builtInTypes()[0];
      const wk = weekKey(d);
      const w = weekly.get(wk) || { sessions: 0, strengthVolume: 0, cardioKm: 0 };

      let didAnything = false;

      if (at.kind === "cardio") {
        const km = safeNumber(log.cardio?.distanceKm);
        const min = safeNumber(log.cardio?.durationMin);
        const spd = min > 0 ? km / (min / 60) : 0;
        if (km > 0 && min > 0) {
          didAnything = true;
          bestCardioSpeed = Math.max(bestCardioSpeed, spd);
          bestCardioDistance = Math.max(bestCardioDistance, km);
          w.cardioKm += km;
        }
      } else if (at.kind === "custom") {
        const min = safeNumber(log.custom?.durationMin);
        if (min > 0) didAnything = true;
      } else if (at.kind === "task") {
        const anyTaskDone = Object.values(log.tasks || {}).some((t) => t && t.done);
        if (anyTaskDone) didAnything = true;  
      } else {
        const entries = log.entries || {};
        let dayStrength = 0;
        for (const [exId, sets] of Object.entries(entries)) {
          for (const s of sets || []) {
            if (!setDidSomething(s)) continue;
            didAnything = true;
            const reps = safeNumber(s.reps);
            const vol = (safeNumber(s.weight) > 0 ? reps * safeNumber(s.weight) : reps * 1);
            // For PBs, keep volume as reps*weight if weight exists else reps
            const setVol = safeNumber(s.weight) > 0 ? reps * safeNumber(s.weight) : reps;

            dayStrength += setVol;
            totalStrengthVolume += setVol;
            w.strengthVolume += setVol;

            const prev = bestByExercise.get(exId) || { bestSetVolume: 0, bestWeight: 0, bestReps: 0, bestTime: 0, bestCount: 0 };
            bestByExercise.set(exId, {
              bestSetVolume: Math.max(prev.bestSetVolume, setVol),
              bestWeight: Math.max(prev.bestWeight, safeNumber(s.weight)),
              bestReps: Math.max(prev.bestReps, reps),
              bestTime: Math.max(prev.bestTime, safeNumber(s.timeSeconds)),
              bestCount: Math.max(prev.bestCount, safeNumber(s.count)),
            });
          }
        }
        const mk = monthKey(d);
        monthToStrength.set(mk, (monthToStrength.get(mk) || 0) + dayStrength);
      }

      if (didAnything) {
        const sc = Math.max(1, getSessions(log).length);
        totalSessions += sc;
        w.sessions += sc;
        sessionDays.add(d);
      }

      weekly.set(wk, w);
    }

    // streak (consecutive training days tracked by simply last consecutive dates)
    let streak = 0;
    let cur = new Date();
    for (let i = 0; i < 365; i++) {
      const d = ymd(cur);
      if (sessionDays.has(d)) streak += 1;
      else break;
      cur.setDate(cur.getDate() - 1);
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

    // top effort day (strength)
    let topEffortDay = null;
    let topEffortValue = 0;
    for (const row of allLogs) {
      const d = row.date_ymd;
      const log = row.log;
      if (!log) continue;
      const typeId = log.typeId || "strength";
      const at = (plan?.activityTypes || builtInTypes()).find((t) => t.id === typeId) || builtInTypes()[0];
      if (at.kind === "cardio" || at.kind === "custom") continue;
      const entries = log.entries || {};
      let v = 0;
      for (const sets of Object.values(entries)) for (const s of sets || []) v += (safeNumber(s.weight) > 0 ? safeNumber(s.reps) * safeNumber(s.weight) : safeNumber(s.reps));
      if (v > topEffortValue) { topEffortValue = v; topEffortDay = d; }
    }

    // improved this month vs last (strength volume)
    const now = new Date();
    const thisMk = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const last = new Date(now);
    last.setMonth(now.getMonth() - 1);
    const lastMk = `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}`;
    const thisVol = monthToStrength.get(thisMk) || 0;
    const lastVol = monthToStrength.get(lastMk) || 0;
    const improved = lastVol > 0 ? Math.round(((thisVol - lastVol) / lastVol) * 100) : null;

    return {
    totalMinutes: "",
      totalSessions,
      totalStrengthVolume,
      bestCardioSpeed,
      bestCardioDistance,
      weeklyChart,
      streak,
      improved,
      topEffortDay,
      topEffortValue,
      bestByExercise,
    };
  }, [allLogs, plan]);

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
      const km = safeNumber(log?.cardio?.distanceKm);
      const min = safeNumber(log?.cardio?.durationMin);
      if (km <= 0 || min <= 0) continue;
      const spd = km / (min / 60);
      pts.push({ date: d, km: Number(km.toFixed(2)), speed: Number(spd.toFixed(2)) });
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
    <h1 className="title">{activeProfile?.name || "Profile"}</h1>

    <div className="header-right">
      <div className="selectWide">
        <Select
          value={activeProfileId}
          onChange={setActiveProfileId}
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
          <div className="gridLog">
            <Card className="pad">
              <div className="row logTopRow">
                <div className="rowLeft">
                  <div className="field">
                    <div className="label">Date</div>
                    <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="input" />
                  </div>
                </div>

                                <div className="rowRight logTopActions">
                  <div
                    className="dayStatusDot"
                    title={selectedDayTitle}
                    style={{ background: selectedDayDotColor }}
                  />
                  <SecondaryButton onClick={addSession}>+ Session</SecondaryButton>
                  <SecondaryButton onClick={resetDay}>Reset day</SecondaryButton>
                </div>

              </div>

              <div className="muted mt8">
                {formatDate(selectedDate)} • <b>{planDay.name}</b> ({planDay.kind})
              </div>

              {/* Sessions */}
              <div className="panel mt12">
                <div className="rowBetween">
                  <div className="h3">Sessions</div>
                  <div className="muted">Tap start/finish or enter minutes</div>
                </div>
                <div className="stack mt12">
                  {getSessions(logForDay).length === 0 ? (
                    <div className="muted">No sessions yet. Tap “+ Session”.</div>
                  ) : (
                    getSessions(logForDay).map((s, idx) => (
                      <div key={s.id} className="sessionRow">
                        <div className="sessionTitle">Session {idx + 1}</div>
                        <div className="sessionBtns">
                          <PrimaryButton
                            className="btnSmall"
                            disabled={!!s.startedAt}
                            onClick={() => startSession(s.id)}
                          >
                            Start
                          </PrimaryButton>
                          <PrimaryButton
                            className="btnSmall"
                            disabled={!s.startedAt || !!s.finishedAt}
                            onClick={() => finishSession(s.id)}
                          >
                            Finish
                          </PrimaryButton>
                          <SecondaryButton
                            className="btnSmall"
                            onClick={() => removeSession(s.id)}
                          >
                            Remove
                          </SecondaryButton>
                        </div>
                        <div className="sessionTimes">
                          <div className="mini"><span className="label">Start</span> {s.startedAt ? new Date(s.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                          <div className="mini"><span className="label">Finish</span> {s.finishedAt ? new Date(s.finishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}</div>
                        </div>
                        <div className="sessionManual">
                          <div className="label">Minutes (manual)</div>
                          <Input type="number" min={0} step={0.5} value={s.manualMin ?? ""} onChange={(v) => updateSession(s.id, { manualMin: v })} placeholder="e.g. 25" />
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="grid3 mt12">
                  <div>
                    <div className="label">Rest between sets (sec)</div>
                    <Input type="number" min={0} step={5} value={logForDay?.meta?.restSec ?? (safeNumber(plan?.restSecByWeekday?.[selectedWeekday]) || 60)} onChange={(v) => {
                      const next = logForDay ? { ...logForDay } : blankLogForDay();
                      next.meta = { ...(next.meta || {}), restSec: v };
                      saveLog(next);
                    }} />
                  </div>
                  <div>
                    <div className="label">Total minutes (override)</div>
                    <Input type="number" min={0} step={0.5} value={logForDay?.meta?.dayManualMin ?? ""} onChange={(v) => {
                      const next = logForDay ? { ...logForDay } : blankLogForDay();
                      next.meta = { ...(next.meta || {}), dayManualMin: v };
                      saveLog(next);
                    }} placeholder="leave blank" />
                  </div>
                  <div className="muted">
                    If left blank, we’ll use session timers, cardio/custom time, or an estimate.
                  </div>
                </div>
              </div>

              {planDay.kind === "cardio" ? (
                <div className="panel mt16">
                  <div className="h2">Cardio log</div>
                  {(plan?.cardioTargetByWeekday?.[selectedWeekday] || plan?.runSettings?.[selectedWeekday]?.text) ? (
                    <div className="muted mt8"><b>Today’s focus:</b> {plan?.cardioTargetByWeekday?.[selectedWeekday] || plan?.runSettings?.[selectedWeekday]?.text}</div>
                  ) : null}
                  <div className="grid3 mt12">
                    <div>
                      <div className="label">Distance (km)</div>
                      <Input type="number" min={0} step={0.01} value={logForDay?.cardio?.distanceKm ?? ""} onChange={(v) => updateCardio({ distanceKm: v })} placeholder="e.g. 2.50" />
                    </div>
                    <div>
                      <div className="label">Time (minutes)</div>
                      <Input type="number" min={0} step={0.1} value={logForDay?.cardio?.durationMin ?? ""} onChange={(v) => updateCardio({ durationMin: v })} placeholder="e.g. 14.5" />
                    </div>
                    <div>
                      <div className="label">Avg speed (km/h)</div>
                      <Input value={logForDay?.cardio?.avgSpeedKmh ?? ""} readOnly onChange={null} placeholder="auto" />
                    </div>
                  </div>
                  <div className="muted mt8">Used for run/swim/etc.</div>
                </div>
              ) : planDay.kind === "custom" ? (
                <div className="panel mt16">
                  <div className="h2">Duration log</div>
                  <div className="grid3 mt12">
                    <div>
                      <div className="label">Minutes</div>
                      <Input type="number" min={0} step={0.5} value={logForDay?.custom?.durationMin ?? ""} onChange={(v) => updateCustom({ durationMin: v })} placeholder="e.g. 30" />
                    </div>
                  </div>
                  <div className="muted mt8">Good for Pilates, yoga, mobility, etc.</div>
                </div>
                           ) : (
                <div className="stack mt16">
                  {/* Extra movements for this specific date */}
                  <div className="panel">
                    <div className="h2">Extra movements for today</div>
                    <div className="muted mt4">
                      Use this for extra strength or timed blocks that aren’t in the weekly plan.
                    </div>
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
                      <div style={{ minWidth: 160 }}>
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
                      <div style={{ width: 8 }} />
                      <PrimaryButton
                        onClick={async () => {
                          await addExtraMovementForToday(
                            extraMovNameDraft,
                            extraMovModeDraft
                          );
                          setExtraMovNameDraft("");
                        }}
                      >
                        + Add movement
                      </PrimaryButton>
                    </div>
                  </div>

                  {(() => {
                    const baseMovs = planDay.movements || [];
                    const extraMovs = getExtraMovements(logForDay);
                    const allMovs = [...baseMovs, ...extraMovs];

                    if (allMovs.length === 0) {
                      return (
                        <div className="dashed">
                          No movements for this day. Add one above, or go to <b>Plan</b> and add weekly movements.
                        </div>
                      );
                    }

                    return allMovs.map((ex) => {
                      const sets = (logForDay?.entries?.[ex.id] || [{}, {}, {}]).map((s) => ({
                        reps: "",
                        weight: "",
                        timeSeconds: ex.fixedSeconds ? String(ex.fixedSeconds) : "",
                        count: "",
                        notes: "",
                        meta: { restSecDefault: 60, sessionsCount: 1 },
                        ...(s || {}),
                      }));
                      const isTime = ex.mode === "time";

                      return (
                        <div key={ex.id} className="panel">
                          <div className="panelTop">
                            <div>
                              <div className="h2">{ex.name}</div>
                              {ex.note ? <div className="muted mt8">{ex.note}</div> : null}
                              <div className="pills mt8">
                                <Pill>{ex.mode}</Pill>
                                <Pill>3 sets</Pill>
                                {ex.fixedSeconds ? <Pill>{ex.fixedSeconds}s</Pill> : null}
                              </div>
                              <div className="muted mt8">
                                {(() => {
                                  const lastSets = findLastMovementSets(allLogs, ex.id, ymd(selectedDate));
                                  const lastTxt = summarizeStrengthSets(lastSets);
                                  const initialTarget = {
                                    text: ex.targetText || null,
                                    reps: ex.targetReps || null,
                                    weight: ex.targetWeight || null,
                                  };
                                  const t = suggestStrengthTarget({
                                    ex,
                                    lastSets,
                                    initialTarget,
                                    ageGroup: activeProfile?.age_group || "under16",
                                  });
                                  return (
                                    <div>
                                      <div><b>Last time:</b> {lastTxt}</div>
                                      <div><b>Target today:</b> {t.text}</div>
                                    </div>
                                  );
                                })()}
                              </div>
                            </div>
                          </div>

                          <div className="stack mt12">
                            {[0, 1, 2].map((i) => {
                              const s = sets[i] || {};
                              return (
                                <div key={i} className="setRow">
                                  <div className="setLabel">Set {i + 1}</div>

                                  {!isTime ? (
                                    <>
                                      <div>
                                        <div className="label">Reps</div>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={s.reps ?? ""}
                                          onChange={(v) => addOrUpdateSet(ex.id, i, { reps: v })}
                                          placeholder="0"
                                        />
                                      </div>
                                      <div>
                                        <div className="label">Weight (kg)</div>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={0.5}
                                          value={s.weight ?? ""}
                                          onChange={(v) => addOrUpdateSet(ex.id, i, { weight: v })}
                                          placeholder={ex.allowWeight ? "kg" : "(optional)"}
                                        />
                                      </div>
                                    </>
                                  ) : (
                                    <>
                                      <div>
                                        <div className="label">Time (sec)</div>
                                        <Input
                                          type="number"
                                          min={0}
                                          step={1}
                                          value={s.timeSeconds ?? (ex.fixedSeconds ? String(ex.fixedSeconds) : "")}
                                          onChange={(v) => addOrUpdateSet(ex.id, i, { timeSeconds: v })}
                                          placeholder={ex.fixedSeconds ? "" : "e.g. 60"}
                                        />
                                      </div>
                                      {ex.allowCount ? (
                                        <div>
                                          <div className="label">{ex.countLabel || "Count"}</div>
                                          <Input
                                            type="number"
                                            min={0}
                                            step={1}
                                            value={s.count ?? ""}
                                            onChange={(v) => addOrUpdateSet(ex.id, i, { count: v })}
                                            placeholder="0"
                                          />
                                        </div>
                                      ) : (
                                        <div />
                                      )}
                                    </>
                                  )}

                                  <div className="notes">
                                    <div className="label">Notes (optional)</div>
                                    <Input
                                      value={s.notes ?? ""}
                                      onChange={(v) => addOrUpdateSet(ex.id, i, { notes: v })}
                                      placeholder="How did it feel?"
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}

              {/* Tick-box tasks from extra day activities */}
              {(() => {
                const acts = getDayActivitiesForWeekday(plan || defaultPlanForFamily(), selectedWeekday);
                const extras = acts.slice(1);
                const activityTypes = (plan?.activityTypes || builtInTypes());
                const taskBlocks = extras.filter((b) => {
                  const t = activityTypes.find((x) => x.id === b.typeId);
                  return t && (t.kind === "task" || t.id === "tasks");
                });
                if (!taskBlocks.length) return null;

                return (
                  <div className="panel mt16">
                    <div className="h2">Activities</div>
                    <div className="stack mt12">
                      {taskBlocks.map((block) => (
                        <div key={block.id} className="stack">
                          {block.label ? <div className="label">{block.label}</div> : null}
                          {(block.tasks || []).length ? (
                            (block.tasks || []).map((task) => (
                              <label key={task.id} className="check">
                                <input
                                  type="checkbox"
                                  checked={!!logForDay?.tasks?.[task.id]?.done}
                                  onChange={(e) => updateTask(task.id, e.target.checked)}
                                />
                                {task.label}
                              </label>
                            ))
                          ) : (
                             // Fallback: treat the whole block as a single tick-box task
      <label className="check">
        <input
          type="checkbox"
          checked={!!logForDay?.tasks?.[block.id]?.done}
          onChange={(e) => updateTask(block.id, e.target.checked)}
        />
        {block.label || "Done"}
      </label>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* One-off activities for this specific date */}
              <div className="panel mt16">
                <div className="rowBetween">
                  <div>
                    <div className="h3">One-off activities today</div>
                    <div className="muted mt4">
                      Use this for PE, football matches, bonus walks, or extra workouts that aren’t in the weekly plan.
                    </div>
                  </div>
                </div>

                <div className="mt12">
                  <div className="label">Add one-off</div>
                  <div className="row mt4">
                    <div style={{ flex: 1 }}>
                      <input
                        className="input"
                        list="oneoff-name-options"
                        value={oneOffNameDraft}
                        onChange={(e) => setOneOffNameDraft(e.target.value)}
                        placeholder="e.g. Extra run, PE lesson, Football match"
                      />
                      <datalist id="oneoff-name-options">
                        {knownOneOffNames.map((n) => (
                          <option key={n} value={n} />
                        ))}
                      </datalist>
                    </div>
                    <div style={{ width: 8 }} />
                    <div style={{ minWidth: 170 }}>
                      <Select
                        value={oneOffKindDraft}
                        onChange={setOneOffKindDraft}
                        options={[
                          { value: "strength", label: "Strength / sets" },
                          { value: "cardio", label: "Cardio (run / bike / swim)" },
                          { value: "custom", label: "Tick-box task / habit" },
                        ]}
                      />
                    </div>
                    <div style={{ width: 8 }} />
                    <PrimaryButton
                      onClick={async () => {
                        await addOneOffActivity(oneOffNameDraft, oneOffKindDraft);
                        setOneOffNameDraft("");
                      }}
                    >
                      + Add
                    </PrimaryButton>
                  </div>
                </div>

                <div className="stack mt12">
                  {getOneOffActivities(logForDay).length === 0 ? (
                    <div className="muted">
                      No one-off activities logged yet.
                    </div>
                  ) : (
                    getOneOffActivities(logForDay).map((a) => (
                      <div key={a.id} className="oneOffRow">
                        <div className="rowBetween">
                          <label className="check">
                            <input
                              type="checkbox"
                              checked={!!a.done}
                              onChange={(e) =>
                                updateOneOffActivity(a.id, { done: e.target.checked })
                              }
                            />
                            <span>{a.name}</span>
                          </label>
                          <div className="mini">
                            <div className="muted">
                              Kind: {a.kind || "custom"}
                            </div>
                            <div className="row mt4">
                              <SecondaryButton onClick={() => addOneOffToWeeklyPlan(a)}>
                                Add to weekly plan
                              </SecondaryButton>
                              <div style={{ width: 6 }} />
                              <SecondaryButton onClick={() => removeOneOffActivity(a.id)}>
                                Remove
                              </SecondaryButton>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="muted mt8">
                  Tip: if this becomes a regular thing, tap <b>“Add to weekly plan”</b>
                  to turn it into a recurring movement.
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
                  <SummaryStat label="Sessions" value={Math.max(0, getSessions(logForDay).length) || "—"} />
                  <SummaryStat label="Sets logged" value={Object.values(logForDay?.entries || {}).flat().filter(setDidSomething).length} />
                  <SummaryStat label="Cardio km" value={safeNumber(logForDay?.cardio?.distanceKm) ? Number(logForDay.cardio.distanceKm).toFixed(2) : "—"} />
                </div>

                <div className="mini mt12">
                  <div className="label">Estimated calories</div>
                  <div className="big">
                    {(() => {
                      const kcal = estimateCalories({ kind: planDay.kind, bodyWeightKg: activeProfile?.body_weight_kg, log: logForDay });
                      return kcal === null ? "Record activity or Add bodyweight in Settings" : `${kcal} kcal`;
                    })()}
                  </div>
                  <div className="muted">Estimate only.</div>
                </div>
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
                      const intervalHint = plan?.cardioTargetByWeekday?.[selectedWeekday] || plan?.runSettings?.[selectedWeekday]?.text || "";
                      return (
                        <div className="mini">
                          <div className="label">Cardio</div>
                          <div className="muted">Last: {lastTxt}</div>
                          <div><b>Target:</b> {t.text}</div>
                          {intervalHint ? <div className="muted mt8">{intervalHint}</div> : null}
                        </div>
                      );
                    })()
                  ) : (
                    <div className="muted">Log your session and keep your streak alive.</div>
                  )}
                </div>
              </Card>

<Card className="pad">
                <div className="h3">Mini challenges</div>
                <div className="stack mt12">
                  <div className="challenge">
                    <div>
                      Claim daily bonus <span className="muted">(15 XP)</span>
                    </div>
                    <div className="row">
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={!!logForDay?.meta?.challengeClaimed}
                          onChange={() => claimDailyBonus()}
                        />
                        Done
                      </label>
                    </div>
                  </div>
                  <Challenge text="Complete today’s plan" done={isDayComplete(logForDay, planDay)} />
                  <Challenge text="Hit a combo streak (5 sets in a row)" done={(logForDay?.gamify?.comboMax || 0) >= 5} />
                  <Challenge text="XP to next level" done={xpToNext <= 25} />
                  {bonusPop ? <div key={bonusPop} className="confettiBurst" aria-hidden="true" /> : null}
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
                <SummaryStat label="Sessions" value={(stats.totalSessions ?? 0) || "—"} />
                <SummaryStat label="Streak" value={`${stats.streak} day${stats.streak === 1 ? "" : "s"}`} />
                <SummaryStat label="Top effort day" value={stats.topEffortDay || "—"} />
                <SummaryStat label="Top effort volume" value={stats.topEffortDay ? Math.round(stats.topEffortValue).toLocaleString() : "—"} />
                <SummaryStat label="Best cardio speed" value={stats.bestCardioSpeed ? `${stats.bestCardioSpeed.toFixed(2)} km/h` : "—"} />
                <SummaryStat label="Best cardio distance" value={stats.bestCardioDistance ? `${stats.bestCardioDistance.toFixed(2)} km` : "—"} />
              </div>

              <div className="mt16">
                <div className="h3">Most improved this month</div>
                <div className="mt8">{stats.improved === null ? "Log sessions across two months to see improvement." : `${stats.improved}% vs last month (strength volume)`}</div>
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
            <Card className="pad planSide">
              <div className="h2">Edit day</div>
              <div className="muted mt8">Choose a weekday, then set its activity type and default rest interval.</div>

              <div className="weekPills mt12">
                {weekdays.map((d) => (
                  <button key={d} className={"weekPill " + (planWeekday === d ? "active" : "")} onClick={() => setPlanWeekday(d)}>
                    {d}
                  </button>
                ))}
              </div>

              <div className="mt16">
                <div className="label">Rest between sets (sec)</div>
                <Input
                  type="number"
                  min={0}
                  step={5}
                  value={(plan?.restSecByWeekday?.[planWeekday] ?? 60)}
                  onChange={async (v) => {
                    const next = { ...plan, restSecByWeekday: { ...(plan?.restSecByWeekday || {}), [planWeekday]: Number(v) } };
                    await savePlan(next);
                  }}
                />
                <div className="muted mt8">Shown on the Log screen and used for time estimates if you don’t enter minutes.</div>
              </div>

              <div className="mt16">
                <div className="h3">Activity types</div>
                <div className="muted mt8">Add custom types (e.g. Swim, Pilates). Everyone can then use them in their weekly plan.</div>
                <div className="stack mt12">
                  {(plan?.activityTypes || builtInTypes()).map((t) => (
                    <div key={t.id} className="mini rowBetween">
                      <div>
                        <b>{t.name}</b>
                        <div className="muted">{t.kind}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="row mt12">
                  <PrimaryButton
                    onClick={async () => {
                      const name = window.prompt("New activity type name (e.g. Swim, Pilates):");
                      if (!name) return;
                      const kind = window.prompt('Kind? Type one of: strength, cardio, time, custom', 'custom');
                      const k = (kind || "custom").toLowerCase();
                      const allowed = new Set(["strength", "cardio", "time", "custom"]);
                      const finalKind = allowed.has(k) ? k : "custom";
                      const nextType = { id: `custom_${uid()}`, name, kind: finalKind };
                      const next = { ...plan, activityTypes: [...(plan?.activityTypes || builtInTypes()), nextType] };
                      await savePlan(next);
                    }}
                  >
                    + Add type
                  </PrimaryButton>
                </div>
              </div>
            </Card>

            <Card className="pad planMain">
              <div className="rowBetween">
                <div>
                  <div className="h2">Weekly plan (fully custom)</div>
                  <div className="muted">Assign an activity type to each day. Add custom types for other people (swim, pilates, etc.).</div>
                </div>
                <div className="selectWide">
                </div>
              </div>

              
              <div className="panel mt16">
                <div className="h3">Preset plans</div>
                <div className="muted mt8">Pick a goal, then apply it (this can overwrite your current week).</div>
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
                      await applyPlan({ ...preset.plan, presetId: preset.id }, `Preset applied: ${preset.name}`);
                      // refresh templates list isn't needed here
                    }}
                  >
                    Apply preset
                  </PrimaryButton>
                </div>
                {undoPlan ? (
                  <div className="rowBetween mt12">
                    <div className="mini">Undo available: <b>{undoLabel || "Recent change"}</b></div>
                    <SecondaryButton onClick={undoLastPlan}>Undo</SecondaryButton>
                  </div>
                ) : null}
              </div>

              <div className="panel mt16">
                <div className="rowBetween">
                  <div>
                    <div className="h3">Saved weekly plans</div>
                    <div className="muted mt8">Save multiple weeks (templates) and switch between them.</div>
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
                      await applyPlan({ ...(tpl.plan_json || {}), templateId: tpl.id }, `Loaded saved plan: ${tpl.name}`);
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
                      const { error } = await createPlanTemplate(family.id, name, plan || {});
                      if (error) window.alert(error.message || String(error));
                      const { data } = await listPlanTemplates(family.id);
                      setPlanTemplates(data || []);
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
                      const ok = window.confirm(`Update "${tpl.name}" with your current plan?`);
                      if (!ok) return;
                      if (!(await ensureUnlocked("update a template"))) return;
                      const { error } = await updatePlanTemplate(tpl.id, tpl.name, plan || {});
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
                      const ok = window.confirm(`Delete saved plan "${tpl.name}"?`);
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

              <div className="panel mt16">
                <div className="h3">Day activity type</div>
                <div className="grid3 mt12">
                  <div>
                    <div className="label">Type</div>
                    <Select
                      value={(plan?.dayTypeByWeekday?.[planWeekday] || "strength")}
                      onChange={async (v) => {
                        const next = { ...plan, dayTypeByWeekday: { ...(plan.dayTypeByWeekday || {}), [planWeekday]: v } };
                        await savePlan(next);
                      }}
                      options={(plan?.activityTypes || builtInTypes()).map((t) => ({ value: t.id, label: t.name }))}
                    />
                  </div>
                  <div className="mini">
                    <div className="label">Kind</div>
                    <div className="big">{planActivityType.kind}</div>
                    <div className="muted">Controls which inputs appear.</div>
                  </div>
                  <div className="mini">
                    <div className="label">Movements</div>
                    <div className="big">{planActivityType.movementsEnabled ? "Enabled" : "None"}</div>
                    <div className="muted">Strength / Timed rounds use movements.</div>
                  </div>
                </div>
              </div>

                            {/* Extra activity blocks for this weekday (e.g. Run + HIIT) */}
              <div className="panel mt16">
                <div className="rowBetween">
                  <div>
                    <div className="h3">Extra activities on this day</div>
                    <div className="muted mt4">
                      Use this when the same day has more than one block —
                      e.g. <b>Run + HIIT</b>, or <b>School PE + home workout</b>.
                    </div>
                  </div>
                </div>

                <div className="stack mt12">
                  {(plan?.dayActivitiesByWeekday?.[planWeekday] || []).length === 0 ? (
                    <div className="muted">
                      No extra activities yet. The main type above is still your primary plan.
                    </div>
                  ) : (
                    (plan?.dayActivitiesByWeekday?.[planWeekday] || []).map((a) => (
                      <div key={a.id} className="planRow">
                        <div className="planMoveHead">
                          <div className="planLeft">
                            <div className="planName">
                              <Input
                                value={a.label || ""}
                                onChange={async (v) => {
                                  const list = (plan?.dayActivitiesByWeekday?.[planWeekday] || []).map((x) =>
                                    x.id === a.id ? { ...x, label: v } : x
                                  );
                                  const next = {
                                    ...plan,
                                    dayActivitiesByWeekday: {
                                      ...(plan.dayActivitiesByWeekday || {}),
                                      [planWeekday]: list,
                                    },
                                  };
                                  await savePlan(next);
                                }}
                                placeholder="e.g. Extra run"
                              />
                            </div>
                            <div className="pills mt8">
                              <Pill>
                                {(plan?.activityTypes || builtInTypes()).find(
                                  (t) => t.id === (a.typeId || "")
                                )?.name || "Activity"}
                              </Pill>
                            </div>
                          </div>

                          <div className="planBtns">
                            <div style={{ minWidth: 160 }}>
                              <Select
                                value={
                                  a.typeId ||
                                  (plan?.dayTypeByWeekday?.[planWeekday] || "strength")
                                }
                                onChange={async (v) => {
                                  const list = (plan?.dayActivitiesByWeekday?.[planWeekday] || []).map((x) =>
                                    x.id === a.id ? { ...x, typeId: v } : x
                                  );
                                  const next = {
                                    ...plan,
                                    dayActivitiesByWeekday: {
                                      ...(plan.dayActivitiesByWeekday || {}),
                                      [planWeekday]: list,
                                    },
                                  };
                                  await savePlan(next);
                                }}
                                options={(plan?.activityTypes || builtInTypes()).map((t) => ({
                                  value: t.id,
                                  label: t.name,
                                }))}
                              />
                            </div>

                            <SecondaryButton
                              onClick={async () => {
                                const list = (plan?.dayActivitiesByWeekday?.[planWeekday] || []).filter(
                                  (x) => x.id !== a.id
                                );
                                const next = {
                                  ...plan,
                                  dayActivitiesByWeekday: {
                                    ...(plan.dayActivitiesByWeekday || {}),
                                    [planWeekday]: list,
                                  },
                                };
                                await savePlan(next);
                              }}
                            >
                              Remove
                            </SecondaryButton>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                <div className="row mt12">
                  <PrimaryButton
                    onClick={async () => {
                      const byDay = { ...(plan?.dayActivitiesByWeekday || {}) };
                      const list = Array.isArray(byDay[planWeekday])
                        ? byDay[planWeekday].slice()
                        : [];
                      list.push({
                        id: uid(),
                        typeId: plan?.dayTypeByWeekday?.[planWeekday] || "strength",
                        label: "",
                      });
                      byDay[planWeekday] = list;
                      const next = { ...plan, dayActivitiesByWeekday: byDay };
                      await savePlan(next);
                    }}
                  >
                    + Add extra activity
                  </PrimaryButton>
                </div>
              </div>


              {planActivityType.kind === "cardio" ? (
                <div className="panel mt16">
                  <div className="h3">Cardio target (optional)</div>
                  <div className="muted mt8">
                    Examples: <b>2.5 km</b> • <b>15 min</b> • <b>6×(1 min fast / 1 min easy)</b> • <b>Tempo: hard but controlled</b>
                    <br/>
                    Leave blank to use last time → auto targets.
                  </div>
                  <div className="mt12">
                    <Input
                      value={(plan?.cardioTargetByWeekday?.[planWeekday]) || ""}
                      onChange={async (v) => {
                        const next = {
                          ...plan,
                          cardioTargetByWeekday: { ...(plan.cardioTargetByWeekday || {}), [planWeekday]: v },
                        };
                        await savePlan(next);
                      }}
                      placeholder='e.g. 6×(1 min fast / 1 min easy)'
                    />
                  </div>
                </div>
              ) : null}

              {planActivityType.movementsEnabled ? (
  <div className="stack mt16">
    {(planMovements || []).map((m) => (
      <div key={m.id} className="planRow">
        <div className="planMoveHead">
          <div className="planLeft">
            <div className="planName">{m.name}</div>
            {m.note ? <div className="muted mt4">{m.note}</div> : null}

            <div className="pills mt8">
              <Pill>{m.mode}</Pill>
              <Pill>3 sets</Pill>
              {m.fixedSeconds ? <Pill>{m.fixedSeconds}s</Pill> : null}
              {m.allowWeight ? <Pill>weights</Pill> : null}
              {m.allowCount ? <Pill>{m.countLabel || "count"}</Pill> : null}
              {m.targetText ? <Pill>Target: {m.targetText}</Pill> : null}
            </div>
          </div>

          <div className="planBtns">
            <SecondaryButton
              onClick={async () => {
                const examples =
                  m.mode === "strength"
                    ? 'Examples:\n• 10\n• 10 @ 20kg\n• 8–12 reps'
                    : m.mode === "time"
                      ? 'Examples:\n• 60s\n• 1 min\n• 3 × 1 min rounds'
                      : m.mode === "custom"
                        ? 'Examples:\n• 20 min\n• 30 min easy'
                        : 'Examples:\n• 10';

                const promptText = `Optional target for "${m.name}" (leave blank for none):\n${examples}\n\nTip: You can type anything — it’s just a reminder.`;
                const prevDefault =
                  (m.targetText != null && String(m.targetText)) ||
                  (m.targetReps != null ? String(m.targetReps) : "");
                const raw = prompt(promptText, prevDefault);
                if (raw === null) return;

                const txt = raw.trim();
                let targetText = txt === "" ? null : txt;

                let targetReps = null;
                let targetWeight = null;

                if (m.mode === "strength" && targetText) {
                  const m1 = targetText.match(/^\s*(\d+)\s*(?:@|at)?\s*(\d+(?:\.\d+)?)?\s*(?:kg)?\s*$/i);
                  if (m1) {
                    targetReps = Number(m1[1]);
                    if (m1[2] != null && m.allowWeight) targetWeight = Number(m1[2]);
                  } else {
                    const m2 = targetText.match(/^\s*(\d+)\s*$/);
                    if (m2) targetReps = Number(m2[1]);
                  }
                  if (!Number.isFinite(targetReps)) targetReps = null;
                  if (!Number.isFinite(targetWeight)) targetWeight = null;
                }

                const nextMov = (planMovements || []).map((x) =>
                  x.id === m.id ? { ...x, targetText, targetReps, targetWeight } : x
                );
                const next = {
                  ...plan,
                  movementsByWeekday: { ...(plan.movementsByWeekday || {}), [planWeekday]: nextMov },
                };
                await savePlan(next);
              }}
            >
              Targets
            </SecondaryButton>

            <SecondaryButton
              onClick={async () => {
                const name = prompt("Rename movement:", m.name);
                if (!name) return;
                const nextMov = (planMovements || []).map((x) =>
                  x.id === m.id ? { ...x, name: name.trim() } : x
                );
                const next = {
                  ...plan,
                  movementsByWeekday: { ...(plan.movementsByWeekday || {}), [planWeekday]: nextMov },
                };
                await savePlan(next);
              }}
            >
              Rename
            </SecondaryButton>

            <SecondaryButton
              onClick={async () => {
                const prev = m.note || "";
                const nextNote = prompt(`Coach note for "${m.name}" (optional):`, prev);
                if (nextNote === null) return;
                const nextMov = (planMovements || []).map((x) =>
                  x.id === m.id ? { ...x, note: nextNote.trim() } : x
                );
                const next = {
                  ...plan,
                  movementsByWeekday: { ...(plan.movementsByWeekday || {}), [planWeekday]: nextMov },
                };
                await savePlan(next);
              }}
            >
              Coach note
            </SecondaryButton>

            <SecondaryButton
              onClick={async () => {
                const nextMov = (planMovements || []).filter((x) => x.id !== m.id);
                const next = {
                  ...plan,
                  movementsByWeekday: { ...(plan.movementsByWeekday || {}), [planWeekday]: nextMov },
                };
                await savePlan(next);
              }}
            >
              Remove
            </SecondaryButton>
          </div>
        </div>
      </div>
    ))}

    <Card className="pad">
  <div className="h3">Add movement</div>
  <div className="muted">Add as many movements as you like for this day.</div>
  <AddMovement
    defaultKind={planActivityType.kind}
    onAdd={async (m) => {
      const arr = [...(planMovements || [])];
      arr.push({ ...m, id: uid() });
      const next = { ...plan, movementsByWeekday: { ...(plan.movementsByWeekday || {}), [planWeekday]: arr } };
      await savePlan(next);
    }}
  />
</Card>
  </div>
) : (
  <div className="dashed mt16">
    This activity type doesn’t use movements (just log distance/time or minutes).
  </div>
)}

                            {/* Tick-box tasks for this day */}
              <div className="panel mt16">
                <div className="rowBetween">
                  <div>
                    <div className="h3">Tick-box tasks for this day</div>
                    <div className="muted mt8">
                      Use this for simple yes/no tasks (reading, homework, hydration, tidy room, etc.).
                    </div>
                  </div>
                  <PrimaryButton
                    disabled={!plan || !!tasksActivityForPlanWeekday}
                    onClick={async () => {
                      if (!plan) return;
                      const label = window.prompt(
                        "Name for this task group (e.g. 'Extras', 'Habits', 'School tasks'):",
                        "Extras"
                      );
                      const name = label && label.trim();
                      const builtInTaskType = builtInTypes().find((t) => t.id === "tasks");
                      const taskType =
                        activityTypesForPlan.find((t) => t.kind === "task" || t.id === "tasks") ||
                        builtInTaskType;

                      let nextPlan = plan;
                      if (!activityTypesForPlan.some((t) => t.id === taskType.id)) {
                        nextPlan = { ...plan, activityTypes: [...activityTypesForPlan, taskType] };
                      }

                      const newBlock = {
  id: uid(),
  typeId: taskType.id,
  label: name || "",
  tasks: [
    {
      id: uid(),
      label: name || "Task",
      completed: false,
    },
  ],
};


                      const updatedPlan = updateDayActivities(nextPlan, planWeekday, (extras) => [
                        ...extras,
                        newBlock,
                      ]);
                      await savePlan(updatedPlan);
                    }}
                  >
                    + Add tasks
                  </PrimaryButton>
                </div>

                {tasksActivityForPlanWeekday ? (
                  <>
                    <div className="mt12">
                      <div className="label">Group label (optional)</div>
                      <Input
                        value={tasksActivityForPlanWeekday.label || ""}
                        onChange={async (v) => {
                          if (!plan) return;
                          const updatedPlan = updateDayActivities(plan, planWeekday, (extras) =>
                            extras.map((b) =>
                              b.id === tasksActivityForPlanWeekday.id ? { ...b, label: v } : b
                            )
                          );
                          await savePlan(updatedPlan);
                        }}
                        placeholder="e.g. Extras, Habits, School tasks"
                      />
                    </div>

                    <div className="stack mt12">
                      {(tasksActivityForPlanWeekday.tasks || []).map((task) => (
                        <div key={task.id} className="rowBetween">
                          <div style={{ flex: 1, marginRight: 8 }}>
                            <Input
                              value={task.label || ""}
                              onChange={async (v) => {
                                if (!plan) return;
                                const updatedPlan = updateDayActivities(plan, planWeekday, (extras) =>
                                  extras.map((b) => {
                                    if (b.id !== tasksActivityForPlanWeekday.id) return b;
                                    const nextTasks = (b.tasks || []).map((t) =>
                                      t.id === task.id ? { ...t, label: v } : t
                                    );
                                    return { ...b, tasks: nextTasks };
                                  })
                                );
                                await savePlan(updatedPlan);
                              }}
                              placeholder="Task name"
                            />
                          </div>
                          <SecondaryButton
                            onClick={async () => {
                              if (!plan) return;
                              const updatedPlan = updateDayActivities(plan, planWeekday, (extras) =>
                                extras.map((b) => {
                                  if (b.id !== tasksActivityForPlanWeekday.id) return b;
                                  const nextTasks = (b.tasks || []).filter((t) => t.id !== task.id);
                                  return { ...b, tasks: nextTasks };
                                })
                              );
                              await savePlan(updatedPlan);
                            }}
                          >
                            Remove
                          </SecondaryButton>
                        </div>
                      ))}
                    </div>

                    <div className="row mt12">
                      <PrimaryButton
                        onClick={async () => {
                          if (!plan) return;
                          const label = window.prompt("New task name (e.g. 'Reading 20 min'):");
                          if (!label || !label.trim()) return;
                          const newTask = { id: uid(), label: label.trim() };
                          const updatedPlan = updateDayActivities(plan, planWeekday, (extras) =>
                            extras.map((b) => {
                              if (b.id !== tasksActivityForPlanWeekday.id) return b;
                              const nextTasks = [...(b.tasks || []), newTask];
                              return { ...b, tasks: nextTasks };
                            })
                          );
                          await savePlan(updatedPlan);
                        }}
                      >
                        + Add task
                      </PrimaryButton>
                      <div style={{ width: 10 }} />
                      <SecondaryButton
                        onClick={async () => {
                          if (!plan || !tasksActivityForPlanWeekday) return;
                          const ok = window.confirm("Remove all tick-box tasks for this day?");
                          if (!ok) return;
                          const updatedPlan = updateDayActivities(plan, planWeekday, (extras) =>
                            extras.filter((b) => b.id !== tasksActivityForPlanWeekday.id)
                          );
                          await savePlan(updatedPlan);
                        }}
                      >
                        Remove tasks block
                      </SecondaryButton>
                    </div>
                  </>
                ) : (
                  <div className="muted mt12">
                    No tick-box tasks set for this day yet.
                  </div>
                )}
              </div>

              </Card>
            </div>
          )}



        {tab === "rewards" && (
          <div className="grid2cols">
            <Card className="pad">
              <div className="h2">Level + XP</div>
              <div className="grid2 mt12">
                <SummaryStat label="Level" value={level} />
                <SummaryStat label="XP" value={xp} />
                <SummaryStat label="XP to next" value={xpToNext} />
                <SummaryStat label="Unlocked" value={`${unlocked.arcade ? "Arcade " : ""}${unlocked.chill ? "Chill" : ""}`.trim() || "—"} />
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

              <div className="mt16">
                <div className="h3">Rewards shop</div>
                <div className="muted">Pick a victory sound theme. Unlock more as you level up.</div>
                <div className="stack mt12">
                  <RewardItem title="Classic" desc="Default sounds" active={victoryTheme === "classic"} locked={false} onPick={() => setVictoryTheme("classic")} />
                  <RewardItem title="Arcade" desc="8-bit vibes" active={victoryTheme === "arcade"} locked={!unlocked.arcade} onPick={() => unlocked.arcade && setVictoryTheme("arcade")} />
                  <RewardItem title="Chill" desc="Softer sounds" active={victoryTheme === "chill"} locked={!unlocked.chill} onPick={() => unlocked.chill && setVictoryTheme("chill")} />
                </div>
                <div className="mini mt12">Unlock rules: Level 3 = Arcade, Level 5 = Chill. (100 XP per level)</div>
              </div>
                             {/* XP log – recent XP breakdown */}
              <div className="panel mt16">
                <div className="rowBetween">
                  <div>
                    <div className="h3">XP log</div>
                    <div className="muted mt4">
                      See how XP is being earned for this profile. Newest days first.
                    </div>
                  </div>
                  <SecondaryButton onClick={() => setShowXpLog((v) => !v)}>
                    {showXpLog ? "Hide" : "Show"}
                  </SecondaryButton>
                </div>

                {showXpLog && (
                  <div
                    className="stack mt8"
                    style={{ maxHeight: 260, overflowY: "auto" }}
                  >
                    {xpDebugRows.slice(0, 50).map((row, idx) => (
                      <div key={`${row.date}-${idx}`} className="rowBetween mini">
                        <div>
                          <b>{row.date}</b> ({row.weekday}) – {row.kind}
                          {row.complete ? " ✅" : ""}
                          {row.oneOffDone
                            ? ` • ${row.oneOffDone} one-off${row.oneOffDone > 1 ? "s" : ""}`
                            : ""}
                        </div>
                        <div>
                          {row.totalXp} XP
                          <span className="muted">
                            {` (base ${row.baseXp}`}
                            {row.bonus ? ` + bonus ${row.bonus}` : ""}
                            {row.oneOffXp ? ` + one-offs ${row.oneOffXp}` : ""}
                            {")"}
                          </span>
                        </div>
                      </div>
                    ))}

                    {xpDebugRows.length === 0 && (
                      <div className="muted">No logs yet for this profile.</div>
                    )}
                  </div>
                )}
              </div>
            </Card>

            <Card className="pad">
              <div className="h2">Settings</div>
              <div className="panel mt12">
                <div className="rowBetween">
                  <div>
                    <div className="h3">Sounds</div>
                    <div className="muted">Whoosh + combo + level-up</div>
                  </div>
                  <label className="check">
                    <input type="checkbox" checked={soundOn} onChange={(e) => setSoundOn(e.target.checked)} />
                    On
                  </label>
                </div>
              </div>
              <div className="panel mt12">
                <div className="h3">Theme</div>
                <Select
                  value={victoryTheme}
                  onChange={(v) => canUseTheme(v) && setVictoryTheme(v)}
                  options={[
                    { value: "classic", label: "Classic" },
                    { value: "arcade", label: unlocked.arcade ? "Arcade" : "Arcade (locked)" },
                    { value: "chill", label: unlocked.chill ? "Chill" : "Chill (locked)" },
                  ]}
                />
              </div>
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

        <footer className="footer">Online build: Account + Profiles • fully custom weekly plan • charts • rewards.</footer>
      </div>

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
      .btn-primary{background:#0f172a;color:#fff;border-color:#0f172a}
      .btn-secondary{background:#fff}
      .btn:hover{filter:brightness(0.98)}
      .btn:active{transform:scale(0.99)}
      .btn-disabled{opacity:.55}
      .input{width:100%;border-radius:14px;border:1px solid #e2e8f0;padding:10px 12px;font-size:14px;outline:none}
      .input:focus{border-color:#94a3b8}
      .label{font-size:12px;font-weight:800;color:#475569;margin-bottom:6px}
      .muted{color:#64748b;font-size:14px}
      .h2{font-size:18px;font-weight:900}
      .h3{font-size:14px;font-weight:900}
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
      .setLabel{font-weight:900;color:#475569}
      .notes{grid-column:1/-1}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
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

