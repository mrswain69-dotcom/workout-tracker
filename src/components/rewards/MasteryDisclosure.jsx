import React, { useEffect, useId, useRef, useState } from "react";

// Local presentation state only: returning to the section starts a new visit.
export default function MasteryDisclosure({ title, subtitle, status, claimable, children }) {
  const [expanded, setExpanded] = useState(Boolean(claimable));
  const previousClaimable = useRef(Boolean(claimable));
  const contentId = useId();
  useEffect(() => {
    if (claimable && !previousClaimable.current) setExpanded(true);
    previousClaimable.current = Boolean(claimable);
  }, [claimable]);
  return <section className="panel sportAvatarSeriesCard masteryDisclosure">
    <button type="button" className="masteryDisclosureToggle" aria-expanded={expanded}
      aria-controls={expanded ? contentId : undefined} onClick={() => setExpanded(value => !value)}>
      <span><span className="h3">{title}</span>{subtitle ? <span className="mini muted mt4">{subtitle}</span> : null}</span>
      <span className="masteryDisclosureStatus">{claimable ? "Ready to claim" : status}<span aria-hidden="true">{expanded ? "−" : "+"}</span></span>
    </button>
    {expanded ? <div id={contentId}>{children}</div> : null}
  </section>;
}
