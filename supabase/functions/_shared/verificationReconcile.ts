export const MATCH_VERSION = "verification_match_v1";
const PROVIDER_THRESHOLD = 0.7;
const MANUAL_THRESHOLD = 0.75;
const MANUAL_MARGIN = 0.1;

function text(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function finite(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const result = Number(value);
  return Number.isFinite(result) ? result : null;
}

function positive(value: unknown) {
  const result = finite(value);
  return result !== null && result > 0 ? result : null;
}

function normalizedToken(value: unknown) {
  return text(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function canonicalActivityFamily(value: unknown) {
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

function typeCompatibility(a: unknown, b: unknown) {
  const left = canonicalActivityFamily(a);
  const right = canonicalActivityFamily(b);
  if (left === "unknown" || right === "unknown") return { compatible: true, score: 0.05 };
  if (left === right) return { compatible: true, score: 0.15 };
  return { compatible: false, score: 0 };
}

function similarityScore(a: unknown, b: unknown, rules: Array<{ relative: number; absolute: number; score: number }>) {
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

function isoMs(value: unknown) {
  const ms = Date.parse(text(value));
  return Number.isFinite(ms) ? ms : null;
}

function obscuredTime(value: unknown) {
  return /T00:00:01(?:\.000)?Z$/.test(text(value));
}

function duration(row: any) {
  return positive(row?.moving_duration_sec) ?? positive(row?.elapsed_duration_sec);
}

function scorePair(left: any, right: any) {
  if (!left?.id || !right?.id || left.id === right.id) return 0;
  if (!left.profile_id || left.profile_id !== right.profile_id) return 0;
  if (!left.provider || !right.provider || left.provider === right.provider) return 0;
  if (left.source_deleted_at || right.source_deleted_at) return 0;
  if (left.local_date_ymd && right.local_date_ymd && left.local_date_ymd !== right.local_date_ymd) return 0;

  const type = typeCompatibility(left.activity_type, right.activity_type);
  if (!type.compatible) return 0;

  let timeScore = 0;
  if (!obscuredTime(left.started_at) && !obscuredTime(right.started_at)) {
    const leftMs = isoMs(left.started_at);
    const rightMs = isoMs(right.started_at);
    if (leftMs !== null && rightMs !== null) {
      const deltaSec = Math.abs(leftMs - rightMs) / 1000;
      if (deltaSec <= 120) timeScore = 0.4;
      else if (deltaSec <= 300) timeScore = 0.3;
      else if (deltaSec <= 600) timeScore = 0.2;
      else if (deltaSec <= 900) timeScore = 0.1;
      else return 0;
    }
  }

  const distanceScore = similarityScore(left.distance_m, right.distance_m, [
    { relative: 0.03, absolute: 100, score: 0.25 },
    { relative: 0.08, absolute: 250, score: 0.15 },
  ]);
  const durationScore = similarityScore(duration(left), duration(right), [
    { relative: 0.05, absolute: 90, score: 0.2 },
    { relative: 0.12, absolute: 180, score: 0.1 },
  ]);
  return Math.round((timeScore + type.score + distanceScore + durationScore) * 1000) / 1000;
}

function median(values: Array<number | null>) {
  const rows = values.filter((value): value is number => Number.isFinite(value as number)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function buildGroups(observations: any[]) {
  const rows = observations
    .filter((row) => row?.id && row?.profile_id && !row?.source_deleted_at)
    .slice()
    .sort((a, b) =>
      text(a.profile_id).localeCompare(text(b.profile_id)) ||
      (isoMs(a.started_at) ?? Number.MAX_SAFE_INTEGER) - (isoMs(b.started_at) ?? Number.MAX_SAFE_INTEGER) ||
      text(a.provider).localeCompare(text(b.provider)) ||
      text(a.id).localeCompare(text(b.id))
    );
  const groups: Array<{ observations: any[] }> = [];

  for (const row of rows) {
    const candidates = groups
      .map((group) => {
        const scores = group.observations.map((member) => scorePair(member, row));
        const eligible = scores.length > 0 && scores.every((score) => score >= PROVIDER_THRESHOLD);
        return { group, eligible, mean: eligible ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0 };
      })
      .filter((candidate) => candidate.eligible)
      .sort((a, b) => b.mean - a.mean || text(a.group.observations[0]?.id).localeCompare(text(b.group.observations[0]?.id)));

    if (candidates.length) candidates[0].group.observations.push(row);
    else groups.push({ observations: [row] });
  }

  return groups.map((group) => {
    group.observations.sort((a, b) => text(a.id).localeCompare(text(b.id)));
    const pairScores: number[] = [];
    for (let left = 0; left < group.observations.length; left += 1) {
      for (let right = left + 1; right < group.observations.length; right += 1) {
        pairScores.push(scorePair(group.observations[left], group.observations[right]));
      }
    }
    const localDates = [...new Set(group.observations.map((row) => text(row.local_date_ymd)).filter(Boolean))];
    const types = group.observations.map((row) => canonicalActivityFamily(row.activity_type)).filter((value) => value !== "unknown");
    const typeCounts = new Map<string, number>();
    for (const type of types) typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
    const activityType = [...typeCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] || "unknown";
    const startedTimes = group.observations.map((row) => isoMs(row.started_at)).filter((value): value is number => value !== null);

    return {
      observations: group.observations,
      activityType,
      startedAt: startedTimes.length ? new Date(Math.min(...startedTimes)).toISOString() : text(group.observations[0]?.started_at),
      localDateYmd: localDates.length === 1 ? localDates[0] : "",
      distanceM: median(group.observations.map((row) => positive(row.distance_m))),
      durationSec: median(group.observations.map((row) => duration(row))),
      identityMethod: group.observations.length > 1 ? "automatic_dedup" : "single_source",
      identityConfidence: pairScores.length ? Math.min(...pairScores) : null,
    };
  });
}

function cardioEntries(payload: any) {
  const result: any[] = [];
  const add = (cardio: any, meta: any) => {
    if (!cardio || typeof cardio !== "object") return;
    const distanceKm = positive(cardio.distanceKm);
    const durationMin = positive(cardio.durationMin);
    if (distanceKm === null && durationMin === null) return;
    result.push({ ...meta, distanceM: distanceKm === null ? null : distanceKm * 1000, durationSec: durationMin === null ? null : durationMin * 60 });
  };
  add(payload?.cardio, { blockId: "", activityType: "unknown" });
  for (const block of Array.isArray(payload?.blocks) ? payload.blocks : []) {
    if (!block || block.cancelled || text(block.typeId).toLowerCase() !== "cardio") continue;
    add(block.cardio, { blockId: text(block.id), activityType: text(block.cardioType || block.label, "unknown") });
  }
  if (result.length > 1 && !result[0].blockId) {
    const legacy = result[0];
    const duplicate = result.slice(1).some((entry) => entry.distanceM === legacy.distanceM && entry.durationSec === legacy.durationSec);
    if (duplicate) result.shift();
  }
  return result;
}

function durationEntries(payload: any) {
  const result: any[] = [];
  const legacy = positive(payload?.custom?.durationMin);
  if (legacy !== null) result.push({ blockId: "", activityType: "unknown", distanceM: null, durationSec: legacy * 60 });
  for (const block of Array.isArray(payload?.blocks) ? payload.blocks : []) {
    if (!block || block.cancelled || text(block.typeId).toLowerCase() !== "duration") continue;
    const minutes = positive(block?.duration?.minutes);
    if (minutes !== null) result.push({ blockId: text(block.id), activityType: text(block.label, "unknown"), distanceM: null, durationSec: minutes * 60 });
  }
  return result;
}

function manualCandidates(logs: any[], profileId: string) {
  const result: any[] = [];
  for (const log of logs) {
    if (text(log?.profile_id) !== profileId || !/^\d{4}-\d{2}-\d{2}$/.test(text(log?.date_ymd))) continue;
    const payload = log?.log_json && typeof log.log_json === "object" ? log.log_json : {};
    const cardio = cardioEntries(payload);
    const rows = cardio.length ? cardio : durationEntries(payload);
    rows.forEach((entry, index) => result.push({
      id: `${log.id}:${entry.blockId || "legacy"}:${cardio.length ? "cardio" : "duration"}:${index}`,
      manualLogId: log.id,
      manualBlockId: entry.blockId || null,
      profileId,
      dateYmd: log.date_ymd,
      activityType: entry.activityType,
      distanceM: entry.distanceM,
      durationSec: entry.durationSec,
    }));
  }
  return result;
}

function manualScore(group: any, candidate: any) {
  let dateScore = 0;
  if (group.localDateYmd) {
    if (group.localDateYmd !== candidate.dateYmd) return 0;
    dateScore = 0.25;
  } else {
    if (text(group.startedAt).slice(0, 10) !== candidate.dateYmd) return 0;
    dateScore = 0.15;
  }
  const type = typeCompatibility(group.activityType, candidate.activityType);
  if (!type.compatible) return 0;
  const distanceScore = similarityScore(group.distanceM, candidate.distanceM, [
    { relative: 0.03, absolute: 100, score: 0.35 },
    { relative: 0.08, absolute: 250, score: 0.22 },
    { relative: 0.15, absolute: 500, score: 0.1 },
  ]);
  const durationScore = similarityScore(group.durationSec, candidate.durationSec, [
    { relative: 0.05, absolute: 90, score: 0.25 },
    { relative: 0.12, absolute: 180, score: 0.15 },
    { relative: 0.2, absolute: 300, score: 0.08 },
  ]);
  return Math.round((dateScore + type.score + distanceScore + durationScore) * 1000) / 1000;
}

function findManualMatch(group: any, candidates: any[]) {
  const scored = candidates
    .map((candidate) => ({ candidate, score: manualScore(group, candidate) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || text(a.candidate.id).localeCompare(text(b.candidate.id)));
  const best = scored[0];
  const second = scored[1];
  if (!best || best.score < MANUAL_THRESHOLD) return { state: "no_match", confidence: best?.score || 0, candidate: null };
  if (second && best.score - second.score < MANUAL_MARGIN) return { state: "ambiguous", confidence: best.score, candidate: null };
  return { state: "matched", confidence: best.score, candidate: best.candidate };
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function identityKey(group: any) {
  const ids = group.observations.map((row: any) => text(row.id)).sort();
  return `${MATCH_VERSION}:${await sha256Hex(ids.join("|"))}`;
}

async function findOrCreateVerifiedActivity(adminClient: any, profile: any, group: any, key: string) {
  const existing = await adminClient.from("verified_activities").select("id").eq("identity_key", key).maybeSingle();
  if (existing.error) throw existing.error;
  if (existing.data?.id) {
    const updated = await adminClient.from("verified_activities").update({
      activity_type: group.activityType,
      started_at: group.startedAt,
      status: "active",
      identity_method: group.identityMethod,
      identity_confidence: group.identityConfidence,
      match_version: MATCH_VERSION,
    }).eq("id", existing.data.id);
    if (updated.error) throw updated.error;
    return existing.data.id;
  }

  const inserted = await adminClient.from("verified_activities").insert({
    family_id: profile.family_id,
    profile_id: profile.id,
    activity_type: group.activityType,
    started_at: group.startedAt,
    status: "active",
    identity_method: group.identityMethod,
    identity_confidence: group.identityConfidence,
    match_version: MATCH_VERSION,
    identity_key: key,
  }).select("id").single();
  if (!inserted.error) return inserted.data.id;
  if (inserted.error.code !== "23505") throw inserted.error;
  const raced = await adminClient.from("verified_activities").select("id").eq("identity_key", key).single();
  if (raced.error) throw raced.error;
  return raced.data.id;
}

export async function reconcileVerifiedActivitiesForProfile(adminClient: any, profileId: string) {
  const profileResult = await adminClient.from("profiles").select("id,family_id").eq("id", profileId).maybeSingle();
  if (profileResult.error || !profileResult.data) throw profileResult.error || new Error("Profile not found");
  const profile = profileResult.data;

  const [observationsResult, logsResult] = await Promise.all([
    adminClient.from("external_activity_observations").select(
      "id,profile_id,provider,provider_activity_id,started_at,local_date_ymd,source_timezone,activity_type,distance_m,elapsed_duration_sec,moving_duration_sec,source_deleted_at"
    ).eq("profile_id", profileId).order("started_at", { ascending: true }),
    adminClient.from("logs").select("id,profile_id,date_ymd,log_json").eq("profile_id", profileId).order("date_ymd", { ascending: true }),
  ]);
  if (observationsResult.error || logsResult.error) throw observationsResult.error || logsResult.error;

  const groups = buildGroups(observationsResult.data || []);
  const candidates = manualCandidates(logsResult.data || [], profileId);
  const activeKeys: string[] = [];
  let linkedManual = 0;

  for (const group of groups) {
    const key = await identityKey(group);
    activeKeys.push(key);
    const verifiedId = await findOrCreateVerifiedActivity(adminClient, profile, group, key);

    const clearLinks = await adminClient.from("verified_activity_observations").delete().eq("verified_activity_id", verifiedId);
    if (clearLinks.error) throw clearLinks.error;
    const memberships = group.observations.map((observation: any) => ({
      verified_activity_id: verifiedId,
      observation_id: observation.id,
      family_id: profile.family_id,
      profile_id: profile.id,
    }));
    if (memberships.length) {
      const linked = await adminClient.from("verified_activity_observations").insert(memberships);
      if (linked.error) throw linked.error;
    }

    const match = findManualMatch(group, candidates);
    if (match.state === "matched" && match.candidate) {
      const persisted = await adminClient.from("external_activity_links").upsert({
        family_id: profile.family_id,
        profile_id: profile.id,
        verified_activity_id: verifiedId,
        manual_log_id: match.candidate.manualLogId,
        manual_block_id: match.candidate.manualBlockId,
        match_method: "automatic",
        match_confidence: match.confidence,
      }, { onConflict: "verified_activity_id" });
      if (persisted.error) throw persisted.error;
      linkedManual += 1;
    } else {
      const cleared = await adminClient.from("external_activity_links").delete().eq("verified_activity_id", verifiedId);
      if (cleared.error) throw cleared.error;
    }
  }

  let staleQuery = adminClient.from("verified_activities").select("id,identity_key").eq("profile_id", profileId).eq("match_version", MATCH_VERSION);
  const staleResult = await staleQuery;
  if (staleResult.error) throw staleResult.error;
  const staleIds = (staleResult.data || [])
    .filter((row: any) => !row.identity_key || !activeKeys.includes(row.identity_key))
    .map((row: any) => row.id);
  if (staleIds.length) {
    const deleted = await adminClient.from("verified_activities").delete().in("id", staleIds);
    if (deleted.error) throw deleted.error;
  }

  return {
    profileId,
    observationCount: (observationsResult.data || []).filter((row: any) => !row.source_deleted_at).length,
    verifiedActivityCount: groups.length,
    automaticManualLinks: linkedManual,
    removedStaleIdentities: staleIds.length,
    matchVersion: MATCH_VERSION,
  };
}
