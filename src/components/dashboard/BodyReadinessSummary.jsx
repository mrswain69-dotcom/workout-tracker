import React from "react";

export default function BodyReadinessSummary({ readiness, onOpenLog }) {
  if (!readiness) return null;

  if (readiness.hasRecentActivity === false) {
    return (
      <section className="dashboardReadiness dashboardReadiness--moderate" aria-label="Body readiness status">
        <div className="dashboardReadiness__top">
          <h3>Body Readiness Status</h3>
          <span className="dashboardReadiness__pill">Awaiting activity</span>
        </div>
        <p>No recent activity recorded. Log an activity to start building your readiness estimate.</p>
        {onOpenLog ? <button type="button" className="btn btn-secondary" onClick={onOpenLog}>Open today’s log</button> : null}
        <p className="dashboardReadiness__note">Readiness estimates use recorded activity and recovery, with assumed rest and sleep. They are not a measurement of how your body feels.</p>
      </section>
    );
  }

  const tone = readiness?.band?.tone || "moderate";
  const label = readiness?.band?.label || "Readiness";
  const score = Number(readiness?.trainingReadinessScore);
  const scalePercent = Math.max(
    0,
    Math.min(100, Number(readiness?.trainingReadinessScalePercent) || 0)
  );

  return (
    <section
      className={`dashboardReadiness dashboardReadiness--${tone}`}
      aria-label="Body readiness status"
    >
      <div className="dashboardReadiness__top">
        <h3>Body Readiness Status</h3>
        <span className="dashboardReadiness__pill">{label}</span>
      </div>

      <div className="dashboardReadiness__body">
        <div className="dashboardReadiness__score">
          {readiness.trainingReadinessScore != null && Number.isFinite(score) ? Math.round(score) : "—"}
        </div>

        <div className="dashboardReadiness__scale">
          <div className="dashboardReadiness__legend" aria-hidden="true">
            <span>Low</span>
            <span>Reduced</span>
            <span>Moderate</span>
            <span>High</span>
            <span>Prime</span>
          </div>
          <div className="dashboardReadiness__band">
            <i style={{ left: `${scalePercent}%` }} />
          </div>
        </div>

        <p>{readiness?.recommendationText || "Use readiness as context for today’s training quality."}</p>
      </div>

      <details className="dashboardReadiness__details">
        <summary>How is this estimated?</summary>
        <p>Estimated from your recorded activity and recovery over the last seven days, with assumed rest and sleep. Activity you haven’t logged is not included.</p>
        <dl>
          {[
            ["Muscle readiness", readiness.muscleReadiness],
            ["Nervous system readiness", readiness.nervousSystemReadiness],
            ["Body energy", readiness.bodyEnergy],
            ["Next-session forecast", readiness.projectedTrainingReadinessScore],
          ].map(([name, value]) => (
            <div key={name}><dt>{name}</dt><dd>{value != null && Number.isFinite(Number(value)) ? `${Math.round(Number(value))}/100` : "—"}</dd></div>
          ))}
        </dl>
        <p className="dashboardReadiness__note">This is a training estimate, not a medical assessment. Consider how you feel alongside it.</p>
      </details>
    </section>
  );
}
