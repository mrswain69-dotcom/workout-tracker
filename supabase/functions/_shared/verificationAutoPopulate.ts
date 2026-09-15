import {
  applyVerifiedActivityPopulation,
  buildSafePlanLogShell,
  isDateInsideAutoPopulationWindow,
  undoVerifiedActivityPopulation,
} from "../../../src/engine/verificationAutoPopulationEngine.js";
import { buildSessionLogBlockSnapshot } from "../../../src/engine/sessionEngine.js";

const DEFAULT_AUTO_LOG_WINDOW_DAYS = 2;

function text(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function positive(value: unknown) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function median(values: Array<number | null>) {
  const rows = values.filter((value): value is number => value !== null && Number.isFinite(value)).sort((a, b) => a - b);
  if (!rows.length) return null;
  const middle = Math.floor(rows.length / 2);
  return rows.length % 2 ? rows[middle] : (rows[middle - 1] + rows[middle]) / 2;
}

function weekday(ymd: string) {
  const date = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "";
  return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getUTCDay()] || "";
}

function shiftYmd(ymd: string, days: number) {
  const date = new Date(`${ymd}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return ymd;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function safeWindow(value: unknown) {
  const days = Number(value);
  return Number.isInteger(days) && days >= 0 && days <= 3 ? days : DEFAULT_AUTO_LOG_WINDOW_DAYS;
}

function providerKey(provider: unknown) {
  return text(provider).toLowerCase();
}

function preparePlanBlocks(planBlocks: any[]) {
  return (Array.isArray(planBlocks) ? planBlocks : []).map((block) => {
    if (text(block?.typeId).toLowerCase() !== "session") return block;
    return buildSessionLogBlockSnapshot(block) || block;
  });
}

function activePreferenceMap(connections: any[], preferences: any[]) {
  const active = new Set(
    (connections || [])
      .filter((row) => row?.status === "active")
      .map((row) => providerKey(row.provider))
      .filter(Boolean)
  );
  const map = new Map<string, any>();
  for (const provider of active) {
    const row = (preferences || []).find((item) => providerKey(item?.provider) === provider);
    map.set(provider, {
      activity_data_enabled: row?.activity_data_enabled !== false,
      auto_log_window_days: safeWindow(row?.auto_log_window_days),
    });
  }
  return map;
}

function aggregateEvidence(activity: any, observations: any[], preferenceMap: Map<string, any>, todayYmd: string) {
  const eligible = (observations || []).filter((row) => {
    const provider = providerKey(row?.provider);
    const preference = preferenceMap.get(provider);
    const localDate = text(row?.local_date_ymd) || text(row?.started_at).slice(0, 10);
    return !!preference &&
      preference.activity_data_enabled &&
      !row?.source_deleted_at &&
      row?.source_manual_entry !== true &&
      isDateInsideAutoPopulationWindow(localDate, todayYmd, preference.auto_log_window_days);
  });
  if (!eligible.length) return null;

  const dates = [...new Set(eligible.map((row) => text(row?.local_date_ymd) || text(row?.started_at).slice(0, 10)).filter(Boolean))];
  if (dates.length !== 1) return null;
  const localDateYmd = dates[0];
  return {
    verifiedActivityId: activity.id,
    activityType: activity.activity_type,
    localDateYmd,
    providers: [...new Set(eligible.map((row) => providerKey(row.provider)).filter(Boolean))].sort(),
    observationIds: eligible.map((row) => text(row.id)).filter(Boolean).sort(),
    distanceM: median(eligible.map((row) => positive(row.distance_m))),
    durationSec: median(eligible.map((row) => positive(row.moving_duration_sec) ?? positive(row.elapsed_duration_sec))),
  };
}

async function audit(adminClient: any, profile: any, eventType: string, actorUserId: string | null, eventData: any, verifiedActivityId: string | null = null) {
  const result = await adminClient.from("external_activity_audit_events").insert({
    family_id: profile.family_id,
    profile_id: profile.id,
    verified_activity_id: verifiedActivityId,
    event_type: eventType,
    event_data: eventData && typeof eventData === "object" ? eventData : {},
    actor_user_id: actorUserId || null,
  });
  if (result.error) throw result.error;
}

export async function applyRecentVerifiedAutoPopulationForProfile(
  adminClient: any,
  profileId: string,
  options: { actorUserId?: string | null; now?: Date } = {}
) {
  const now = options.now || new Date();
  const nowIso = now.toISOString();
  const todayYmd = nowIso.slice(0, 10);
  const earliestYmd = shiftYmd(todayYmd, -3);

  const profileResult = await adminClient.from("profiles")
    .select("id,family_id,plan_json,archived")
    .eq("id", profileId)
    .maybeSingle();
  if (profileResult.error || !profileResult.data || profileResult.data.archived) {
    throw profileResult.error || new Error("Profile not found");
  }
  const profile = profileResult.data;

  const [connectionsResult, preferencesResult, activitiesResult, observationsResult, observationLinksResult, manualLinksResult, controlsResult, logsResult] = await Promise.all([
    adminClient.from("external_connections").select("id,provider,status").eq("profile_id", profileId),
    adminClient.from("external_connection_preferences").select("provider,activity_data_enabled,auto_log_window_days").eq("profile_id", profileId),
    adminClient.from("verified_activities").select("id,activity_type,started_at,status,auto_match_suppressed").eq("profile_id", profileId).eq("status", "active"),
    adminClient.from("external_activity_observations").select("id,provider,started_at,local_date_ymd,distance_m,moving_duration_sec,elapsed_duration_sec,source_deleted_at,source_manual_entry").eq("profile_id", profileId),
    adminClient.from("verified_activity_observations").select("verified_activity_id,observation_id").eq("profile_id", profileId),
    adminClient.from("external_activity_links").select("verified_activity_id,manual_log_id,manual_block_id,match_method").eq("profile_id", profileId),
    adminClient.from("external_activity_population_controls").select("verified_activity_id,suppressed_at,suppress_reason").eq("profile_id", profileId),
    adminClient.from("logs").select("id,date_ymd,log_json").eq("profile_id", profileId).gte("date_ymd", earliestYmd).lte("date_ymd", todayYmd),
  ]);
  const firstError = [connectionsResult, preferencesResult, activitiesResult, observationsResult, observationLinksResult, manualLinksResult, controlsResult, logsResult]
    .map((result) => result.error).find(Boolean);
  if (firstError) throw firstError;

  const preferenceMap = activePreferenceMap(connectionsResult.data || [], preferencesResult.data || []);
  if (!preferenceMap.size) {
    return { profileId, logsChanged: 0, fieldsFilled: 0, extraBlocksCreated: 0, manualOverridesPreserved: 0, skippedSuppressed: 0, skippedLinked: 0, consideredActivities: 0 };
  }

  const observationById = new Map((observationsResult.data || []).map((row: any) => [row.id, row]));
  const observationsByActivity = new Map<string, any[]>();
  for (const membership of observationLinksResult.data || []) {
    if (!observationsByActivity.has(membership.verified_activity_id)) observationsByActivity.set(membership.verified_activity_id, []);
    const observation = observationById.get(membership.observation_id);
    if (observation) observationsByActivity.get(membership.verified_activity_id)!.push(observation);
  }

  const suppressed = new Set((controlsResult.data || []).map((row: any) => row.verified_activity_id));
  const linkedActivities = new Set((manualLinksResult.data || []).map((row: any) => row.verified_activity_id));
  const logByDate = new Map((logsResult.data || []).map((row: any) => [row.date_ymd, row]));
  const claimedByLog = new Map<string, Set<string>>();
  for (const link of manualLinksResult.data || []) {
    if (!link.manual_log_id || !link.manual_block_id) continue;
    if (!claimedByLog.has(link.manual_log_id)) claimedByLog.set(link.manual_log_id, new Set());
    claimedByLog.get(link.manual_log_id)!.add(link.manual_block_id);
  }

  const plan = profile.plan_json && typeof profile.plan_json === "object" ? profile.plan_json : {};
  const blocksByWeekday = plan.blocksByWeekday && typeof plan.blocksByWeekday === "object" ? plan.blocksByWeekday : {};
  const activities = (activitiesResult.data || []).slice().sort((a: any, b: any) => text(a.started_at).localeCompare(text(b.started_at)) || text(a.id).localeCompare(text(b.id)));

  const summary = {
    profileId,
    logsChanged: 0,
    fieldsFilled: 0,
    extraBlocksCreated: 0,
    manualOverridesPreserved: 0,
    skippedSuppressed: 0,
    skippedLinked: 0,
    consideredActivities: 0,
  };
  const changedDates = new Set<string>();

  for (const activity of activities) {
    if (activity.auto_match_suppressed === true) continue;
    if (suppressed.has(activity.id)) {
      summary.skippedSuppressed += 1;
      continue;
    }
    if (linkedActivities.has(activity.id)) {
      summary.skippedLinked += 1;
      continue;
    }
    const evidence = aggregateEvidence(activity, observationsByActivity.get(activity.id) || [], preferenceMap, todayYmd);
    if (!evidence) continue;
    summary.consideredActivities += 1;

    const dateYmd = evidence.localDateYmd;
    let logRow: any = logByDate.get(dateYmd) || null;
    const originalLog = logRow?.log_json && typeof logRow.log_json === "object" ? logRow.log_json : null;
    const dayKey = weekday(dateYmd);
    const rawPlanBlocks = Array.isArray(blocksByWeekday?.[dayKey]) ? blocksByWeekday[dayKey] : [];
    const planBlocks = preparePlanBlocks(rawPlanBlocks);
    const baseLog = originalLog || buildSafePlanLogShell(planBlocks);

    const transient = JSON.parse(JSON.stringify(baseLog));
    const claimed = logRow?.id ? claimedByLog.get(logRow.id) || new Set<string>() : new Set<string>();
    const originalCancelled = new Map<string, any>();
    for (const block of Array.isArray(transient.blocks) ? transient.blocks : []) {
      if (!claimed.has(text(block?.id))) continue;
      originalCancelled.set(text(block.id), block.cancelled);
      block.cancelled = true;
    }

    const population = applyVerifiedActivityPopulation({ logJson: transient, planBlocks, evidence, nowIso });
    if (!population.changed) continue;

    if (!population.targetBlockId) {
      const savedState = await adminClient.from("logs").upsert({
        family_id: profile.family_id,
        profile_id: profile.id,
        date_ymd: dateYmd,
        log_json: population.logJson,
      }, { onConflict: "family_id,profile_id,date_ymd" }).select("id,date_ymd,log_json").single();
      if (savedState.error) throw savedState.error;
      logByDate.set(dateYmd, savedState.data);
      summary.manualOverridesPreserved += population.manualOverridesPreserved || 0;
      changedDates.add(dateYmd);
      continue;
    }

    for (const block of Array.isArray(population.logJson?.blocks) ? population.logJson.blocks : []) {
      const blockId = text(block?.id);
      if (originalCancelled.has(blockId)) block.cancelled = originalCancelled.get(blockId);
    }

    const saved = await adminClient.from("logs").upsert({
      family_id: profile.family_id,
      profile_id: profile.id,
      date_ymd: dateYmd,
      log_json: population.logJson,
    }, { onConflict: "family_id,profile_id,date_ymd" }).select("id,date_ymd,log_json").single();
    if (saved.error) throw saved.error;
    logRow = saved.data;
    logByDate.set(dateYmd, logRow);

    const insertedLink = await adminClient.from("external_activity_links").insert({
      family_id: profile.family_id,
      profile_id: profile.id,
      verified_activity_id: activity.id,
      manual_log_id: logRow.id,
      manual_block_id: population.targetBlockId,
      match_method: "automatic",
      match_confidence: population.extraBlocksCreated ? 1 : 0.95,
      date_offset_days: 0,
      confirmed_at: null,
    });
    if (insertedLink.error) {
      const rollback = undoVerifiedActivityPopulation({ logJson: population.logJson, verifiedActivityId: activity.id, nowIso });
      const rollbackLog = originalLog || rollback.logJson;
      const restored = await adminClient.from("logs").update({ log_json: rollbackLog }).eq("id", logRow.id);
      if (restored.error) throw restored.error;
      throw insertedLink.error;
    }

    linkedActivities.add(activity.id);
    if (!claimedByLog.has(logRow.id)) claimedByLog.set(logRow.id, new Set());
    claimedByLog.get(logRow.id)!.add(population.targetBlockId);
    summary.fieldsFilled += population.fieldsFilled || 0;
    summary.extraBlocksCreated += population.extraBlocksCreated || 0;
    summary.manualOverridesPreserved += population.manualOverridesPreserved || 0;
    changedDates.add(dateYmd);
  }

  summary.logsChanged = changedDates.size;
  if (summary.logsChanged || summary.fieldsFilled || summary.extraBlocksCreated) {
    await audit(adminClient, profile, "auto_population_apply", options.actorUserId || null, {
      logsChanged: summary.logsChanged,
      fieldsFilled: summary.fieldsFilled,
      extraBlocksCreated: summary.extraBlocksCreated,
      manualOverridesPreserved: summary.manualOverridesPreserved,
      consideredActivities: summary.consideredActivities,
      rewardBonusXp: 0,
      rewardMultiplier: 1,
    });
  }
  return summary;
}

export async function undoVerifiedAutoPopulationForProfile(
  adminClient: any,
  profileId: string,
  verifiedActivityId: string,
  actorUserId: string | null = null
) {
  const profileResult = await adminClient.from("profiles").select("id,family_id,archived").eq("id", profileId).maybeSingle();
  if (profileResult.error || !profileResult.data || profileResult.data.archived) throw profileResult.error || new Error("Profile not found");
  const profile = profileResult.data;
  const activityResult = await adminClient.from("verified_activities").select("id,family_id,profile_id").eq("id", verifiedActivityId).maybeSingle();
  if (activityResult.error || !activityResult.data || activityResult.data.profile_id !== profileId || activityResult.data.family_id !== profile.family_id) {
    throw activityResult.error || new Error("Verified activity not found");
  }

  const logsResult = await adminClient.from("logs").select("id,date_ymd,log_json").eq("profile_id", profileId).order("date_ymd", { ascending: true });
  if (logsResult.error) throw logsResult.error;
  let logsChanged = 0;
  let fieldsRestored = 0;
  let extraBlocksRemoved = 0;
  let manualOverridesPreserved = 0;
  const nowIso = new Date().toISOString();

  for (const row of logsResult.data || []) {
    const result = undoVerifiedActivityPopulation({ logJson: row.log_json, verifiedActivityId, nowIso });
    if (!result.changed) continue;
    const updated = await adminClient.from("logs").update({ log_json: result.logJson }).eq("id", row.id);
    if (updated.error) throw updated.error;
    logsChanged += 1;
    fieldsRestored += result.fieldsRestored || 0;
    extraBlocksRemoved += result.extraBlocksRemoved || 0;
    manualOverridesPreserved += result.manualOverridesPreserved || 0;
  }

  const detached = await adminClient.from("external_activity_links").delete()
    .eq("verified_activity_id", verifiedActivityId)
    .eq("match_method", "automatic");
  if (detached.error) throw detached.error;

  const suppressed = await adminClient.from("external_activity_population_controls").upsert({
    family_id: profile.family_id,
    profile_id: profile.id,
    verified_activity_id: verifiedActivityId,
    suppressed_at: nowIso,
    suppress_reason: "user_undo",
    actor_user_id: actorUserId || null,
    updated_at: nowIso,
  }, { onConflict: "profile_id,verified_activity_id" });
  if (suppressed.error) throw suppressed.error;

  const summary = { verifiedActivityId, logsChanged, fieldsRestored, extraBlocksRemoved, manualOverridesPreserved, suppressed: true };
  await audit(adminClient, profile, "auto_population_undo", actorUserId, summary, verifiedActivityId);
  return summary;
}
