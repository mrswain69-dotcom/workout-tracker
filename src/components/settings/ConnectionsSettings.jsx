import React, { useEffect, useMemo, useState } from "react";
import {
  disconnectStravaConnection,
  startStravaConnection,
} from "../../verifiedActivityDb.js";
import {
  DEFAULT_CONNECTION_PREFERENCES,
  loadConnectionSettingsData,
  updateConnectionPreferences,
} from "../../connectionSettingsDb.js";
import "./ConnectionsSettings.css";

const DEFAULT_API = Object.freeze({
  disconnectStravaConnection,
  loadConnectionSettingsData,
  startStravaConnection,
  updateConnectionPreferences,
});

const PROVIDERS = Object.freeze([
  {
    id: "strava",
    name: "Strava",
    status: "Available",
    detail: "Broad activity bridge for many watches, apps and fitness ecosystems.",
    connectable: true,
  },
  {
    id: "garmin",
    name: "Garmin Connect",
    status: "Provider access paused",
    detail: "Garmin has temporarily paused review of new Connect Developer Program API applications.",
    connectable: false,
  },
  {
    id: "apple_health",
    name: "Apple Health",
    status: "Native bridge planned",
    detail: "Future iPhone/Apple Watch connection through an iOS HealthKit bridge.",
    connectable: false,
  },
  {
    id: "health_connect",
    name: "Health Connect",
    status: "Native bridge planned",
    detail: "Future Android connection for participating fitness and health apps.",
    connectable: false,
  },
]);

function profileName(profile) {
  return profile?.name || "Athlete";
}

function formatSync(value) {
  if (!value) return "Not synced yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sync recorded";
  return `Last synced ${new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

function keyFor(profileId, provider) {
  return `${profileId}:${provider}`;
}

function preferenceFor(rows, profileId, provider) {
  return {
    ...DEFAULT_CONNECTION_PREFERENCES,
    ...(rows.find((row) => row.profile_id === profileId && row.provider === provider) || {}),
  };
}

function connectionReturnMessage(connectionReturn, selectedName) {
  if (connectionReturn?.provider !== "strava") return null;
  if (connectionReturn.status === "connected") {
    return {
      tone: "success",
      text: `Strava connected successfully for ${selectedName}. Activity evidence is syncing now.`,
    };
  }
  if (connectionReturn.status === "denied") {
    return {
      tone: "error",
      text: "Strava connection was not authorised. Nothing was connected or changed.",
    };
  }
  if (connectionReturn.status === "failed") {
    return {
      tone: "error",
      text: "Strava connection failed. Workout Tracker history was not changed. Please try again.",
    };
  }
  return null;
}

function StreamToggle({ label, detail, checked, disabled = false, onChange }) {
  return (
    <label className={`connection-stream${disabled ? " is-disabled" : ""}`}>
      <span>
        <strong>{label}</strong>
        <small>{detail}</small>
      </span>
      <input
        type="checkbox"
        checked={!!checked}
        disabled={disabled}
        onChange={(event) => onChange?.(event.target.checked)}
      />
    </label>
  );
}

export default function ConnectionsSettings({
  profiles = [],
  initialProfileId = "",
  connectionReturn = null,
  authorizeMutation = async () => true,
  api = DEFAULT_API,
  confirmAction = (message) => window.confirm(message),
  navigateToProvider = (url) => window.location.assign(url),
}) {
  const activeProfiles = useMemo(() => (profiles || []).filter((profile) => profile && !profile.archived), [profiles]);
  const [selectedProfileId, setSelectedProfileId] = useState(() =>
    activeProfiles.some((profile) => profile.id === initialProfileId)
      ? initialProfileId
      : (activeProfiles[0]?.id || "")
  );
  const [data, setData] = useState({ connections: [], preferences: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");

  const selectedProfile = activeProfiles.find((profile) => profile.id === selectedProfileId) || activeProfiles[0] || null;
  const selectedName = profileName(selectedProfile);
  const returnMessage = connectionReturnMessage(connectionReturn, selectedName);

  useEffect(() => {
    if (!activeProfiles.some((profile) => profile.id === selectedProfileId)) {
      setSelectedProfileId(
        activeProfiles.some((profile) => profile.id === initialProfileId)
          ? initialProfileId
          : (activeProfiles[0]?.id || "")
      );
    }
  }, [activeProfiles, initialProfileId, selectedProfileId]);

  async function reload() {
    setLoading(true);
    try {
      const result = await api.loadConnectionSettingsData(activeProfiles.map((profile) => profile.id));
      if (result?.error) throw result.error;
      setData(result?.data || { connections: [], preferences: [] });
      setError(null);
    } catch (loadError) {
      setError(loadError);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeProfiles.map((profile) => profile.id).join("|")]);

  const connectionsByKey = useMemo(
    () => new Map((data.connections || []).map((row) => [keyFor(row.profile_id, row.provider), row])),
    [data.connections]
  );

  async function connectStrava() {
    if (!selectedProfile) return;
    if (!(await authorizeMutation(`connect Strava to ${selectedName}`))) return;
    if (!confirmAction(`Connect the Strava account you authorise to ${selectedName}?\n\nThis connection will provide activity evidence for ${selectedName} only.`)) return;

    setBusy("connect:strava");
    setError(null);
    setNotice("");
    try {
      const preferences = preferenceFor(data.preferences || [], selectedProfile.id, "strava");
      const result = await api.startStravaConnection(selectedProfile.id, {
        includePrivate: preferences.include_private_activities === true,
      });
      if (result?.error) throw result.error;
      if (!result?.data?.authorizeUrl) throw new Error("Strava connection setup is not available yet.");
      navigateToProvider(result.data.authorizeUrl);
    } catch (actionError) {
      setError(actionError);
      setBusy("");
    }
  }

  async function disconnectStrava() {
    if (!selectedProfile) return;
    if (!(await authorizeMutation(`disconnect Strava from ${selectedName}`))) return;
    if (!confirmAction(`Disconnect Strava from ${selectedName}?\n\nWorkout Tracker history will stay unchanged.`)) return;

    setBusy("disconnect:strava");
    setError(null);
    setNotice("");
    try {
      const result = await api.disconnectStravaConnection(selectedProfile.id);
      if (result?.error) throw result.error;
      setNotice(`Strava disconnected from ${selectedName}. Workout Tracker history was not changed.`);
      await reload();
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusy("");
    }
  }

  async function changePreference(provider, key, checked) {
    if (!selectedProfile) return;
    if (!(await authorizeMutation(`change ${provider} data settings for ${selectedName}`))) return;

    setBusy(`preference:${provider}:${key}`);
    setError(null);
    setNotice("");
    try {
      const result = await api.updateConnectionPreferences(selectedProfile.id, provider, { [key]: checked });
      if (result?.error) throw result.error;
      const returned = result?.data?.preferences;
      setData((current) => {
        const remaining = (current.preferences || []).filter(
          (row) => !(row.profile_id === selectedProfile.id && row.provider === provider)
        );
        return { ...current, preferences: returned ? [...remaining, returned] : remaining };
      });
      if (key === "include_private_activities") {
        setNotice(
          connectionsByKey.get(keyFor(selectedProfile.id, provider))?.status === "active"
            ? "Private-activity access changes require reconnecting this provider so its OAuth permission can change."
            : "Private-activity preference saved. It will be requested when this provider is connected."
        );
      } else if (checked) {
        setNotice("Data stream enabled. Newly synced provider activity can include this stream.");
      } else {
        setNotice("Data stream disabled. Stored optional values from this provider were scrubbed where applicable.");
      }
    } catch (actionError) {
      setError(actionError);
    } finally {
      setBusy("");
    }
  }

  if (!activeProfiles.length) {
    return <div className="connections-empty">Add an athlete profile before connecting an activity source.</div>;
  }

  const stravaConnection = connectionsByKey.get(keyFor(selectedProfile?.id, "strava"));
  const stravaPreferences = preferenceFor(data.preferences || [], selectedProfile?.id, "strava");

  return (
    <div className="connections-settings" aria-label="Connected apps and devices settings">
      <section className="connections-hero">
        <div>
          <div className="connections-kicker">CONNECTED APPS &amp; DEVICES</div>
          <h2>Connections</h2>
          <p>
            Connect activity sources to a specific Workout Tracker athlete. Provider evidence can then support Progress,
            plan verification and other features without becoming a second workout or XP authority.
          </p>
        </div>
        <label className="connections-athlete-picker">
          <span>Manage connections for</span>
          <select
            aria-label="Athlete for connected apps"
            value={selectedProfile?.id || ""}
            onChange={(event) => setSelectedProfileId(event.target.value)}
          >
            {activeProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>{profileName(profile)}</option>
            ))}
          </select>
        </label>
      </section>

      <div className="connections-profile-strip" aria-label="Connection summary by athlete">
        {activeProfiles.map((profile) => {
          const count = (data.connections || []).filter((row) => row.profile_id === profile.id && row.status === "active").length;
          return (
            <button
              type="button"
              key={profile.id}
              className={profile.id === selectedProfile?.id ? "is-active" : ""}
              onClick={() => setSelectedProfileId(profile.id)}
            >
              <strong>{profileName(profile)}</strong>
              <span>{count} connected source{count === 1 ? "" : "s"}</span>
            </button>
          );
        })}
      </div>

      {returnMessage ? (
        <div
          className={`connections-message connections-message--${returnMessage.tone}`}
          role={returnMessage.tone === "error" ? "alert" : "status"}
        >
          {returnMessage.text}
        </div>
      ) : null}
      {loading ? <div className="connections-message">Loading connection settings…</div> : null}
      {error ? <div className="connections-message connections-message--error" role="alert">{error.message || String(error)}</div> : null}
      {notice ? <div className="connections-message" role="status">{notice}</div> : null}

      <div className="connections-provider-grid">
        {PROVIDERS.map((provider) => {
          const connection = connectionsByKey.get(keyFor(selectedProfile?.id, provider.id));
          const connected = connection?.status === "active";
          return (
            <article key={provider.id} className={`connections-provider-card${connected ? " is-connected" : ""}`}>
              <div className="connections-provider-card__top">
                <div>
                  <h3>{provider.name}</h3>
                  <span>{connected ? "Connected" : provider.status}</span>
                </div>
                <i aria-hidden="true" className={connected ? "is-connected" : ""} />
              </div>
              <p>{provider.detail}</p>
              {connected ? (
                <div className="connections-provider-account">
                  <strong>Connected for {selectedName}</strong>
                  <span>{connection.provider_account_label || `${provider.name} account connected`}</span>
                  <small>{formatSync(connection.last_sync_at)}</small>
                </div>
              ) : (
                <div className="connections-provider-account">
                  <strong>Not connected for {selectedName}</strong>
                  <span>A connection made here belongs to {selectedName} only.</span>
                </div>
              )}
              {provider.id === "strava" ? (
                <div className="connections-provider-actions">
                  {connected ? (
                    <button type="button" onClick={disconnectStrava} disabled={!!busy}>
                      {busy === "disconnect:strava" ? "Disconnecting…" : `Disconnect Strava from ${selectedName}`}
                    </button>
                  ) : (
                    <button type="button" onClick={connectStrava} disabled={!!busy}>
                      {busy === "connect:strava" ? "Opening Strava…" : `Connect Strava to ${selectedName}`}
                    </button>
                  )}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>

      <section className="connections-streams" aria-label={`Strava data streams for ${selectedName}`}>
        <div className="connections-streams__heading">
          <div>
            <div className="connections-kicker">DATA STREAMS</div>
            <h3>Strava · {selectedName}</h3>
          </div>
          <span>Privacy-first controls</span>
        </div>
        <p>
          Activity verification is the core connection. Optional streams can be limited independently. Turning a supported
          stream off scrubs retained optional values; turning it on applies to newly synced activity.
        </p>
        <div className="connections-stream-list">
          <StreamToggle
            label="Activity verification"
            detail="Activity type, date/time, duration, distance and recording provenance. Required while Strava is connected."
            checked
            disabled
          />
          <StreamToggle
            label="Performance details"
            detail="Optional activity details such as elevation and calories. Core distance/duration remain available for verification."
            checked={stravaPreferences.performance_metrics_enabled}
            disabled={busy.startsWith("preference:")}
            onChange={(checked) => changePreference("strava", "performance_metrics_enabled", checked)}
          />
          <StreamToggle
            label="Heart-rate data"
            detail="Average/max heart rate when supplied by the provider. Off by default for every athlete."
            checked={stravaPreferences.heart_rate_enabled}
            disabled={busy.startsWith("preference:")}
            onChange={(checked) => changePreference("strava", "heart_rate_enabled", checked)}
          />
          <StreamToggle
            label="Location / route data"
            detail="Workout Tracker does not currently store Strava route geometry. Reserved for a future explicit opt-in."
            checked={false}
            disabled
          />
          <StreamToggle
            label="Health & recovery data"
            detail="Not part of the Strava activity connector. Future Garmin/Apple/Health Connect integrations can expose this separately."
            checked={false}
            disabled
          />
          <StreamToggle
            label="Include private Strava activities"
            detail="Requests Strava's broader activity permission at OAuth. Changing this on an existing connection requires reconnecting."
            checked={stravaPreferences.include_private_activities}
            disabled={busy.startsWith("preference:")}
            onChange={(checked) => changePreference("strava", "include_private_activities", checked)}
          />
        </div>
      </section>
    </div>
  );
}
