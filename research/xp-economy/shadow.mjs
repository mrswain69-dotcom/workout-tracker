// Local read-only replay. Input stays outside the repository; never commit raw logs.
import fs from 'node:fs';
import {evaluate} from './candidates.mjs';
import {buildXpDebugRows} from '../../src/engine/xpEngine.js';
const profiles=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const sum=(rows,key)=>rows.reduce((n,r)=>n+(Number(r[key])||0),0);
const result=profiles.map(p=>{
 const records=p.records||[],options={activationDate:'2026-08-31',todayYmd:'2026-10-12'};
 const old=buildXpDebugRows(records,p.plan_json||{},options),preview=evaluate(records,p.plan_json||{},options);
 const latest=(rows)=>rows.filter(r=>r.date==='2026-10-12').map(r=>Object.fromEntries(['earnedXp','strengthXp','durationXp','progXp','streakXp','dayCompleteXp','warnings'].map(k=>[k,r[k]])));
 const blocks=records.flatMap(r=>r.log?.blocks||[]);
 return {name:p.name,loggedDates:records.length,currentEarned:sum(old,'earnedXp'),previewEarned:sum(preview,'earnedXp'),changePercent:Math.round((sum(preview,'earnedXp')/sum(old,'earnedXp')-1)*1000)/10,currentImprovement:sum(old,'progXp'),previewImprovement:sum(preview,'progXp'),currentCompletionDays:old.filter(r=>r.dayCompleteXp>0).length,previewCompletionDays:preview.filter(r=>r.dayCompleteXp>0).length,classifiedBlocks:blocks.filter(b=>b.activityPurpose).length,totalBlocks:blocks.length,latest:{current:latest(old),preview:latest(preview)},warningDays:preview.filter(r=>r.warnings?.length).length};
});
console.log(JSON.stringify({scope:'read-only replay; hypothetical activation; unmodified logs with existing classification only; not approved awards',window:'2026-08-31 through 2026-10-12',profiles:result},null,2));
