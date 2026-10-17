import { describe, expect, it } from 'vitest';
import { createLogOutbox, LOG_OUTBOX_PREFIX } from './logOutbox.js';
function storage() {
 const data=new Map();return {get length(){return data.size;},key:i=>[...data.keys()][i],getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
}
const input={ownerId:'owner',familyId:'family',profileId:'athlete',dateKey:'2026-10-17',log:{blocks:[{id:'run',cardio:{durationMin:'32'}}]}};
describe('durable log outbox',()=>{
 it('restores an interrupted edit in a new process only for its owner and allowed profile',()=>{
  const store=storage();createLogOutbox(store).put(input);const restored=createLogOutbox(store);
  expect(restored.list('owner','family',['athlete'])[0].log).toEqual(input.log);
  expect(restored.list('other','family',['athlete'])).toEqual([]);
  expect(restored.list('owner','other',['athlete'])).toEqual([]);
  expect(restored.list('owner','family',['other'])).toEqual([]);
 });
 it('does not acknowledge away an edit made while a request was running',()=>{
  const box=createLogOutbox(storage());const first=box.put(input);const second=box.put({...input,log:{blocks:[]}});
  expect(box.acknowledge(first)).toBe(false);expect(box.list('owner','family')).toEqual([second]);
  expect(box.acknowledge(second)).toBe(true);expect(box.list('owner','family')).toEqual([]);
 });
 it('does not erase another tab’s newer edit on acknowledgement',()=>{
  const store=storage();const a=createLogOutbox(store),b=createLogOutbox(store);const old=a.put(input);const next=b.put({...input,log:{blocks:[]}});
  expect(a.acknowledge(old)).toBe(false);expect(a.list('owner','family')).toEqual([next]);
 });
 it('reports volatile storage instead of claiming a draft survives restart',()=>{
  const box=createLogOutbox({setItem(){throw new Error('Quota exceeded');},getItem(){return null;}});
  const e=box.put(input);expect(box.isDurable(e)).toBe(false);expect(box.list('owner','family')).toEqual([e]);
 });
 it('ignores malformed journal data and snapshots mutable payloads',()=>{
  const store=storage();store.setItem(LOG_OUTBOX_PREFIX+'bad','{');const box=createLogOutbox(store);const log={blocks:[]};const e=box.put({...input,log});log.blocks.push({id:'later'});
  expect(e.log.blocks).toEqual([]);expect(box.list('owner','family')).toHaveLength(1);
 });
});
it('keeps the latest edit writable when storage fills after an older draft was stored',()=>{
 const store=storage();const box=createLogOutbox(store);const old=box.put(input);
 store.setItem=()=>{throw new Error('Quota');};
 const latest=box.put({...input,log:{blocks:[{id:'new'}]}});
 expect(box.isCurrent(latest)).toBe(true);expect(box.isCurrent(old)).toBe(false);
 expect(box.list('owner','family')[0].log.blocks[0].id).toBe('new');
});
