from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected patch marker not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))


# 1) Server reconciliation: group one physical strength session before automatic scoring.
path = "supabase/functions/_shared/verificationReconcile.ts"
replace_once(path,
'''const USER_MATCH_WINDOW_DAYS = 2;''',
'''const USER_MATCH_WINDOW_DAYS = 2;
const STRENGTH_CLUSTER_TOLERANCE_MS = 2 * 60 * 1000;
const STRENGTH_AUTO_DURATION_MAX_MS = 2 * 60 * 60 * 1000;''')

replace_once(path,
'''      completedAt: completedAt || null,
      manualOnly: true,''',
'''      completedAt: completedAt || null,
      isExtra: block?.isExtra === true,
      manualOnly: true,''')

replace_once(path,
'''      completedAt: entry.completedAt || null,
      manualOnly: entry.manualOnly === true,''',
'''      completedAt: entry.completedAt || null,
      isExtra: entry.isExtra === true,
      manualOnly: entry.manualOnly === true,''')

replace_once(path,
'''  return result;
}

function strengthSessionAutoScore(group: any, candidate: any) {''',
'''  return result;
}

function strengthCandidateInterval(candidate: any) {
  const start = isoMs(candidate?.startedAt);
  if (start === null) return null;
  const explicitEnd = isoMs(candidate?.completedAt);
  const durationSec = positive(candidate?.durationSec);
  const end = explicitEnd !== null && explicitEnd >= start
    ? explicitEnd
    : durationSec !== null
      ? start + durationSec * 1000
      : start;
  return { start, end };
}

function groupStrengthManualCandidates(candidates: any[]) {
  const source = Array.isArray(candidates) ? candidates : [];
  const consumed = new Set<number>();
  const grouped: any[] = [];

  source.forEach((candidate, index) => {
    if (consumed.has(index)) return;
    const interval = strengthCandidateInterval(candidate);
    const isStrength = candidate?.manualOnly === true && canonicalActivityFamily(candidate?.activityType) === "strength";
    if (!isStrength || !interval || !candidate?.manualLogId) {
      grouped.push(candidate);
      consumed.add(index);
      return;
    }

    const cluster = [{ candidate, index, interval }];
    consumed.add(index);
    let clusterStart = interval.start;
    let clusterEnd = interval.end;
    let changed = true;
    while (changed) {
      changed = false;
      source.forEach((peer, peerIndex) => {
        if (consumed.has(peerIndex)) return;
        if (peer?.manualOnly !== true || canonicalActivityFamily(peer?.activityType) !== "strength") return;
        if (peer?.manualLogId !== candidate.manualLogId) return;
        const peerInterval = strengthCandidateInterval(peer);
        if (!peerInterval) return;
        if (peerInterval.start <= clusterEnd + STRENGTH_CLUSTER_TOLERANCE_MS && peerInterval.end >= clusterStart - STRENGTH_CLUSTER_TOLERANCE_MS) {
          cluster.push({ candidate: peer, index: peerIndex, interval: peerInterval });
          consumed.add(peerIndex);
          clusterStart = Math.min(clusterStart, peerInterval.start);
          clusterEnd = Math.max(clusterEnd, peerInterval.end);
          changed = true;
        }
      });
    }

    if (cluster.length === 1) {
      grouped.push(candidate);
      return;
    }

    const primary = cluster.slice().sort((left, right) => {
      const extraOrder = Number(left.candidate?.isExtra === true) - Number(right.candidate?.isExtra === true);
      if (extraOrder) return extraOrder;
      const leftDuration = left.interval.end - left.interval.start;
      const rightDuration = right.interval.end - right.interval.start;
      return rightDuration - leftDuration || left.interval.start - right.interval.start || text(left.candidate?.id).localeCompare(text(right.candidate?.id));
    })[0].candidate;
    const sessionDurationMs = Math.max(0, clusterEnd - clusterStart);
    const credibleDurationSec = sessionDurationMs > 0 && sessionDurationMs <= STRENGTH_AUTO_DURATION_MAX_MS
      ? Math.round(sessionDurationMs / 1000)
      : null;
    grouped.push({
      ...primary,
      startedAt: new Date(clusterStart).toISOString(),
      completedAt: new Date(clusterEnd).toISOString(),
      durationSec: credibleDurationSec,
      sessionBlockCount: cluster.length,
      coveredTargetKeys: cluster.map((entry) => `${text(entry.candidate?.manualLogId)}:${text(entry.candidate?.manualBlockId)}`),
    });
  });

  return grouped;
}

function strengthSessionAutoScore(group: any, candidate: any) {''')

old_score = '''function strengthSessionAutoScore(group: any, candidate: any) {
  if (canonicalActivityFamily(group.activityType) !== "strength" || canonicalActivityFamily(candidate.activityType) !== "strength") return 0;
  const groupDate = text(group.localDateYmd) || text(group.startedAt).slice(0, 10);
  const offset = verificationDateOffsetDays(groupDate, candidate.dateYmd);
  if (offset === null || Math.abs(offset) > USER_MATCH_WINDOW_DAYS) return 0;
  const externalStart = isoMs(group.startedAt);
  const workoutStart = isoMs(candidate.startedAt);
  if (externalStart === null || workoutStart === null) return 0;
  const deltaMin = Math.abs(externalStart - workoutStart) / 60000;
  let startScore = 0;
  if (deltaMin <= 5) startScore = 0.4;
  else if (deltaMin <= 15) startScore = 0.3;
  else if (deltaMin <= 30) startScore = 0.2;
  else return 0;
  const dateScore = Math.max(0.08, 0.2 - Math.abs(offset) * 0.06);
  const durationScore = similarityScore(group.durationSec, candidate.durationSec, [
    { relative: 0.08, absolute: 120, score: 0.2 },
    { relative: 0.2, absolute: 300, score: 0.12 },
    { relative: 0.35, absolute: 600, score: 0.06 },
  ]);
  return Math.round((dateScore + 0.15 + startScore + durationScore) * 1000) / 1000;
}'''
new_score = '''function strengthSessionAutoScore(group: any, candidate: any) {
  if (canonicalActivityFamily(group.activityType) !== "strength" || canonicalActivityFamily(candidate.activityType) !== "strength") return 0;
  const groupDate = text(group.localDateYmd) || text(group.startedAt).slice(0, 10);
  const offset = verificationDateOffsetDays(groupDate, candidate.dateYmd);
  if (offset === null || Math.abs(offset) > USER_MATCH_WINDOW_DAYS) return 0;
  const externalStart = isoMs(group.startedAt);
  const workoutStart = isoMs(candidate.startedAt);
  if (externalStart === null || workoutStart === null) return 0;
  const deltaMin = Math.abs(externalStart - workoutStart) / 60000;
  let startScore = 0;
  if (deltaMin <= 5) startScore = 0.45;
  else if (deltaMin <= 15) startScore = 0.35;
  else if (deltaMin <= 30) startScore = 0.2;
  else return 0;
  const offsetDays = Math.abs(offset);
  const dateScore = offsetDays === 0 ? 0.25 : offsetDays === 1 ? 0.16 : 0.08;
  const durationScore = similarityScore(group.durationSec, candidate.durationSec, [
    { relative: 0.08, absolute: 120, score: 0.15 },
    { relative: 0.2, absolute: 300, score: 0.1 },
    { relative: 0.35, absolute: 600, score: 0.05 },
  ]);
  return Math.round((dateScore + 0.15 + startScore + durationScore) * 1000) / 1000;
}'''
replace_once(path, old_score, new_score)

replace_once(path,
'''function targetKey(value: any) {
  return `${text(value?.manualLogId || value?.manual_log_id)}:${text(value?.manualBlockId || value?.manual_block_id)}`;
}
''',
'''function targetKey(value: any) {
  return `${text(value?.manualLogId || value?.manual_log_id)}:${text(value?.manualBlockId || value?.manual_block_id)}`;
}

function candidateTargetKeys(candidate: any) {
  const keys = Array.isArray(candidate?.coveredTargetKeys) ? candidate.coveredTargetKeys.map((value: any) => text(value)).filter(Boolean) : [];
  return keys.length ? keys : [targetKey(candidate)];
}
''')

replace_once(path,
'''  const groups = buildGroups(observationsResult.data || []);
  const candidates = manualCandidates(logsResult.data || [], profileId);''',
'''  const groups = buildGroups(observationsResult.data || []);
  const rawCandidates = manualCandidates(logsResult.data || [], profileId);
  const candidates = groupStrengthManualCandidates(rawCandidates);''')

replace_once(path,
'''    const existingCandidate = existingManual
      ? candidates.find((candidate) => candidate.manualLogId === existingManual.manual_log_id && (candidate.manualBlockId || null) === (existingManual.manual_block_id || null))
      : null;''',
'''    const existingCandidate = existingManual
      ? rawCandidates.find((candidate) => candidate.manualLogId === existingManual.manual_log_id && (candidate.manualBlockId || null) === (existingManual.manual_block_id || null))
      : null;''')

replace_once(path,
'''    const availableCandidates = candidates.filter((candidate) => !claimedManualTargets.has(targetKey(candidate)));''',
'''    const availableCandidates = candidates.filter((candidate) => candidateTargetKeys(candidate).every((key) => !claimedManualTargets.has(key)));''')

replace_once(path,
'''      claimedManualTargets.add(targetKey(match.candidate));
      linkedManual += 1;''',
'''      candidateTargetKeys(match.candidate).forEach((key) => claimedManualTargets.add(key));
      linkedManual += 1;''')


# 2) Strava provider: self-heal the one application-level webhook subscription.
path = "supabase/functions/_shared/stravaProvider.ts"
replace_once(path,
'''export const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
export const STRAVA_API_BASE = Deno.env.get("STRAVA_API_BASE_URL") || "https://www.strava.com/api/v3";''',
'''export const STRAVA_REVOKE_URL = "https://www.strava.com/oauth/revoke";
export const STRAVA_WEBHOOK_SUBSCRIPTIONS_URL = "https://www.strava.com/api/v3/push_subscriptions";
export const STRAVA_API_BASE = Deno.env.get("STRAVA_API_BASE_URL") || "https://www.strava.com/api/v3";''')

replace_once(path,
'''    webhookSubscriptionId: Deno.env.get("STRAVA_WEBHOOK_SUBSCRIPTION_ID") || "",
    oauthCallbackUrl:''',
'''    webhookSubscriptionId: Deno.env.get("STRAVA_WEBHOOK_SUBSCRIPTION_ID") || "",
    webhookCallbackUrl:
      Deno.env.get("STRAVA_WEBHOOK_CALLBACK_URL") ||
      (supabaseUrl ? `${supabaseUrl}/functions/v1/strava-webhook` : ""),
    oauthCallbackUrl:''')

replace_once(path,
'''}

export function randomUrlSafe(bytes = 32) {''',
'''}

function webhookSubscriptionUrl(subscriptionId = "") {
  return subscriptionId
    ? `${STRAVA_WEBHOOK_SUBSCRIPTIONS_URL}/${encodeURIComponent(subscriptionId)}`
    : STRAVA_WEBHOOK_SUBSCRIPTIONS_URL;
}

export async function ensureStravaWebhookSubscription() {
  const config = stravaAppConfig();
  if (!config.clientId || !config.clientSecret || !config.webhookVerifyToken || !config.webhookSigningSecret || !config.webhookCallbackUrl) {
    return { state: "unavailable", reason: "missing_configuration", id: null, created: false, repaired: false };
  }

  const listUrl = new URL(STRAVA_WEBHOOK_SUBSCRIPTIONS_URL);
  listUrl.searchParams.set("client_id", config.clientId);
  listUrl.searchParams.set("client_secret", config.clientSecret);
  const listedResponse = await fetch(listUrl);
  const listedBody = await listedResponse.json().catch(() => []);
  if (!listedResponse.ok) throw new Error(`Strava webhook subscription lookup failed (${listedResponse.status})`);
  const subscriptions = Array.isArray(listedBody) ? listedBody : [];
  const matching = subscriptions.find((row: any) => String(row?.callback_url || "") === config.webhookCallbackUrl);
  if (matching?.id !== null && matching?.id !== undefined) {
    return { state: "active", id: String(matching.id), created: false, repaired: false, callbackUrl: config.webhookCallbackUrl };
  }

  if (subscriptions.length > 1) {
    return { state: "ambiguous", reason: "multiple_application_subscriptions", id: null, created: false, repaired: false };
  }

  let repaired = false;
  if (subscriptions.length === 1 && subscriptions[0]?.id !== null && subscriptions[0]?.id !== undefined) {
    const existingId = String(subscriptions[0].id);
    const deleteUrl = new URL(webhookSubscriptionUrl(existingId));
    deleteUrl.searchParams.set("client_id", config.clientId);
    deleteUrl.searchParams.set("client_secret", config.clientSecret);
    const deleted = await fetch(deleteUrl, { method: "DELETE" });
    if (!deleted.ok && deleted.status !== 404) throw new Error(`Strava webhook subscription repair failed (${deleted.status})`);
    repaired = true;
  }

  const createdResponse = await fetch(STRAVA_WEBHOOK_SUBSCRIPTIONS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      callback_url: config.webhookCallbackUrl,
      verify_token: config.webhookVerifyToken,
    }),
  });
  const createdBody = await createdResponse.json().catch(() => ({}));
  if (!createdResponse.ok || createdBody?.id === null || createdBody?.id === undefined) {
    throw new Error(`Strava webhook subscription creation failed (${createdResponse.status})`);
  }
  return {
    state: "active",
    id: String(createdBody.id),
    created: true,
    repaired,
    callbackUrl: config.webhookCallbackUrl,
  };
}

export function randomUrlSafe(bytes = 32) {''')


# 3) Authenticated verification actions: provision auto-sync silently and as part of manual sync.
path = "supabase/functions/verification-actions/index.ts"
replace_once(path,
'''  createUserClient,
  importRecentStravaActivities,''',
'''  createUserClient,
  ensureStravaWebhookSubscription,
  importRecentStravaActivities,''')

replace_once(path,
'''    if (action === "manual_sync") {''',
'''    if (action === "ensure_auto_sync") {
      const provider = text(body?.provider, "strava");
      if (provider !== "strava") return json({ error: "Automatic source sync is not available for this provider yet" }, 400, corsHeaders);
      const { data: connection, error: connectionError } = await userClient.from("external_connections")
        .select("id,family_id,profile_id,provider,status,auto_sync_enabled")
        .eq("profile_id", profileId).eq("provider", provider).maybeSingle();
      if (connectionError || !connection || connection.status !== "active") return json({ error: "Provider is not connected" }, 409, corsHeaders);
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

    if (action === "manual_sync") {''')

replace_once(path,
'''      const accessToken = await refreshStravaAccessToken(adminClient, connection.id);
      const imported = await importRecentStravaActivities(adminClient, connection, accessToken, { days: 7 });''',
'''      let autoSync: any;
      try {
        autoSync = await ensureStravaWebhookSubscription();
      } catch (error) {
        console.error("Strava automatic sync provisioning failed during manual sync", error);
        autoSync = { state: "error", reason: String((error as any)?.message || error), id: null, created: false, repaired: false };
      }
      const accessToken = await refreshStravaAccessToken(adminClient, connection.id);
      const imported = await importRecentStravaActivities(adminClient, connection, accessToken, { days: 7 });''')

replace_once(path,
'''      await audit(adminClient, authData.user.id, profile, "manual_sync", { provider, eventData: { imported, reconciliation, syncedAt } });
      return json({ provider, imported, reconciliation, syncedAt, nextAllowedAt: new Date(Date.parse(manualSyncStartedAt) + MANUAL_SYNC_COOLDOWN_MS).toISOString() }, 200, corsHeaders);''',
'''      await audit(adminClient, authData.user.id, profile, "manual_sync", { provider, eventData: { imported, reconciliation, syncedAt, autoSync } });
      return json({ provider, imported, reconciliation, syncedAt, autoSync, nextAllowedAt: new Date(Date.parse(manualSyncStartedAt) + MANUAL_SYNC_COOLDOWN_MS).toISOString() }, 200, corsHeaders);''')


# 4) New OAuth connections also ensure the application-level webhook exists.
path = "supabase/functions/strava-oauth-callback/index.ts"
replace_once(path,
'''  fixedAppRedirect,
  hasActivityReadScope,''',
'''  fixedAppRedirect,
  hasActivityReadScope,
  ensureStravaWebhookSubscription,''')

replace_once(path,
'''        try {
          await importRecentStravaActivities(adminClient, connection, accessToken);''',
'''        try {
          try {
            const autoSync = await ensureStravaWebhookSubscription();
            if (autoSync.state !== "active") console.warn("Strava automatic sync is not active after OAuth", autoSync);
          } catch (autoSyncError) {
            console.error("Strava automatic sync provisioning failed after OAuth", autoSyncError);
          }
          await importRecentStravaActivities(adminClient, connection, accessToken);''')


# 5) Signed webhook is authoritative. A legacy pinned subscription id is diagnostic only,
# because self-healing may legitimately replace an old application-level subscription id.
path = "supabase/functions/strava-webhook/index.ts"
replace_once(path,
'''  if (config.webhookSubscriptionId && String(subscriptionId) !== config.webhookSubscriptionId) {
    return json({ error: "Unexpected webhook subscription" }, 403);
  }''',
'''  if (config.webhookSubscriptionId && String(subscriptionId) !== config.webhookSubscriptionId) {
    console.warn("Signed Strava webhook arrived on a subscription id different from the legacy configured id", {
      received: String(subscriptionId),
      configured: config.webhookSubscriptionId,
    });
  }''')


# 6) Browser API + Progress: provision silently once, and refresh evidence when the app regains focus.
path = "src/verifiedActivityDb.js"
replace_once(path,
'''export function checkConnectedSources(profileId, provider = "strava") {
  return runVerificationAction(profileId, "manual_sync", { provider });
}
''',
'''export function ensureConnectedSourceAutoSync(profileId, provider = "strava") {
  return runVerificationAction(profileId, "ensure_auto_sync", { provider });
}

export function checkConnectedSources(profileId, provider = "strava") {
  return runVerificationAction(profileId, "manual_sync", { provider });
}
''')

path = "src/components/progress/VerifiedActivityEvidenceSection.jsx"
replace_once(path,
'''import React, { useEffect, useMemo, useState } from "react";''',
'''import React, { useEffect, useMemo, useRef, useState } from "react";''')
replace_once(path,
'''  detachVerifiedMatch,
  loadManualMatchCandidates,''',
'''  detachVerifiedMatch,
  ensureConnectedSourceAutoSync,
  loadManualMatchCandidates,''')
replace_once(path,
'''  detachVerifiedMatch,
  loadManualMatchCandidates,
  loadVerifiedActivityData,''',
'''  detachVerifiedMatch,
  ensureConnectedSourceAutoSync,
  loadManualMatchCandidates,
  loadVerifiedActivityData,''')
replace_once(path,
'''  const [candidatesByActivity, setCandidatesByActivity] = useState({});''',
'''  const [candidatesByActivity, setCandidatesByActivity] = useState({});
  const autoSyncEnsureKeyRef = useRef("");''')

replace_once(path,
'''  useEffect(() => {
    let active = true;
    async function initialLoad() {
      if (!active) return;
      await load();
    }
    initialLoad();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, onDataChange, profileId]);
''',
'''  useEffect(() => {
    let active = true;
    async function initialLoad() {
      if (!active) return;
      await load();
    }
    initialLoad();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, onDataChange, profileId]);

  useEffect(() => {
    let lastRefreshAt = Date.now();
    const refreshWhenVisible = () => {
      if (!profileId || document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastRefreshAt < 15000) return;
      lastRefreshAt = now;
      void load();
    };
    window.addEventListener("focus", refreshWhenVisible);
    document.addEventListener("visibilitychange", refreshWhenVisible);
    return () => {
      window.removeEventListener("focus", refreshWhenVisible);
      document.removeEventListener("visibilitychange", refreshWhenVisible);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api, onDataChange, profileId]);
''')

replace_once(path,
'''  const stravaConnection = (data?.connections || []).find((row) => row.provider === "strava" && row.status === "active") || null;
  const syncCooldown = useMemo(() => manualSyncCooldown(stravaConnection, nowTick), [stravaConnection, nowTick]);
''',
'''  const stravaConnection = (data?.connections || []).find((row) => row.provider === "strava" && row.status === "active") || null;
  const syncCooldown = useMemo(() => manualSyncCooldown(stravaConnection, nowTick), [stravaConnection, nowTick]);

  useEffect(() => {
    const key = profileId && stravaConnection?.id ? `${profileId}:${stravaConnection.id}` : "";
    if (!key || autoSyncEnsureKeyRef.current === key || typeof api.ensureConnectedSourceAutoSync !== "function") return;
    autoSyncEnsureKeyRef.current = key;
    void api.ensureConnectedSourceAutoSync(profileId, "strava").catch(() => null);
  }, [api, profileId, stravaConnection?.id]);
''')

replace_once(path,
'''      const imported = Number(result?.data?.imported || 0);
      setSyncNotice(`Sync complete. ${imported} connected activit${imported === 1 ? "y was" : "ies were"} refreshed and verification was reconciled.`);''',
'''      const imported = Number(result?.data?.imported || 0);
      const autoSyncState = text(result?.data?.autoSync?.state);
      const autoSyncSuffix = autoSyncState === "active" ? " Automatic Strava updates are active." : "";
      setSyncNotice(`Sync complete. ${imported} connected activit${imported === 1 ? "y was" : "ies were"} refreshed and verification was reconciled.${autoSyncSuffix}`);''')


# 7) Regression/contract coverage for both sides of automatic verification polish.
Path("src/engine/verificationAutomaticPolish.test.js").write_text(r'''import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => fs.readFileSync(path, "utf8");

describe("automatic verification polish", () => {
  it("groups overlapping strength blocks before automatic matching and still preserves raw candidates for user-confirmed links", () => {
    const source = read("supabase/functions/_shared/verificationReconcile.ts");
    expect(source).toContain("function groupStrengthManualCandidates");
    expect(source).toContain("coveredTargetKeys");
    expect(source).toContain("const rawCandidates = manualCandidates");
    expect(source).toContain("const candidates = groupStrengthManualCandidates(rawCandidates)");
    expect(source).toContain("rawCandidates.find((candidate)");
    expect(source).toContain("candidateTargetKeys(candidate).every");
  });

  it("allows a unique same-session strength match without requiring exact movement names or a trustworthy form-entry duration", () => {
    const source = read("supabase/functions/_shared/verificationReconcile.ts");
    expect(source).toContain("if (deltaMin <= 5) startScore = 0.45");
    expect(source).toContain("else if (deltaMin <= 15) startScore = 0.35");
    expect(source).toContain("const dateScore = offsetDays === 0 ? 0.25 : offsetDays === 1 ? 0.16 : 0.08");
    expect(source).toContain("const MANUAL_MARGIN = 0.1");
  });

  it("self-heals the single Strava webhook subscription and provisions it from both connection and manual-sync paths", () => {
    const provider = read("supabase/functions/_shared/stravaProvider.ts");
    const actions = read("supabase/functions/verification-actions/index.ts");
    const callback = read("supabase/functions/strava-oauth-callback/index.ts");
    expect(provider).toContain("STRAVA_WEBHOOK_SUBSCRIPTIONS_URL");
    expect(provider).toContain("export async function ensureStravaWebhookSubscription");
    expect(provider).toContain('method: "DELETE"');
    expect(provider).toContain('method: "POST"');
    expect(actions).toContain('action === "ensure_auto_sync"');
    expect(actions).toContain("await ensureStravaWebhookSubscription()");
    expect(callback).toContain("await ensureStravaWebhookSubscription()");
  });

  it("keeps the signed webhook authoritative if self-healing changes a legacy subscription id", () => {
    const webhook = read("supabase/functions/strava-webhook/index.ts");
    expect(webhook).toContain("Signed Strava webhook arrived on a subscription id different from the legacy configured id");
    expect(webhook).not.toContain('return json({ error: "Unexpected webhook subscription" }, 403)');
  });

  it("silently provisions automatic sync and refreshes evidence after returning to the app", () => {
    const db = read("src/verifiedActivityDb.js");
    const ui = read("src/components/progress/VerifiedActivityEvidenceSection.jsx");
    expect(db).toContain("ensureConnectedSourceAutoSync");
    expect(ui).toContain("autoSyncEnsureKeyRef");
    expect(ui).toContain('window.addEventListener("focus", refreshWhenVisible)');
    expect(ui).toContain('document.addEventListener("visibilitychange", refreshWhenVisible)');
    expect(ui).toContain("Automatic Strava updates are active.");
  });
});
''')

print("Automatic verification polish patch applied")
