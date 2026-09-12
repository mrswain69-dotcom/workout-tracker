import React, { useEffect, useMemo, useState } from "react";
import { setProfileBirthDate } from "../../profileBirthDateDb.js";
import { buildHistoricalTimelineEvents } from "../../engine/historicalTimelineEventEngine.js";
import { buildHistoricalAutobiographyFoundation } from "../../engine/historicalAutobiographyEngine.js";
import "./PerformanceAutobiography.css";

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(value))) return "—";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function formatCompactDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(cleanText(value))) return "—";
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

function formatNumber(value, maximumFractionDigits = 1) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return number.toLocaleString("en-GB", { maximumFractionDigits });
}

function sourceLabel(sourceType) {
  const labels = {
    assessment: "Assessment",
    consistency: "Consistency",
    group_award: "Award",
    knowledge: "Knowledge",
    session: "Session",
    workout: "Training",
    improvement: "Performance",
  };
  return labels[sourceType] || "History";
}

function milestoneTone(item) {
  if (item?.sourceType === "group_award") return "gold";
  if (item?.sourceType === "consistency") return "green";
  if (item?.sourceType === "assessment" || item?.sourceType === "improvement") return "cyan";
  return "neutral";
}

function improvementFeedItem(highlight) {
  return {
    id: highlight.id,
    date: highlight.date,
    age: highlight.age,
    sourceType: "improvement",
    eventType: highlight.kind,
    title: highlight.title,
    evidenceState: "derived_from_compatible_history",
    evidence: {
      metricLabel: highlight.metricLabel,
      previousBestValue: highlight.previousBestValue,
      value: highlight.value,
      percentageImprovement: highlight.percentageImprovement,
      improvementValue: highlight.improvementValue,
      unit: highlight.unit,
      displayValue: highlight.displayValue,
    },
  };
}

function significantEvents(events = []) {
  const allowed = new Set([
    "assessment",
    "consistency",
    "group_award",
    "knowledge",
  ]);
  return (Array.isArray(events) ? events : []).filter((event) =>
    allowed.has(event?.sourceType)
  );
}

function buildFeed({ chapter = null, foundation }) {
  const improvement = chapter
    ? chapter.improvementHighlights || []
    : foundation?.trendEvidence?.improvementHighlights || [];
  const events = chapter ? chapter.events || [] : foundation?.events || [];
  return [
    ...significantEvents(events),
    ...improvement.map(improvementFeedItem),
  ]
    .sort((a, b) =>
      cleanText(b?.date).localeCompare(cleanText(a?.date)) ||
      cleanText(a?.id).localeCompare(cleanText(b?.id))
    );
}

function evidenceLines(item) {
  const evidence = item?.evidence || {};
  const lines = [];

  if (item?.sourceType === "improvement") {
    if (evidence.metricLabel) lines.push(evidence.metricLabel);
    if (evidence.previousBestValue !== null && evidence.previousBestValue !== undefined) {
      const unit = evidence.unit ? ` ${evidence.unit}` : "";
      lines.push(`Previous best: ${formatNumber(evidence.previousBestValue)}${unit}`);
    }
    if (evidence.value !== null && evidence.value !== undefined) {
      const unit = evidence.unit ? ` ${evidence.unit}` : "";
      lines.push(`New best: ${formatNumber(evidence.value)}${unit}`);
    } else if (evidence.displayValue) {
      lines.push(`Result: ${evidence.displayValue}`);
    }
    if (evidence.percentageImprovement !== null && evidence.percentageImprovement !== undefined) {
      lines.push(`Compatible improvement: ${formatNumber(evidence.percentageImprovement)}%`);
    } else if (evidence.improvementValue !== null && evidence.improvementValue !== undefined) {
      lines.push(`Compatible change: ${formatNumber(evidence.improvementValue)}`);
    }
  }

  if (item?.sourceType === "consistency") {
    lines.push(`${evidence.completedDays || 0}/${evidence.plannedDays || 0} planned days completed`);
    if (evidence.consistencyPct !== null && evidence.consistencyPct !== undefined) {
      lines.push(`${formatNumber(evidence.consistencyPct)}% Consistency`);
    }
    if (evidence.periodStart && evidence.periodEnd) {
      lines.push(`${formatDate(evidence.periodStart)} – ${formatDate(evidence.periodEnd)}`);
    }
  }

  if (item?.sourceType === "group_award") {
    if (evidence.periodStart && evidence.periodEnd) {
      lines.push(`${formatDate(evidence.periodStart)} – ${formatDate(evidence.periodEnd)}`);
    }
    if (evidence.rank) lines.push(`Frozen rank: #${evidence.rank}`);
    if (evidence.scoreValue !== null && evidence.scoreValue !== undefined) {
      lines.push(`Frozen score: ${formatNumber(evidence.scoreValue)}${evidence.scoreUnit ? ` ${evidence.scoreUnit}` : ""}`);
    }
  }

  if (item?.sourceType === "assessment") {
    const count = Number(evidence.validResultCount || 0);
    lines.push(`${count} valid ${count === 1 ? "result" : "results"} retained`);
  }

  if (item?.sourceType === "knowledge") {
    for (const [key, value] of Object.entries(evidence)) {
      if (["string", "number"].includes(typeof value)) {
        lines.push(`${key.replace(/_/g, " ")}: ${value}`);
      }
    }
  }

  return lines;
}

function MilestoneFeed({ items }) {
  const rows = Array.isArray(items) ? items : [];
  if (!rows.length) {
    return (
      <div className="autobiography-empty">
        No benchmark, PB, Consistency or award milestone is recorded in this chapter yet.
        Routine training history is still retained in the chapter totals.
      </div>
    );
  }

  return (
    <div className="autobiography-feed" aria-label="Performance milestones">
      {rows.map((item) => {
        const lines = evidenceLines(item);
        return (
          <article
            className={`autobiography-milestone autobiography-milestone--${milestoneTone(item)}`}
            key={item.id}
          >
            <div className="autobiography-milestone__rail" aria-hidden="true" />
            <div className="autobiography-milestone__body">
              <div className="autobiography-milestone__meta">
                <span>{formatDate(item.date)}</span>
                <span>{sourceLabel(item.sourceType)}</span>
              </div>
              <h4>{item.title || "Recorded milestone"}</h4>
              {lines.length ? (
                <details>
                  <summary>View evidence</summary>
                  <div className="autobiography-evidence">
                    {lines.map((line) => (
                      <span key={line}>{line}</span>
                    ))}
                    <small>Source state: {cleanText(item.evidenceState, "recorded").replace(/_/g, " ")}</small>
                  </div>
                </details>
              ) : null}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function EvidenceState({ label, state, count = 0 }) {
  const stateCopy = {
    ready: `${count} comparable ${count === 1 ? "series" : "series"}`,
    recorded_only: "Recorded history · comparison unavailable",
    empty: "No recorded evidence yet",
  };
  return (
    <div className={`autobiography-evidence-card autobiography-evidence-card--${state}`}>
      <span>{label}</span>
      <strong>{stateCopy[state] || state.replace(/_/g, " ")}</strong>
    </div>
  );
}

function ChapterSummary({ chapter }) {
  return (
    <>
      <div className="autobiography-chapter-metrics">
        <div><strong>{chapter.trainingDays}</strong><span>training days</span></div>
        <div><strong>{chapter.structuredSessions}</strong><span>structured Sessions</span></div>
        <div><strong>{chapter.recoveryDays}</strong><span>recovery days</span></div>
        <div><strong>{chapter.improvementHighlights?.length || 0}</strong><span>PB / improvement moments</span></div>
      </div>
      <div className="autobiography-evidence-grid">
        <EvidenceState
          label="Strength"
          state={chapter.strength?.state || "empty"}
          count={chapter.strength?.series?.length || 0}
        />
        <EvidenceState
          label="Cardio"
          state={chapter.cardio?.state || "empty"}
          count={chapter.cardio?.series?.length || 0}
        />
        <EvidenceState
          label="Assessments"
          state={chapter.assessment?.state || "empty"}
          count={chapter.assessment?.histories?.length || 0}
        />
        <div className={`autobiography-evidence-card autobiography-evidence-card--${chapter.consistency?.state || "empty"}`}>
          <span>Consistency</span>
          <strong>
            {chapter.consistency?.state === "ready"
              ? `${chapter.consistency.milestones.length} milestone${chapter.consistency.milestones.length === 1 ? "" : "s"}`
              : cleanText(chapter.consistency?.state, "no_milestone").replace(/_/g, " ")}
          </strong>
        </div>
      </div>
    </>
  );
}

function CareerSummary({ summary }) {
  if (!summary?.gate?.firstEvidenceDate) {
    return (
      <div className="autobiography-career autobiography-career--locked">
        <div className="autobiography-career__eyebrow">CAREER SUMMARY</div>
        <h4>Build the record first</h4>
        <p>The three-year Career Summary begins from the first genuine historical evidence.</p>
      </div>
    );
  }

  if (!summary.available) {
    return (
      <div className="autobiography-career autobiography-career--locked">
        <div className="autobiography-career__eyebrow">CAREER SUMMARY · BUILDING</div>
        <h4>Three years of real history unlocks the full career view</h4>
        <p>
          Evidence currently runs from {formatDate(summary.gate.firstEvidenceDate)} to {formatDate(summary.gate.lastEvidenceDate)}.
          The full Career Summary unlocks once recorded history reaches {formatDate(summary.gate.unlockDate)}.
        </p>
        <div className="autobiography-career__preview">
          <span><strong>{summary.training?.recordedTrainingDays || 0}</strong> recorded training days</span>
          <span><strong>{summary.streak?.highestWorkoutStreakDays || 0}d</strong> highest supported streak</span>
          <span><strong>{summary.improvement?.milestoneCount || 0}</strong> PB / improvement moments</span>
        </div>
      </div>
    );
  }

  const biggest = summary.improvement?.biggestYear;
  const biggestText = biggest?.available
    ? biggest.years.join(" / ")
    : "—";

  return (
    <div className="autobiography-career autobiography-career--ready">
      <div className="autobiography-career__eyebrow">CAREER SUMMARY</div>
      <h4>Your long-range performance record</h4>
      <div className="autobiography-career__grid">
        <div><strong>{summary.training.recordedTrainingDays}</strong><span>training days</span></div>
        <div><strong>{summary.streak.highestWorkoutStreakDays}d</strong><span>highest streak</span></div>
        <div><strong>{summary.improvement.milestoneCount}</strong><span>PB / improvement moments</span></div>
        <div><strong>{biggestText}</strong><span>biggest improvement year</span></div>
        <div><strong>{summary.awards.seasonWins}</strong><span>season wins</span></div>
        <div><strong>{summary.coverage.calendarYears.length}</strong><span>calendar years covered</span></div>
      </div>
      <p className="autobiography-integrity-note">
        Lifetime improvement stays metric-specific. Workout Tracker does not combine kg,
        reps, seconds and scores into a made-up universal percentage.
      </p>
    </div>
  );
}

function DateOfBirthUnlock({ profileId, onSaved, dateApi = setProfileBirthDate }) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function save(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setSaving(true);
    const result = await dateApi(profileId, value);
    setSaving(false);
    if (result?.error) {
      setError(result.error.message || String(result.error));
      return;
    }
    const saved = result?.data?.birth_date || value;
    setMessage("Age timeline unlocked.");
    onSaved(saved);
  }

  return (
    <form className="autobiography-dob" onSubmit={save}>
      <div>
        <strong>Unlock the true age timeline</strong>
        <span>
          Add this athlete’s private date of birth. It is used only to place genuine
          history into the correct age chapter and is never exposed through Groups.
        </span>
      </div>
      <div className="autobiography-dob__controls">
        <input
          aria-label="Date of birth"
          type="date"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          required
        />
        <button type="submit" disabled={saving || !value}>
          {saving ? "Saving…" : "Unlock ages"}
        </button>
      </div>
      {error ? <div className="autobiography-dob__error" role="alert">{error}</div> : null}
      {message ? <div className="autobiography-dob__success" role="status">{message}</div> : null}
    </form>
  );
}

export default function PerformanceAutobiography({
  profileId,
  profileName = "Athlete",
  birthDate = null,
  logs = [],
  assessmentRuns = [],
  assessmentResults = [],
  timelineData = null,
  referenceDate = "",
  dateApi = setProfileBirthDate,
}) {
  const [savedBirthDate, setSavedBirthDate] = useState(null);
  const serverBirthDate = timelineData?.profile?.birthDate || null;
  const resolvedBirthDate = savedBirthDate || birthDate || serverBirthDate || null;

  const foundation = useMemo(() => {
    const baseEvents = buildHistoricalTimelineEvents({
      logs,
      assessmentRuns,
      assessmentResults,
      groupAwards: timelineData?.groupAwards || [],
      profileId,
      birthDate: resolvedBirthDate,
    });
    return buildHistoricalAutobiographyFoundation({
      events: baseEvents,
      workoutLogs: logs,
      assessmentRuns,
      assessmentResults,
      consistencySnapshots: timelineData?.consistencySnapshots || [],
      knowledgeMilestones: timelineData?.knowledge?.milestones || [],
      knowledgeSourceAvailable: timelineData?.knowledge?.sourceAvailable === true,
      profileId,
      birthDate: resolvedBirthDate,
      referenceDate,
    });
  }, [
    logs,
    assessmentRuns,
    assessmentResults,
    timelineData,
    profileId,
    resolvedBirthDate,
    referenceDate,
  ]);

  const chapters = foundation.chapters || [];
  const [selectedAge, setSelectedAge] = useState(null);

  useEffect(() => {
    setSavedBirthDate(null);
  }, [profileId]);

  useEffect(() => {
    setSelectedAge(chapters.length ? chapters.at(-1).age : null);
  }, [profileId, resolvedBirthDate, chapters.length]);

  const selectedChapter =
    chapters.find((chapter) => chapter.age === selectedAge) || chapters.at(-1) || null;
  const feed = buildFeed({ chapter: selectedChapter, foundation });
  const evidenceCount = foundation.events?.filter((event) => event.sourceType === "workout").length || 0;

  return (
    <section className="performance-autobiography" aria-label="Performance Autobiography">
      <div className="autobiography-hero">
        <div>
          <div className="autobiography-hero__eyebrow">LONG-RANGE HISTORY</div>
          <h3>Performance Autobiography</h3>
          <p>
            {profileName}’s recorded growth over time — genuine training, comparable
            performance improvements, benchmarks, Consistency milestones and frozen awards.
          </p>
        </div>
        <div className="autobiography-hero__mark" aria-hidden="true">⌁</div>
      </div>

      {!resolvedBirthDate ? (
        <>
          <DateOfBirthUnlock
            profileId={profileId}
            onSaved={setSavedBirthDate}
            dateApi={dateApi}
          />
          <div className="autobiography-date-history">
            <strong>Date-based history is already active</strong>
            <span>
              {evidenceCount} recorded training {evidenceCount === 1 ? "day" : "days"} can be retained now.
              Exact Age chapters stay off until a real date of birth is supplied.
            </span>
          </div>
        </>
      ) : null}

      {chapters.length ? (
        <>
          <div className="autobiography-age-nav" aria-label="Age chapters">
            {chapters.map((chapter) => (
              <button
                key={chapter.age}
                type="button"
                aria-pressed={selectedChapter?.age === chapter.age}
                onClick={() => setSelectedAge(chapter.age)}
              >
                <strong>Age {chapter.age}</strong>
                <span>{formatCompactDate(chapter.startDate)} → {formatCompactDate(chapter.endDate)}</span>
              </button>
            ))}
          </div>

          <div className="autobiography-chapter-head">
            <div>
              <span>SELECTED CHAPTER</span>
              <h4>Age {selectedChapter.age}</h4>
            </div>
            <div>
              {formatDate(selectedChapter.firstEvidenceDate)} – {formatDate(selectedChapter.lastEvidenceDate)}
            </div>
          </div>
          <ChapterSummary chapter={selectedChapter} />
        </>
      ) : resolvedBirthDate ? (
        <div className="autobiography-empty">
          Date of birth is set, but there is not yet genuine recorded evidence to form an age chapter.
        </div>
      ) : null}

      <div className="autobiography-section-title">
        <div>
          <span>MILESTONE FEED</span>
          <h4>{selectedChapter ? `Age ${selectedChapter.age} highlights` : "Recorded highlights"}</h4>
        </div>
        <small>Routine workouts stay in totals; this feed surfaces notable evidence.</small>
      </div>
      <MilestoneFeed items={feed} />

      <CareerSummary summary={foundation.careerSummary} />

      <div className="autobiography-footnote">
        <span>Knowledge milestones: {foundation.milestones?.knowledge?.state === "not_available_yet" ? "not available yet" : foundation.milestones?.knowledge?.state || "empty"}</span>
        <span>History is derived from current source truth; correcting past records can update this view.</span>
      </div>
    </section>
  );
}
