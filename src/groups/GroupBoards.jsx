import React, { useState } from 'react';
import GroupWeeklyXp from './GroupWeeklyXp.jsx';
import GroupConsistency from './GroupConsistency.jsx';
import GroupImprovement from './GroupImprovement.jsx';
import GroupSeasons from './GroupSeasons.jsx';
import GroupChallenges from "./GroupChallenges.jsx";
import GroupTeamView from './GroupTeamView.jsx';
import './GroupBoards.css';

const tabs = [{id:'xp',label:'XP'}, {id:'consistency',label:'Discipline'}, {id:'improvement',label:'Improvement'}, {id:'challenges',label:'Challenges'}, {id:'awards',label:'Awards'}];
export default function GroupBoards({ group, membership, isAdmin, onGroupChanged, onOpenIdentity, directory }) {
 const [metric,setMetric]=useState('xp');
 const [period,setPeriod]=useState('current');
 const team=group.group_type==='squad' || group.group_type==='club';
 const boards=team ? [...tabs,{id:'team',label:'Team'}] : tabs;
 const scored=['xp','consistency','improvement'].includes(metric);
 const shared={group,membership,onOpenIdentity,directory};
 function selectTab(next) { setMetric(next); }
 return <div className="groupBoards">
  <nav className="groupBoardTabs" aria-label="Group boards">
   {boards.map(tab=><button type="button" key={tab.id} aria-pressed={metric===tab.id} onClick={()=>selectTab(tab.id)}>{tab.label}</button>)}
  </nav>
  {scored ? <div className="groupBoardControls"><label>Period <select aria-label="Leaderboard period" value={period} onChange={event=>setPeriod(event.target.value)}>
   <option value="current">This week</option><option value="history">Previous weeks</option><option value="month">Month</option><option value="season">8-week season</option>
  </select></label></div> : null}
  <div className="groupBoardSurface" role="region" aria-label={`${boards.find(tab=>tab.id===metric)?.label} board`}>
   {scored && ['month','season'].includes(period) ? <GroupSeasons {...shared} boardMetric={metric} boardPeriod={period} display="standings" /> : null}
   {metric==='xp' && !['month','season'].includes(period) ? <GroupWeeklyXp {...shared} isAdmin={isAdmin} onGroupChanged={onGroupChanged} periodMode={period} /> : null}
   {metric==='consistency' && !['month','season'].includes(period) ? <GroupConsistency {...shared} periodMode={period} /> : null}
   {metric==='improvement' && !['month','season'].includes(period) ? <GroupImprovement {...shared} periodMode={period} /> : null}
   {metric==='challenges' ? <GroupChallenges group={group} membership={membership} isAdmin={isAdmin} /> : null}
   {metric==='awards' ? <GroupSeasons {...shared} display="awards" /> : null}
   {metric==='team' ? <GroupTeamView {...shared} /> : null}
  </div>
 </div>;
}
