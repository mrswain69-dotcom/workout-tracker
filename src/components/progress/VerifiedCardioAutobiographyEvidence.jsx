import React, { useMemo } from "react";
import {
  buildVerifiedCardioEvidence,
  summariseVerifiedCardioEvidence,
} from "../../engine/verifiedCardioEvidenceEngine.js";

function formatDistance(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return "—";
  return `${number.toLocaleString("en-GB", { maximumFractionDigits: 2 })} km`;
}

function formatDuration(value) {
  const minutes = Number(value);
  if (!Number.isFinite(minutes) || minutes <= 0) return "—";
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function formatPace(value) {
  const pace = Number(value);
  if (!Number.isFinite(pace) || pace <= 0) return "";
  let minutes = Math.floor(pace);
  let seconds = Math.round((pace - minutes) * 60);
  if (seconds === 60) {
    minutes += 1;
    seconds = 0;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")} /km`;
}

function formatSpeed(value) {
  const speed = Number(value);
  if (!Number.isFinite(speed) || speed <= 0) return "";
  return `${speed.toLocaleString("en-GB", { maximumFractionDigits: 2 })} km/h`;
}

function providerLabel(value) {
  if (value === "strava") return "Strava";
  if (value === "garmin") return "Garmin";
  if (value === "apple_health") return "Apple Health";
  if (value === "health_connect") return "Health Connect";
  return String(value || "External").replace(/[_-]+/g, " ");
}

function activityLabel(row) {
  if (row.activityName) return row.activityName;
  const labels = {
    run: "Verified run",
    cycle: "Verified ride",
    walk: "Verified walk / hike",
    swim: "Verified swim",
    row: "Verified rowing activity",
    team_sport: "Verified team sport",
    other_cardio: "Verified cardio activity",
  };
  return labels[row.cardioKind] || "Verified cardio activity";
}

export default function VerifiedCardioAutobiographyEvidence({
  verificationData = null,
  range = null,
  title = "Verified cardio evidence",
}) {
  const rows = useMemo(
    () => buildVerifiedCardioEvidence(verificationData || {}),
    [verificationData]
  );
  const summary = useMemo(
    () => summariseVerifiedCardioEvidence(rows, range),
    [rows, range?.startDate, range?.endDate]
  );

  return (
    <section className="autobiography-verified-cardio" aria-label="Verified cardio evidence">
      <div className="autobiography-verified-cardio__heading">
        <div>
          <span>VERIFIED CARDIO</span>
          <h4>{title}</h4>
        </div>
        <small>External evidence · 0 bonus XP</small>
      </div>

      <p>
        Synced provider evidence can confirm distance, duration, pace/speed and heart-rate context.
        It stays separate from Workout Tracker&apos;s PB and improvement authority, so it cannot create
        or replace a manual PB milestone.
      </p>

      <div className="autobiography-verified-cardio__metrics">
        <div><strong>{summary.activityCount}</strong><span>verified cardio activities</span></div>
        <div><strong>{formatDistance(summary.totalDistanceKm)}</strong><span>verified distance</span></div>
        <div><strong>{formatDuration(summary.totalDurationMin)}</strong><span>verified time</span></div>
        <div><strong>{summary.heartRateActivityCount}</strong><span>activities with HR evidence</span></div>
      </div>

      {summary.rows.length ? (
        <div className="autobiography-verified-cardio__list">
          {summary.rows.slice(0, 4).map((row) => {
            const performanceMetric = formatPace(row.paceMinPerKm) || formatSpeed(row.averageSpeedKmh);
            const metrics = [
              row.distanceKm ? formatDistance(row.distanceKm) : "",
              row.durationMin ? formatDuration(row.durationMin) : "",
              performanceMetric,
              row.averageHeartRateBpm ? `${Math.round(row.averageHeartRateBpm)} bpm avg` : "",
            ].filter(Boolean);
            return (
              <article key={row.id}>
                <div className="autobiography-verified-cardio__rowtop">
                  <div>
                    <strong>{activityLabel(row)}</strong>
                    <span>{row.date || "Date unavailable"}</span>
                  </div>
                  <span className={row.matchedManual ? "is-matched" : ""}>
                    {row.matchedManual ? "Matched to manual log" : "Provider evidence"}
                  </span>
                </div>
                {metrics.length ? <div className="autobiography-verified-cardio__rowmetrics">{metrics.join(" · ")}</div> : null}
                <div className="autobiography-verified-cardio__providers">
                  {(row.providers || []).map((provider) => (
                    <span key={provider}>{providerLabel(provider)}</span>
                  ))}
                  {row.multiSource ? <span>One activity · multiple sources</span> : null}
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className="autobiography-verified-cardio__empty">
          No verified cardio evidence is recorded for this view yet.
        </div>
      )}

      <div className="autobiography-verified-cardio__integrity">
        PB / improvement moments above remain derived only from their existing Workout Tracker and Assessment authorities.
      </div>
    </section>
  );
}
