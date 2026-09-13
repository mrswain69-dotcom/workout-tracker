import React, { useMemo } from "react";
import { buildVerifiedCardioEvidence } from "../../engine/verifiedCardioEvidenceEngine.js";
import { buildVerifiedConsistencyEffects } from "../../engine/verifiedConsistencyEffectEngine.js";
import "./VerifiedConsistencyPanel.css";

function titleCase(value) {
  return String(value || "cardio")
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return "";
  const date = new Date(`${value}T00:00:00.000Z`);
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export default function VerifiedConsistencyPanel({
  verificationData = null,
  logs = [],
  consistencySnapshots = [],
}) {
  const evidence = useMemo(
    () => buildVerifiedCardioEvidence(verificationData || {}),
    [verificationData]
  );
  const effects = useMemo(
    () => buildVerifiedConsistencyEffects({
      logs,
      consistencySnapshots,
      verifiedCardioEvidence: evidence,
    }),
    [logs, consistencySnapshots, evidence]
  );

  const applied = effects.rows
    .filter((row) => row.verifiedAssignments.length > 0)
    .slice()
    .sort((a, b) => b.dateYmd.localeCompare(a.dateYmd));

  return (
    <section className="progress-section verified-consistency-panel" aria-label="Verified plan completion">
      <div className="verified-consistency-panel__heading">
        <div>
          <div className="progress-section-heading__kicker">PLAN VERIFICATION</div>
          <h3>Verified training can satisfy the plan</h3>
        </div>
        <span>Consistency evidence · 0 bonus XP</span>
      </div>

      <p className="verified-consistency-panel__copy">
        A same-day provider activity can satisfy a matching cardio block without creating a second workout.
        Manual completion always wins first, and one physical activity can satisfy only one planned block.
      </p>

      <div className="verified-consistency-panel__metrics">
        <div><span>Plan blocks verified</span><strong>{effects.verifiedPlanBlocks}</strong></div>
        <div><span>Days completed by verification</span><strong>{effects.daysCompletedByVerification}</strong></div>
        <div><span>Mixed manual + verified days</span><strong>{effects.mixedCompletionDays}</strong></div>
      </div>

      <div className="verified-consistency-panel__rule">
        Strict matches only: Run, Ride, Swim, Walk, Row or explicit Cardio. Strength, Sessions, Recovery and generic Duration stay manual unless the plan later stores stronger verification metadata.
      </div>

      {applied.length ? (
        <div className="verified-consistency-panel__list">
          {applied.slice(0, 6).map((row) => (
            <article key={row.dateYmd}>
              <div>
                <strong>{formatDate(row.dateYmd)}</strong>
                <span>{row.completedAfterVerification ? "Planned day satisfied" : "Plan block verified"}</span>
              </div>
              <div className="verified-consistency-panel__chips">
                {row.verifiedAssignments.map((assignment) => (
                  <span key={`${row.dateYmd}:${assignment.expectedBlockId}`}>
                    {titleCase(assignment.expectedBlockType)} ← {titleCase(assignment.cardioKind)}
                  </span>
                ))}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="verified-consistency-panel__empty">
          No verified activity currently satisfies a strict planned cardio block. Manual plan completion is unchanged.
        </div>
      )}
    </section>
  );
}
