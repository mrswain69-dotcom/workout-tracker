import { buildWorkoutHistoryEvents } from "./historicalTimelineEventEngine.js";

export const VERIFICATION_MATCH_VERSION = "verification_match_v1";
export const PROVIDER_DEDUP_THRESHOLD = 0.7;
export const MANUAL_MATCH_THRESHOLD = 0.75;
export const MANUAL_MATCH_MARGIN = 0.1;

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function finite(value) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function positive(value) {
  const result = finite(value);
  return result !== null && result > 0 ? result : null;
}

function validYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(text(value));
}

function isoMs(value) {
  const ms = Date.parse(text(value));
  return Number.isFinite(ms) ? ms : null;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}

function median(values) {
  const rows = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function normalizedToken(value) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

export function canonicalActivityFamily(value) {
  const token = normalizedToken(value);
  if (!token || ["unknown", "other", "workout", "cardio", "activity"].includes(token)) return "unknown";
  if (/(^|_)trail_?run|(^|_)run(ning)?($|_)/.test(token)) return "run";
  if (/(ride|cycling|cycle|bike|biking|mountain_bike|ebike)/.test(token)) return "cycle";
  if (/swim/.test(token)) return "swim";
  if (/(walk|hike|hiking)/.test(token)) return "walk_hike";
  if (/(soccer|football)/.test(token)) return "football";
  if (/(strength|weight_training|weights|weightlifting|resistance)/.test(token)) return "strength";
  if (/(row|rowing)/.test(token)) return "row";
  if (/(ski|snowboard)/.test(token)) return "snow";
  if (/(yoga|pilates|mobility|stretch)/.test(token)) return "mobility";
  return token;
}

function activityTypeCompatibility(a, b) {
  const left = canonicalActivityFamily(a);
  const right = canonicalActivityFamily(b);
  if (left === "unknown" || right === "unknown") return { compatible: true, score: 0.05 };
  if (left === right) return { compatible: true, score: 0.15 };
  return { compatible: false, score: 0 };
}

function similarityScore(a, b, rules) {
  const left = positive(a);
  const right = positive(b);
  if (left === null || right === null) return 0;
  const absolute = Math.abs(left - right);
  const relative = absolute / Math.max(left, right);
  for (const rule of rules) {
    if (relative <= rule.relative || absolute <= rule.absolute) return rule.score;
  }
  return 0;
}

function observationId(row) {
  return text(row?.id || row?.observationId || `${text(row?.provider)}:${text(row?.provider_activity_id || row?.providerActivityId)}`);
}

function normalizeObservation(row) {
  const startedAt = text(row?.started_at || row?.startedAt);
  const localDate = text(row?.local_date_ymd || row?.localDateYmd);
  return {
    id: observationId(row),
    profileId: text(row?.profile_id || row?.profileId),
    provider: normalizedToken(row?.provider),
    providerActivityId: text(row?.provider_activity_id || row?.providerActivityId),
    startedAt,
    startedMs: isoMs(startedAt),
    localDateYmd: validYmd(localDate) ? localDate : "",
    activityType: text(row?.activity_type || row?.activityType, "unknown"),
    distanceM: positive(row?.distance_m ?? row?.distanceM),
    movingDurationSec: positive(row?.moving_duration_sec ?? row?.movingDurationSec),
    elapsedDurationSec: positive(row?.elapsed_duration_sec ?? row?.elapsedDurationSec),
    sourceDeletedAt: text(row?.source_deleted_at || row?.sourceDeletedAt),
    sourceTimezone: text(row?.source_timezone || row?.sourceTimezone),
    raw: row,
  };
}

function observationDuration(observation) {
  return observation.movingDurationSec ?? observation.elapsedDurationSec;
}

function startTimeLooksObscured(observation) {
  const value = text(observation?.startedAt);
  return /T00:00:01(?:\.000)?Z$/.test(value);
}

export function scoreProviderObservationPair(leftRow, rightRow) {
  const left = normalizeObservation(leftRow);
  const right = normalizeObservation(rightRow);
  if (!left.id || !right.id || left.id === right.id) return 0;
  if (!left.profileId || left.profileId !== right.profileId) return 0;
  if (!left.provider || !right.provider || left.provider === right.provider) return 0;
  if (left.sourceDeletedAt || right.sourceDeletedAt) return 0;
  if (left.localDateYmd && right.localDateYmd && left.localDateYmd !== right.localDateYmd) return 0;

  const type = activityTypeCompatibility(left.activityType, right.activityType);
  if (!type.compatible) return 0;

  const obscured = startTimeLooksObscured(left) || startTimeLooksObscured(right);
  let timeScore = 0;
  if (!obscured && left.startedMs !== null && right.startedMs !== null) {
    const deltaSec = Math.abs(left.startedMs - right.startedMs) / 1000;
    if (deltaSec <= 120) timeScore = 0.4;
    else if (deltaSec <= 300) timeScore = 0.3;
    else if (deltaSec <= 600) timeScore = 0.2;
    else if (deltaSec <= 900) timeScore = 0.1;
    else return 0;
  }

  const distanceScore = similarityScore(left.distanceM, right.distanceM, [
    { relative: 0.03, absolute: 100, score: 0.25 },
    { relative: 0.08, absolute: 250, score: 0.15 },
  ]);
  const durationScore = similarityScore(observationDuration(left), observationDuration(right), [
    { relative: 0.05, absolute: 90, score: 0.2 },
    { relative: 0.12, absolute: 180, score: 0.1 },
  ]);

  return round(timeScore + type.score + distanceScore + durationScore);
}

function groupConfidence(members) {
  if (members.length <= 1) return null;
  const scores = [];
  for (let left = 0; left < members.length; left += 1) {
    for (let right = left + 1; right < members.length; right += 1) {
      scores.push(scoreProviderObservationPair(members[left].raw, members[right].raw));
    }
  }
  return scores.length ? round(Math.min(...scores)) : null;
}

export function summarizeVerifiedActivityGroup(group) {
  const members = Array.isArray(group?.observations) ? group.observations.map(normalizeObservation) : [];
  const active = members.filter((row) => row.id && !row.sourceDeletedAt);
  if (!active.length) return null;

  const types = active.map((row) => canonicalActivityFamily(row.activityType)).filter((value) => value !== "unknown");
  const typeCounts = new Map();
  for (const type of types) typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
  const activityType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "unknown";
  const localDates = [...new Set(active.map((row) => row.localDateYmd).filter(Boolean))];
  const started = active.map((row) => row.startedMs).filter((value) => value !== null);

  return {
    profileId: active[0].profileId,
    activityType,
    startedAt: started.length ? new Date(Math.min(...started)).toISOString() : active[0].startedAt,
    localDateYmd: localDates.length === 1 ? localDates[0] : "",
    distanceM: median(active.map((row) => row.distanceM)),
    durationSec: median(active.map(observationDuration)),
    providers: [...new Set(active.map((row) => row.provider).filter(Boolean))].sort(),
    observationIds: active.map((row) => row.id).sort(),
  };
}

export function buildVerifiedActivityGroups(observations = [], { minimumScore = PROVIDER_DEDUP_THRESHOLD } = {}) {
  const rows = (Array.isArray(observations) ? observations : [])
    .map(normalizeObservation)
    .filter((row) => row.id && row.profileId && !row.sourceDeletedAt)
    .sort(
      (a, b) =>
        a.profileId.localeCompare(b.profileId) ||
        (a.startedMs ?? Number.MAX_SAFE_INTEGER) - (b.startedMs ?? Number.MAX_SAFE_INTEGER) ||
        a.provider.localeCompare(b.provider) ||
        a.id.localeCompare(b.id)
    );

  const groups = [];
  for (const row of rows) {
    const candidates = groups
      .filter((group) => group.profileId === row.profileId)
      .map((group) => {
        const pairScores = group.observations.map((member) => scoreProviderObservationPair(member.raw, row.raw));
        const eligible = pairScores.length > 0 && pairScores.every((score) => score >= minimumScore);
        return {
          group,
          eligible,
          meanScore: eligible ? pairScores.reduce((sum, score) => sum + score, 0) / pairScores.length : 0,
        };
      })
      .filter((candidate) => candidate.eligible)
      .sort((a, b) => b.meanScore - a.meanScore || a.group.id.localeCompare(b.group.id));

    if (candidates.length) {
      candidates[0].group.observations.push(row);
      candidates[0].group.observations.sort((a, b) => a.id.localeCompare(b.id));
      candidates[0].group.id = `verified:${candidates[0].group.observations.map((item) => item.id).join("+")}`;
    } else {
      groups.push({
        id: `verified:${row.id}`,
        profileId: row.profileId,
        observations: [row],
      });
    }
  }

  return groups
    .map((group) => {
      const confidence = groupConfidence(group.observations);
      const summary = summarizeVerifiedActivityGroup(group);
      return {
        id: group.id,
        profileId: group.profileId,
        observations: group.observations.map((row) => row.raw),
        observationIds: group.observations.map((row) => row.id).sort(),
        identityMethod: group.observations.length > 1 ? "automatic_dedup" : "single_source",
        identityConfidence: confidence,
        matchVersion: VERIFICATION_MATCH_VERSION,
        summary,
      };
    })
    .sort((a, b) => a.profileId.localeCompare(b.profileId) || a.id.localeCompare(b.id));
}

export function buildManualVerificationCandidates(logs = [], { profileId = "" } = {}) {
  const events = buildWorkoutHistoryEvents(logs, { profileId });
  const candidates = [];

  for (const event of events) {
    if (event?.sourceType !== "workout" || event?.eventType !== "training_day") continue;
    const cardio = Array.isArray(event?.evidence?.cardio) ? event.evidence.cardio : [];
    const durations = Array.isArray(event?.evidence?.duration) ? event.evidence.duration : [];

    cardio.forEach((entry, index) => {
      candidates.push({
        id: `${event.sourceId}:${text(entry?.blockId, "legacy")}:cardio:${index}`,
        profileId: text(event.profileId || profileId),
        manualLogId: text(event.sourceId),
        manualBlockId: text(entry?.blockId),
        dateYmd: event.date,
        kind: "cardio",
        activityType: text(entry?.cardioType || entry?.label, "unknown"),
        distanceM: positive(entry?.distanceKm) !== null ? positive(entry.distanceKm) * 1000 : null,
        durationSec: positive(entry?.durationMin) !== null ? positive(entry.durationMin) * 60 : null,
      });
    });

    if (!cardio.length) {
      durations.forEach((entry, index) => {
        candidates.push({
          id: `${event.sourceId}:${text(entry?.blockId, "legacy")}:duration:${index}`,
          profileId: text(event.profileId || profileId),
          manualLogId: text(event.sourceId),
          manualBlockId: text(entry?.blockId),
          dateYmd: event.date,
          kind: "duration",
          activityType: text(entry?.label, "unknown"),
          distanceM: null,
          durationSec: positive(entry?.minutes) !== null ? positive(entry.minutes) * 60 : null,
        });
      });
    }
  }

  return candidates.sort((a, b) => a.dateYmd.localeCompare(b.dateYmd) || a.id.localeCompare(b.id));
}

export function scoreVerifiedActivityManualCandidate(group, candidate) {
  const summary = group?.summary || summarizeVerifiedActivityGroup(group);
  if (!summary || !candidate) return 0;
  if (!summary.profileId || summary.profileId !== text(candidate.profileId)) return 0;

  let dateScore = 0;
  if (summary.localDateYmd) {
    if (summary.localDateYmd !== text(candidate.dateYmd)) return 0;
    dateScore = 0.25;
  } else {
    const fallbackDate = text(summary.startedAt).slice(0, 10);
    if (!validYmd(fallbackDate) || fallbackDate !== text(candidate.dateYmd)) return 0;
    dateScore = 0.15;
  }

  const type = activityTypeCompatibility(summary.activityType, candidate.activityType);
  if (!type.compatible) return 0;

  const distanceScore = similarityScore(summary.distanceM, candidate.distanceM, [
    { relative: 0.03, absolute: 100, score: 0.35 },
    { relative: 0.08, absolute: 250, score: 0.22 },
    { relative: 0.15, absolute: 500, score: 0.1 },
  ]);
  const durationScore = similarityScore(summary.durationSec, candidate.durationSec, [
    { relative: 0.05, absolute: 90, score: 0.25 },
    { relative: 0.12, absolute: 180, score: 0.15 },
    { relative: 0.2, absolute: 300, score: 0.08 },
  ]);

  return round(dateScore + type.score + distanceScore + durationScore);
}

export function findManualVerificationMatch(
  group,
  candidates = [],
  { minimumScore = MANUAL_MATCH_THRESHOLD, minimumMargin = MANUAL_MATCH_MARGIN } = {}
) {
  const scored = (Array.isArray(candidates) ? candidates : [])
    .map((candidate) => ({ candidate, score: scoreVerifiedActivityManualCandidate(group, candidate) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || text(a.candidate?.id).localeCompare(text(b.candidate?.id)));

  const best = scored[0] || null;
  const second = scored[1] || null;
  if (!best || best.score < minimumScore) {
    return { state: "no_match", confidence: best?.score || 0, candidate: null, alternatives: scored };
  }
  if (second && best.score - second.score < minimumMargin) {
    return { state: "ambiguous", confidence: best.score, candidate: null, alternatives: scored };
  }
  return { state: "matched", confidence: best.score, candidate: best.candidate, alternatives: scored };
}
