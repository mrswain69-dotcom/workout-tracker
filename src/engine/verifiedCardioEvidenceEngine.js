function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function finitePositive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function roundTo(value, places = 2) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  const factor = 10 ** places;
  return Math.round((number + Number.EPSILON) * factor) / factor;
}

function validYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(cleanText(value));
}

function ymdFromIso(value) {
  const text = cleanText(value);
  return /^\d{4}-\d{2}-\d{2}/.test(text) ? text.slice(0, 10) : "";
}

export function classifyVerifiedCardioType(value) {
  const compact = cleanText(value, "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "");
  if (compact.includes("run") || compact.includes("jog")) return "run";
  if (compact.includes("ride") || compact.includes("cycle") || compact.includes("bike")) return "cycle";
  if (compact.includes("swim")) return "swim";
  if (compact.includes("row") || compact.includes("kayak") || compact.includes("canoe") || compact.includes("paddle")) return "row";
  if (compact.includes("walk") || compact.includes("hike")) return "walk";
  if (
    compact.includes("soccer") ||
    compact.includes("football") ||
    compact.includes("rugby") ||
    compact.includes("basketball") ||
    compact.includes("hockey") ||
    compact.includes("lacrosse")
  ) {
    return "team_sport";
  }
  if (compact.includes("ski") || compact.includes("skate") || compact.includes("snowboard")) {
    return "other_cardio";
  }
  return "unknown";
}

function observationCompleteness(row) {
  return [
    finitePositive(row?.distance_m),
    finitePositive(row?.moving_duration_sec) || finitePositive(row?.elapsed_duration_sec),
    finitePositive(row?.average_heart_rate_bpm),
    finitePositive(row?.max_heart_rate_bpm),
    finitePositive(row?.elevation_gain_m),
    finitePositive(row?.calories_kcal),
  ].filter((value) => value !== null).length;
}

function stableObservations(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((row) => row && !row.source_deleted_at)
    .slice()
    .sort((a, b) => {
      const scoreDiff = observationCompleteness(b) - observationCompleteness(a);
      if (scoreDiff) return scoreDiff;
      return (
        cleanText(a.provider).localeCompare(cleanText(b.provider)) ||
        cleanText(a.id).localeCompare(cleanText(b.id))
      );
    });
}

function firstMetric(rows, key, fallbackKey = "") {
  for (const row of rows) {
    const primary = finitePositive(row?.[key]);
    if (primary !== null) return { value: primary, provider: cleanText(row?.provider, "external") };
    if (fallbackKey) {
      const fallback = finitePositive(row?.[fallbackKey]);
      if (fallback !== null) return { value: fallback, provider: cleanText(row?.provider, "external") };
    }
  }
  return { value: null, provider: "" };
}

function providerList(rows) {
  return [...new Set(rows.map((row) => cleanText(row?.provider)).filter(Boolean))].sort();
}

function localDateFor(activity, observations) {
  for (const observation of observations) {
    if (validYmd(observation?.local_date_ymd)) return observation.local_date_ymd;
  }
  return ymdFromIso(activity?.started_at) || ymdFromIso(observations[0]?.started_at);
}

function activityTypeFor(activity, observations) {
  return cleanText(activity?.activity_type || observations[0]?.activity_type, "unknown").toLowerCase();
}

function activityNameFor(observations) {
  return cleanText(observations.find((row) => cleanText(row?.activity_name))?.activity_name, "");
}

export function buildVerifiedCardioEvidence(data = {}) {
  const observationsById = new Map(
    (Array.isArray(data?.observations) ? data.observations : []).map((row) => [row.id, row])
  );
  const observationIdsByActivity = new Map();
  for (const link of Array.isArray(data?.observationLinks) ? data.observationLinks : []) {
    const activityId = cleanText(link?.verified_activity_id);
    const observationId = cleanText(link?.observation_id);
    if (!activityId || !observationId) continue;
    const list = observationIdsByActivity.get(activityId) || [];
    list.push(observationId);
    observationIdsByActivity.set(activityId, list);
  }
  const manualLinkByActivity = new Map(
    (Array.isArray(data?.manualLinks) ? data.manualLinks : [])
      .filter((row) => cleanText(row?.verified_activity_id))
      .map((row) => [row.verified_activity_id, row])
  );

  const rows = [];
  for (const activity of Array.isArray(data?.verifiedActivities) ? data.verifiedActivities : []) {
    if (!activity?.id || activity?.status === "ignored") continue;

    const observations = stableObservations(
      (observationIdsByActivity.get(activity.id) || [])
        .map((id) => observationsById.get(id))
        .filter(Boolean)
    );
    if (!observations.length) continue;

    const activityType = activityTypeFor(activity, observations);
    let cardioKind = classifyVerifiedCardioType(activityType);
    const distance = firstMetric(observations, "distance_m");
    const duration = firstMetric(observations, "moving_duration_sec", "elapsed_duration_sec");
    if (cardioKind === "unknown" && distance.value !== null) cardioKind = "other_cardio";
    if (cardioKind === "unknown") continue;

    const averageHr = firstMetric(observations, "average_heart_rate_bpm");
    const maxHr = firstMetric(observations, "max_heart_rate_bpm");
    const elevation = firstMetric(observations, "elevation_gain_m");
    const calories = firstMetric(observations, "calories_kcal");
    const distanceKm = distance.value === null ? null : roundTo(distance.value / 1000, 3);
    const durationMin = duration.value === null ? null : roundTo(duration.value / 60, 1);
    const averageSpeedKmh =
      distanceKm !== null && durationMin !== null && durationMin > 0
        ? roundTo(distanceKm / (durationMin / 60), 2)
        : null;
    const paceMinPerKm =
      distanceKm !== null && distanceKm > 0 && durationMin !== null && ["run", "walk"].includes(cardioKind)
        ? roundTo(durationMin / distanceKm, 3)
        : null;
    const providers = providerList(observations);
    const date = localDateFor(activity, observations);

    rows.push({
      id: activity.id,
      date,
      startedAt: cleanText(activity?.started_at || observations[0]?.started_at),
      activityType,
      activityName: activityNameFor(observations),
      cardioKind,
      providers,
      primaryProvider: cleanText(observations[0]?.provider, providers[0] || "external"),
      multiSource: providers.length > 1,
      matchedManual: manualLinkByActivity.has(activity.id),
      manualLink: manualLinkByActivity.get(activity.id) || null,
      distanceKm,
      durationMin,
      averageSpeedKmh,
      paceMinPerKm,
      averageHeartRateBpm: averageHr.value === null ? null : roundTo(averageHr.value, 0),
      maxHeartRateBpm: maxHr.value === null ? null : roundTo(maxHr.value, 0),
      elevationGainM: elevation.value === null ? null : roundTo(elevation.value, 0),
      caloriesKcal: calories.value === null ? null : roundTo(calories.value, 0),
      metricSources: {
        distance: distance.provider,
        duration: duration.provider,
        averageHeartRate: averageHr.provider,
        maxHeartRate: maxHr.provider,
        elevation: elevation.provider,
        calories: calories.provider,
      },
      identityConfidence: Number.isFinite(Number(activity?.identity_confidence))
        ? Number(activity.identity_confidence)
        : null,
      identityMethod: cleanText(activity?.identity_method),
      authority: "verified_evidence_only",
      rewardXp: 0,
    });
  }

  return rows.sort(
    (a, b) =>
      cleanText(b.date).localeCompare(cleanText(a.date)) ||
      cleanText(b.startedAt).localeCompare(cleanText(a.startedAt)) ||
      cleanText(a.id).localeCompare(cleanText(b.id))
  );
}

export function summariseVerifiedCardioEvidence(rows = [], range = null) {
  const startDate = validYmd(range?.startDate) ? range.startDate : "";
  const endDate = validYmd(range?.endDate) ? range.endDate : "";
  const scoped = (Array.isArray(rows) ? rows : []).filter((row) => {
    if (!validYmd(row?.date)) return !startDate && !endDate;
    if (startDate && row.date < startDate) return false;
    if (endDate && row.date > endDate) return false;
    return true;
  });

  const providers = new Set();
  let totalDistanceKm = 0;
  let totalDurationMin = 0;
  let distanceActivityCount = 0;
  let durationActivityCount = 0;
  let heartRateActivityCount = 0;
  let matchedManualCount = 0;
  let multiSourceCount = 0;

  for (const row of scoped) {
    for (const provider of row.providers || []) providers.add(provider);
    if (Number.isFinite(row.distanceKm) && row.distanceKm > 0) {
      totalDistanceKm += row.distanceKm;
      distanceActivityCount += 1;
    }
    if (Number.isFinite(row.durationMin) && row.durationMin > 0) {
      totalDurationMin += row.durationMin;
      durationActivityCount += 1;
    }
    if (Number.isFinite(row.averageHeartRateBpm) && row.averageHeartRateBpm > 0) {
      heartRateActivityCount += 1;
    }
    if (row.matchedManual) matchedManualCount += 1;
    if (row.multiSource) multiSourceCount += 1;
  }

  return {
    state: scoped.length ? "ready" : "empty",
    authority: "verified_evidence_only",
    activityCount: scoped.length,
    matchedManualCount,
    multiSourceCount,
    providerCount: providers.size,
    providers: [...providers].sort(),
    totalDistanceKm: roundTo(totalDistanceKm, 2) || 0,
    totalDurationMin: roundTo(totalDurationMin, 1) || 0,
    distanceActivityCount,
    durationActivityCount,
    heartRateActivityCount,
    latestDate: scoped[0]?.date || "",
    rows: scoped,
    rewardXp: 0,
  };
}
