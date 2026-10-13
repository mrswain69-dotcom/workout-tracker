import React, { useEffect, useId, useRef, useState } from "react";
import BadgeTierLabel from "./BadgeTierLabel.jsx";

// Local presentation state only: returning to the section starts a new visit.
export default function MasteryDisclosure({ title, subtitle, status, claimable, children, badge = false, defaultExpanded, verified = false }) {
  const [expanded, setExpanded] = useState(defaultExpanded ?? Boolean(claimable));
  const previousClaimable = useRef(Boolean(claimable));
  const contentId = useId();
  const hasTierStatus = /^(bronze|silver|gold|platinum|diamond|pro|elite|champion|unreal)$/i.test(String(status || ""));
  useEffect(() => {
    if (defaultExpanded === undefined && claimable && !previousClaimable.current) setExpanded(true);
    previousClaimable.current = Boolean(claimable);
  }, [claimable, defaultExpanded]);
  return <section className={`panel sportAvatarSeriesCard masteryDisclosure${badge ? " masteryDisclosure--badge" : ""}`}>
    <button type="button" className="masteryDisclosureToggle" aria-expanded={expanded}
      aria-controls={expanded ? contentId : undefined} onClick={() => setExpanded(value => !value)}>
      <span className="masteryDisclosureHeading"><span className="masteryDisclosureTitle">{title}</span>{subtitle ? <span className="masteryDisclosureSubtitle">{subtitle}</span> : null}{verified && <span className="masteryVerifiedLabel">★ Verified</span>}</span>
      <span className="masteryDisclosureStatus">{badge || (!claimable && hasTierStatus) ? <BadgeTierLabel tier={status} /> : claimable ? "Ready to claim" : status}<span className="masteryDisclosureSymbol" aria-hidden="true">{expanded ? "−" : "+"}</span></span>
    </button>
    {expanded ? <div className="masteryDisclosureContent" id={contentId}>{children}</div> : null}
  </section>;
}
