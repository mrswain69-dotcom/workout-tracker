export const VERIFICATION_MANUAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
export const VERIFICATION_MATCH_WINDOW_DAYS = 2;

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function ymdMs(value) {
  const ymd = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}

export function canonicalVerificationActivityFamily(value) {
  const token = text(value, "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!token || ["unknown", "other", "workout", "activity"].includes(token)) return "unknown";
  if (/(^|_)trail_?run|(^|_)run(ning)?($|_)|jog/.test(token)) return "run";
  if (/(ride|cycling|cycle|bike|biking|mountain_bike|ebike)/.test(token)) return "cycle";
  if (/swim/.test(token)) return "swim";
  if (/(walk|hike|hiking)/.test(token)) return "walk_hike";
  if (/(soccer|football|rugby|basketball|hockey|lacrosse)/.test(token)) return "team_sport";
  if (/(strength|weight_training|weights|weightlifting|resistance)/.test(token)) return "strength";
  if (/(row|rowing|kayak|canoe|paddle)/.test(token)) return "row";
  if (/(yoga|pilates|mobility|stretch)/.test(token)) return "mobility";
  if (token === "cardio") return "cardio";
  return token;
}

export function verificationFamiliesCompatible(left, right) {
  const a = canonicalVerificationActivityFamily(left);
  const b = canonicalVerificationActivityFamily(right);
  if (a === b) return true;
  if (a === "unknown" || b === "unknown") return false;
  if (a === "cardio" && ["run", "cycle", "swim", "walk_hike", "row", "team_sport"].includes(b)) return true;
  if (b === "cardio" && ["run", "cycle", "swim", "walk_hike", "row", "team_sport"].includes(a)) return true;
  return false;
}

export function verificationDateOffsetDays(externalYmd, workoutYmd) {
  const externalMs = ymdMs(externalYmd);
  const workoutMs = ymdMs(workoutYmd);
  if (externalMs === null || workoutMs === null) return null;
  return Math.round((workoutMs - externalMs) / 86400000);
}

export function isVerificationDateCompatible(externalYmd, workoutYmd, maxDays = VERIFICATION_MATCH_WINDOW_DAYS) {
  const offset = verificationDateOffsetDays(externalYmd, workoutYmd);
  return offset !== null && Math.abs(offset) <= Math.max(0, Number(maxDays) || 0);
}

export function manualSyncCooldown(connection, nowMs = Date.now()) {
  const last = Date.parse(text(connection?.last_manual_sync_at));
  if (!Number.isFinite(last)) return { blocked: false, remainingMs: 0, nextAllowedAt: "" };
  const next = last + VERIFICATION_MANUAL_SYNC_COOLDOWN_MS;
  const remainingMs = Math.max(0, next - Number(nowMs || Date.now()));
  return {
    blocked: remainingMs > 0,
    remainingMs,
    nextAllowedAt: new Date(next).toISOString(),
  };
}

export function verificationRollup({ eligibleComponents = 0, verifiedComponents = 0, sessionVerified = false } = {}) {
  const eligible = Math.max(0, Number(eligibleComponents) || 0);
  const verified = Math.min(eligible, Math.max(0, Number(verifiedComponents) || 0));
  if (eligible > 0 && verified === eligible) return "verified";
  if (verified > 0 || sessionVerified) return eligible > verified ? "partial" : "session_verified";
  return "unverified";
}

export const VERIFICATION_HISTORY_OPTIONS = Object.freeze([
  { value: 0, label: "From now onwards" },
  { value: 7, label: "Last 7 days" },
  { value: 30, label: "Last 30 days" },
  { value: 90, label: "Last 90 days" },
  { value: 365, label: "Last year" },
]);

export const VERIFICATION_AUTO_LOG_WINDOW_OPTIONS = Object.freeze([
  { value: 0, label: "Today only" },
  { value: 1, label: "Today + previous day" },
  { value: 2, label: "Today + previous 2 days" },
  { value: 3, label: "Today + previous 3 days" },
]);
