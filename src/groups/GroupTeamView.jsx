import React, { useEffect, useMemo, useState } from "react";
import { loadGroupImprovementLeaderboard, loadGroupSeasonsAwards } from "./groupDb";
import { loadGroupTeamPrBoard } from "./groupTeamDb";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";
import {
  buildTeamImprovementSeries,
  buildTeamSeasonSummary,
  selectTeamTopThree,
} from "../engine/groupTeamEngine.js";
import "./GroupWeeklyXp.css";
import "./GroupTeamView.css";

const SPOTLIGHT_METRICS = [
  { id: "xp", label: "XP" },
  { id: "consistency", label: "Consistency" },
  { id: "improvement", label: "Improvement" },
];

function errorText(error, fallback = "Could not load team performance.") {
  return error?.message || String(error || fallback);
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function formatShortDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

function formatWeekLabel(startDate) {
  if (!startDate) return "Week";
  const date = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "Week";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", timeZone: "UTC" });
}

function formatPct(value) {
  const number = numeric(value);
  if (number === null) return "—";
  return `${number > 0 ? "+" : ""}${number.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
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

function ImprovementGraph({ series = [] }) {
  const valid = series.filter((point) => numeric(point?.improvementPct) !== null);
  const values = valid.map((point) => Number(point.improvementPct));
  const rawMin = values.length ? Math.min(0, ...values) : -1;
  const rawMax = values.length ? Math.max(0, ...values) : 1;
  const span = Math.max(1, rawMax - rawMin);
  const min = rawMin - span * 0.14;
  const max = rawMax + span * 0.14;
  const width = 420;
  const height = 132;
  const left = 22;
  const right = 12;
  const top = 12;
  const bottom = 24;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const xFor = (index) => left + (series.length <= 1 ? plotWidth / 2 : (plotWidth * index) / (series.length - 1));
  const yFor = (value) => top + ((max - value) / (max - min || 1)) * plotHeight;
  const points = series
    .map((point, index) => ({ point, index, value: numeric(point?.improvementPct) }))
    .filter((item) => item.value !== null);
  const polyline = points.map((item) => `${xFor(item.index)},${yFor(item.value)}`).join(" ");
  const zeroY = yFor(0);

  return (
    <div className="groupTeamGraphWrap">
      <svg className="groupTeamGraph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Team Improvement graph">
        <line x1={left} x2={width - right} y1={zeroY} y2={zeroY} className="groupTeamGraphZero" />
        {points.length > 1 ? <polyline points={polyline} className="groupTeamGraphLine" /> : null}
        {points.map((item) => (
          <g key={`${item.point.startDate}-${item.index}`}>
            <circle cx={xFor(item.index)} cy={yFor(item.value)} r="4.5" className="groupTeamGraphPoint" />
          </g>
        ))}
      </svg>
      <div className="groupTeamGraphLegend" aria-label="Team Improvement weekly values">
        {series.map((point) => (
          <div key={point.startDate || point.endDate}>
            <span>{formatWeekLabel(point.startDate)}</span>
            <strong>{formatPct(point.improvementPct)}</strong>
            <small>{point.scoredAthletes || 0} scored</small>
          </div>
        ))}
      </div>
    </div>
  );
}

function spotlightValue(row, metric) {
  if (metric === "consistency") {
    const value = numeric(row?.consistencyPct);
    return value === null ? "—" : `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
  }
  if (metric === "improvement") return formatPct(row?.improvementPct);
  return `${Math.round(Number(row?.xp || 0)).toLocaleString()} XP`;
}

function spotlightRank(row, metric) {
  if (metric === "consistency") return row?.consistencyRank;
  if (metric === "improvement") return row?.improvementRank;
  return row?.xpRank;
}

function TopThreeSpotlight({ period, metric, selfId }) {
  const rows = selectTeamTopThree(period, metric);
  if (!rows.length) return <div className="groupHubMuted groupTeamEmptyLine">No scored athletes yet for this spotlight.</div>;
  return (
    <div className="groupTeamSpotlight" aria-label={`Team ${metric} Top 3`}>
      {rows.map((row) => (
        <div key={`${metric}-${row.membership_id}`} className={`groupTeamSpotlightCard rank${spotlightRank(row, metric)} ${row.membership_id === selfId ? "self" : ""}`}>
          <span className="groupTeamSpotlightRank">#{spotlightRank(row, metric)}</span>
          <LeaderAvatar row={row} />
          <strong>{row.nickname || "Athlete"}{row.membership_id === selfId ? " · You" : ""}</strong>
          <span>{spotlightValue(row, metric)}</span>
        </div>
      ))}
    </div>
  );
}

function PrBoard({ rows = [], selfId, label }) {
  if (!rows.length) return <div className="groupHubMuted groupTeamEmptyLine">No active athletes are available for the current PR board.</div>;
  return (
    <div className="groupXpStandings groupTeamPrTable" role="table" aria-label={`${label} PR board`}>
      <div className="groupXpStandingHeader" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Athlete</span>
        <span role="columnheader">Season PRs</span>
      </div>
      {rows.map((row) => {
        const self = row.membership_id === selfId;
        return (
          <div key={row.membership_id} className={`groupXpStandingRow ${self ? "self" : ""}`} role="row">
            <span className="groupXpRank" role="cell">{row.rank ? `#${row.rank}` : "—"}</span>
            <span className="groupXpIdentity" role="cell">
              <LeaderAvatar row={row} />
              <span><strong>{row.nickname || "Athlete"}{self ? " · You" : ""}</strong></span>
            </span>
            <span className="groupTeamPrScore" role="cell">
              <strong>{Number(row.prCount || 0)} {Number(row.prCount || 0) === 1 ? "PR" : "PRs"}</strong>
              <small>{row.latestPrDate ? `Latest ${formatShortDate(row.latestPrDate)}` : "No new PR yet"}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function GroupTeamView({ group, membership }) {
  const teamMode = group?.group_type === "squad" || group?.group_type === "club";
  const [seasonData, setSeasonData] = useState(null);
  const [improvementData, setImprovementData] = useState(null);
  const [prData, setPrData] = useState(null);
  const [spotlightMetric, setSpotlightMetric] = useState("xp");
  const [loading, setLoading] = useState(teamMode);
  const [error, setError] = useState("");

  async function refresh() {
    if (!teamMode || !group?.id || !membership?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const [seasonResult, improvementResult, prResult] = await Promise.all([
      loadGroupSeasonsAwards(group.id, membership.id),
      loadGroupImprovementLeaderboard(group.id, membership.id),
      loadGroupTeamPrBoard(group.id, membership.id),
    ]);
    setSeasonData(seasonResult.data || null);
    setImprovementData(improvementResult.data || null);
    setPrData(prResult.data || null);
    const firstError = seasonResult.error || improvementResult.error || prResult.error;
    if (firstError) setError(errorText(firstError));
    setLoading(false);
  }

  useEffect(() => {
    setSpotlightMetric("xp");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, group?.group_type, membership?.id]);

  const season = seasonData?.season?.current || null;
  const summary = useMemo(() => buildTeamSeasonSummary(season), [season]);
  const improvementSeries = useMemo(
    () => buildTeamImprovementSeries(improvementData?.current || null, improvementData?.history || []),
    [improvementData]
  );
  const prRows = Array.isArray(prData?.current?.rows) ? prData.current.rows : [];

  if (!teamMode) return null;

  const teamLabel = group.group_type === "club" ? "Club" : "Squad";
  const consistency = summary?.consistency || null;

  return (
    <section className="groupHubPanel groupXpPanel groupTeamPanel">
      <div className="groupXpHeading">
        <div>
          <span className="groupXpEyebrow groupTeamEyebrow">◎ {teamLabel.toUpperCase()} PERFORMANCE</span>
          <h4>{teamLabel} View</h4>
          <p>One team picture built from the same truthful competition engines: season progress, collective consistency, weekly Improvement and personal-record momentum.</p>
        </div>
        <button className="groupXpRefresh" type="button" onClick={refresh} disabled={loading} aria-label={`Refresh ${teamLabel} View`}>↻</button>
      </div>

      {error ? <div className="groupHubMessage error" role="alert">{error}</div> : null}
      {loading ? <div className="groupHubMuted groupXpLoading">Building {teamLabel.toLowerCase()} performance view…</div> : null}

      {!loading && summary ? (
        <>
          <div className="groupTeamSeasonHeader">
            <div>
              <strong>Season {summary.seasonNumber}</strong>
              <span>Week {summary.weekNumber} of 8</span>
            </div>
            <div className="groupTeamSeasonProgress" aria-label={`Season week ${summary.weekNumber} of 8`}>
              <span style={{ width: `${Math.max(0, Math.min(100, (summary.weekNumber / 8) * 100))}%` }} />
            </div>
          </div>

          <div className="groupTeamSummaryGrid">
            <div className="groupTeamSummaryCard">
              <span>Team XP</span>
              <strong>{summary.teamXp.toLocaleString()}</strong>
              <small>{summary.participatingAthletes} / {summary.athleteCount} participating</small>
            </div>
            <div className="groupTeamSummaryCard consistency">
              <span>🛡 Team Consistency</span>
              <strong>{consistency?.available && numeric(consistency.consistencyPct) !== null ? `${consistency.consistencyPct}%` : "—"}</strong>
              <small>{consistency?.reason === "schedule_unavailable" ? "Schedule truth unavailable" : `${consistency?.completedDays || 0} / ${consistency?.plannedDays || 0} planned days`}</small>
            </div>
            <div className="groupTeamSummaryCard improvement">
              <span>Team Improvement</span>
              <strong>{formatPct(summary.improvementPct)}</strong>
              <small>Equal athlete weighting · {summary.improvementScoredAthletes} scored</small>
            </div>
          </div>

          <div className="groupTeamSectionHeading">
            <div><strong>Team Improvement</strong><span>Last 4 completed weeks + this week</span></div>
          </div>
          {improvementSeries.length ? <ImprovementGraph series={improvementSeries} /> : <div className="groupHubMuted groupTeamEmptyLine">No truthful weekly Improvement series is available yet.</div>}

          <div className="groupTeamSectionHeading">
            <div><strong>Top 3 Spotlight</strong><span>Current 8-week season · genuine ties stay visible</span></div>
          </div>
          <div className="groupTeamMetricTabs" role="group" aria-label="Team Top 3 metric">
            {SPOTLIGHT_METRICS.map((item) => (
              <button type="button" key={item.id} className={spotlightMetric === item.id ? "active" : ""} onClick={() => setSpotlightMetric(item.id)}>{item.label}</button>
            ))}
          </div>
          <TopThreeSpotlight period={season} metric={spotlightMetric} selfId={membership.id} />

          <div className="groupTeamSectionHeading">
            <div><strong>{teamLabel} PR Board</strong><span>New training personal records achieved during this season</span></div>
          </div>
          <PrBoard rows={prRows} selfId={membership.id} label={teamLabel} />

          <div className="groupTeamPrivacyNote">
            <strong>Team-safe by design:</strong> the PR board shares only PR counts and the latest PR date. Exercise names, weights, raw workout data, body information and Assessment results stay private. A first-ever result is a baseline, not a PR.
          </div>
        </>
      ) : !loading ? (
        <div className="groupHubMuted groupTeamEmptyLine">This team season has not started yet.</div>
      ) : null}
    </section>
  );
}
