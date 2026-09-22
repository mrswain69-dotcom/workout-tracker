import React, { useEffect, useMemo, useState } from "react";
import {
  loadGroupXpLeaderboard,
  updateGroupXpHistoryScope,
} from "./groupDb";
import GroupIdentityTrigger from "./GroupIdentityTrigger.jsx";
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

function TopThree({ rows = [], selfId, onOpenIdentity }) {
  const top = rows.filter((row) => Number(row?.xp || 0) > 0 && Number(row?.rank || 99) <= 3);
  if (!top.length) return null;

  return (
    <div className="groupXpTopThree" aria-label="Weekly XP Top 3">
      {top.map((row) => (
        <div
          key={row.membership_id}
          className={`groupXpPodium rank${row.rank} ${row.membership_id === selfId ? "self" : ""}`}
        >
          <span className="groupXpMedal">#{row.rank}</span>
          <GroupIdentityTrigger
            member={row}
            isSelf={row.membership_id === selfId}
            onOpen={onOpenIdentity}
            className="groupPodiumIdentityTrigger"
          />
          <span>{Number(row.xp || 0).toLocaleString()} XP</span>
        </div>
      ))}
    </div>
  );
}

function VerificationBadge({ row, onOpenEvidence }) {
  const pct =
    row?.verificationPct === null || row?.verificationPct === undefined
      ? null
      : Number(row.verificationPct);

  const content = pct === null ? "Verification —" : `${pct}% verified`;

  if (row?.evidence && onOpenEvidence) {
    return (
      <button
        type="button"
        className="groupXpVerificationButton"
        onClick={() => onOpenEvidence(row)}
        title="Open XP evidence"
      >
        {content}
      </button>
    );
  }

  return <span className="groupXpVerification">{content}</span>;
}

function Standings({ rows = [], selfId, onOpenIdentity, onOpenEvidence }) {
  const selfIndex = rows.findIndex((row) => row.membership_id === selfId);

  return (
    <div className="groupXpStandings" role="table" aria-label="Weekly Earned XP standings">
      <div className="groupXpStandingHeader" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Athlete</span>
        <span role="columnheader">Earned XP</span>
      </div>
      {rows.map((row, index) => {
        const self = row.membership_id === selfId;
        const neighbour = selfIndex >= 0 && !self && Math.abs(index - selfIndex) === 1;
        const excluded = row.competition_excluded === true;
        return (
          <div
            key={row.membership_id}
            className={`groupXpStandingRow ${self ? "self" : ""} ${neighbour ? "neighbour" : ""} ${excluded ? "excluded" : ""}`}
            role="row"
          >
            <span className="groupXpRank" role="cell">
              {excluded ? "—" : row.rank ? `#${row.rank}` : "—"}
            </span>
            <span className="groupXpAthleteCell" role="cell">
              <GroupIdentityTrigger
                member={row}
                isSelf={self}
                onOpen={onOpenIdentity}
                className="groupXpIdentity"
              />
              {excluded ? (
                <small className="groupXpIntegrityLabel">
                  {row.competition_exclusion_label || "Gamed XP"}
                </small>
              ) : null}
              <VerificationBadge row={row} onOpenEvidence={onOpenEvidence} />
            </span>
            <span className="groupXpScoreCell" role="cell">
              {row.evidence ? (
                <button
                  type="button"
                  className="groupXpScoreEvidenceButton"
                  onClick={() => onOpenEvidence?.(row)}
                  title="See how this Earned XP was generated"
                >
                  {Number(row.xp || 0).toLocaleString()} XP ⓘ
                </button>
              ) : (
                <strong className="groupXpScore">
                  {Number(row.xp || 0).toLocaleString()} XP
                </strong>
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function XpEvidenceDialog({ row, period, onClose }) {
  if (!row?.evidence) return null;
  const categories = Array.isArray(row.evidence.categories)
    ? row.evidence.categories
    : [];
  const activities = Array.isArray(row.evidence.activities)
    ? row.evidence.activities
    : [];

  return (
    <div className="groupXpEvidenceBackdrop" role="presentation" onClick={onClose}>
      <div
        className="groupXpEvidenceDialog"
        role="dialog"
        aria-modal="true"
        aria-label={`${row.nickname || "Athlete"} XP evidence`}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="groupXpEvidenceHeader">
          <div>
            <span>XP EVIDENCE</span>
            <h4>{row.nickname || "Athlete"}</h4>
            <small>{formatWeek(period?.startDate, period?.endDate)}</small>
          </div>
          <button type="button" onClick={onClose} aria-label="Close XP evidence">×</button>
        </div>

        <div className="groupXpEvidenceHero">
          <strong>{Number(row.evidence.earnedXp || 0).toLocaleString()} Earned XP</strong>
          <span>
            {row.verificationPct === null || row.verificationPct === undefined
              ? "No verification-eligible activity"
              : `${row.verificationPct}% of eligible activity verified`}
          </span>
        </div>

        <div className="groupXpEvidenceSection">
          <strong>Plan / XP breakdown</strong>
          {categories.length ? (
            <div className="groupXpEvidenceBreakdown">
              {categories.map((item) => (
                <div key={item.label}>
                  <span>{item.label}</span>
                  <b>{Number(item.xp || 0).toLocaleString()} XP</b>
                </div>
              ))}
            </div>
          ) : (
            <small>No Earned XP in this period.</small>
          )}
        </div>

        <div className="groupXpEvidenceSection">
          <strong>Activity evidence</strong>
          {activities.length ? (
            <div className="groupXpEvidenceActivities">
              {activities.map((activity, index) => (
                <div key={`${activity.date}-${activity.label}-${index}`}>
                  <span>
                    <b>{activity.date}</b> · {activity.label}
                  </span>
                  <span className={activity.verified ? "verified" : "unverified"}>
                    {activity.verified ? "✓ Verified" : "Manual"}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <small>No verification-eligible physical activity in this period.</small>
          )}
        </div>

        <div className="groupXpEvidencePrivacy">
          This is a privacy-safe score overview. Reps, weights, private notes,
          medical/recovery detail and raw provider data are not shared.
        </div>
      </div>
    </div>
  );
}

export default function GroupWeeklyXp({ group, membership, isAdmin = false, onGroupChanged, onOpenIdentity }) {
  const [mode, setMode] = useState("current");
  const [historyIndex, setHistoryIndex] = useState(0);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [evidenceRow, setEvidenceRow] = useState(null);

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
          <h4>Weekly Earned XP</h4>
          <p>Group competition uses Earned XP only — training, tasks, completion, progress and consistency. Reward/award Bonus XP never increases the leaderboard score.</p>
        </div>
        <button className="groupXpRefresh" type="button" onClick={refresh} disabled={loading || busy} aria-label="Refresh Weekly XP">
          ↻
        </button>
      </div>

      <div className="groupXpPeriodToggle" role="group" aria-label="Weekly Earned XP period">
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
      {loading ? <div className="groupHubMuted groupXpLoading">Calculating Earned XP…</div> : null}

      {!loading && period ? (
        <>
          <div className="groupXpPeriodMeta">
            <strong>{formatWeek(period.startDate, period.endDate)}</strong>
            <span>
              {period.state === "frozen"
                ? period.scoreMode === "legacy_total_xp"
                  ? "Final standings · legacy Total XP"
                  : "Final standings · Earned XP"
                : "Live standings · Earned XP"}
            </span>
          </div>

          {!period.available ? (
            <div className="groupHubEmpty compact">This Group had not started yet.</div>
          ) : rows.length ? (
            <>
              <TopThree rows={rows} selfId={membership.id} onOpenIdentity={onOpenIdentity} />
              <Standings
                rows={rows}
                selfId={membership.id}
                onOpenIdentity={onOpenIdentity}
                onOpenEvidence={setEvidenceRow}
              />
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

      <div className="groupXpScopeNote">
        Verification % covers verification-eligible physical activity only. Tasks,
        consistency XP and rewards do not dilute the percentage. Members choose
        whether their privacy-safe XP evidence breakdown is visible to the Group.
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
      {evidenceRow ? (
        <XpEvidenceDialog
          row={evidenceRow}
          period={period}
          onClose={() => setEvidenceRow(null)}
        />
      ) : null}
    </section>
  );
}
