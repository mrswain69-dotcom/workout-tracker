import React, { useEffect, useMemo, useState } from "react";
import { loadGroupImprovementLeaderboard } from "./groupDb";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";
import "./GroupWeeklyXp.css";
import "./GroupImprovement.css";

function errorText(error, fallback = "Could not load Improvement.") {
  return error?.message || String(error || fallback);
}

function formatWeek(startDate, endDate) {
  if (!startDate || !endDate) return "";
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "";
  const opts = { day: "numeric", month: "short", timeZone: "UTC" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
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

function scoreLabel(row) {
  const value = Number(row?.improvementPct);
  if (!Number.isFinite(value)) return "—";
  const rounded = value.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${value > 0 ? "+" : ""}${rounded}%`;
}

function evidenceLabel(row) {
  const count = Number(row?.metricCount || 0);
  if (count > 0) {
    const improved = Number(row?.improvedMetricCount || 0);
    const declined = Number(row?.declinedMetricCount || 0);
    if (improved || declined) return `${count} comparable ${count === 1 ? "metric" : "metrics"} · ${improved} up · ${declined} down`;
    return `${count} comparable ${count === 1 ? "metric" : "metrics"}`;
  }
  if (row?.scoreState === "no_current_performance") return "No comparable performance recorded this week";
  if (row?.scoreState === "no_comparable_baseline") return "No matching 4-week baseline yet";
  if (row?.scoreState === "not_started") return "Not eligible yet";
  return "No comparable score yet";
}

function scoreTone(row) {
  const value = Number(row?.improvementPct);
  if (!Number.isFinite(value)) return "neutral";
  if (value > 0.05) return "positive";
  if (value < -0.05) return "negative";
  return "neutral";
}

function TopThree({ rows = [], selfId }) {
  const top = rows.filter(
    (row) => Number.isFinite(Number(row?.improvementPct)) && Number(row?.rank || 99) <= 3
  );
  if (!top.length) return null;

  return (
    <div className="groupXpTopThree groupImprovementTopThree" aria-label="Improvement Top 3">
      {top.map((row) => (
        <div
          key={row.membership_id}
          className={`groupXpPodium rank${row.rank} ${row.membership_id === selfId ? "self" : ""}`}
        >
          <span className="groupXpMedal">#{row.rank}</span>
          <LeaderAvatar row={row} />
          <strong>{row.nickname || "Athlete"}</strong>
          <span className={`groupImprovementPodiumScore ${scoreTone(row)}`}>{scoreLabel(row)}</span>
          <small>{evidenceLabel(row)}</small>
        </div>
      ))}
    </div>
  );
}

function Standings({ rows = [], selfId }) {
  const selfIndex = rows.findIndex((row) => row.membership_id === selfId);
  return (
    <div className="groupXpStandings" role="table" aria-label="Improvement standings">
      <div className="groupXpStandingHeader" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Athlete</span>
        <span role="columnheader">Improvement</span>
      </div>
      {rows.map((row, index) => {
        const self = row.membership_id === selfId;
        const neighbour = selfIndex >= 0 && !self && Math.abs(index - selfIndex) === 1;
        return (
          <div
            key={row.membership_id}
            className={`groupXpStandingRow ${self ? "self" : ""} ${neighbour ? "neighbour" : ""}`}
            role="row"
          >
            <span className="groupXpRank" role="cell">{row.rank ? `#${row.rank}` : "—"}</span>
            <span className="groupXpIdentity" role="cell">
              <LeaderAvatar row={row} />
              <span><strong>{row.nickname || "Athlete"}{self ? " · You" : ""}</strong></span>
            </span>
            <span className={`groupImprovementScoreCell ${scoreTone(row)}`} role="cell">
              <strong>{scoreLabel(row)}</strong>
              <small>{evidenceLabel(row)}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function GroupImprovement({ group, membership }) {
  const [mode, setMode] = useState("current");
  const [historyIndex, setHistoryIndex] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function refresh() {
    if (!group?.id || !membership?.id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await loadGroupImprovementLeaderboard(group.id, membership.id);
    setLoading(false);
    if (result.error) {
      setError(errorText(result.error));
      return;
    }
    setData(result.data || null);
    setHistoryIndex(0);
  }

  useEffect(() => {
    setMode("current");
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, membership?.id]);

  const history = Array.isArray(data?.history) ? data.history : [];
  const period = mode === "history" ? history[historyIndex] || history[0] || null : data?.current || null;
  const rows = Array.isArray(period?.rows) ? period.rows : [];
  const weekButtons = useMemo(
    () => history.map((week, index) => ({
      index,
      label: formatWeek(week.startDate, week.endDate),
      disabled: !week.available,
    })),
    [history]
  );

  return (
    <section className="groupHubPanel groupXpPanel groupImprovementPanel">
      <div className="groupXpHeading">
        <div>
          <span className="groupXpEyebrow groupImprovementEyebrow">↗ SELF VS SELF</span>
          <h4>Improvement</h4>
          <p>Current recorded performance versus your own locked rolling 4-week baseline. It compares change, not body size or absolute strength.</p>
        </div>
        <button className="groupXpRefresh" type="button" onClick={refresh} disabled={loading} aria-label="Refresh Improvement">↻</button>
      </div>

      <div className="groupXpPeriodToggle" role="group" aria-label="Improvement period">
        <button type="button" className={mode === "current" ? "active" : ""} onClick={() => setMode("current")}>This week</button>
        <button type="button" className={mode === "history" ? "active" : ""} onClick={() => setMode("history")}>Last 4 weeks</button>
      </div>

      {mode === "history" && weekButtons.length ? (
        <div className="groupXpWeekPicker" role="group" aria-label="Choose Improvement week">
          {weekButtons.map((week) => (
            <button
              type="button"
              key={week.index}
              className={historyIndex === week.index ? "active" : ""}
              disabled={week.disabled}
              onClick={() => setHistoryIndex(week.index)}
            >
              {week.label || `Week ${week.index + 1}`}
            </button>
          ))}
        </div>
      ) : null}

      {error ? <div className="groupHubMessage error" role="alert">{error}</div> : null}
      {loading ? <div className="groupHubMuted groupXpLoading">Calculating Improvement…</div> : null}

      {!loading && period ? (
        <>
          <div className="groupXpPeriodMeta">
            <strong>{formatWeek(period.startDate, period.endDate)}</strong>
            <span>{period.state === "frozen" ? "Final standings" : "Live self-vs-self change"}</span>
          </div>

          {!period.available ? (
            <div className="groupHubEmpty compact">This Group had not started yet.</div>
          ) : rows.length ? (
            <>
              <TopThree rows={rows} selfId={membership.id} />
              <Standings rows={rows} selfId={membership.id} />
            </>
          ) : (
            <div className="groupHubEmpty compact">No Improvement standings are available for this period.</div>
          )}
        </>
      ) : null}

      <div className="groupImprovementRuleNote">
        <strong>How it stays fair:</strong> comparable metrics are measured against each athlete’s own preceding 28-day average, then weighted equally. Declines count as well as gains, unsafe percentage metrics are excluded, practice volume does not become performance, and each metric has a ±50% outlier cap.
      </div>
    </section>
  );
}
