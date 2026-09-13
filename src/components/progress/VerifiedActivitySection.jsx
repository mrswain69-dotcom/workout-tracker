import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  disconnectStravaConnection,
  loadVerifiedActivityData,
  reconcileVerifiedActivityData,
  startStravaConnection,
} from "../../verifiedActivityDb.js";
import "./VerifiedActivitySection.css";

const DEFAULT_API = Object.freeze({
  disconnectStravaConnection,
  loadVerifiedActivityData,
  reconcileVerifiedActivityData,
  startStravaConnection,
});

const PROVIDERS = Object.freeze([
  {
    id: "strava",
    name: "Strava",
    detail: "Automatic activity sync through OAuth and signed webhooks.",
    state: "available",
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    detail: "Provider adapter planned on the same verified-activity foundation.",
    state: "planned",
  },
  {
    id: "apple_health",
    name: "Apple Health",
    detail: "Planned through the native iOS HealthKit bridge.",
    state: "native",
  },
  {
    id: "health_connect",
    name: "Health Connect",
    detail: "Planned through the native Android Health Connect bridge.",
    state: "native",
  },
]);

function emptyData(profileId = "") {
  return {
    profileId,
    connections: [],
    observations: [],
    verifiedActivities: [],
    observationLinks: [],
    manualLinks: [],
  };
}

function text(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const result = String(value).trim();
  return result || fallback;
}

function titleCase(value) {
  return text(value, "Activity")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDistance(value) {
  const metres = Number(value);
  if (!Number.isFinite(metres) || metres <= 0) return "";
  return `${(metres / 1000).toFixed(metres >= 10000 ? 1 : 2)} km`;
}

function formatDuration(value) {
  const seconds = Number(value);
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const totalMinutes = Math.round(seconds / 60);
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function formatDate(value) {
  const raw = text(value);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.slice(0, 10);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatSync(value) {
  const raw = text(value);
  if (!raw) return "Not synced yet";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "Sync recorded";
  return `Last sync ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

function firstPositive(rows, key) {
  for (const row of rows) {
    const value = Number(row?.[key]);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function providerLabel(provider) {
  if (provider === "strava") return "Strava";
  if (provider === "garmin") return "Garmin";
  if (provider === "apple_health") return "Apple Health";
  if (provider === "health_connect") return "Health Connect";
  return titleCase(provider);
}

function buildActivityRows(data) {
  const observationsById = new Map(
    (data?.observations || []).map((row) => [row.id, row])
  );
  const observationIdsByActivity = new Map();
  for (const link of data?.observationLinks || []) {
    if (!observationIdsByActivity.has(link.verified_activity_id)) {
      observationIdsByActivity.set(link.verified_activity_id, []);
    }
    observationIdsByActivity.get(link.verified_activity_id).push(link.observation_id);
  }
  const manualLinkByActivity = new Map(
    (data?.manualLinks || []).map((row) => [row.verified_activity_id, row])
  );

  return (data?.verifiedActivities || [])
    .filter((activity) => activity?.status !== "ignored")
    .map((activity) => {
      const observations = (observationIdsByActivity.get(activity.id) || [])
        .map((id) => observationsById.get(id))
        .filter(Boolean)
        .filter((row) => !row.source_deleted_at);
      const providers = [...new Set(observations.map((row) => row.provider).filter(Boolean))]
        .sort();
      const firstObservation = observations[0] || null;
      return {
        ...activity,
        observations,
        providers,
        localDateYmd: firstObservation?.local_date_ymd || "",
        distanceM: firstPositive(observations, "distance_m"),
        durationSec:
          firstPositive(observations, "moving_duration_sec") ||
          firstPositive(observations, "elapsed_duration_sec"),
        averageHeartRate: firstPositive(observations, "average_heart_rate_bpm"),
        manualLink: manualLinkByActivity.get(activity.id) || null,
      };
    })
    .sort((a, b) => text(b.started_at).localeCompare(text(a.started_at)));
}

function ProviderCard({ provider, connection, busy, onConnect, onDisconnect }) {
  const connected = connection?.status === "active";
  const status = connected
    ? "Connected"
    : connection?.status === "error"
      ? "Needs attention"
      : provider.state === "available"
        ? "Ready to connect"
        : provider.state === "native"
          ? "Native app bridge"
          : "Planned";

  return (
    <div className={`verified-source-card verified-source-card--${connected ? "connected" : provider.state}`}>
      <div className="verified-source-card__top">
        <div>
          <div className="verified-source-card__name">{provider.name}</div>
          <div className="verified-source-card__status">{status}</div>
        </div>
        <span className={`verified-source-dot ${connected ? "is-connected" : ""}`} aria-hidden="true" />
      </div>
      <p>{provider.detail}</p>
      {connection ? (
        <div className="verified-source-card__meta">
          <span>{connection.auto_sync_enabled ? "Automatic sync on" : "Automatic sync off"}</span>
          <span>{formatSync(connection.last_sync_at)}</span>
        </div>
      ) : null}
      {provider.id === "strava" ? (
        <div className="verified-source-card__actions">
          {connected ? (
            <button type="button" disabled={busy} onClick={onDisconnect}>
              {busy ? "Working…" : "Disconnect"}
            </button>
          ) : (
            <button type="button" disabled={busy} onClick={onConnect}>
              {busy ? "Opening…" : "Connect Strava"}
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export default function VerifiedActivitySection({
  profileId,
  profileName = "Athlete",
  api = DEFAULT_API,
  navigateToProvider = (url) => window.location.assign(url),
}) {
  const [data, setData] = useState(() => emptyData(profileId));
  const [loading, setLoading] = useState(true);
  const [busyAction, setBusyAction] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const reload = useCallback(async () => {
    if (!profileId) {
      setData(emptyData(""));
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const result = await api.loadVerifiedActivityData(profileId);
      if (result?.error) throw result.error;
      setData(result?.data || emptyData(profileId));
      setError(null);
    } catch (loadError) {
      setData(emptyData(profileId));
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }, [api, profileId]);

  useEffect(() => {
    let active = true;
    async function load() {
      if (!profileId) {
        if (active) {
          setData(emptyData(""));
          setLoading(false);
        }
        return;
      }
      setLoading(true);
      try {
        const result = await api.loadVerifiedActivityData(profileId);
        if (!active) return;
        if (result?.error) throw result.error;
        setData(result?.data || emptyData(profileId));
        setError(null);
      } catch (loadError) {
        if (active) {
          setData(emptyData(profileId));
          setError(loadError);
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [api, profileId]);

  const connectionsByProvider = useMemo(
    () => new Map((data.connections || []).map((row) => [row.provider, row])),
    [data.connections]
  );
  const activityRows = useMemo(() => buildActivityRows(data), [data]);
  const connectedCount = (data.connections || []).filter((row) => row.status === "active").length;
  const linkedCount = (data.manualLinks || []).length;

  async function connectStrava() {
    setBusyAction("connect-strava");
    setNotice("");
    setError(null);
    try {
      const result = await api.startStravaConnection(profileId, { includePrivate: false });
      if (result?.error) throw result.error;
      if (!result?.data?.authorizeUrl) {
        throw new Error("Strava connection setup is not activated yet.");
      }
      navigateToProvider(result.data.authorizeUrl);
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusyAction("");
    }
  }

  async function disconnectStrava() {
    setBusyAction("disconnect-strava");
    setNotice("");
    setError(null);
    try {
      const result = await api.disconnectStravaConnection(profileId);
      if (result?.error) throw result.error;
      setNotice("Strava disconnected. Existing Workout Tracker history was not changed.");
      await reload();
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusyAction("");
    }
  }

  async function syncVerification() {
    setBusyAction("reconcile");
    setNotice("");
    setError(null);
    try {
      const result = await api.reconcileVerifiedActivityData(profileId);
      if (result?.error) throw result.error;
      setNotice("Verification evidence refreshed from current source truth.");
      await reload();
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusyAction("");
    }
  }

  return (
    <div className="progress-section verified-activity-section" aria-label="Connected Sources and verified activity">
      <div className="verified-activity-heading">
        <div>
          <div className="progress-section-heading__kicker">VERIFICATION</div>
          <h3>Connected Sources</h3>
          <p className="progress-section-copy">
            Provider activity stays separate from {profileName}&apos;s manual Workout Tracker history.
            Matching adds evidence only — it does not duplicate workouts or XP.
          </p>
        </div>
        <button
          type="button"
          className="verified-refresh-button"
          onClick={syncVerification}
          disabled={!profileId || busyAction === "reconcile"}
        >
          {busyAction === "reconcile" ? "Refreshing…" : "Refresh evidence"}
        </button>
      </div>

      {loading ? <div className="verified-system-message">Loading connected sources…</div> : null}
      {error ? (
        <div className="verified-system-message verified-system-message--error" role="alert">
          <strong>Connected Sources:</strong> {error.message || String(error)}
        </div>
      ) : null}
      {notice ? <div className="verified-system-message" role="status">{notice}</div> : null}

      <div className="verified-source-grid">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            connection={connectionsByProvider.get(provider.id)}
            busy={busyAction.includes(provider.id)}
            onConnect={connectStrava}
            onDisconnect={disconnectStrava}
          />
        ))}
      </div>

      <div className="verified-summary-grid" aria-label="Verification summary">
        <div><span>Connected sources</span><strong>{connectedCount}</strong></div>
        <div><span>Verified activities</span><strong>{activityRows.length}</strong></div>
        <div><span>Matched to manual logs</span><strong>{linkedCount}</strong></div>
      </div>

      <div className="verified-evidence-header">
        <div>
          <div className="progress-section-heading__kicker">ACTIVITY EVIDENCE</div>
          <h4>Recent synced activity</h4>
        </div>
        <span className="verified-reward-neutral">0 bonus XP · evidence only</span>
      </div>

      {activityRows.length ? (
        <div className="verified-activity-list">
          {activityRows.slice(0, 8).map((activity) => {
            const metrics = [
              formatDistance(activity.distanceM),
              formatDuration(activity.durationSec),
              activity.averageHeartRate ? `${Math.round(activity.averageHeartRate)} bpm avg` : "",
            ].filter(Boolean);
            const dateLabel = activity.localDateYmd || formatDate(activity.started_at);
            return (
              <article key={activity.id} className="verified-activity-card">
                <div className="verified-activity-card__top">
                  <div>
                    <div className="verified-activity-card__type">{titleCase(activity.activity_type)}</div>
                    <div className="verified-activity-card__date">{dateLabel}</div>
                  </div>
                  <span className={`verified-match-chip ${activity.manualLink ? "is-linked" : ""}`}>
                    {activity.manualLink ? "Matched to Workout Tracker" : "Provider evidence"}
                  </span>
                </div>
                {metrics.length ? <div className="verified-activity-card__metrics">{metrics.join(" · ")}</div> : null}
                <div className="verified-provider-row">
                  {(activity.providers.length ? activity.providers : ["external"]).map((provider) => (
                    <span key={provider}>{providerLabel(provider)}</span>
                  ))}
                  {activity.identity_method === "automatic_dedup" ? (
                    <span className="verified-dedupe-chip">One activity · multiple sources</span>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="verified-empty-state">
          <strong>No synced activity yet.</strong>
          <span>
            Once a source is connected, provider observations can sync here automatically and
            clear matches can be linked to existing manual workouts without changing them.
          </span>
        </div>
      )}
    </div>
  );
}
