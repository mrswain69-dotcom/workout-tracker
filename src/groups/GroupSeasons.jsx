import React, { useEffect, useMemo, useState } from "react";
import { loadGroupSeasonsAwards } from "./groupDb";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";
import "./GroupWeeklyXp.css";
import "./GroupSeasons.css";

const METRICS = [
  { id: "xp", label: "XP" },
  { id: "consistency", label: "Consistency" },
  { id: "improvement", label: "Improvement" },
];

const AWARD_LABELS = {
  monthly_xp: "Monthly XP Winner",
  monthly_consistency: "Monthly Most Consistent",
  monthly_improvement: "Monthly Most Improved",
  season_xp: "Season XP Champion",
  season_consistency: "Season Consistency Champion",
  season_improvement: "Season Improvement Champion",
  season_finisher: "Season Finisher",
};

function errorText(error, fallback = "Could not load Seasons & Awards.") {
  return error?.message || String(error || fallback);
}

function formatPeriod(startDate, endDate) {
  if (!startDate || !endDate) return "";
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const startText = start.toLocaleDateString(undefined, { day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }), timeZone: "UTC" });
  const endText = end.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
  return `${startText} – ${endText}`;
}

function formatMonth(startDate) {
  if (!startDate) return "Month";
  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Month";
  return date.toLocaleDateString(undefined, { month: "short", year: "numeric", timeZone: "UTC" });
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function metricRank(row, metric) {
  if (metric === "xp") return row?.xpRank ?? null;
  if (metric === "consistency") return row?.consistencyRank ?? null;
  return row?.improvementRank ?? null;
}

function metricValue(row, metric) {
  if (metric === "xp") {
    const value = numeric(row?.xp);
    return value === null ? "—" : `${Math.round(value).toLocaleString()} XP`;
  }
  if (metric === "consistency") {
    const value = numeric(row?.consistencyPct);
    return value === null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }
  const value = numeric(row?.improvementPct);
  if (value === null) return "—";
  return `${value > 0 ? "+" : ""}${value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
}

function metricEvidence(row, metric) {
  if (metric === "xp") return "Authoritative XP earned in this period";
  if (metric === "consistency") {
    if (!Number(row?.plannedDays || 0)) return row?.consistencyState === "schedule_unavailable" ? "Schedule unavailable" : "No planned days due";
    return `${Number(row?.completedDays || 0)} / ${Number(row?.plannedDays || 0)} planned days`;
  }
  const count = Number(row?.improvementMetricCount || 0);
  if (!count) return row?.improvementState === "no_current_performance" ? "No comparable performance" : "No matching 28-day baseline";
  return `${count} comparable ${count === 1 ? "metric" : "metrics"}`;
}

function LeaderAvatar({ row }) {
  const avatar = resolveGroupAvatar(row?.avatar_id);
  const frameClass = groupAvatarFrameClass({
    avatarFrame: row?.avatar_frame,
    avatarFramesEnabled: row?.avatar_frames_enabled,
  });
  return (
    <span className={`groupXpAvatar ${frameClass}`} aria-hidden="true">
      {avatar.imgSrc ? <img src={avatar.imgSrc} alt="" /> : <span>{avatar.emoji || "🙂"}</span>}
    </span>
  );
}

function PeriodStandings({ period, metric, selfId, periodType }) {
  const rows = useMemo(() => {
    const rankKey = metric === "xp" ? "xpRank" : metric === "consistency" ? "consistencyRank" : "improvementRank";
    return [...(Array.isArray(period?.rows) ? period.rows : [])].sort((a, b) => {
      const ar = a?.[rankKey] ?? Number.MAX_SAFE_INTEGER;
      const br = b?.[rankKey] ?? Number.MAX_SAFE_INTEGER;
      if (ar !== br) return ar - br;
      return String(a?.nickname || "").localeCompare(String(b?.nickname || ""), "en", { sensitivity: "base" });
    });
  }, [period?.rows, metric]);

  if (!period?.available) return <div className="groupHubEmpty compact">This Group had not started for this period.</div>;
  if (!rows.length) return <div className="groupHubEmpty compact">No long-cycle standings are available yet.</div>;

  const label = `${periodType === "month" ? "Monthly" : "Season"} ${METRICS.find((item) => item.id === metric)?.label || metric} standings`;
  return (
    <div className="groupXpStandings groupSeasonStandings" role="table" aria-label={label}>
      <div className="groupXpStandingHeader" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Athlete</span>
        <span role="columnheader">{METRICS.find((item) => item.id === metric)?.label || metric}</span>
      </div>
      {rows.map((row) => {
        const rank = metricRank(row, metric);
        const self = row.membership_id === selfId;
        return (
          <div key={row.membership_id} className={`groupXpStandingRow ${self ? "self" : ""}`} role="row">
            <span className="groupXpRank" role="cell">{rank ? `#${rank}` : "—"}</span>
            <span className="groupXpIdentity" role="cell">
              <LeaderAvatar row={row} />
              <span><strong>{row.nickname || "Athlete"}{self ? " · You" : ""}</strong></span>
            </span>
            <span className="groupSeasonScoreCell" role="cell">
              <strong>{metricValue(row, metric)}</strong>
              <small>{metricEvidence(row, metric)}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

function AwardCard({ award, selfId }) {
  const label = AWARD_LABELS[award?.awardType] || "Progress Award";
  const self = award?.membership_id === selfId;
  return (
    <div className={`groupSeasonAward ${self ? "self" : ""}`}>
      <span className="groupSeasonAwardIcon" aria-hidden="true">{award?.awardType === "season_finisher" ? "🎖️" : "🏆"}</span>
      <div>
        <strong>{label}</strong>
        <span>{award?.nickname || "Athlete"}{self ? " · You" : ""}</span>
        <small>{award?.periodType === "month" ? formatMonth(award.periodStart) : `Season ${award?.seasonNumber || ""}`}</small>
      </div>
    </div>
  );
}

export default function GroupSeasons({ group, membership }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [periodType, setPeriodType] = useState("month");
  const [metric, setMetric] = useState("xp");
  const [historyIndex, setHistoryIndex] = useState(-1);

  async function refresh() {
    if (!group?.id || !membership?.id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await loadGroupSeasonsAwards(group.id, membership.id);
    setLoading(false);
    if (result.error) {
      setError(errorText(result.error));
      return;
    }
    setData(result.data || null);
    setHistoryIndex(-1);
  }

  useEffect(() => {
    setPeriodType("month");
    setMetric("xp");
    setHistoryIndex(-1);
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, membership?.id]);

  const current = periodType === "month" ? data?.monthly?.current : data?.season?.current;
  const history = periodType === "month" ? data?.monthly?.history : data?.season?.history;
  const periods = Array.isArray(history) ? history : [];
  const period = historyIndex >= 0 ? periods[historyIndex] || current : current;
  const awards = Array.isArray(data?.awards) ? data.awards : [];

  return (
    <section className="groupHubPanel groupXpPanel groupSeasonsPanel">
      <div className="groupXpHeading">
        <div>
          <span className="groupXpEyebrow groupSeasonsEyebrow">🏆 LONG GAME</span>
          <h4>Seasons & Awards</h4>
          <p>Calendar-month standings and fixed 8-week seasons. XP, Consistency and Improvement stay separate so every award has a clear reason.</p>
        </div>
        <button className="groupXpRefresh" type="button" onClick={refresh} disabled={loading} aria-label="Refresh Seasons and Awards">↻</button>
      </div>

      <div className="groupXpPeriodToggle" role="group" aria-label="Long-cycle period">
        <button type="button" className={periodType === "month" ? "active" : ""} onClick={() => { setPeriodType("month"); setHistoryIndex(-1); }}>Month</button>
        <button type="button" className={periodType === "season" ? "active" : ""} onClick={() => { setPeriodType("season"); setHistoryIndex(-1); }}>8-week season</button>
      </div>

      <div className="groupSeasonMetricTabs" role="group" aria-label="Long-cycle metric">
        {METRICS.map((item) => (
          <button type="button" key={item.id} className={metric === item.id ? "active" : ""} onClick={() => setMetric(item.id)}>{item.label}</button>
        ))}
      </div>

      {error ? <div className="groupHubMessage error" role="alert">{error}</div> : null}
      {loading ? <div className="groupHubMuted groupXpLoading">Calculating Seasons & Awards…</div> : null}

      {!loading && period ? (
        <>
          <div className="groupSeasonPeriodNav" role="group" aria-label="Choose long-cycle period">
            <button type="button" className={historyIndex < 0 ? "active" : ""} onClick={() => setHistoryIndex(-1)}>
              {periodType === "month" ? "This month" : `Season ${current?.seasonNumber || 1}`}
            </button>
            {periods.map((item, index) => (
              <button type="button" key={`${item.startDate}-${index}`} className={historyIndex === index ? "active" : ""} onClick={() => setHistoryIndex(index)}>
                {periodType === "month" ? formatMonth(item.startDate) : `Season ${item.seasonNumber}`}
              </button>
            ))}
          </div>

          <div className="groupXpPeriodMeta groupSeasonMeta">
            <strong>{periodType === "season" ? `Season ${period.seasonNumber} · ${formatPeriod(period.startDate, period.endDate)}` : formatMonth(period.startDate)}</strong>
            <span>{period.state === "frozen" ? "Final standings" : periodType === "season" ? `Live · week ${period.weekNumber || 1} of 8` : "Live monthly standings"}</span>
          </div>

          <PeriodStandings period={period} metric={metric} selfId={membership.id} periodType={periodType} />
        </>
      ) : null}

      <div className="groupSeasonAwardsHeader">
        <strong>Progress Awards</strong>
        <span>Final awards are issued only when a month or 8-week season closes.</span>
      </div>
      {awards.length ? (
        <div className="groupSeasonAwards" aria-label="Progress Awards">
          {awards.slice(0, 12).map((award, index) => <AwardCard key={`${award.awardType}-${award.periodStart}-${award.membership_id}-${index}`} award={award} selfId={membership.id} />)}
        </div>
      ) : (
        <div className="groupHubMuted groupSeasonNoAwards">No completed-period awards yet — the first ones will lock when a month or season finishes.</div>
      )}

      <div className="groupSeasonRuleNote">
        <strong>Truth rules:</strong> XP is earned XP inside the eligible period; Consistency is completed planned days ÷ planned days across the whole period; Improvement compares that period’s compatible performance with the athlete’s own locked preceding 28-day baseline. Genuine ties share the award.
      </div>
    </section>
  );
}
