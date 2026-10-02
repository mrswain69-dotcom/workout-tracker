import React, { useEffect, useMemo, useState } from "react";
import {
  buildVerifiedCardioEvidence,
  summariseVerifiedCardioEvidence,
} from "../../engine/verifiedCardioEvidenceEngine.js";
import "./VerifiedCardioAutobiographyEvidence.css";

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

function isYmd(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}

function shiftYmd(value, days) {
  if (!isYmd(value)) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + Number(days || 0));
  return date.toISOString().slice(0, 10);
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
  const [timeWindow, setTimeWindow] = useState("12w");
  const [query, setQuery] = useState("");
  const [visibleCount, setVisibleCount] = useState(12);

  const filterReferenceDate = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    if (isYmd(range?.endDate) && range.endDate < today) return range.endDate;
    return today;
  }, [range?.endDate]);

  const filteredRows = useMemo(() => {
    const daysByWindow = {
      "4w": 27,
      "12w": 83,
      "1y": 364,
    };
    const cutoff =
      timeWindow === "all"
        ? ""
        : shiftYmd(filterReferenceDate, -(daysByWindow[timeWindow] || 83));
    const needle = String(query || "").trim().toLowerCase();

    return (summary.rows || []).filter((row) => {
      if (cutoff && row.date && row.date < cutoff) return false;
      if (!needle) return true;
      const haystack = [
        activityLabel(row),
        row.date,
        ...(row.providers || []).map(providerLabel),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(needle);
    });
  }, [summary.rows, timeWindow, query, filterReferenceDate]);

  useEffect(() => {
    setVisibleCount(12);
  }, [timeWindow, query, range?.startDate, range?.endDate]);

  const visibleRows = filteredRows.slice(0, visibleCount);

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
        <details className="autobiography-verified-cardio__browser">
          <summary>
            <span>Browse verified cardio</span>
            <strong>{filteredRows.length} in selected view</strong>
          </summary>

          <div className="autobiography-verified-cardio__filters">
            <label>
              <span>Date range</span>
              <select
                aria-label="Verified cardio date range"
                value={timeWindow}
                onChange={(event) => setTimeWindow(event.target.value)}
              >
                <option value="4w">Last 4 weeks</option>
                <option value="12w">Last 12 weeks</option>
                <option value="1y">Last 12 months</option>
                <option value="all">All chapter history</option>
              </select>
            </label>
            <label>
              <span>Search</span>
              <input
                aria-label="Search verified cardio"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Run, date, Strava…"
              />
            </label>
          </div>

          {visibleRows.length ? (
            <div className="autobiography-verified-cardio__list">
              {visibleRows.map((row) => {
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
              No verified cardio matches this date range or search.
            </div>
          )}

          {filteredRows.length > visibleCount ? (
            <button
              type="button"
              className="autobiography-verified-cardio__more"
              onClick={() => setVisibleCount((value) => value + 12)}
            >
              Show 12 more · {filteredRows.length - visibleCount} remaining
            </button>
          ) : null}
        </details>
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
