import fs from 'node:fs';
import {evaluateDay} from './engine.mjs';
const date='2026-10-19';
function strength(n,reps=144,minutes=20){return {date,events:Array.from({length:n},(_,i)=>({id:`s${i}`,purpose:'strength',minutes:minutes/n,reps:reps/n,format:i%2?'session':'blocks'}))};}
function timed(n,purpose,minutes,km=0){return {date,events:Array.from({length:n},(_,i)=>({id:`t${i}`,purpose,minutes:minutes/n,distanceKm:km/n}))};}
const fixtures=[
 ['20-minute strength workout: 1 vs 6 movement groups',strength(1),strength(6)],
 ['20-minute strength workout: 24 vs 240 repetitions',strength(1,24),strength(1,240)],
 ['20-minute mobility: 1 vs 20 blocks',timed(1,'mobility',20),timed(20,'mobility',20)],
 ['3km / 30-minute run: 1 vs 10 blocks',timed(1,'cardio',30,3),timed(10,'cardio',30,3)],
 ['30-minute walk vs same walk plus six-second run',timed(1,'walk',30,3),{date,events:[...timed(1,'walk',30,3).events,{id:'tiny',purpose:'cardio',minutes:.1,distanceKm:.01}]}],
];
const comparison=fixtures.map(([name,a,b])=>({name,workUnits:[evaluateDay(a,'work-units').activityScore,evaluateDay(b,'work-units').activityScore],recordedTime:[evaluateDay(a).activityScore,evaluateDay(b).activityScore]}));
const athletes=[{name:'Steady athlete',activity:80,improvement:20,consistency:100},{name:'Improving athlete',activity:60,improvement:100,consistency:80},{name:'High volume, less consistent',activity:100,improvement:0,consistency:60}];
const weighting=[{name:'50/25/25',weights:[.5,.25,.25]},{name:'60/20/20',weights:[.6,.2,.2]},{name:'80/10/10',weights:[.8,.1,.1]}].map(({name,weights})=>({name,rankings:athletes.map(a=>({name:a.name,score:a.activity*weights[0]+a.improvement*weights[1]+a.consistency*weights[2]})).sort((a,b)=>b.score-a.score)}));
const report={date:'2026-10-13',productionBase:'b0b9ab9018b40df33dd39adbc1b50fb1253ff043',prototypeVersion:'fairness-lab-1',tests:{prototypeTests:33,partitionChecks:1200,existingXpStreakTests:17},comparison,weighting,screenshotComparison:{xander:{observedEarnedXp:255,loggedSets:40,displayedEstimatedMinutes:55,progressWins:15},paul:{observedEarnedXp:91,loggedSets:12,displayedEstimatedMinutes:25,progressWins:3},newAuditedScores:null,reason:'Screenshots lack recorded training time, classified mobility, benchmark baselines and frozen requirements; displayed time includes estimates.'}};
fs.writeFileSync(new URL('./results.json',import.meta.url),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
