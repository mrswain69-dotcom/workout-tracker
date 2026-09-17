import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  checkConnectedSources,
  confirmManualVerifiedMatch,
  detachVerifiedMatch,
  ensureConnectedSourceAutoSync,
  loadManualMatchCandidates,
  loadVerifiedActivityData,
  resetVerifiedAutomaticMatching,
  setVerifiedActivityIgnored,
} from "../../verifiedActivityDb.js";
import {
  buildVerifiedCardioEvidence,
  summariseVerifiedCardioEvidence,
} from "../../engine/verifiedCardioEvidenceEngine.js";
import { manualSyncCooldown } from "../../engine/verificationInteractionEngine.js";
import "./VerifiedActivitySection.css";

const DEFAULT_API = Object.freeze({
  checkConnectedSources,
  confirmManualVerifiedMatch,
  detachVerifiedMatch,
  ensureConnectedSourceAutoSync,
  loadManualMatchCandidates,
  loadVerifiedActivityData,
  resetVerifiedAutomaticMatching,
  setVerifiedActivityIgnored,
});

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function titleCase(value) {
  return text(value, "Activity").replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function firstPositive(rows, key) {
  for (const row of rows) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function formatDistanceMetres(value) {
  const metres = Number(value);
  if (!Number.isFinite(metres) || metres <= 0) return "";
  return `${(metres / 1000).toFixed(metres >= 10000 ? 1 : 2)} km`;
}

function formatDistanceKm(value) {
  const km = Number(value);
  return Number.isFinite(km) && km > 0 ? `${km.toLocaleString("en-GB", { maximumFractionDigits: 2 })} km` : "—";
}

function formatDurationSeconds(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`;
}

function formatMinutes(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return `${hours}h${remainder ? ` ${remainder}m` : ""}`;
}

function formatCooldown(value) {
  const seconds = Math.max(0, Math.ceil(Number(value || 0) / 1000));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return minutes ? `${minutes}:${String(remainder).padStart(2, "0")}` : `${remainder}s`;
}

function providerLabel(provider) {
  const labels = { strava: "Strava", garmin: "Garmin", apple_health: "Apple Health", health_connect: "Health Connect" };
  return labels[provider] || titleCase(provider);
}

function offsetLabel(offset) {
  const value = Number(offset || 0);
  if (!value) return "same-day match";
  if (value < 0) return `${Math.abs(value)} day${Math.abs(value) === 1 ? "" : "s"} after planned date`;
  return `${value} day${value === 1 ? "" : "s"} before planned date`;
}

function candidateMetrics(candidate) {
  const parts = [];
  if (Number(candidate?.distanceM) > 0) parts.push(formatDistanceMetres(candidate.distanceM));
  if (Number(candidate?.durationSec) > 0) parts.push(formatDurationSeconds(candidate.durationSec));
  return parts.join(" · ");
}

function candidateIsStrength(candidate) {
  const token = text(candidate?.activityType, "unknown").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return /(strength|weight_?training|weights|weightlifting|resistance)/.test(token);
}

function candidateInterval(candidate) {
  const start = Date.parse(text(candidate?.startedAt));
  if (!Number.isFinite(start)) return null;
  const explicitEnd = Date.parse(text(candidate?.completedAt));
  const durationSec = Number(candidate?.durationSec);
  const end = Number.isFinite(explicitEnd) && explicitEnd >= start
    ? explicitEnd
    : Number.isFinite(durationSec) && durationSec > 0
      ? start + durationSec * 1000
      : start;
  return { start, end };
}

export function groupManualMatchCandidates(candidates = []) {
  const source = Array.isArray(candidates) ? candidates : [];
  const consumed = new Set();
  const grouped = [];
  const toleranceMs = 2 * 60 * 1000;
  const maxStartGapMs = 90 * 60 * 1000;

  source.forEach((candidate, index) => {
    if (consumed.has(index)) return;
    const interval = candidateInterval(candidate);
    if (!candidateIsStrength(candidate) || !interval || !candidate?.manualLogId) {
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
        if (consumed.has(peerIndex) || peer?.manualLogId !== candidate.manualLogId || !candidateIsStrength(peer)) return;
        const peerInterval = candidateInterval(peer);
        if (!peerInterval) return;
        if (
          peerInterval.start <= clusterEnd + toleranceMs &&
          peerInterval.end >= clusterStart - toleranceMs &&
          Math.abs(peerInterval.start - clusterStart) <= maxStartGapMs
        ) {
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
      const leftDuration = left.interval.end - left.interval.start;
      const rightDuration = right.interval.end - right.interval.start;
      return rightDuration - leftDuration || left.interval.start - right.interval.start || Number(right.candidate?.score || 0) - Number(left.candidate?.score || 0);
    })[0].candidate;
    grouped.push({
      ...primary,
      displayLabel: `Strength session · ${cluster.length} Workout Tracker blocks`,
      groupedCount: cluster.length,
      durationSec: Math.max(1, Math.round((clusterEnd - clusterStart) / 1000)),
      startedAt: new Date(clusterStart).toISOString(),
      completedAt: new Date(clusterEnd).toISOString(),
      score: Math.max(...cluster.map((entry) => Number(entry.candidate?.score || 0))),
    });
  });

  return grouped.sort((left, right) => Number(right?.score || 0) - Number(left?.score || 0));
}

function buildRows(data) {
  const observationsById = new Map((data?.observations || []).map((row) => [row.id, row]));
  const observationIdsByActivity = new Map();
  for (const link of data?.observationLinks || []) {
    if (!observationIdsByActivity.has(link.verified_activity_id)) observationIdsByActivity.set(link.verified_activity_id, []);
    observationIdsByActivity.get(link.verified_activity_id).push(link.observation_id);
  }
  const manualLinks = new Map((data?.manualLinks || []).map((row) => [row.verified_activity_id, row]));

  return (data?.verifiedActivities || []).map((activity) => {
    const observations = (observationIdsByActivity.get(activity.id) || [])
      .map((id) => observationsById.get(id))
      .filter((row) => row && !row.source_deleted_at);
    const eligible = observations.filter((row) => row.source_manual_entry !== true);
    const devices = [...new Set(eligible.map((row) => text(row.source_device_name)).filter(Boolean))].sort();
    const hasDevice = eligible.some((row) => text(row.source_device_name) || text(row.source_external_id) || text(row.source_upload_id));
    return {
      ...activity,
      observations,
      providers: [...new Set(observations.map((row) => row.provider).filter(Boolean))].sort(),
      verificationEligible: eligible.length > 0,
      verificationLabel: eligible.length ? (hasDevice ? "Device/file evidence" : "Provider-recorded evidence") : "Manual provider entry · not verification eligible",
      devices,
      localDateYmd: observations[0]?.local_date_ymd || "",
      distanceM: firstPositive(observations, "distance_m"),
      durationSec: firstPositive(observations, "moving_duration_sec") || firstPositive(observations, "elapsed_duration_sec"),
      averageHeartRate: firstPositive(observations, "average_heart_rate_bpm"),
      manualLink: manualLinks.get(activity.id) || null,
    };
  }).filter((row) => row.observations.length).sort((a, b) => text(b.started_at).localeCompare(text(a.started_at)));
}

export default function VerifiedActivityEvidenceSection({
  profileId,
  profileName = "Athlete",
  api = DEFAULT_API,
  onDataChange = null,
}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedId, setExpandedId] = useState("");
  const [busy, setBusy] = useState("");
  const [actionError, setActionError] = useState("");
  const [syncNotice, setSyncNotice] = useState("");
  const [nowTick, setNowTick] = useState(Date.now());
  const [candidatesByActivity, setCandidatesByActivity] = useState({});
  const autoSyncEnsureKeyRef = useRef("");

  async function load() {
    if (!profileId) {
      setData(null);
      setLoading(false);
      onDataChange?.(null);
      return;
    }
    setLoading(true);
    try {
      const result = await api.loadVerifiedActivityData(profileId);
      if (result?.error) throw result.error;
      const next = result?.data || null;
      setData(next);
      setError(null);
      onDataChange?.(next);
    } catch (loadError) {
      setData(null);
      setError(loadError);
      onDataChange?.(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
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

  const allRows = useMemo(() => buildRows(data), [data]);
  const activityRows = useMemo(() => allRows.filter((row) => row.status !== "ignored"), [allRows]);
  const ignoredRows = useMemo(() => allRows.filter((row) => row.status === "ignored"), [allRows]);
  const verifiedRows = useMemo(() => buildVerifiedCardioEvidence(data || {}), [data]);
  const summary = useMemo(() => summariseVerifiedCardioEvidence(verifiedRows), [verifiedRows]);
  const connectedCount = (data?.connections || []).filter((row) => row.status === "active").length;
  const matchedCount = (data?.manualLinks || []).length;
  const stravaConnection = (data?.connections || []).find((row) => row.provider === "strava" && row.status === "active") || null;
  const syncCooldown = useMemo(() => manualSyncCooldown(stravaConnection, nowTick), [stravaConnection, nowTick]);

  useEffect(() => {
    const key = profileId && stravaConnection?.id ? `${profileId}:${stravaConnection.id}` : "";
    if (!key || stravaConnection?.auto_sync_enabled === false || autoSyncEnsureKeyRef.current === key || typeof api.ensureConnectedSourceAutoSync !== "function") return;
    autoSyncEnsureKeyRef.current = key;
    void api.ensureConnectedSourceAutoSync(profileId, "strava").catch(() => null);
  }, [api, profileId, stravaConnection?.id]);

  useEffect(() => {
    if (!syncCooldown.blocked) return undefined;
    const timer = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [syncCooldown.blocked]);

  async function runSync() {
    if (!profileId || !stravaConnection || syncCooldown.blocked || busy) return;
    setBusy("sync");
    setActionError("");
    setSyncNotice("");
    try {
      const result = await api.checkConnectedSources(profileId, "strava");
      if (result?.error) throw result.error;
      const imported = Number(result?.data?.imported || 0);
      const autoSyncState = text(result?.data?.autoSync?.state);
      const autoSyncSuffix = autoSyncState === "active" ? " Automatic Strava updates are active." : "";
      setSyncNotice(`Sync complete. ${imported} connected activit${imported === 1 ? "y was" : "ies were"} refreshed and verification was reconciled.${autoSyncSuffix}`);
      await load();
      setNowTick(Date.now());
    } catch (syncFailure) {
      setActionError(syncFailure?.message || String(syncFailure));
      await load();
      setNowTick(Date.now());
    } finally {
      setBusy("");
    }
  }

  async function runAction(activityId, action) {
    setBusy(`${action}:${activityId}`);
    setActionError("");
    try {
      await action();
      setCandidatesByActivity((current) => ({ ...current, [activityId]: undefined }));
      await load();
    } catch (actionFailure) {
      setActionError(actionFailure?.message || String(actionFailure));
    } finally {
      setBusy("");
    }
  }

  async function findCandidates(activity) {
    setBusy(`candidates:${activity.id}`);
    setActionError("");
    try {
      const result = await api.loadManualMatchCandidates(profileId, activity.id);
      if (result?.error) throw result.error;
      setCandidatesByActivity((current) => ({ ...current, [activity.id]: result?.data?.candidates || [] }));
    } catch (actionFailure) {
      setActionError(actionFailure?.message || String(actionFailure));
    } finally {
      setBusy("");
    }
  }

  function renderActivityCard(activity) {
    const metrics = [
      formatDistanceMetres(activity.distanceM),
      formatDurationSeconds(activity.durationSec),
      activity.averageHeartRate ? `${Math.round(activity.averageHeartRate)} bpm avg` : "",
    ].filter(Boolean);
    const expanded = expandedId === activity.id;
    const candidates = candidatesByActivity[activity.id];
    const displayCandidates = Array.isArray(candidates) ? groupManualMatchCandidates(candidates) : candidates;
    const linked = !!activity.manualLink;
    const matchMethod = activity.manualLink?.match_method === "manual" ? "Match confirmed by athlete" : "Automatically matched";

    return (
      <article key={activity.id} className="verified-activity-card">
        <div className="verified-activity-card__top">
          <div>
            <div className="verified-activity-card__type">{titleCase(activity.activity_type)}</div>
            <div className="verified-activity-card__date">{activity.localDateYmd || text(activity.started_at).slice(0, 10)}</div>
          </div>
          <button
            type="button"
            className={`verified-status-button ${linked ? "is-verified" : "is-unverified"}`}
            aria-expanded={expanded}
            onClick={() => setExpandedId(expanded ? "" : activity.id)}
          >
            <span aria-hidden="true">{linked ? "✓" : "○"}</span>
            {linked ? "Verified workout" : "Not linked"}
          </button>
        </div>
        {metrics.length ? <div className="verified-activity-card__metrics">{metrics.join(" · ")}</div> : null}
        <div className="verified-provider-row">
          {activity.providers.map((provider) => <span key={provider}>{providerLabel(provider)}</span>)}
          <span className={`verified-match-chip ${activity.verificationEligible ? "is-eligible" : "is-ineligible"}`}>{activity.verificationLabel}</span>
          {activity.devices.map((device) => <span key={device} className="verified-device-chip">Recorded by {device}</span>)}
          {activity.identity_method === "automatic_dedup" ? <span className="verified-dedupe-chip">One activity · multiple sources</span> : null}
        </div>

        {expanded ? (
          <div className="verified-activity-detail">
            <div className="verified-detail-grid">
              <div><span>Verification</span><strong>{linked ? matchMethod : "External evidence only"}</strong></div>
              <div><span>Providers</span><strong>{activity.providers.map(providerLabel).join(" + ") || "External source"}</strong></div>
              {linked ? <div><span>Date relationship</span><strong>{offsetLabel(activity.manualLink.date_offset_days)}</strong></div> : null}
              {Number.isFinite(Number(activity.manualLink?.match_confidence)) ? <div><span>Match confidence</span><strong>{Math.round(Number(activity.manualLink.match_confidence) * 100)}%</strong></div> : null}
            </div>

            {linked ? (
              <div className="verified-detail-actions">
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => runAction(activity.id, () => api.detachVerifiedMatch(profileId, activity.id).then((result) => { if (result?.error) throw result.error; }))}
                >
                  {busy === `detach:${activity.id}` ? "Detaching…" : "Detach from Workout Tracker activity"}
                </button>
                {activity.auto_match_suppressed ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => runAction(activity.id, () => api.resetVerifiedAutomaticMatching(profileId, activity.id).then((result) => { if (result?.error) throw result.error; }))}
                  >
                    Allow automatic matching again
                  </button>
                ) : null}
              </div>
            ) : activity.verificationEligible ? (
              <div className="verified-match-finder">
                <button type="button" disabled={!!busy} onClick={() => findCandidates(activity)}>
                  {busy === `candidates:${activity.id}` ? "Finding…" : "Find matching Workout Tracker activity"}
                </button>
                {Array.isArray(displayCandidates) ? (
                  displayCandidates.length ? (
                    <div className="verified-candidate-list">
                      {displayCandidates.map((candidate) => (
                        <button
                          type="button"
                          key={`${candidate.manualLogId}:${candidate.manualBlockId || "legacy"}`}
                          disabled={!!busy}
                          onClick={() => runAction(activity.id, async () => {
                            const result = await api.confirmManualVerifiedMatch(profileId, activity.id, {
                              manualLogId: candidate.manualLogId,
                              manualBlockId: candidate.manualBlockId,
                            });
                            if (result?.error) throw result.error;
                          })}
                        >
                          <span><strong>{candidate.displayLabel || candidate.label}</strong><small>{candidate.logDate} · {offsetLabel(candidate.dateOffsetDays)}</small></span>
                          <span>{candidateMetrics(candidate) || "Compatible activity"}</span>
                        </button>
                      ))}
                    </div>
                  ) : <div className="verified-no-candidates">No compatible unclaimed Workout Tracker activity was found within ±2 days.</div>
                ) : null}
              </div>
            ) : null}

            <details className="verified-detail-more">
              <summary>More options</summary>
              <button
                type="button"
                className="is-danger"
                disabled={!!busy}
                onClick={() => runAction(activity.id, async () => {
                  const result = await api.setVerifiedActivityIgnored(profileId, activity.id, true);
                  if (result?.error) throw result.error;
                })}
              >
                Ignore this external activity
              </button>
            </details>
          </div>
        ) : null}
      </article>
    );
  }

  return (
    <div className="progress-section verified-activity-section" aria-label="Verified activity evidence">
      <div className="verified-activity-heading">
        <div>
          <div className="progress-section-heading__kicker">VERIFIED ACTIVITY</div>
          <h3>External activity evidence</h3>
          <p className="progress-section-copy">
            Verification works quietly in the background. Tap a verification status only when you want provenance, matching or correction controls.
            Provider evidence stays separate from manual workout history and rewards.
          </p>
        </div>
        {stravaConnection ? (
          <div className="verified-sync-control">
            <button
              type="button"
              className={`verified-refresh-button verified-sync-button${busy === "sync" ? " is-syncing" : ""}`}
              disabled={!!busy || syncCooldown.blocked}
              onClick={runSync}
            >
              <span className="verified-sync-icon" aria-hidden="true">↻</span>
              <span>{busy === "sync" ? "Syncing…" : syncCooldown.blocked ? `Sync in ${formatCooldown(syncCooldown.remainingMs)}` : "Run sync"}</span>
            </button>
            <small>Refresh connected activity evidence</small>
          </div>
        ) : null}
      </div>
      {loading ? <div className="verified-system-message">Loading verified activity…</div> : null}
      {error ? <div className="verified-system-message verified-system-message--error" role="alert">Verified activity could not be loaded.</div> : null}
      {actionError ? <div className="verified-system-message verified-system-message--error" role="alert">{actionError}</div> : null}
      {syncNotice ? <div className="verified-system-message verified-system-message--success" role="status">{syncNotice}</div> : null}

      <div className="verified-summary-grid" aria-label="Verification summary">
        <div><span>Connected sources</span><strong>{connectedCount}</strong></div>
        <div><span>Synced activities</span><strong>{activityRows.length}</strong></div>
        <div><span>Matched to Workout Tracker</span><strong>{matchedCount}</strong></div>
      </div>

      <div className="verified-cardio-progress" aria-label="Verified cardio Progress evidence">
        <div className="verified-cardio-progress__heading">
          <div><div className="progress-section-heading__kicker">CARDIO EVIDENCE</div><h4>Verified cardio in Progress</h4></div>
          <span>Evidence only · PB authority unchanged</span>
        </div>
        <div className="verified-cardio-progress__metrics">
          <div><span>Verified cardio</span><strong>{summary.activityCount}</strong></div>
          <div><span>Verified distance</span><strong>{formatDistanceKm(summary.totalDistanceKm)}</strong></div>
          <div><span>Verified time</span><strong>{formatMinutes(summary.totalDurationMin)}</strong></div>
          <div><span>HR evidence</span><strong>{summary.heartRateActivityCount}</strong></div>
        </div>
      </div>

      <div className="verified-evidence-header">
        <div><div className="progress-section-heading__kicker">RECENT EVIDENCE</div><h4>Recent synced activity</h4></div>
        <span className="verified-reward-neutral">0 bonus XP · evidence only</span>
      </div>

      {activityRows.length ? <div className="verified-activity-list">{activityRows.slice(0, 8).map(renderActivityCard)}</div> : (
        <div className="verified-empty-state"><strong>No synced activity yet.</strong><span>Connect a source in Settings → Connections.</span></div>
      )}

      {ignoredRows.length ? (
        <details className="verified-ignored-section">
          <summary>{ignoredRows.length} ignored external activit{ignoredRows.length === 1 ? "y" : "ies"}</summary>
          <div className="verified-ignored-list">
            {ignoredRows.map((activity) => (
              <div key={activity.id}>
                <span><strong>{titleCase(activity.activity_type)}</strong><small>{activity.localDateYmd || text(activity.started_at).slice(0, 10)}</small></span>
                <button type="button" disabled={!!busy} onClick={() => runAction(activity.id, async () => {
                  const result = await api.setVerifiedActivityIgnored(profileId, activity.id, false);
                  if (result?.error) throw result.error;
                })}>Restore</button>
              </div>
            ))}
          </div>
        </details>
      ) : null}
    </div>
  );
}