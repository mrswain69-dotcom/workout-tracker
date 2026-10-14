import { GroupBlockCountHeaders, GroupBlockCountCells } from "./GroupBlockCountCells.jsx";
import "./GroupCompact.css";
import React, { useEffect, useMemo, useState } from "react";
import { loadGroupImprovementLeaderboard } from "./groupDb";
import { withGroupCosmetics } from "./groupIdentity";
import GroupIdentityTrigger from "./GroupIdentityTrigger.jsx";
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

function numericScore(row) {
  const raw = row?.improvementPct;
  if (raw === null || raw === undefined || raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function scoreLabel(row) {
  const value = numericScore(row);
  if (value === null) return "—";
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
  const value = numericScore(row);
  if (value === null) return "neutral";
  if (value > 0.05) return "positive";
  if (value < -0.05) return "negative";
  return "neutral";
}

function Standings({ rows = [], selfId, onOpenIdentity }) {
  const selfIndex = rows.findIndex((row) => row.membership_id === selfId);
  return (
    <> <div className="groupTableScroll" role="region" aria-label="Improvement table — scroll for more" tabIndex={0}><div className="groupXpStandings groupDetailedTable withBlockCounts improvement" role="table" aria-label="Improvement standings">
      <div className="groupXpStandingHeader" role="row">
        <span role="columnheader">Rank</span>
        <span role="columnheader">Athlete</span>
        <span role="columnheader">Improvement</span><span role="columnheader">Metrics</span><span role="columnheader">Improved</span><span role="columnheader">Declined</span>
        <GroupBlockCountHeaders />
      </div>
      {rows.map((row, index) => {
        const self = row.membership_id === selfId;
        const neighbour = selfIndex >= 0 && !self && Math.abs(index - selfIndex) === 1;
        const excluded = row.competition_excluded === true;
        return (
          <div
            key={row.membership_id}
            className={`groupXpStandingRow ${row.rank && row.rank <= 3 ? `leader rank${row.rank}` : ""} ${self ? "self" : ""} ${neighbour ? "neighbour" : ""} ${excluded ? "excluded" : ""}`}
            role="row"
          >
            <span className="groupXpRank" role="cell">{row.rank ? `#${row.rank}` : "—"}</span>
            <span className="groupXpAthleteCell" role="cell">
              <GroupIdentityTrigger member={row} isSelf={self} onOpen={onOpenIdentity} className="groupXpIdentity" />
              {excluded ? (
                <small className="groupXpIntegrityLabel">
                  {row.competition_exclusion_label || "Gamed XP"}
                </small>
              ) : null}
            </span>
            <span className={`groupImprovementScoreCell ${scoreTone(row)}`} role="cell">
              <strong>{scoreLabel(row)}</strong>
              {!Number(row.metricCount) ? <small>{evidenceLabel(row)}</small> : null}
                </span><span role="cell">{row.metricCount ?? "—"}</span><span role="cell">{row.improvedMetricCount ?? "—"}</span><span role="cell">{row.declinedMetricCount ?? "—"}</span>
            <GroupBlockCountCells row={row} />
          </div>
        );
      })}
    </div></div><span className="groupTableHint">Scroll sideways for more →</span></>
  );
}

export default function GroupImprovement({ group, membership, onOpenIdentity, directory = [], periodMode }) {
  const [localMode, setMode] = useState("current");
  const mode = periodMode ?? localMode;
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
  const rows = withGroupCosmetics(period?.rows || [], directory, period?.state === "frozen");
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
      <section className="groupHubPanel groupXpPanel groupImprovementPanel">
        <div className="groupXpHeading">
          <div>
            <span className="groupXpEyebrow groupImprovementEyebrow">↗ SELF VS SELF</span>
            <h4>Improvement</h4>
            <p>Current performance vs 4-week baseline.</p>
          </div>
          <button className="groupXpRefresh" type="button" onClick={refresh} disabled={loading} aria-label="Refresh Improvement">↻</button>
        </div>

{periodMode === undefined ? (        <div className="groupXpPeriodToggle" role="group" aria-label="Improvement period">
          <button type="button" className={mode === "current" ? "active" : ""} onClick={() => setMode("current")}>This week</button>
          <button type="button" className={mode === "history" ? "active" : ""} onClick={() => setMode("history")}>Last 4 weeks</button>
        </div>) : null}

        {mode === "history" && weekButtons.length ? (
<label className="groupBoardHistoryPicker">Week <select aria-label="Choose completed week" value={historyIndex} onChange={event=>setHistoryIndex(Number(event.target.value))}>
            {weekButtons.map(week=><option key={week.index} value={week.index} disabled={week.disabled}>{week.label || `Week ${week.index + 1}`}</option>)}
          </select></label>
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
              <Standings rows={rows} selfId={membership.id} onOpenIdentity={onOpenIdentity} />
              </>
            ) : (
              <div className="groupHubEmpty compact">No Improvement standings are available for this period.</div>
            )}
          </>
        ) : null}

<details className="groupCompactDetails"><summary>Details &amp; scoring</summary><div className="groupCompactDetailsBody"><p>Block counts show completed recorded Strength, Cardio, Duration, Session and Task blocks in this period, including extra blocks. They follow the app’s completion rules. These totals reflect current logs; final standings remain fixed.</p><p>Current recorded performance versus your own locked rolling 4-week baseline. It compares change, not body size or absolute strength.</p>        <div className="groupImprovementRuleNote">
          <strong>How it stays fair:</strong> comparable metrics are measured against each athlete’s own preceding 28-day average, then weighted equally. Declines count as well as gains, unsafe percentage metrics are excluded, practice volume does not become performance, and each metric has a ±50% outlier cap.
        </div></div></details>
      </section>
    </>
  );
}
