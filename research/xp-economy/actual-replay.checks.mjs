import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {factsFor,probesFor,replay} from './actual-replay.mjs';
import {activityBase} from './revision-rules.mjs';
const date='2026-10-12';
const block={id:'b',typeId:'strength',movements:[{id:'m',sets:2,trackWeight:true}],sets:{m:[{reps:10,weight:10},{reps:5,weight:10}]}};
const record={date_ymd:date,log:{blocks:[block]}};
test('actual adapter includes retained orphan set data consistently with existing base scorer',()=>{
 const r=structuredClone(record);r.log.blocks[0].sets.orphan=[{reps:12}];assert.equal(activityBase(factsFor(r).facts).strength,11);
});
test('cancellation sensitivity is separate from layout-only scoring',()=>{
 const r=structuredClone(record);r.log.blocks[0].cancelled=true;assert.equal(activityBase(factsFor(r).facts).strength,9);assert.equal(activityBase(factsFor(r,{excludeCancelled:true}).facts).strength,0);
});
test('suspended recovery entries do not earn base XP',()=>{
 const r=structuredClone(record);r.log.blocks[0].suspendedByRecoveryMode=true;assert.equal(activityBase(factsFor(r).facts).total,0);
});
test('empty earlier set does not get renumbered into another ordinal slot',()=>{
 const r=structuredClone(record);r.log.blocks[0].sets.m[0]={};assert.equal(probesFor(r).length,0);
});
test('changing load leaves the repetitions probe incomparable while the fixed-reps load probe can compare',()=>{
 const r=structuredClone(record);r.log.blocks[0].sets.m[0].weight=12;
 const a=probesFor(record),b=probesFor(r);assert.notEqual(a[0].protocol,b[0].protocol);assert.equal(a[1].protocol,b[1].protocol);
});
test('input records and profile state are not mutated by real replay',()=>{
 const p=[{records:[record],plan_json:{}}],old=structuredClone(p);replay(p);assert.deepEqual(p,old);
});
test('serialized report does not leak names, IDs, exercise names or raw logs',()=>{
 const p=[{name:'private-name',id:'secret-id',records:[record],plan_json:{}}];const text=JSON.stringify(replay(p));assert.ok(!text.includes('private-name'));assert.ok(!text.includes('secret-id'));assert.ok(!text.includes('"sets":{'));
});
test('current fixture has a reconciled complete earned-XP decomposition',()=>{
 const r=replay([{records:[record],plan_json:{}}]).profiles[0].latest;
 assert.equal(r.earnedCurrent,r.currentBase+r.legacyStrengthImprovement+r.legacyUnchangedComponents);
 assert.equal(r.layoutOnly,r.revisedBase+r.legacyStrengthImprovement+r.legacyUnchangedComponents);
 assert.equal(r.matchedPreview,r.revisedBase+r.exploratoryStrengthImprovement+r.legacyUnchangedComponents);
});
test('actual saved results reproduce the known October 12 current scores',()=>{
 const report=JSON.parse(fs.readFileSync(new URL('./actual-results.json',import.meta.url)));
 assert.equal(report.profiles[0].latest.earnedCurrent,91);assert.equal(report.profiles[2].latest.earnedCurrent,255);
 assert.equal(report.profiles.reduce((n,p)=>n+p.totalRecords,0),540);
});
test('one prior date gives broader inferred eligibility than a three-date requirement',()=>{
 const s=JSON.parse(fs.readFileSync(new URL('./history-sensitivity.json',import.meta.url))).sensitivity;
 for(let i=0;i<3;i++)assert.ok(s[0].profiles[i].eligible>s[2].profiles[i].eligible);
});
