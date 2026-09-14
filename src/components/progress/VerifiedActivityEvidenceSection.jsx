import React, { useEffect, useMemo, useState } from "react";
import { loadVerifiedActivityData } from "../../verifiedActivityDb.js";
import {
  buildVerifiedCardioEvidence,
  summariseVerifiedCardioEvidence,
} from "../../engine/verifiedCardioEvidenceEngine.js";
import "./VerifiedActivitySection.css";

const DEFAULT_API = Object.freeze({ loadVerifiedActivityData });

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

function providerLabel(provider) {
  const labels = { strava: "Strava", garmin: "Garmin", apple_health: "Apple Health", health_connect: "Health Connect" };
  return labels[provider] || titleCase(provider);
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

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profileId) {
        if (active) {
          setData(null);
          setLoading(false);
          onDataChange?.(null);
        }
        return;
      }
      setLoading(true);
      try {
        const result = await api.loadVerifiedActivityData(profileId);
        if (!active) return;
        if (result?.error) throw result.error;
        const next = result?.data || null;
        setData(next);
        setError(null);
        onDataChange?.(next);
      } catch (loadError) {
        if (active) {
          setData(null);
          setError(loadError);
          onDataChange?.(null);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => { active = false; };
  }, [api, onDataChange, profileId]);

  const activityRows = useMemo(() => buildRows(data), [data]);
  const verifiedRows = useMemo(() => buildVerifiedCardioEvidence(data || {}), [data]);
  const summary = useMemo(() => summariseVerifiedCardioEvidence(verifiedRows), [verifiedRows]);
  const connectedCount = (data?.connections || []).filter((row) => row.status === "active").length;
  const matchedCount = (data?.manualLinks || []).length;

  return (
    <div className="progress-section verified-activity-section" aria-label="Verified activity evidence">
      <div className="verified-activity-heading">
        <div>
          <div className="progress-section-heading__kicker">VERIFIED ACTIVITY</div>
          <h3>External activity evidence</h3>
          <p className="progress-section-copy">
            Read-only evidence for {profileName}. Connections and data permissions are managed in Settings → Connections.
            Provider evidence stays separate from manual workout history and rewards.
          </p>
        </div>
      </div>
      {loading ? <div className="verified-system-message">Loading verified activity…</div> : null}
      {error ? <div className="verified-system-message verified-system-message--error" role="alert">Verified activity could not be loaded.</div> : null}

      <div className="verified-summary-grid" aria-label="Verification summary">
        <div><span>Connected sources</span><strong>{connectedCount}</strong></div>
        <div><span>Synced activities</span><strong>{activityRows.length}</strong></div>
        <div><span>Matched to manual logs</span><strong>{matchedCount}</strong></div>
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

      {activityRows.length ? (
        <div className="verified-activity-list">
          {activityRows.slice(0, 8).map((activity) => {
            const metrics = [
              formatDistanceMetres(activity.distanceM),
              formatDurationSeconds(activity.durationSec),
              activity.averageHeartRate ? `${Math.round(activity.averageHeartRate)} bpm avg` : "",
            ].filter(Boolean);
            return (
              <article key={activity.id} className="verified-activity-card">
                <div className="verified-activity-card__top">
                  <div><div className="verified-activity-card__type">{titleCase(activity.activity_type)}</div><div className="verified-activity-card__date">{activity.localDateYmd || text(activity.started_at).slice(0, 10)}</div></div>
                  <span className={`verified-match-chip ${activity.verificationEligible ? "is-eligible" : "is-ineligible"}`}>{activity.verificationLabel}</span>
                </div>
                {metrics.length ? <div className="verified-activity-card__metrics">{metrics.join(" · ")}</div> : null}
                <div className="verified-provider-row">
                  {activity.providers.map((provider) => <span key={provider}>{providerLabel(provider)}</span>)}
                  {activity.manualLink ? <span className="verified-manual-link-chip">Matched to Workout Tracker</span> : null}
                  {activity.devices.map((device) => <span key={device} className="verified-device-chip">Recorded by {device}</span>)}
                  {activity.identity_method === "automatic_dedup" ? <span className="verified-dedupe-chip">One activity · multiple sources</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : <div className="verified-empty-state"><strong>No synced activity yet.</strong><span>Connect a source in Settings → Connections.</span></div>}
    </div>
  );
}
