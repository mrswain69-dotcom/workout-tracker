import React from "react";
import { MasteryBadgeArt } from "./MasteryBadgeArt.jsx";

function Milestones({ tiers, claimedKeys, value, earnedKeys, card, faceText, requirementText, verifiedKeys }) {
  const requirement = tier => card.badgeGroup === "sport_mastery" ? `${tier.threshold} counted sessions · +${tier.xp} XP` : requirementText(tier);
  return <div className="masteryMilestoneGrid">
    {tiers.map(tier => {
      const claimed = claimedKeys.has(tier.key);
      const earned = earnedKeys ? earnedKeys.has(tier.key) : value != null && Number.isFinite(Number(value)) && (card.comparator === "lte" ? Number(value) > 0 && Number(value) <= tier.threshold : Number(value) >= tier.threshold);
      const status = claimed ? "Claimed" : earned ? "Earned" : "Locked";
      const name = tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);
      return <div key={tier.key} tabIndex={0} title={status} aria-label={`${name}: ${requirement(tier)}, ${status.toLowerCase()}`}
        className={`masteryMilestone${claimed ? " masteryMilestone--claimed" : ""}`}>
        <MasteryBadgeArt verified={verifiedKeys?.has(tier.key)} faceText={faceText} card={card} tier={tier} muted={!earned && !claimed} />
        <strong>{name}</strong><small>{requirement(tier)}</small>
        <span className="masteryMilestoneStatus" aria-hidden="true">{status}</span>
      </div>;
    })}
  </div>;
}

export default function SportsMasteryMilestones({ state, claimedKeys, card, faceText, requirementText, verifiedKeys }) {
  const sections = [{title:"Bronze to Diamond",tiers:state.tiers.slice(0,5)}];
  if (state.tiers.length > 5 && state.stage !== "foundation") sections.push({title:"Pro to Elite",tiers:state.tiers.slice(5,8)});
  if (state.stage === "unreal") sections.push({title:"Unreal",tiers:state.tiers.slice(8)});
  return <div>
    {sections.map(section=><section className="masteryStage" key={section.title} aria-label={section.title}>
      <h3>{section.title}</h3><Milestones tiers={section.tiers} claimedKeys={claimedKeys} value={state.value} earnedKeys={state.earnedKeys} card={card} faceText={faceText} requirementText={requirementText} verifiedKeys={verifiedKeys}/>
    </section>)}
    {state.tiers.length > 5 && state.stage === "foundation" && <p className="masteryNote">The next stage unlocks after Diamond.</p>}
    {state.stage === "prestige" && <p className="masteryNote">The final stage unlocks after Elite.</p>}
    {card.badgeGroup === "sport_mastery" && state.stage === "unreal" && <p className="masteryNote">After Unreal, every further 80 counted sessions unlocks a star. Stars do not add bonus XP.{state.stars > 0 ? ` ${state.stars} Unreal stars claimed.` : ""}</p>}
    {card.badgeGroup !== "sport_mastery" && state.stage === "unreal" && <section className="masteryStage" aria-label="Unreal stars">
      <h3>Unreal stars · 1–10</h3><p className="masteryNote">Each star has its own target and adds no bonus XP.</p>
      <div className="masteryStarGrid">{card.starTiers?.map(tier=>{
        const earned=state.earnedStarKeys?.has(tier.key), claimed=claimedKeys.has(tier.key);
        const status=claimed?"Claimed":earned?"Earned":"Locked";
        return <div key={tier.key} tabIndex={0} title={status} aria-label={`Unreal star ${tier.star}: ${status.toLowerCase()}`} className={`masteryStarMilestone masteryMilestone${earned||claimed?"":" masteryStarMilestone--locked"}`}>
          <strong>★ {tier.star}</strong><small>{requirementText(tier).replace(/ · \+0 XP$/, "")}</small><span className="masteryMilestoneStatus" aria-hidden="true">{status}</span>
        </div>;
      })}</div>
      {card.prestige?.benchmarkLabel && <p className="masteryNote">Star 10: {card.prestige.benchmarkLabel}. Reference checked {card.prestige.benchmarkDate}. {card.prestige.source && <a href={card.prestige.source} target="_blank" rel="noreferrer">Source</a>} App achievements use recorded activity and are not official records or age/category-adjusted ratings.</p>}
    </section>}
    {card.prestige?.note && <p className="masteryNote">{card.prestige.note}</p>}
    {card.badgeGroup === "sport_mastery" && <section className="masteryStage" aria-label="Counting rules"><h3>How sessions count</h3>
      <p className="masteryNote">A session counts when you record sport activity, including partial structured sessions. Cancelled sessions and future dates do not count. Each sport counts at most once per day. Existing claimed achievements stay in your history if you later edit a log.</p>
    </section>}
  </div>;
}
