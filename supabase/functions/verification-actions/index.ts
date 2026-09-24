import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  createUserClient,
  ensureStravaWebhookSubscription,
  importRecentStravaActivities,
  json,
  refreshStravaAccessToken,
  revokeStravaToken,
} from "../_shared/stravaProvider.ts";
import { reconcileVerifiedActivitiesForProfile } from "../_shared/verificationReconcile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const MANUAL_SYNC_COOLDOWN_MS = 5 * 60 * 1000;
const MATCH_WINDOW_DAYS = 2;
const PROVIDERS = new Set(["strava", "garmin", "apple_health", "health_connect", "google_fit_legacy"]);

function text(value: unknown, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}
function positive(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}
function isoMs(value: unknown) {
  const ms = Date.parse(text(value));
  return Number.isFinite(ms) ? ms : null;
}
function family(value: unknown) {
  const token = text(value, "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (!token || ["unknown", "other", "workout", "activity"].includes(token)) return "unknown";
  if (/(^|_)trail_?run|(^|_)run(ning)?($|_)|jog/.test(token)) return "run";
  if (/(ride|cycling|cycle|bike|biking|mountain_bike|ebike)/.test(token)) return "cycle";
  if (/swim/.test(token)) return "swim";
  if (/(walk|hike|hiking)/.test(token)) return "walk_hike";
  if (/(soccer|football|rugby|basketball|hockey|lacrosse)/.test(token)) return "team_sport";
  if (/(strength|weight_?training|weights|weightlifting|resistance)/.test(token)) return "strength";
  if (/(row|rowing|kayak|canoe|paddle)/.test(token)) return "row";
  if (/(yoga|pilates|mobility|stretch)/.test(token)) return "mobility";
  if (token === "cardio") return "cardio";
  return token;
}
function familiesCompatible(left: unknown, right: unknown) {
  const a = family(left);
  const b = family(right);
  if (a === b && a !== "unknown") return true;
  const cardio = new Set(["run", "cycle", "swim", "walk_hike", "row", "team_sport"]);
  return (a === "cardio" && cardio.has(b)) || (b === "cardio" && cardio.has(a));
}
function ymdMs(value: unknown) {
  const ymd = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const ms = Date.parse(`${ymd}T00:00:00Z`);
  return Number.isFinite(ms) ? ms : null;
}
function dateOffsetDays(externalYmd: string, workoutYmd: string) {
  const left = ymdMs(externalYmd);
  const right = ymdMs(workoutYmd);
  return left === null || right === null ? null : Math.round((right - left) / 86400000);
}
function metricCompatible(left: unknown, right: unknown, relativeLimit: number, absoluteLimit: number) {
  const a = positive(left);
  const b = positive(right);
  if (a === null || b === null) return { comparable: false, compatible: true, score: 0 };
  const delta = Math.abs(a - b);
  const relative = delta / Math.max(a, b);
  return {
    comparable: true,
    compatible: relative <= relativeLimit || delta <= absoluteLimit,
    score: Math.max(0, 1 - relative),
  };
}
function strengthTimingScore(evidenceStartedAt: unknown, candidateStartedAt: unknown) {
  const externalMs = isoMs(evidenceStartedAt);
  const workoutMs = isoMs(candidateStartedAt);
  if (externalMs === null || workoutMs === null) return 0;
  const deltaMin = Math.abs(externalMs - workoutMs) / 60000;
  if (deltaMin <= 5) return 0.2;
  if (deltaMin <= 15) return 0.16;
  if (deltaMin <= 30) return 0.11;
  if (deltaMin <= 60) return 0.07;
  if (deltaMin <= 120) return 0.03;
  return 0;
}

function blockCandidates(log: any) {
  const payload = log?.log_json && typeof log.log_json === "object" ? log.log_json : {};
  const result: any[] = [];
  const addCardio = (cardio: any, blockId: string | null, label: string, activityType: string) => {
    if (!cardio || typeof cardio !== "object") return;
    const distanceKm = positive(cardio.distanceKm);
    const durationMin = positive(cardio.durationMin);
    if (distanceKm === null && durationMin === null) return;
    result.push({
      manualLogId: log.id,
      manualBlockId: blockId,
      logDate: log.date_ymd,
      label,
      activityType,
      distanceM: distanceKm === null ? null : distanceKm * 1000,
      durationSec: durationMin === null ? null : durationMin * 60,
      scope: "cardio",
    });
  };
  addCardio(payload?.cardio, null, "Cardio", "cardio");
  for (const block of Array.isArray(payload?.blocks) ? payload.blocks : []) {
    if (!block || block.cancelled) continue;
    const typeId = text(block.typeId).toLowerCase();
    if (typeId === "cardio") {
      addCardio(block.cardio, text(block.id) || null, text(block.label || block.cardioType, "Cardio"), text(block.cardioType || block.label, "cardio"));
      continue;
    }
    if (typeId === "duration") {
      const minutes = positive(block?.duration?.minutes);
      if (minutes !== null) result.push({
        manualLogId: log.id,
        manualBlockId: text(block.id) || null,
        logDate: log.date_ymd,
        label: text(block.label, "Timed activity"),
        activityType: text(block.label, "unknown"),
        distanceM: null,
        durationSec: minutes * 60,
        scope: "duration",
      });
      continue;
    }
    if (typeId === "strength") {
      const recorded = Object.values(block?.sets || {}).some((sets: any) =>
        (Array.isArray(sets) ? sets : []).some((set: any) =>
          positive(set?.reps) !== null || positive(set?.weight) !== null || positive(set?.timeSeconds) !== null || positive(set?.seconds) !== null
        )
      );
      if (recorded) {
        const startedAt = text(block?.startedAt || block?.loggedAt);
        const completedAt = text(block?.completedAt || block?.updatedAt);
        const startedMs = isoMs(startedAt);
        const completedMs = isoMs(completedAt);
        const entryDurationSec = startedMs !== null && completedMs !== null && completedMs > startedMs
          ? Math.round((completedMs - startedMs) / 1000)
          : null;
        result.push({
          manualLogId: log.id,
          manualBlockId: text(block.id) || null,
          logDate: log.date_ymd,
          label: text(block.label, "Strength"),
          activityType: "strength",
          distanceM: null,
          durationSec: entryDurationSec,
          startedAt: startedAt || null,
          completedAt: completedAt || null,
          scope: "session",
        });
      }
    }
  }
  return result;
}

async function loadVerifiedEvidence(adminClient: any, verifiedActivityId: string) {
  const activityResult = await adminClient.from("verified_activities")
    .select("id,family_id,profile_id,activity_type,started_at,status,auto_match_suppressed")
    .eq("id", verifiedActivityId).maybeSingle();
  if (activityResult.error || !activityResult.data) throw activityResult.error || new Error("Verified activity not found");
  const linkResult = await adminClient.from("verified_activity_observations").select("observation_id").eq("verified_activity_id", verifiedActivityId);
  if (linkResult.error) throw linkResult.error;
  const ids = (linkResult.data || []).map((row: any) => row.observation_id).filter(Boolean);
  let observations: any[] = [];
  if (ids.length) {
    const result = await adminClient.from("external_activity_observations")
      .select("id,provider,activity_type,started_at,local_date_ymd,distance_m,moving_duration_sec,elapsed_duration_sec,source_deleted_at,source_manual_entry")
      .in("id", ids);
    if (result.error) throw result.error;
    observations = result.data || [];
  }
  const active = observations.filter((row) => !row.source_deleted_at && row.source_manual_entry !== true);
  return {
    activity: activityResult.data,
    observations: active,
    localDate: text(active.find((row) => text(row.local_date_ymd))?.local_date_ymd) || text(activityResult.data.started_at).slice(0, 10),
    distanceM: active.map((row) => positive(row.distance_m)).find((value) => value !== null) ?? null,
    durationSec: active.map((row) => positive(row.moving_duration_sec) ?? positive(row.elapsed_duration_sec)).find((value) => value !== null) ?? null,
  };
}

function scoreCandidate(evidence: any, candidate: any) {
  if (!familiesCompatible(evidence.activity.activity_type, candidate.activityType)) return null;
  const offset = dateOffsetDays(evidence.localDate, candidate.logDate);
  if (offset === null || Math.abs(offset) > MATCH_WINDOW_DAYS) return null;
  const distance = metricCompatible(evidence.distanceM, candidate.distanceM, 0.2, 500);
  const duration = metricCompatible(evidence.durationSec, candidate.durationSec, 0.3, 600);
  const strengthSession = candidate.scope === "session" && family(evidence.activity.activity_type) === "strength";
  if (!strengthSession && (!distance.compatible || !duration.compatible)) return null;
  if (!strengthSession && !distance.comparable && !duration.comparable) return null;
  let score = 0.45 + Math.max(0, 0.2 - Math.abs(offset) * 0.08);
  if (distance.comparable) score += 0.2 * distance.score;
  if (duration.comparable) score += (strengthSession ? 0.1 : 0.15) * duration.score;
  if (strengthSession) {
    score += 0.15;
    score += strengthTimingScore(evidence.activity.started_at, candidate.startedAt);
  }
  return { ...candidate, dateOffsetDays: offset, score: Math.round(Math.min(1, score) * 1000) / 1000 };
}

async function loadCandidates(adminClient: any, evidence: any) {
  const externalMs = ymdMs(evidence.localDate);
  if (externalMs === null) return [];
  const start = new Date(externalMs - MATCH_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const end = new Date(externalMs + MATCH_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const [logs, claims] = await Promise.all([
    adminClient.from("logs").select("id,profile_id,date_ymd,log_json")
      .eq("profile_id", evidence.activity.profile_id).gte("date_ymd", start).lte("date_ymd", end).order("date_ymd", { ascending: true }),
    adminClient.from("external_activity_links").select("verified_activity_id,manual_log_id,manual_block_id").eq("profile_id", evidence.activity.profile_id),
  ]);
  if (logs.error || claims.error) throw logs.error || claims.error;
  const claimed = new Set((claims.data || [])
    .filter((row: any) => row.verified_activity_id !== evidence.activity.id)
    .map((row: any) => `${row.manual_log_id}:${row.manual_block_id || ""}`));
  return (logs.data || []).flatMap(blockCandidates)
    .filter((candidate: any) => !claimed.has(`${candidate.manualLogId}:${candidate.manualBlockId || ""}`))
    .map((candidate: any) => scoreCandidate(evidence, candidate)).filter(Boolean)
    .sort((a: any, b: any) => b.score - a.score || Math.abs(a.dateOffsetDays) - Math.abs(b.dateOffsetDays) || text(a.label).localeCompare(text(b.label)));
}

async function audit(adminClient: any, authUserId: string, profile: any, eventType: string, values: any = {}) {
  const result = await adminClient.from("external_activity_audit_events").insert({
    family_id: profile.family_id,
    profile_id: profile.id,
    provider: values.provider || null,
    verified_activity_id: values.verifiedActivityId || null,
    observation_id: values.observationId || null,
    event_type: eventType,
    event_data: values.eventData && typeof values.eventData === "object" ? values.eventData : {},
    actor_user_id: authUserId,
  });
  if (result.error) throw result.error;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);
  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Authentication required" }, 401, corsHeaders);
    const userClient = createUserClient(jwt);
    const adminClient = createAdminClient();
    if (!userClient || !adminClient) return json({ error: "Verification service unavailable" }, 503, corsHeaders);
    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) return json({ error: "Authentication required" }, 401, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const action = text(body?.action);
    const profileId = text(body?.profileId);
    if (!action || !profileId) return json({ error: "Action and athlete profile are required" }, 400, corsHeaders);
    const { data: profile, error: profileError } = await userClient.from("profiles")
      .select("id,family_id,archived").eq("id", profileId).maybeSingle();
    if (profileError || !profile || profile.archived) return json({ error: "Athlete profile is not available" }, 404, corsHeaders);

    if (action === "ensure_auto_sync") {
      const provider = text(body?.provider, "strava");
      if (provider !== "strava") return json({ error: "Automatic source sync is not available for this provider yet" }, 400, corsHeaders);
      const { data: connection, error: connectionError } = await userClient.from("external_connections")
        .select("id,family_id,profile_id,provider,status,auto_sync_enabled")
        .eq("profile_id", profileId).eq("provider", provider).maybeSingle();
      if (connectionError || !connection || connection.status !== "active") return json({ error: "Provider is not connected" }, 409, corsHeaders);
      if (connection.auto_sync_enabled === false) return json({ provider, autoSync: { state: "disabled", id: null, created: false, repaired: false } }, 200, corsHeaders);
      let autoSync: any;
      try {
        autoSync = await ensureStravaWebhookSubscription();
      } catch (error) {
        console.error("Strava automatic sync provisioning failed", error);
        autoSync = { state: "error", reason: String((error as any)?.message || error), id: null, created: false, repaired: false };
      }
      await audit(adminClient, authData.user.id, profile, "auto_sync_ensure", { provider, eventData: { autoSync } });
      return json({ provider, autoSync }, 200, corsHeaders);
    }

    if (action === "manual_sync") {
      const provider = text(body?.provider, "strava");
      if (provider !== "strava") return json({ error: "Manual source check is not available for this provider yet" }, 400, corsHeaders);
      const { data: connection, error: connectionError } = await userClient.from("external_connections")
        .select("id,family_id,profile_id,provider,status,auto_sync_enabled,last_manual_sync_at")
        .eq("profile_id", profileId).eq("provider", provider).maybeSingle();
      if (connectionError || !connection || connection.status !== "active") return json({ error: "Provider is not connected" }, 409, corsHeaders);

      const cutoff = new Date(Date.now() - MANUAL_SYNC_COOLDOWN_MS).toISOString();
      const manualSyncStartedAt = new Date().toISOString();
      const claimed = await adminClient.from("external_connections")
        .update({ last_manual_sync_at: manualSyncStartedAt }).eq("id", connection.id)
        .or(`last_manual_sync_at.is.null,last_manual_sync_at.lt.${cutoff}`)
        .select("id,last_manual_sync_at").maybeSingle();
      if (claimed.error) throw claimed.error;
      if (!claimed.data) {
        const lastMs = Date.parse(text(connection.last_manual_sync_at));
        return json({
          error: "Source check is cooling down",
          code: "manual_sync_cooldown",
          nextAllowedAt: Number.isFinite(lastMs) ? new Date(lastMs + MANUAL_SYNC_COOLDOWN_MS).toISOString() : new Date(Date.now() + MANUAL_SYNC_COOLDOWN_MS).toISOString(),
        }, 429, corsHeaders);
      }
      let autoSync: any = { state: "disabled", id: null, created: false, repaired: false };
      if (connection.auto_sync_enabled !== false) {
        try {
          autoSync = await ensureStravaWebhookSubscription();
        } catch (error) {
          console.error("Strava automatic sync provisioning failed during manual sync", error);
          autoSync = { state: "error", reason: String((error as any)?.message || error), id: null, created: false, repaired: false };
        }
      }
      const accessToken = await refreshStravaAccessToken(adminClient, connection.id);
      const imported = await importRecentStravaActivities(adminClient, connection, accessToken, { days: 7 });
      const reconciliation = await reconcileVerifiedActivitiesForProfile(adminClient, profileId);
      const syncedAt = new Date().toISOString();
      const connectionUpdate = await adminClient.from("external_connections").update({
        last_sync_at: syncedAt,
        last_error_code: null,
      }).eq("id", connection.id);
      if (connectionUpdate.error) throw connectionUpdate.error;
      await audit(adminClient, authData.user.id, profile, "manual_sync", { provider, eventData: { imported, reconciliation, syncedAt, autoSync } });
      return json({ provider, imported, reconciliation, syncedAt, autoSync, nextAllowedAt: new Date(Date.parse(manualSyncStartedAt) + MANUAL_SYNC_COOLDOWN_MS).toISOString() }, 200, corsHeaders);
    }

    if (["match_candidates", "manual_match", "detach_match", "ignore_activity", "unignore_activity", "reset_automatic_matching"].includes(action)) {
      const verifiedActivityId = text(body?.verifiedActivityId);
      if (!verifiedActivityId) return json({ error: "Verified activity is required" }, 400, corsHeaders);
      const evidence = await loadVerifiedEvidence(adminClient, verifiedActivityId);
      if (evidence.activity.profile_id !== profileId || evidence.activity.family_id !== profile.family_id) return json({ error: "Verified activity is not available" }, 404, corsHeaders);

      if (action === "match_candidates") return json({ verifiedActivityId, candidates: await loadCandidates(adminClient, evidence) }, 200, corsHeaders);

      if (action === "manual_match") {
        const manualLogId = text(body?.manualLogId);
        const manualBlockId = body?.manualBlockId === null || body?.manualBlockId === undefined ? null : text(body.manualBlockId);
        const candidates = await loadCandidates(adminClient, evidence);
        const candidate = candidates.find((row: any) => row.manualLogId === manualLogId && (row.manualBlockId || null) === (manualBlockId || null));
        if (!candidate) return json({ error: "These activities are not compatible enough to verify" }, 409, corsHeaders);

        let targetQuery = adminClient.from("external_activity_links").select("id,verified_activity_id")
          .eq("profile_id", profileId).eq("manual_log_id", manualLogId);
        targetQuery = manualBlockId === null ? targetQuery.is("manual_block_id", null) : targetQuery.eq("manual_block_id", manualBlockId);
        const existingTarget = await targetQuery;
        if (existingTarget.error) throw existingTarget.error;
        if ((existingTarget.data || []).some((row: any) => row.verified_activity_id !== verifiedActivityId)) {
          return json({ error: "That Workout Tracker activity is already verified by another physical activity" }, 409, corsHeaders);
        }

        const clear = await adminClient.from("external_activity_links").delete().eq("verified_activity_id", verifiedActivityId);
        if (clear.error) throw clear.error;
        const inserted = await adminClient.from("external_activity_links").insert({
          family_id: profile.family_id,
          profile_id: profileId,
          verified_activity_id: verifiedActivityId,
          manual_log_id: candidate.manualLogId,
          manual_block_id: candidate.manualBlockId,
          match_method: "manual",
          match_confidence: candidate.score,
          date_offset_days: candidate.dateOffsetDays,
          confirmed_at: new Date().toISOString(),
        });
        if (inserted.error) throw inserted.error;
        const suppress = await adminClient.from("verified_activities").update({
          auto_match_suppressed: true,
          status: "active",
          ignored_at: null,
          ignored_by_user_id: null,
        }).eq("id", verifiedActivityId);
        if (suppress.error) throw suppress.error;
        await audit(adminClient, authData.user.id, profile, "manual_match", {
          verifiedActivityId,
          eventData: { manualLogId: candidate.manualLogId, manualBlockId: candidate.manualBlockId, dateOffsetDays: candidate.dateOffsetDays, score: candidate.score },
        });
        return json({ matched: true, candidate }, 200, corsHeaders);
      }

      if (action === "detach_match") {
        const clear = await adminClient.from("external_activity_links").delete().eq("verified_activity_id", verifiedActivityId);
        if (clear.error) throw clear.error;
        const update = await adminClient.from("verified_activities").update({ auto_match_suppressed: true }).eq("id", verifiedActivityId);
        if (update.error) throw update.error;
        await audit(adminClient, authData.user.id, profile, "detach_match", { verifiedActivityId });
        return json({ detached: true }, 200, corsHeaders);
      }
      if (action === "ignore_activity") {
        const clear = await adminClient.from("external_activity_links").delete().eq("verified_activity_id", verifiedActivityId);
        if (clear.error) throw clear.error;
        const ignoredAt = new Date().toISOString();
        const update = await adminClient.from("verified_activities").update({
          status: "ignored", ignored_at: ignoredAt, ignored_by_user_id: authData.user.id, auto_match_suppressed: true,
        }).eq("id", verifiedActivityId);
        if (update.error) throw update.error;
        await audit(adminClient, authData.user.id, profile, "ignore_activity", { verifiedActivityId });
        return json({ ignored: true, ignoredAt }, 200, corsHeaders);
      }
      if (action === "unignore_activity") {
        const update = await adminClient.from("verified_activities").update({
          status: "active", ignored_at: null, ignored_by_user_id: null, auto_match_suppressed: false,
        }).eq("id", verifiedActivityId);
        if (update.error) throw update.error;
        const reconciliation = await reconcileVerifiedActivitiesForProfile(adminClient, profileId);
        await audit(adminClient, authData.user.id, profile, "unignore_activity", { verifiedActivityId });
        return json({ ignored: false, reconciliation }, 200, corsHeaders);
      }
      const update = await adminClient.from("verified_activities").update({ auto_match_suppressed: false }).eq("id", verifiedActivityId);
      if (update.error) throw update.error;
      const populationControl = await adminClient.from("external_activity_population_controls")
        .delete()
        .eq("profile_id", profileId)
        .eq("verified_activity_id", verifiedActivityId);
      if (populationControl.error) throw populationControl.error;
      const reconciliation = await reconcileVerifiedActivitiesForProfile(adminClient, profileId);
      await audit(adminClient, authData.user.id, profile, "reset_automatic_matching", { verifiedActivityId });
      return json({ autoMatchSuppressed: false, reconciliation }, 200, corsHeaders);
    }

    if (action === "purge_provider") {
      const provider = text(body?.provider);
      if (!PROVIDERS.has(provider)) return json({ error: "Supported provider is required" }, 400, corsHeaders);
      const { data: connection, error: connectionError } = await userClient.from("external_connections")
        .select("id,family_id,profile_id,provider,status").eq("profile_id", profileId).eq("provider", provider).maybeSingle();
      if (connectionError || !connection) return json({ error: "Provider connection is not available" }, 404, corsHeaders);
      if (provider === "strava") {
        const [accessRow, refreshRow] = await Promise.all([
          adminClient.from("external_connection_access_tokens").select("access_token").eq("connection_id", connection.id).maybeSingle(),
          adminClient.from("external_connection_refresh_tokens").select("refresh_token").eq("connection_id", connection.id).maybeSingle(),
        ]);
        await revokeStravaToken(text(refreshRow.data?.refresh_token || accessRow.data?.access_token));
      }
      const counted = await adminClient.from("external_activity_observations").select("id", { count: "exact", head: true }).eq("connection_id", connection.id);
      if (counted.error) throw counted.error;
      const removedObservations = counted.count || 0;
      const deleted = await adminClient.from("external_connections").delete().eq("id", connection.id);
      if (deleted.error) throw deleted.error;
      const preferences = await adminClient.from("external_connection_preferences").delete().eq("profile_id", profileId).eq("provider", provider);
      if (preferences.error) throw preferences.error;
      const reconciliation = await reconcileVerifiedActivitiesForProfile(adminClient, profileId);
      await audit(adminClient, authData.user.id, profile, "purge_provider", {
        provider,
        eventData: { removedObservations, reconciliation, importedWorkoutTrackerRowsRemoved: 0 },
      });
      return json({ provider, disconnected: true, removedObservations, reconciliation, importedWorkoutTrackerRowsRemoved: 0 }, 200, corsHeaders);
    }

    return json({ error: "Unsupported verification action" }, 400, corsHeaders);
  } catch (error) {
    console.error("Verification action failed", error);
    return json({ error: error instanceof Error ? error.message : "Verification action failed" }, 500, corsHeaders);
  }
});
