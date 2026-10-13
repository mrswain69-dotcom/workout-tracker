import React from 'react';
import { XP_RULES_ACTIVATION_DATE, XP_PROGRESSION_RULES as rules } from '../../engine/xpRuleVersions.js';
import './XpLedger.css';
const changeDate = new Date(`${XP_RULES_ACTIVATION_DATE}T00:00:00Z`).toLocaleDateString('en-GB', {day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

export default function XpRulesInfo() {
  return <div className="stack mt8 mini xpRulesInfo">
    <p className="xpRulesChange"><b>Revised rules from {changeDate}</b><br/>Earlier activity dates keep their previous XP rules, including when you edit an older log. Your existing XP and reward unlocks carry forward.</p>
    <div><b>Strength / HIIT / Box:</b> +2 XP per recorded set, plus +5 XP for the first logged Strength category that day. More Strength blocks add set XP without repeating the +5.</div>
    <div><b>Cardio:</b> +1 XP per 2 minutes and +1 XP per 0.5 km, plus one +5 category award per day. Minutes and distance are added across blocks before rounding up. Walking earns 60% of the cardio rate; in mixed days only the walking work is discounted. A walking-only category award is +3 XP.</div>
    <div><b>Duration:</b> +2 XP per 10 minutes, plus one +5 category award per day. Minutes are added before rounding up. General Duration blocks earn no improvement or PB XP.</div>
    <div><b>Sessions:</b> +10 XP for each completed Session. Multiple genuine Sessions can earn this; drill counts/results do not add XP.</div>
    <div><b>Recovery, illness and injury:</b> once per day across these blocks: +5 XP for completed recovery/illness, or +10 XP for logged injury physio. If both apply, receive the higher award once.</div>
    <div><b>Reps or holds:</b> {rules.repsOrHoldXpPerPercent} XP per 1% improvement, up to {rules.repsOrHoldCap} XP. Compare your best set with the best set on the last comparable date. For example, 30 → 31 reps earns 1 improvement XP; 30 → 36 earns 5 XP after the cap.</div>
    <div><b>Weighted sets:</b> {rules.weightedXpPerPercent} XP per 1% improvement, up to {rules.weightedCap} XP. Compare actual best paired weight × reps sets, with neither weight nor reps reduced. Improving both increases the gain. For example, 20 kg × 10 → 21 kg × 11 is 15.5% improvement and earns 15 XP after the cap.</div>
    <div><b>Cardio improvement:</b> {rules.cardioXpPerPercent} XP per 1% reduction in time, up to {rules.cardioCap} XP, for the same sport and exact recorded distance. For example, a 5 km run from 30 → 29 minutes earns 3 XP. Different sports or distances start their own comparison history.</div>
    <div><b>Daily improvement limit:</b> only your highest Strength improvement and highest Cardio improvement award count—up to 15 + 10 = 25 XP per day. Percentage-based awards round down to whole XP, so tiny changes may earn no improvement XP. Additional movements/blocks still earn their normal base XP.</div>
    <div><b>Established personal best:</b> +{rules.personalBestDaily} earned XP once per day when you beat a comparable all-time PB after {rules.personalBestPriorDates} earlier recording dates. The fourth date is the first eligible date. A small genuine record can qualify even if its percentage gain earns no improvement XP. PB XP is additional to the 25 XP improvement limit.</div>
    <div><b>Warmup / record-only:</b> use “Record only” in your plan’s movement settings to exclude that movement from improvement and PB awards. Its recorded sets still earn base XP. Missing history, ties, cancelled and recovery-suspended activity do not earn improvement/PB XP.</div>
    <div><b>Tasks:</b> XP per completed task, as configured in your plan. <b>Day complete:</b> +10 XP when all active workout blocks (excluding tasks) have qualifying recorded activity. These rules are unchanged.</div>
    <div><b>Streak milestones:</b> 2 days → 5 XP; 3 → 10; 5 → 20; 10 → 50; 30 → 100; 60 → 200; 90 → 300; 180 → 600. <b>Daily challenge claim:</b> +15 XP. These rules are unchanged.</div>
    <div><b>PB badges:</b> distinct PB days unlock Bronze 1, Silver 3, Gold 5, Platinum 10, Diamond 25, Pro 50, Champion 100, Elite 150 and Unreal 250. Unreal stars then require another 50 PB days each, up to ten stars.</div>
    <div><b>Earned and Bonus XP:</b> activity, improvement, daily PB, tasks, completion, streak and daily challenge XP are Earned XP and count in Group Earned XP tables. Claimed badge/avatar rewards and Group awards are Bonus XP; they increase Total XP and reward unlocks. Unreal stars award no extra XP.</div>
    <details><summary>Previous rules — activity through 13 October 2026</summary>
      <p>+2 per Strength set; Cardio from time and distance; +2 per 10 Duration minutes. Each logged Strength, Cardio or Duration block added +5. Each improved Strength movement added +10, and a Cardio improvement added +20. Recovery awards could repeat by block. Walking-only days received 60% of the day’s Cardio XP. These rules remain attached to older dates.</p>
    </details>
  </div>;
}
