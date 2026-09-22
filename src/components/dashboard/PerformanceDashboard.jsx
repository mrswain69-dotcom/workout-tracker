import React, { useEffect, useMemo, useState } from "react";
import { loadVerifiedActivityData } from "../../verifiedActivityDb.js";
import { listProfileGroups } from "../../groups/groupDb.js";
import { listAssessmentSchedules } from "../../assessmentScheduleDb.js";
import { listAssessmentRuns } from "../../assessmentRunDb.js";
import { buildAssessmentScheduleStatuses } from "../../engine/assessmentScheduleEngine.js";
import { buildDashboardCoachInsight } from "../../engine/dashboardEngine.js";
import "./PerformanceDashboard.css";

function formatDateTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function blockLabel(block) {
  return (
    block?.label ||
    block?.name ||
    block?.activityName ||
    (block?.typeId === "tasks" ? "Tasks" : "") ||
    (block?.typeId ? String(block.typeId).replaceAll("_", " ") : "Planned activity")
  );
}

function Metric({ label, value, note = "" }) {
  return (
    <div className="dashboardMetric">
      <div className="dashboardMetric__label">{label}</div>
      <div className="dashboardMetric__value">{value}</div>
      {note ? <div className="dashboardMetric__note">{note}</div> : null}
    </div>
  );
}

function ActionButton({ children, onClick, primary = false }) {
  return (
    <button
      type="button"
      className={`btn ${primary ? "btn-primary" : "btn-secondary"}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function PerformanceDashboard({
  familyId = "",
  profileId = "",
  profileName = "Athlete",
  todayYmd = "",
  todayStatus = "amber",
  currentStreak = 0,
  weekSummary = null,
  totalXp = 0,
  nextAvatarReward = null,
  todayBlocks = [],
  planIsBlank = false,
  recoveryMode = "normal",
  motivationLine = "",
  healthTip = "",
  onOpenLog,
  onOpenPlan,
  onLogExtra,
  onOpenProgress,
  onOpenRewards,
  onOpenGroups,
  onOpenConnections,
  onOpenAssessments,
}) {
  const [remote, setRemote] = useState({
    groups: [],
    verified: null,
    assessmentStatuses: [],
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!profileId) {
        if (!cancelled) {
          setRemote({ groups: [], verified: null, assessmentStatuses: [], loading: false });
        }
        return;
      }

      const [groupsResult, verifiedResult, schedulesResult, runsResult] =
        await Promise.all([
          listProfileGroups(profileId).catch((error) => ({ data: [], error })),
          loadVerifiedActivityData(profileId).catch((error) => ({ data: null, error })),
          familyId
            ? listAssessmentSchedules(familyId, { profileId, activeOnly: true }).catch(
                (error) => ({ data: [], error })
              )
            : Promise.resolve({ data: [], error: null }),
          familyId
            ? listAssessmentRuns(familyId, { profileId, limit: 100 }).catch(
                (error) => ({ data: [], error })
              )
            : Promise.resolve({ data: [], error: null }),
        ]);

      const statuses = buildAssessmentScheduleStatuses({
        schedules: schedulesResult?.data || [],
        runs: runsResult?.data || [],
        todayYmd,
      });

      if (!cancelled) {
        setRemote({
          groups: groupsResult?.data || [],
          verified: verifiedResult?.data || null,
          assessmentStatuses: statuses,
          loading: false,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [familyId, profileId, todayYmd]);

  const activeTodayBlocks = useMemo(
    () =>
      (Array.isArray(todayBlocks) ? todayBlocks : []).filter(
        (block) => block && !block.cancelled && !block.suspendedByRecoveryMode
      ),
    [todayBlocks]
  );

  const coach = buildDashboardCoachInsight({
    recoveryMode,
    todayStatus,
    currentStreak,
    weekXp: weekSummary?.xp || 0,
    completedDays: weekSummary?.completedDays || 0,
    todayActionCount: activeTodayBlocks.length,
    planIsBlank,
  });

  const verifiedSummary = useMemo(() => {
    const data = remote.verified;
    if (!data) return null;

    const connections = (data.connections || []).filter(
      (connection) => connection?.status === "active"
    );
    const activities = (data.verifiedActivities || []).filter(
      (activity) => activity?.status !== "ignored"
    );
    if (!connections.length && !activities.length) return null;

    const observations = data.observations || [];
    const observationById = new Map(
      observations.map((observation) => [observation.id, observation])
    );
    const datesByActivity = new Map();
    for (const link of data.observationLinks || []) {
      const observation = observationById.get(link.observation_id);
      const date = observation?.local_date_ymd || "";
      if (!date) continue;
      const previous = datesByActivity.get(link.verified_activity_id) || "";
      if (!previous || date > previous) {
        datesByActivity.set(link.verified_activity_id, date);
      }
    }

    const weekStart = weekSummary?.startDate || "";
    const verifiedThisWeek = activities.filter((activity) => {
      const date =
        datesByActivity.get(activity.id) ||
        String(activity?.started_at || "").slice(0, 10);
      return !!date && (!weekStart || date >= weekStart) && date <= todayYmd;
    }).length;

    const latestObservation = observations[0] || null;
    const lastSync = connections
      .map((connection) => connection?.last_sync_at || connection?.updated_at || "")
      .filter(Boolean)
      .sort()
      .at(-1) || "";

    return {
      connectionCount: connections.length,
      verifiedThisWeek,
      latestLabel:
        latestObservation?.activity_name ||
        latestObservation?.activity_type ||
        activities[0]?.activity_type ||
        "Connected activity",
      lastSync,
    };
  }, [remote.verified, weekSummary?.startDate, todayYmd]);

  const assessmentSummary = useMemo(() => {
    const statuses = remote.assessmentStatuses || [];
    if (!statuses.length) return null;
    const actionStates = new Set(["in_progress", "overdue", "due"]);
    const actionCount = statuses.filter((status) => actionStates.has(status.state)).length;
    const first = statuses[0] || null;
    return { count: statuses.length, actionCount, first };
  }, [remote.assessmentStatuses]);

  const todayComplete = todayStatus === "green";
  const nextRewardValue = nextAvatarReward
    ? `${nextAvatarReward.unlockAtXp.toLocaleString("en-GB")} XP`
    : "Prestige reached";
  const nextRewardNote = nextAvatarReward
    ? `${nextAvatarReward.remainingXp.toLocaleString("en-GB")} XP to go`
    : "More high-XP avatar tiers are next";

  return (
    <main className="performanceDashboard" aria-label="Performance dashboard">
      <section className={`dashboardCoach dashboardCoach--${coach.tone}`}>
        <div className="dashboardCoach__kicker">{coach.kicker}</div>
        <h2>{coach.title}</h2>
        <p>{coach.body}</p>
        {(motivationLine || healthTip) && (
          <div className="dashboardCoach__secondary">
            {motivationLine ? <span>{motivationLine}</span> : null}
            {healthTip ? <span>{healthTip}</span> : null}
          </div>
        )}
      </section>

      <section className="dashboardMetricGrid" aria-label="Current performance summary">
        <Metric
          label="Today"
          value={todayComplete ? "Complete" : activeTodayBlocks.length ? "In progress" : "Rest day"}
          note={todayComplete ? "Plan completed" : activeTodayBlocks.length ? `${activeTodayBlocks.length} active block${activeTodayBlocks.length === 1 ? "" : "s"}` : "Nothing planned"}
        />
        <Metric
          label="Plan streak"
          value={`${currentStreak} day${currentStreak === 1 ? "" : "s"}`}
          note="Following the plan"
        />
        <Metric
          label="Earned XP this week"
          value={(weekSummary?.xp || 0).toLocaleString("en-GB")}
          note={`${Math.max(0, Number(totalXp) || 0).toLocaleString("en-GB")} XP total`}
        />
        <Metric
          label="Next reward"
          value={nextRewardValue}
          note={nextRewardNote}
        />
      </section>

      <section className="dashboardGrid">
        <article className="dashboardCard dashboardCard--today">
          <div className="dashboardCard__head">
            <div>
              <div className="dashboardCard__kicker">TODAY</div>
              <h3>{profileName}’s plan</h3>
            </div>
            <span className={`dashboardStatus dashboardStatus--${todayComplete ? "complete" : "active"}`}>
              {todayComplete ? "Complete" : "Active"}
            </span>
          </div>

          {activeTodayBlocks.length ? (
            <div className="dashboardPlanList">
              {activeTodayBlocks.slice(0, 6).map((block, index) => (
                <div className="dashboardPlanItem" key={block.id || `${block.typeId}-${index}`}>
                  <span className="dashboardPlanItem__dot" />
                  <span>{blockLabel(block)}</span>
                </div>
              ))}
              {activeTodayBlocks.length > 6 ? (
                <div className="dashboardPlanMore">
                  +{activeTodayBlocks.length - 6} more
                </div>
              ) : null}
            </div>
          ) : (
            <div className="dashboardEmpty">
              <strong>Nothing planned today.</strong>
              <span>{planIsBlank ? "Build your weekly schedule when you are ready." : "This is a rest day. It will not increase or break your streak."}</span>
            </div>
          )}

          <div className="dashboardCard__actions">
            {activeTodayBlocks.length ? (
              <ActionButton onClick={onOpenLog} primary>Open Today’s Log</ActionButton>
            ) : (
              <>
                <ActionButton onClick={onOpenPlan} primary>Build my weekly plan</ActionButton>
                <ActionButton onClick={onLogExtra}>Log an extra activity</ActionButton>
              </>
            )}
          </div>
        </article>

        <article className="dashboardCard">
          <div className="dashboardCard__kicker">THIS WEEK</div>
          <h3>Weekly performance summary</h3>
          <div className="dashboardSummaryRows">
            <div><span>Earned XP</span><strong>{(weekSummary?.earnedXp ?? weekSummary?.xp ?? 0).toLocaleString("en-GB")}</strong></div>
            {Number(weekSummary?.bonusXp || 0) > 0 ? (
              <div><span>Bonus XP</span><strong>+{Number(weekSummary.bonusXp).toLocaleString("en-GB")}</strong></div>
            ) : null}
            <div><span>Plan days complete</span><strong>{weekSummary?.completedDays || 0}</strong></div>
            <div><span>Active days</span><strong>{weekSummary?.activeDays || 0}</strong></div>
            <div><span>Recovery-mode days</span><strong>{weekSummary?.recoveryDays || 0}</strong></div>
          </div>
          {weekSummary?.bestXpDay ? (
            <div className="dashboardFootnote">
              Best Earned XP day: {weekSummary.bestXpDay.date} · {weekSummary.bestXpDay.xp} XP
            </div>
          ) : null}
        </article>

        <article className="dashboardCard">
          <div className="dashboardCard__kicker">PROGRESS</div>
          <h3>Progress highlights</h3>
          <div className="dashboardHighlight">
            <strong>{currentStreak}-day plan streak</strong>
            <span>Current habit momentum</span>
          </div>
          <div className="dashboardHighlight">
            <strong>{weekSummary?.completedDays || 0} completed plan days</strong>
            <span>Since Monday</span>
          </div>
          <div className="dashboardCard__actions">
            <ActionButton onClick={onOpenProgress}>Open Progress</ActionButton>
          </div>
        </article>

        {remote.groups.length ? (
          <article className="dashboardCard">
            <div className="dashboardCard__kicker">GROUPS</div>
            <h3>Group activity</h3>
            <div className="dashboardBigValue">{remote.groups.length}</div>
            <div className="dashboardFootnote">
              active group{remote.groups.length === 1 ? "" : "s"} for this profile
            </div>
            <div className="dashboardCard__actions">
              <ActionButton onClick={onOpenGroups}>Open Groups</ActionButton>
            </div>
          </article>
        ) : null}

        {verifiedSummary ? (
          <article className="dashboardCard">
            <div className="dashboardCard__kicker">CONNECTED ACTIVITY</div>
            <h3>Verified this week</h3>
            <div className="dashboardBigValue">{verifiedSummary.verifiedThisWeek}</div>
            <div className="dashboardFootnote">
              Latest: {verifiedSummary.latestLabel}
              {verifiedSummary.lastSync ? ` · synced ${formatDateTime(verifiedSummary.lastSync)}` : ""}
            </div>
            <div className="dashboardCard__actions">
              <ActionButton onClick={onOpenProgress}>View Verified Activity</ActionButton>
              <ActionButton onClick={onOpenConnections}>Connections</ActionButton>
            </div>
          </article>
        ) : null}

        {assessmentSummary ? (
          <article className="dashboardCard">
            <div className="dashboardCard__kicker">UPCOMING</div>
            <h3>Assessments</h3>
            <div className="dashboardBigValue">{assessmentSummary.actionCount}</div>
            <div className="dashboardFootnote">
              {assessmentSummary.actionCount
                ? "assessment item(s) due, overdue or in progress"
                : "No assessment action needed right now"}
            </div>
            <div className="dashboardCard__actions">
              <ActionButton onClick={onOpenAssessments}>Assessment settings</ActionButton>
              <ActionButton onClick={onOpenProgress}>View Progress</ActionButton>
            </div>
          </article>
        ) : null}

        <article className="dashboardCard dashboardCard--reward">
          <div className="dashboardCard__kicker">REWARDS</div>
          <h3>Keep something to chase</h3>
          <div className="dashboardBigValue">
            {(weekSummary?.xp || 0).toLocaleString("en-GB")} XP
          </div>
          <div className="dashboardFootnote">
            this week · {Math.max(0, Number(totalXp) || 0).toLocaleString("en-GB")} XP total
          </div>
          <div className="dashboardCard__actions">
            <ActionButton onClick={onOpenRewards}>Open Rewards</ActionButton>
          </div>
        </article>
      </section>

      {remote.loading ? (
        <div className="dashboardLoading" aria-live="polite">
          Updating connected, group and assessment context…
        </div>
      ) : null}
    </main>
  );
}
