import React, { useEffect, useMemo, useState } from "react";
import { loadGroupConsistencyLeaderboard } from "./groupDb";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";
import GroupImprovement from "./GroupImprovement.jsx";
import "./GroupWeeklyXp.css";
import "./GroupConsistency.css";

function errorText(error, fallback = "Could not load Consistency.") {
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
  if (!Number(row?.plannedDays)) return "—";
  const value = Number(row?.consistencyPct);
  return Number.isFinite(value) ? `${value.toLocaleString(undefined, { maximumFractionDigits: 1 })}%` : "—";
}

function ratioLabel(row) {
  if (!Number(row?.plannedDays)) {
    return row?.scoreState === "schedule_unavailable" ? "Schedule unavailable" : "No planned days due";
  }
  return `${Number(row.completedDays || 0)} / ${Number(row.plannedDays || 0)} planned days`;
}

function TopThree({ rows = [], selfId }) {
  const top = rows.filter(
    (row) => Number(row?.plannedDays) > 0 && Number(row?.rank || 99) <= 3
  );
  if (!top.length) return null;

  return (
    <div className="groupXpTopThree groupConsistencyTopThree" aria-label="Consistency Top 3">
      {top.map((row) => (
        <div
          key={row.membership_id}
          className={`groupXpPodium rank${row.rank} ${row.membership_id === selfId ? "self" : ""}`}
        >
          <span className="groupXpMedal">#{row.rank}</span>
          <LeaderAvatar row={row} />
          <strong>{row.nickname || "Athlete"}</strong>
          <span className="groupConsistencyPodiumScore">{scoreLabel(row)}</span>
          <small>{ratioLabel(row)}</small>
        </div>
      ))}
    </div>
  );
}

function Standings({ rows = [], selfId }) {
  const selfIndex = rows.findIndex((row) => row.membership_id === selfId);
  return (
    <div className="groupXpStandings" role="table" aria-label="Consistency standings">
      <div className="groupXpStandingHeader" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Athlete</span>
        <span role="columnheader">Consistency</span>
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
            <span className="groupConsistencyScoreCell" role="cell">
              <strong>{scoreLabel(row)}</strong>
              <small>{ratioLabel(row)}</small>
            </span>
          </div>
        );
      })}
    </div>
  );
}

export default function GroupConsistency({ group, membership }) {
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
    const result = await loadGroupConsistencyLeaderboard(group.id, membership.id);
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
    <>
      <section className="groupHubPanel groupXpPanel groupConsistencyPanel">
        <div className="groupXpHeading">
          <div>
            <span className="groupXpEyebrow groupConsistencyEyebrow">🛡️ DISCIPLINE</span>
            <h4>Consistency</h4>
            <p>Completed planned performance and recovery days ÷ planned days. It rewards following the plan, not doing the most work.</p>
          </div>
          <button className="groupXpRefresh" type="button" onClick={refresh} disabled={loading} aria-label="Refresh Consistency">
            ↻
          </button>
        </div>

        <div className="groupXpPeriodToggle" role="group" aria-label="Consistency period">
          <button type="button" className={mode === "current" ? "active" : ""} onClick={() => setMode("current")}>This week</button>
          <button type="button" className={mode === "history" ? "active" : ""} onClick={() => setMode("history")}>Last 4 weeks</button>
        </div>

        {mode === "history" && weekButtons.length ? (
          <div className="groupXpWeekPicker" role="group" aria-label="Choose Consistency week">
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
        {loading ? <div className="groupHubMuted groupXpLoading">Calculating Consistency…</div> : null}

        {!loading && period ? (
          <>
            <div className="groupXpPeriodMeta">
              <strong>{formatWeek(period.startDate, period.endDate)}</strong>
              <span>{period.state === "frozen" ? "Final standings" : "Live standings · due days only"}</span>
            </div>

            {!period.available ? (
              <div className="groupHubEmpty compact">This Group had not started yet.</div>
            ) : rows.length ? (
              <>
                <TopThree rows={rows} selfId={membership.id} />
                <Standings rows={rows} selfId={membership.id} />
              </>
            ) : (
              <div className="groupHubEmpty compact">No Consistency standings are available for this period.</div>
            )}
          </>
        ) : null}

        <div className="groupConsistencyRuleNote">
          <strong>What counts:</strong> a planned performance or recovery day is complete only when every planned training/recovery block is recorded on that day. Task-only days and Streak Saver do not count as completed planned days.
        </div>
      </section>

      <GroupImprovement group={group} membership={membership} />
    </>
  );
}
