import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildXpDebugRows} from '../../src/engine/xpEngine.js';
import {evaluateBonusCaps} from './bonus-cap.mjs';
const profiles=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const start='2026-09-12',end='2026-10-12',sum=(rows,key)=>rows.reduce((n,r)=>n+(r[key]||0),0);
let componentChecks=0,historyChecks=0;
const results=profiles.map((p,i)=>{
 const options={todayYmd:end,scheduleSnapshots:p.scheduleSnapshots||p.schedulesnapshots||[]};
 const old=buildXpDebugRows(p.records,p.plan_json,options);
 const preview=evaluateBonusCaps(p.records,p.plan_json,{...options,activationDate:'2025-01-01'});
 const strict=evaluateBonusCaps(p.records,p.plan_json,{...options,activationDate:'2025-01-01',completion:'required-work'});
 assert.deepEqual(evaluateBonusCaps(p.records,p.plan_json,{...options,activationDate:'2026-10-19'}),old);historyChecks+=p.records.length;
 for(let j=0;j<old.length;j++){for(const key of ['sessionXp','strengthProgressXp','cardioProgressXp','tasksXp','dayCompleteXp','dailyBonusXp','streakXp','bonusXp']){assert.equal(old[j][key],preview[j][key]);componentChecks++;}}
 const window=rs=>rs.filter(r=>r.date>=start&&r.date<=end),latest=rs=>rs.find(r=>r.date===end&&r.kind==='blocks');
 const a=window(old),b=window(preview),c=window(strict);
 const unknowns={strength:0,cardio:0,duration:0};for(const r of c)for(const key of Object.keys(unknowns))unknowns[key]+=r.bonusEligibility?.unknown[key]||0;
 const fullRemoval={strength:sum(old,'strengthXp')-sum(preview,'strengthXp'),cardio:sum(old,'cardioXp')-sum(preview,'cardioXp'),duration:sum(old,'durationXp')-sum(preview,'durationXp'),recovery:sum(old,'recoveryXp')-sum(preview,'recoveryXp')};
 const decomposition={strength:sum(a,'strengthXp')-sum(b,'strengthXp'),cardio:sum(a,'cardioXp')-sum(b,'cardioXp'),duration:sum(a,'durationXp')-sum(b,'durationXp'),recovery:sum(a,'recoveryXp')-sum(b,'recoveryXp')};
 const weeks=new Map();for(const r of a){const d=new Date(r.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()-(d.getUTCDay()+6)%7);const key=d.toISOString().slice(0,10),w=weeks.get(key)||{week:key,current:0,bonusCapped:0};w.current+=r.earnedXp;w.bonusCapped+=b.find(x=>x.date===r.date&&x.kind===r.kind)?.earnedXp||0;weeks.set(key,w);}
 return {alias:String.fromCharCode(65+i),records:p.records.length,currentEarned:sum(a,'earnedXp'),cappedEarned:sum(b,'earnedXp'),removed:sum(a,'earnedXp')-sum(b,'earnedXp'),changePercent:Math.round((sum(b,'earnedXp')/sum(a,'earnedXp')-1)*1000)/10,decomposition,fullHistoryRemoval:fullRemoval,strictCompletionSensitivity:{earned:sum(c,'earnedXp'),unknownTargets:unknowns,notAnApprovedAward:true},latest:latest(old)?{current:latest(old).earnedXp,capped:latest(preview).earnedXp,removed:latest(old).earnedXp-latest(preview).earnedXp,strict:latest(strict).earnedXp}:null,weekly:[...weeks.values()].sort((a,b)=>a.week.localeCompare(b.week))};
});
const output={status:'read-only hypothetical replay; production and all existing historical awards unchanged',baseCommit:'b0b9ab9018b40df33dd39adbc1b50fb1253ff043',window:{start,end},rules:['strength/cardio/duration each receive one daily five-XP category award','base set/minute/distance XP unchanged including current per-block rounding and walking multiplier','completed Sessions remain ten each','recovery/illness/physio share one daily award: highest qualifying value five or ten','progression, task, daily claim, completion, streak and cosmetic awards unchanged'],completionInterpretation:'main comparison uses existing active-block award eligibility; strict required-work sensitivity is separately reported with missing targets flagged',checks:{componentChecks,historyChecks},results};
fs.writeFileSync(process.argv[3],JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
