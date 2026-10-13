import React, { useState } from 'react';
import { XP_RULES_ACTIVATION_DATE, xpRuleVersionForDate } from '../../engine/xpRuleVersions.js';
import './XpLedger.css';
const columns = [
  ['Earned','earnedXp'], ['Bonus','bonusXp'], ['Total','totalXp'], ['Balance','runningTotalXp'],
  ['Strength','strengthXp'], ['Cardio','cardioXp'], ['Duration','durationXp'], ['Session','sessionXp'],
  ['Recovery','recoveryXp'], ['Tasks','tasksXp'], ['Day','dayCompleteXp'], ['Daily','dailyBonusXp'],
  ['Improvement','progXp'], ['PB','personalBestXp'], ['Streak','streakXp'], ['Rewards',null],
];
const format = value => Number(value || 0).toLocaleString('en-GB');
function progressionText(row) {
  return (row.progressionDetails || []).map(d=>`${d.label}: ${d.percent.toFixed(2)}% ${d.kind==='cardio'?'faster':'improvement'}, ${d.xp} XP`).join('; ');
}
export default function XpLedger({ rows = [] }) {
  const [limit,setLimit] = useState(21);
  const visible = rows.slice(0,limit);
  return <>
    <p className="xpRulesChange mini"><b>XP rule change · {XP_RULES_ACTIVATION_DATE}</b><br/>v4 applies to activity from this date. Earlier dates use v3. Editing an older log uses its original rules.</p>
    <div className="xpLedgerScroll mt12">
      <table className="table xpLedgerTable">
        <thead><tr><th>Date / rules</th>{columns.map(([label])=><th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{visible.map((row,index)=>{
          const version = row.ruleVersion || xpRuleVersionForDate(row.date);
          const previous = index ? visible[index-1].ruleVersion || xpRuleVersionForDate(visible[index-1].date) : null;
          return <React.Fragment key={`${row.date}-${row.kind || 'xp'}-${index}`}>
            {previous === 4 && version === 3 && <tr className="xpLedgerBoundary"><td colSpan={columns.length+1}>Revised rules began {XP_RULES_ACTIVATION_DATE} ↑ · Previous rules below ↓</td></tr>}
            <tr><th scope="row">{row.date}<small className="xpLedgerVersion">v{version}</small></th>
              {columns.map(([label,key])=><td key={label} title={key==='progXp'?progressionText(row):key==='personalBestXp'?'Established PB award, once per day':key==='cardioXp'&&row.cardioMode==='mixed'?'Walking work at 60%; other Cardio at the standard rate':undefined}>
                {key==='earnedXp'?<b>{format(row[key])}</b>:format(key?row[key]:Number(row.badgeClaimXp || 0)+Number(row.challengeRewardXp || 0))}
                {key==='cardioXp'&&row.cardioMode==='casual'?' *':''}
              </td>)}
            </tr>
            {!!row.progressionDetails?.length && <tr className="xpLedgerDetail"><td colSpan={columns.length+1}>{progressionText(row)}. Only the highest award in each category counts.</td></tr>}
          </React.Fragment>;
        })}</tbody>
      </table>
    </div>
    {rows.length > limit && <button type="button" className="btn mt8" onClick={()=>setLimit(n=>n+21)}>Show older XP dates</button>}
    {!rows.length && <p className="mini muted">Your XP receipts will appear here when you record activity or claim a reward.</p>}
    <p className="mini muted mt8">* Walking-only Cardio earns 60% of its normal rate. Earned XP counts in Groups; Bonus XP contributes to Total XP and reward unlocks.</p>
  </>;
}
