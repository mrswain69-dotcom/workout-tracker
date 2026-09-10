import React, { useEffect, useMemo, useState } from "react";
import {
  loadGroupXpLeaderboard,
  updateGroupXpHistoryScope,
} from "./groupDb";
import { groupAvatarFrameClass, resolveGroupAvatar } from "./groupIdentity";
import "./GroupWeeklyXp.css";

function errorText(error, fallback = "Could not load Weekly XP.") {
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

function formatStartDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
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

function TopThree({ rows = [], selfId }) {
  const top = rows.filter((row) => Number(row?.xp || 0) > 0 && Number(row?.rank || 99) <= 3).slice(0, 3);
  if (!top.length) return null;

  return (
    <div className="groupXpTopThree" aria-label="Weekly XP Top 3">
      {top.map((row) => (
        <div
          key={row.membership_id}
          className={`groupXpPodium rank${row.rank} ${row.membership_id === selfId ? "self" : ""}`}
        >
          <span className="groupXpMedal">#{row.rank}</span>
          <LeaderAvatar row={row} />
          <strong>{row.nickname || "Athlete"}</strong>
          <span>{Number(row.xp || 0).toLocaleString()} XP</span>
        </div>
      ))}
    </div>
  );
}

function Standings({ rows = [], selfId }) {
  const selfIndex = rows.findIndex((row) => row.membership_id === selfId);

  return (
    <div className="groupXpStandings" role="table" aria-label="Weekly XP standings">
      <div className="groupXpStandingHeader" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Athlete</span>
        <span role="columnheader">XP</span>
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
            <span className="groupXpRank" role="cell">#{row.rank}</span>
            <span className="groupXpIdentity" role="cell">
              <LeaderAvatar row={row} />
              <span><strong>{row.nickname || "Athlete"}{self ? " · You" : ""}</strong></span>
            </span>
            <strong className="groupXpScore" role="cell">{Number(row.xp || 0).toLocaleString()} XP</strong>
          </div>
        );
      })}
    </div>
  );
}

export default function GroupWeeklyXp({ group, membership, isAdmin = false, onGroupChanged }) {
  const [mode, setMode] = useState("current");
  const [historyIndex, setHistoryIndex] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    if (!group?.id || !membership?.id) {
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    const result = await loadGroupXpLeaderboard(group.id, membership.id);
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
  }, [group?.id, membership?.id, group?.xp_history_scope]);

  const history = Array.isArray(data?.history) ? data.history : [];
  const period = mode === "history" ? history[historyIndex] || history[0] || null : data?.current || null;
  const rows = Array.isArray(period?.rows) ? period.rows : [];
  const scope = data?.scopeMode || group?.xp_history_scope || "group_start";

  const weekButtons = useMemo(
    () => history.map((week, index) => ({
      index,
      label: formatWeek(week.startDate, week.endDate),
      disabled: !week.available,
    })),
    [history]
  );

  async function changeScope(nextScope) {
    if (!isAdmin || busy || nextScope === scope) return;
    setBusy(true);
    setError("");
    const result = await updateGroupXpHistoryScope(group.id, nextScope);
    setBusy(false);
    if (result.error) {
      setError(errorText(result.error, "Could not change Weekly XP history."));
      return;
    }
    if (onGroupChanged) await onGroupChanged(group.id);
    await refresh();
  }

  return (
    <section className="groupHubPanel groupXpPanel">
      <div className="groupXpHeading">
        <div>
          <span className="groupXpEyebrow">LEADERBOARD</span>
          <h4>Weekly XP</h4>
          <p>Earn XP through your normal Workout Tracker training. Scores are calculated securely from the same XP rules as your athlete profile.</p>
        </div>
        <button className="groupXpRefresh" type="button" onClick={refresh} disabled={loading || busy} aria-label="Refresh Weekly XP">
          ↻
        </button>
      </div>

      <div className="groupXpPeriodToggle" role="group" aria-label="Weekly XP period">
        <button type="button" className={mode === "current" ? "active" : ""} onClick={() => setMode("current")}>This week</button>
        <button type="button" className={mode === "history" ? "active" : ""} onClick={() => setMode("history")}>Last 4 weeks</button>
      </div>

      {mode === "history" && weekButtons.length ? (
        <div className="groupXpWeekPicker" role="group" aria-label="Choose completed week">
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
      {loading ? <div className="groupHubMuted groupXpLoading">Calculating Weekly XP…</div> : null}

      {!loading && period ? (
        <>
          <div className="groupXpPeriodMeta">
            <strong>{formatWeek(period.startDate, period.endDate)}</strong>
            <span>{period.state === "frozen" ? "Final standings" : "Live standings"}</span>
          </div>

          {!period.available ? (
            <div className="groupHubEmpty compact">This Group had not started yet.</div>
          ) : rows.length ? (
            <>
              <TopThree rows={rows} selfId={membership.id} />
              <Standings rows={rows} selfId={membership.id} />
            </>
          ) : (
            <div className="groupHubEmpty compact">No Weekly XP standings are available for this period.</div>
          )}
        </>
      ) : null}

      <div className="groupXpScopeNote">
        {scope === "all_history"
          ? "This Group compares eligible athlete history even from before the Group began."
          : `Only activity dated on or after ${formatStartDate(data?.competitionStartDate || group?.competition_start_date)} counts for this Group.`}
      </div>

      {isAdmin ? (
        <div className="groupXpAdminSetting">
          <div>
            <strong>Weekly XP history</strong>
            <span>Choose the historical cutoff for everyone in this Group. The Group start date itself does not move.</span>
          </div>
          <div className="groupXpScopeButtons" role="group" aria-label="Weekly XP history setting">
            <button
              type="button"
              className={scope === "group_start" ? "active" : ""}
              onClick={() => changeScope("group_start")}
              disabled={busy}
            >
              Since Group started
            </button>
            <button
              type="button"
              className={scope === "all_history" ? "active" : ""}
              onClick={() => changeScope("all_history")}
              disabled={busy}
            >
              All eligible history
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
