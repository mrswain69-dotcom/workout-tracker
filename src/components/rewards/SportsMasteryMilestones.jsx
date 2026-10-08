import React from "react";
import { MasteryBadgeArt } from "./MasteryBadgeArt.jsx";

function Milestones({ tiers, claimedKeys, value, card }) {
  return <div className="masteryMilestoneGrid">
    {tiers.map(tier => {
      const claimed = claimedKeys.has(tier.key);
      const earned = value >= tier.threshold;
      const status = claimed ? "Claimed" : earned ? "Earned" : "Locked";
      const name = tier.tier.charAt(0).toUpperCase() + tier.tier.slice(1);
      return <div key={tier.key} tabIndex={0} title={status} aria-label={`${name}: ${tier.threshold} counted sessions, ${status.toLowerCase()}`}
        className={`masteryMilestone${claimed ? " masteryMilestone--claimed" : ""}`}>
        <MasteryBadgeArt card={card} tier={tier} muted={!earned && !claimed} />
        <strong>{name}</strong><small>{tier.threshold} counted sessions</small><small>+{tier.xp} XP</small>
        <span className="masteryMilestoneStatus" aria-hidden="true">{status}</span>
      </div>;
    })}
  </div>;
}

export default function SportsMasteryMilestones({ state, claimedKeys, card }) {
  const sections = [{title:"Bronze to Diamond",tiers:state.tiers.slice(0,5)}];
  if (state.stage !== "foundation") sections.push({title:"Pro to Elite",tiers:state.tiers.slice(5,8)});
  if (state.stage === "unreal") sections.push({title:"Unreal",tiers:state.tiers.slice(8)});
  return <div>
    {sections.map(section=><section className="masteryStage" key={section.title} aria-label={section.title}>
      <h3>{section.title}</h3><Milestones tiers={section.tiers} claimedKeys={claimedKeys} value={state.value} card={card}/>
    </section>)}
    {state.stage === "foundation" && <p className="mini muted">The next stage unlocks after Diamond.</p>}
    {state.stage === "prestige" && <p className="mini muted">The final stage unlocks after Elite.</p>}
    {state.stage === "unreal" && <p className="mini muted">After Unreal, every further 80 counted sessions unlocks a star. Stars do not add bonus XP.{state.stars > 0 ? ` ${state.stars} Unreal stars claimed.` : ""}</p>}
    <section className="masteryStage" aria-label="Counting rules"><h3>How sessions count</h3>
      <p className="mini muted">A session counts when you record sport activity, including partial structured sessions. Cancelled sessions and future dates do not count. Each sport counts at most once per day. Existing claimed achievements stay in your history if you later edit a log.</p>
    </section>
  </div>;
}
