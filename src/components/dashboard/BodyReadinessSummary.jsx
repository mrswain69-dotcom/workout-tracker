import React from "react";

export default function BodyReadinessSummary({ readiness }) {
  if (!readiness) return null;

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
          {Number.isFinite(score) ? Math.round(score) : "—"}
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
    </section>
  );
}
