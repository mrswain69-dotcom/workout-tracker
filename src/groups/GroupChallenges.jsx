import React, { useEffect, useMemo, useState } from "react";
import {
  GROUP_CHALLENGE_DURATIONS,
  GROUP_CHALLENGE_TEMPLATES,
  buildGroupChallengeDefinition,
} from "../engine/groupChallengeEngine.js";
import {
  cancelGroupChallenge,
  createGroupChallenge,
  loadGroupChallenges,
} from "./groupChallengeDb.js";
import "./GroupChallenges.css";

function errorText(error, fallback = "Could not load Group Challenges.") {
  return error?.message || String(error || fallback);
}

function londonToday() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function addDays(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shortDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

function metricValue(challenge) {
  const value = challenge?.currentValue;
  if (value === null || value === undefined || value === "") return "—";
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  if (challenge.metricType === "xp_rate") return `${number.toFixed(1)} XP / athlete / week`;
  return `${number > 0 && challenge.metricType === "improvement" ? "+" : ""}${number.toFixed(1)}%`;
}

function targetValue(challenge) {
  const number = Number(challenge?.targetValue || 0);
  if (challenge?.metricType === "xp_rate") return `${number} XP / athlete / week`;
  return `${number}%`;
}

function stateLabel(state) {
  return ({
    scheduled: "Scheduled",
    live: "Live",
    awaiting_finalization: "Finalising",
    completed: "Completed",
    missed: "Target missed",
    unavailable: "No truthful result",
    cancelled: "Cancelled",
  })[state] || "Challenge";
}

function evidenceText(challenge) {
  const evidence = challenge?.evidence || {};
  if (challenge?.metricType === "xp_rate") {
    return `${Number(evidence.totalXp || 0)} training XP · ${Number(evidence.eligibleAthleteDays || 0)} athlete-days`;
  }
  if (challenge?.metricType === "consistency") {
    return `${Number(evidence.completedDays || 0)} / ${Number(evidence.plannedDays || 0)} planned days completed`;
  }
  return `${Number(evidence.scoredAthletes || 0)} athlete${Number(evidence.scoredAthletes || 0) === 1 ? "" : "s"} with comparable Improvement evidence`;
}

function ChallengeCard({ challenge, isAdmin, busy, onCancel }) {
  const progress = challenge?.progressPct;
  const progressNumber = Number.isFinite(Number(progress)) ? Math.max(0, Math.min(100, Number(progress))) : null;
  const canCancel = isAdmin && ["scheduled", "live"].includes(challenge.state);
  return (
    <article className={`groupChallengeCard state-${challenge.state}`}>
      <div className="groupChallengeCardTop">
        <div>
          <span className="groupChallengeState">{stateLabel(challenge.state)}</span>
          <h5>{challenge.title}</h5>
        </div>
        <span className="groupChallengeReward">Pool {challenge.rewardPoolXp} XP</span>
      </div>
      <p>{challenge.description}</p>
      <div className="groupChallengeScore">
        <div><span>Current</span><strong>{metricValue(challenge)}</strong></div>
        <div><span>Target</span><strong>{targetValue(challenge)}</strong></div>
      </div>
      {progressNumber !== null && ["live", "completed", "missed"].includes(challenge.state) ? (
        <div className="groupChallengeProgress" aria-label={`${progressNumber.toFixed(1)}% of challenge target`}>
          <span style={{ width: `${progressNumber}%` }} />
        </div>
      ) : null}
      <div className="groupChallengeMeta">
        <span>{shortDate(challenge.startDate)} → {shortDate(challenge.endDate)}</span>
        {!["scheduled", "cancelled"].includes(challenge.state) ? <span>{evidenceText(challenge)}</span> : null}
        {challenge.state === "unavailable" ? <span>Result withheld because the required truthful evidence was unavailable.</span> : null}
        {challenge.state === "completed" ? <span>{challenge.rewardSummary?.distributedXp || 0} XP shared across {challenge.rewardSummary?.recipients || 0} contributing athletes.</span> : null}
      </div>
      {canCancel ? <button type="button" className="groupChallengeCancel" disabled={busy} onClick={() => onCancel(challenge)}>Cancel challenge</button> : null}
    </article>
  );
}

export default function GroupChallenges({ group, membership, isAdmin = false }) {
  const today = londonToday();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [templateKey, setTemplateKey] = useState(GROUP_CHALLENGE_TEMPLATES[0].key);
  const [durationDays, setDurationDays] = useState(14);
  const [startDate, setStartDate] = useState(today);

  async function refresh() {
    if (!group?.id || !membership?.id) return;
    setLoading(true);
    setError("");
    const result = await loadGroupChallenges(group.id, membership.id);
    setLoading(false);
    if (result.error) {
      setError(errorText(result.error));
      return;
    }
    setData(result.data || null);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [group?.id, membership?.id]);

  const preview = useMemo(
    () => buildGroupChallengeDefinition({ templateKey, durationDays, startDate }),
    [templateKey, durationDays, startDate]
  );
  const challenges = Array.isArray(data?.challenges) ? data.challenges : [];
  const open = challenges.filter((challenge) => ["scheduled", "live", "awaiting_finalization"].includes(challenge.state));
  const history = challenges.filter((challenge) => !open.includes(challenge));

  async function handleCreate(event) {
    event.preventDefault();
    if (!preview) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = await createGroupChallenge(group.id, membership.id, { templateKey, durationDays, startDate });
    setBusy(false);
    if (result.error) {
      setError(errorText(result.error, "Could not create challenge."));
      return;
    }
    setNotice("Private Group Challenge created.");
    await refresh();
  }

  async function handleCancel(challenge) {
    if (!window.confirm(`Cancel ${challenge.title}? Challenge history will remain visible.`)) return;
    setBusy(true);
    setError("");
    setNotice("");
    const result = await cancelGroupChallenge(group.id, membership.id, challenge.id);
    setBusy(false);
    if (result.error) {
      setError(errorText(result.error, "Could not cancel challenge."));
      return;
    }
    setNotice("Challenge cancelled.");
    await refresh();
  }

  return (
    <section className="groupHubPanel groupChallengesPanel" aria-label="Private Group Challenges">
      <div className="groupHubPanelHeading groupChallengeHeading">
        <div><h4>Private Group Challenges</h4><span>Collective goals · private to this Group</span></div>
        <div className={`groupChallengeBadge ${data?.teamBadge?.unlocked ? "unlocked" : ""}`}>
          <strong>Challenge Unit</strong><span>{Number(data?.teamBadge?.completedChallenges || 0)} / 10</span>
        </div>
      </div>

      <div className="groupChallengePrinciple">Fixed dates. Controlled targets. One shared reward pool. No feed, no public ranking and no open-ended XP farming.</div>
      {error ? <div className="groupHubMessage error" role="alert">{error}</div> : null}
      {notice ? <div className="groupHubMessage success">{notice}</div> : null}

      {isAdmin ? (
        <form className="groupChallengeCreate" onSubmit={handleCreate}>
          <label>Goal<select value={templateKey} onChange={(event) => setTemplateKey(event.target.value)}>{GROUP_CHALLENGE_TEMPLATES.map((template) => <option key={template.key} value={template.key}>{template.title}</option>)}</select></label>
          <label>Duration<select value={durationDays} onChange={(event) => setDurationDays(Number(event.target.value))}>{GROUP_CHALLENGE_DURATIONS.map((days) => <option key={days} value={days}>{days} days</option>)}</select></label>
          <label>Starts<input type="date" value={startDate} min={today} max={addDays(today, 28)} onChange={(event) => setStartDate(event.target.value)} /></label>
          <div className="groupChallengePreview"><strong>{preview?.title || "Challenge"}</strong><span>{preview?.description || ""}</span><span>{preview ? `${shortDate(preview.startDate)} → ${shortDate(preview.endDate)} · ${preview.rewardPoolXp} XP shared pool` : "Choose a valid challenge."}</span></div>
          <button className="groupHubPrimary" type="submit" disabled={busy || !preview}>{busy ? "Working…" : "Create challenge"}</button>
        </form>
      ) : null}

      {loading ? <div className="groupHubMuted">Loading Challenges…</div> : (
        <>
          <div className="groupChallengeSectionTitle">Open challenges</div>
          {open.length ? <div className="groupChallengeGrid">{open.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} isAdmin={isAdmin} busy={busy} onCancel={handleCancel} />)}</div> : <div className="groupHubMuted">No live or scheduled challenges.</div>}
          {history.length ? <><div className="groupChallengeSectionTitle history">Challenge history</div><div className="groupChallengeGrid history">{history.map((challenge) => <ChallengeCard key={challenge.id} challenge={challenge} isAdmin={false} busy={busy} onCancel={handleCancel} />)}</div></> : null}
        </>
      )}
    </section>
  );
}
