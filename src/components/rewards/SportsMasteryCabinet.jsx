import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MasteryBadgeArt } from "./MasteryBadgeArt.jsx";
import SportsMasteryMilestones from "./SportsMasteryMilestones.jsx";
import "./SportsMasteryCabinet.css";

const label = tier => tier.charAt(0).toUpperCase() + tier.slice(1);


function BadgeDetails({ card, state, claimedKeys, onClose, onClaim, busy, error, lastDate }) {
  const ref = useRef(null);
  const close = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
    close.current?.focus();
    return () => { dialog.close?.(); previous?.focus?.(); };
  }, []);
  return createPortal(<dialog ref={ref} className="masteryDetailsDialog" aria-label={`${card.title} details`}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="masteryDetailsInner">
      <header><h2>{card.title}</h2><button ref={close} type="button" className="btn" onClick={onClose}>Close</button></header>
      <div className="masteryDetailsOverview">
        {state.currentTier ? <MasteryBadgeArt card={card} tier={state.currentTier} /> : <MasteryBadgeArt card={card} tier={state.tiers[0]} muted />}
        <div><p className="masteryDetailsCount"><strong>{state.value}</strong> counted sessions</p>
          <p>{state.currentTier ? `Best achievement: ${label(state.currentTier.tier)}` : "Record your first sport session to earn Bronze."}</p>
          {lastDate && <p className="mini muted">Last recorded: {lastDate}</p>}
          <p>{state.nextTier.star ? `Unreal star ${state.nextTier.star}` : label(state.nextTier.tier)} · {state.nextTier.threshold} counted sessions</p>
          <progress value={state.progressPct} max="100" aria-label={`Progress to ${state.nextTier.star ? `Unreal star ${state.nextTier.star}` : state.nextTier.tier}`} />
          <p className="mini">{Math.max(0,state.nextTier.threshold-state.value)} more counted sessions · {state.progressPct}%</p>
          {state.nextClaimable && <button type="button" className="btn btn-primary" disabled={busy} onClick={event => onClaim(event.currentTarget)}>{busy ? "Claiming…" : state.nextClaimable.star ? `Claim star ${state.nextClaimable.star}` : `Claim ${label(state.currentTier.tier)}`}</button>}
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
      <SportsMasteryMilestones state={state} claimedKeys={claimedKeys} card={card} />
    </div>
  </dialog>, document.body);
}

export default function SportsMasteryCabinet({ card, state, claimedKeys, onClaim, lastDate, flash }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const claiming = useRef(false);
  const best = state.currentTier;
  const bestIndex = best ? state.tiers.findIndex(t => t.key === best.key) : -1;
  const previous = state.tiers.slice(0, Math.max(0,bestIndex));
  const target = bestIndex === state.tiers.length-1 ? state.nextTier : state.tiers[bestIndex+1];
  const bestClaimable = state.nextClaimable && !state.nextClaimable.star;
  const openDetails = () => setOpen(true);
  async function claim(element) {
    if (claiming.current) return;
    claiming.current = true; setBusy(true); setError("");
    try {
      const success = await onClaim(element);
      if (!success) setError("Could not finish claiming. Please try again.");
      return !!success;
    }
    catch { setError("Could not finish claiming. Please try again."); return false; }
    finally { claiming.current = false; setBusy(false); }
  }
  return <article className={`panel masteryCabinet${flash ? " masteryCabinet--flash" : ""}`}>
    <h3>{card.title}</h3>
    <div className="masteryPrevious" aria-label="Earlier earned badges">
      {previous.map(tier => <button key={tier.key} type="button" onClick={openDetails}
        title={`${label(tier.tier)} · ${claimedKeys.has(tier.key) ? "Claimed" : "Earned"}`}
        aria-label={`${card.title}: ${label(tier.tier)}, ${claimedKeys.has(tier.key) ? "claimed" : "earned"}. View details`}>
        <MasteryBadgeArt card={card} tier={tier} tiny />
      </button>)}
    </div>
    <div className="masteryShelf">
      <div className="masteryCurrent">
        {best ? <button type="button" className="masteryArtButton" onClick={openDetails} aria-label={`${card.title}: ${label(best.tier)}. View details`}
          title={`${label(best.tier)} · ${claimedKeys.has(best.key) ? "Claimed" : "Earned"}`}><MasteryBadgeArt card={card} tier={best} /></button>
          : <div className="masteryEmpty">Your first trophy<br /><span className="mini">Starts with one session</span></div>}
        {state.stars > 0 && <div className="masteryEarnedStars" aria-label={`${state.stars} Unreal stars claimed`}><span aria-hidden="true">{"★".repeat(Math.min(8,state.stars))}{state.stars>8?` +${state.stars-8}`:""}</span></div>}
        {bestClaimable && <button type="button" className="btn btn-primary masteryClaim" disabled={busy} onClick={event=>claim(event.currentTarget)}>{busy ? "Claiming…" : "Claim"}</button>}
      </div>
      <div className="masteryTarget">
        {target.star ? <>
          <button type="button" className={`masteryStarTarget${state.nextClaimable?.star ? " masteryStarTarget--ready" : ""}`} onClick={openDetails} aria-label={`Next target: Unreal star ${target.star}. View details`}><span aria-hidden="true">★</span><span>Star {target.star}</span></button>
          {state.nextClaimable?.star ? <button type="button" className="btn btn-primary masteryClaim" disabled={busy} onClick={event=>claim(event.currentTarget)}>{busy ? "Claiming…" : "Claim star"}</button> : <span className="masteryLocked">Locked</span>}
        </> : <>
          <button type="button" className="masteryArtButton" onClick={openDetails} aria-label={`Next target: ${label(target.tier)}, locked. View details`}><MasteryBadgeArt card={card} tier={target} muted /></button>
          <span className="masteryLocked">Locked</span>
        </>}
      </div>
    </div>
    {error && <p role="alert" className="mini">{error}</p>}
    <button type="button" className="masteryDetailsButton" onClick={openDetails}>Details</button>
    {open && <BadgeDetails card={card} state={state} claimedKeys={claimedKeys} onClose={()=>setOpen(false)} onClaim={async element => { if (await claim(element)) setOpen(false); }} busy={busy} error={error} lastDate={lastDate} />}
  </article>;
}
