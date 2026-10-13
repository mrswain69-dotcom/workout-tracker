// Reads native log shapes for shadow evaluation. Classification and duration
// evidence are passed explicitly; they are never inferred from exercise names.
export function adaptLog(log, date, {classifications={},recordedMinutes={},requirements=[], benchmarkSlots=[],benchmarks=[],history=[],rewardedBenchmarks=[],rewardXp=0}={}) {
  const events=[],warnings=[];
  for(const block of log?.blocks || []) {
    const type=block.typeId;
    const purpose=classifications[block.id] || ({strength:'strength',hiit:'strength',box:'strength',cardio:block.cardioType==='walk'?'walk':'cardio',duration:'mobility',session:'skills',recovery:'recovery',tasks:'tasks'}[type]);
    const flags={purpose,blockId:block.id,cancelled:!!block.cancelled,suspended:!!block.suspendedByRecoveryMode,performedBeforeCancellation:block.performedBeforeCancellation===true};
    const minutes=Number(recordedMinutes[block.id] || 0);
    const requirementKey=block.requirementKey || block.id;
    if(['strength','hiit','box'].includes(type)) {
      const sets=Object.values(block.sets || {}).flat().filter(s=>Number(s?.reps)>0 || Number(s?.timeSeconds)>0 || Number(s?.count)>0);
      const reps=sets.reduce((n,s)=>n+Number(s.reps || s.count || 0),0);
      const seconds=sets.reduce((n,s)=>n+Number(s.timeSeconds || 0),0);
      if(sets.length)events.push({...flags,id:`block:${block.id}`,reps,minutes,seconds:minutes?0:seconds,requirementKey,amount:reps || seconds});
      if(sets.length&&!minutes&&!seconds)warnings.push(`${block.id}: duration is estimated, not recorded`);
    } else if(type==='session') {
      const session=block.session || {};
      const sourceMinutes=minutes || Number(session.actualDurationSec || 0)/60;
      let reps=0;
      for(const movement of session.movements || []) {
        const result=movement.result?.overall || movement.result || {};
        if(movement.trackingMethod==='sets_reps')reps+=(result.sets || []).reduce((n,s)=>n+Number(s.reps || 0),0);
        else if(movement.trackingMethod==='repetitions')reps+=Number(result.count || 0);
      }
      if(sourceMinutes||reps||session.completed)events.push({...flags,id:`block:${block.id}`,minutes:sourceMinutes,reps,completed:!!session.completed,requirementKey,amount:reps||sourceMinutes});
      if(session.completed&&!sourceMinutes)warnings.push(`${block.id}: completed Session has no recorded duration`);
    } else if(type==='cardio') {
      events.push({...flags,id:`block:${block.id}`,minutes:Number(block.cardio?.durationMin || 0),distanceKm:Number(block.cardio?.distanceKm || 0),requirementKey,amount:Number(block.cardio?.durationMin || 0)});
    } else if(type==='duration') {
      events.push({...flags,id:`block:${block.id}`,minutes:Number(block.duration?.minutes || 0),requirementKey,amount:Number(block.duration?.minutes || 0)});
    } else if(type==='recovery') {
      const completed=block.recoveryDone || (block.isProfileRecoveryBlock && block.profileRecoveryMode==='injury' && Number(block.duration?.minutes)>0);
      events.push({...flags,id:`block:${block.id}`,completed:!!completed,requirementKey});
    } else if(type==='tasks') {
      for(const [key,completed] of Object.entries(block.tasksDone || {}))events.push({...flags,id:`task:${block.id}:${key}`,completed:!!completed,taskXp:5});
    } else warnings.push(`${block.id}: unsupported activity type`);
    if(!block.id)warnings.push('Native block lacks a stable ID');
  }
  return {date,events,requirements,benchmarkSlots,benchmarks,history,rewardedBenchmarks,rewardXp,warnings};
}
