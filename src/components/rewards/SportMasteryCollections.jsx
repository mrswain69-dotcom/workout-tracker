import React, { useState } from "react";

export default function SportMasteryCollections({ series, renderSeries }) {
  const [view, setView] = useState("earned");
  const earned = series.filter(item => item.avatars.some(avatar => avatar.claimed || avatar.claimable));
  const visible = view === "all" ? series : earned;
  return <>
    <div className="badgeViewTabs mt8" role="group" aria-label="Sport Mastery collection filter">
      {["earned", "all"].map(value => <button key={value} type="button"
        className={`subTabPill ${view === value ? "on" : "off"}`} aria-pressed={view === value}
        onClick={() => setView(value)}>{value === "earned" ? "Earned" : "All"}</button>)}
    </div>
    {visible.length ? <div className="sportAvatarSeriesGrid mt12">{visible.map(renderSeries)}</div>
      : <p className="muted mt12">No Sport Mastery avatars earned yet. Choose All to explore the collections and their session targets.</p>}
  </>;
}
