import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MasteryBadgeArt } from "./MasteryBadgeArt.jsx";
import SportsMasteryMilestones from "./SportsMasteryMilestones.jsx";
import "./SportsMasteryCabinet.css";

const label = tier => tier.charAt(0).toUpperCase() + tier.slice(1);


function BadgeDetails({ card, state, claimedKeys, onClose, onClaim, busy, error, lastDate, faceText, requirementText, progressText, verification, formatValue, onOpenLog }) {
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
        {state.currentTier ? <MasteryBadgeArt verified={verification?.verified} faceText={faceText} card={card} tier={state.currentTier} /> : <MasteryBadgeArt faceText={faceText} card={card} tier={state.tiers[0]} muted />}
        <div>
          {card.badgeGroup === "sport_mastery" ? <p className="masteryDetailsCount"><strong>{state.value}</strong> counted sessions</p> : <>
            <p className="masteryNote">{card.desc}</p>
            <p className="masteryNote">{progressText}</p>
          </>}
          <p>{state.currentTier ? `Best achievement: ${label(state.currentTier.tier)}` : "Reach the Bronze target to earn your first trophy."}</p>
          {lastDate && <p className="masteryNote">Last recorded: {lastDate}</p>}
          {state.nextTier ? <>
            <p>{state.nextTier.star ? `Unreal star ${state.nextTier.star}` : label(state.nextTier.tier)} · {card.badgeGroup === "sport_mastery" ? `${state.nextTier.threshold} counted sessions` : requirementText(state.nextTier)}</p>
            {state.progressPct != null && <progress value={state.progressPct} max="100" aria-label={`Progress to ${state.nextTier.star ? `Unreal star ${state.nextTier.star}` : state.nextTier.tier}`} />}
            {card.badgeGroup === "sport_mastery" && <p className="masteryNote">{Math.max(0,state.nextTier.threshold-state.value)} more counted sessions · {state.progressPct}%</p>}
          </> : <p className="masteryNote">All tiers and stars achieved.</p>}
          {state.nextClaimable && <button type="button" className="btn btn-primary" disabled={busy} onClick={event => onClaim(event.currentTarget)}>{busy ? "Claiming…" : state.nextClaimable.star ? `Claim star ${state.nextClaimable.star}` : `Claim ${label(state.tiers[state.highestEarnedIndex]?.tier || state.nextClaimable.tier)}`}</button>}
          {error && <p role="alert">{error}</p>}
        </div>
      </div>
      {verification && <section className="masteryEvidence" aria-label="Performance verification">
        <h3>Performance verification</h3>
        <p className="masteryNote">{verification.status==="loading"?"Checking verification…":verification.status==="error"?"Verification could not be loaded. Reopen Rewards to retry.":verification.verified?"★ Verified performance — linked source data supports this achievement.":"This achievement is not verified by the available source data."}</p>
        {!verification.supportsMeasuredVerification && <p className="masteryNote">A recording can verify that a session happened; it does not confirm individually entered sets, reps or weights.</p>}
        <details><summary>Qualifying performances / contributing log days ({verification.entries.length})</summary>
          <div className="masteryEvidenceRows">{verification.entries.map(entry=><div key={entry.date} className="masteryEvidenceRow"><button type="button" onClick={()=>{onClose();onOpenLog(entry.date);}}>Open log · {entry.date}</button><span>{entry.value!=null?formatValue(entry.value):"Qualifying day"}</span><small>{entry.verified?`★ Verified · ${entry.sources.join(", ")}`:"Logged · unverified"}</small></div>)}</div>
          {!verification.entries.length && <p className="masteryNote">No qualifying log days available.</p>}
        </details>
      </section>}
      <SportsMasteryMilestones state={state} claimedKeys={claimedKeys} card={card} faceText={faceText} requirementText={requirementText} verifiedKeys={verification?.verifiedKeys} />
    </div>
  </dialog>, document.body);
}

export default function SportsMasteryCabinet({ card, state, claimedKeys, onClaim, lastDate, flash, faceText, requirementText, progressText, verification, formatValue, onOpenLog }) {
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
    <h3>{card.title}{verification?.verified && <span className="masteryVerifiedLabel"> · Verified</span>}</h3>
    <div className="masteryPrevious" aria-label="Earlier earned badges">
      {previous.map(tier => <button key={tier.key} type="button" onClick={openDetails}
        title={`${label(tier.tier)} · ${claimedKeys.has(tier.key) ? "Claimed" : "Earned"}`}
        aria-label={`${card.title}: ${label(tier.tier)}, ${claimedKeys.has(tier.key) ? "claimed" : "earned"}. View details`}>
        <MasteryBadgeArt verified={verification?.verifiedKeys?.has(tier.key)} faceText={faceText} card={card} tier={tier} tiny />
      </button>)}
    </div>
    <div className="masteryShelf">
      <div className="masteryCurrent">
        {best ? <button type="button" className="masteryArtButton" onClick={openDetails} aria-label={`${card.title}: ${label(best.tier)}. View details`}
          title={`${label(best.tier)} · ${claimedKeys.has(best.key) ? "Claimed" : "Earned"}`}><MasteryBadgeArt verified={verification?.verified} faceText={faceText} card={card} tier={best} /></button>
          : <div className="masteryEmpty">Your first trophy<br /><span>Reach the Bronze target</span></div>}
        {state.stars > 0 && <div className="masteryEarnedStars" aria-label={`${state.stars} Unreal stars claimed`}><span aria-hidden="true">{"★".repeat(Math.min(8,state.stars))}{state.stars>8?` +${state.stars-8}`:""}</span></div>}
        {bestClaimable && <button type="button" className="btn btn-primary masteryClaim" disabled={busy} onClick={event=>claim(event.currentTarget)}>{busy ? "Claiming…" : "Claim"}</button>}
      </div>
      <div className="masteryTarget">
        {!target ? <span className="masteryComplete">Collection complete</span> : target.star ? <>
          <button type="button" className={`masteryStarTarget${state.nextClaimable?.star ? " masteryStarTarget--ready" : ""}`} onClick={openDetails} aria-label={`Next target: Unreal star ${target.star}. View details`}><span aria-hidden="true">★</span><span>Star {target.star}</span></button>
          {state.nextClaimable?.star ? <button type="button" className="btn btn-primary masteryClaim" disabled={busy} onClick={event=>claim(event.currentTarget)}>{busy ? "Claiming…" : "Claim star"}</button> : <span className="masteryLocked">Locked</span>}
        </> : <>
          <button type="button" className="masteryArtButton" onClick={openDetails} aria-label={`Next target: ${label(target.tier)}, locked. View details`}><MasteryBadgeArt faceText={faceText} card={card} tier={target} muted /></button>
          <span className="masteryLocked">Locked</span>
        </>}
      </div>
    </div>
    {error && <p role="alert" className="mini">{error}</p>}
    <button type="button" className="masteryDetailsButton" onClick={openDetails}>Details</button>
    {open && <BadgeDetails card={card} state={state} claimedKeys={claimedKeys} onClose={()=>setOpen(false)} onClaim={async element => { if (await claim(element)) setOpen(false); }} busy={busy} error={error} lastDate={lastDate} faceText={faceText} requirementText={requirementText} progressText={progressText} verification={verification} formatValue={formatValue} onOpenLog={onOpenLog} />}
  </article>;
}
