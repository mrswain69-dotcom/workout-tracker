import { describe, expect, it } from "vitest";
import { lastWorkoutComparison, lastRepeatableWorkout, summariseRecordedSets, repeatableWorkoutBlocks } from "./workoutComparisonEngine.js";
const movement={id:"squat",name:"Squat",trackWeight:true};
const strength={id:"strength",typeId:"strength",movements:[movement],sets:{squat:[{reps:10,weight:20},{reps:8,weight:25}]}};
describe("workout comparisons and safe repetition", () => {
  it("keeps each recorded weight/reps pair together", () => expect(summariseRecordedSets(strength.sets.squat)).toBe("10 reps at 20 kg · 8 reps at 25 kg"));
  it("ignores today, future and cancelled activity", () => {
    const result=lastWorkoutComparison({movement,before:"2026-10-20",logs:[
      {date_ymd:"2026-10-21",log:{blocks:[strength]}},
      {date_ymd:"2026-10-20",log:{blocks:[strength]}},
      {date_ymd:"2026-10-19",log:{blocks:[{...strength,cancelled:true}]}},
      {date_ymd:"2026-10-18",log:{blocks:[strength]}},
    ]});
    expect(result).toEqual({date:"2026-10-18",text:"10 reps at 20 kg · 8 reps at 25 kg"});
  });
  it("does not compare mismatched units or cardio sports", () => {
    expect(lastWorkoutComparison({movement:{...movement,weightUnit:"lb"},before:"2026-10-20",logs:[{date:"2026-10-19",log:{blocks:[strength]}}]})).toBeNull();
    expect(lastWorkoutComparison({block:{id:"run",typeId:"cardio",cardioType:"cycle"},before:"2026-10-20",logs:[{date:"2026-10-19",log:{blocks:[{id:"run",typeId:"cardio",cardioType:"run",cardio:{distanceKm:5,durationMin:30}}]}}]})).toBeNull();
  });
  it("compares duration activity without treating more minutes as an automatic improvement", () => {
    expect(lastWorkoutComparison({block:{id:"yoga",typeId:"duration"},before:"2026-10-20",logs:[{date:"2026-10-19",log:{blocks:[{id:"yoga",typeId:"duration",duration:{minutes:18}}]}}]})).toEqual({date:"2026-10-19",text:"18 min"});
  });
  it("repeats structure without copying results, provider evidence or completion", () => {
    const log={blocks:[{...strength,completedAt:"old",verifiedActivityId:"provider",isExtra:true},{id:"yoga",typeId:"duration",plannedMinutes:20,duration:{minutes:18},cancelled:false},{id:"rest",typeId:"recovery",recoveryDone:true}]};
    const source=JSON.stringify(log);const result=repeatableWorkoutBlocks(log);
    expect(result).toHaveLength(2);
    for(const block of result) for(const key of ["sets","duration","completedAt","verifiedActivityId","isExtra","recoveryDone"]) expect(block[key]).toBeUndefined();
    expect(result[0].movements[0].id).toBe("squat");
    expect(JSON.stringify(log)).toBe(source);
    expect(lastRepeatableWorkout([{date:"2026-10-19",log},{date:"2026-10-20",log}],"2026-10-20").date).toBe("2026-10-19");
  });
});
