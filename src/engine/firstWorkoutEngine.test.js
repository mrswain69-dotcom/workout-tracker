import { describe, expect, it } from "vitest";
import { cleanProfileName, createFirstActivity, needsFirstWorkoutSetup } from "./firstWorkoutEngine.js";
describe("guided first workout", () => {
  it("creates a timed plan on selected days without recording any results", () => {
    const result = createFirstActivity({name:"Yoga",type:"duration",minutes:"20",days:["Tue","Thu","Tue"]},()=>"activity");
    expect(result.days).toEqual(["Tue","Thu"]);
    expect(result.block).toEqual({id:"activity",typeId:"duration",label:"Yoga",note:"",plannedMinutes:20});
    expect(result.block.duration).toBeUndefined();
  });
  it("preserves paired weight/reps as a planned target", () => {
    const {block} = createFirstActivity({name:"Squat",type:"strength",sets:"3",reps:"10",weight:"20",days:["Mon"]},()=>"id");
    expect(block.movements[0]).toMatchObject({sets:3,reps:"10",trackWeight:true,initialTarget:"10 reps at 20 kg"});
    expect(block.sets).toBeUndefined();
  });
  it.each([{name:"",days:["Mon"]},{name:"Yoga",days:[]},{name:"Yoga",minutes:-20,days:["Mon"]},{name:"Squat",type:"strength",sets:1.5,days:["Mon"]}])("rejects invalid setup %j", draft => expect(()=>createFirstActivity(draft)).toThrow());
  it("does not enrol existing accounts or accounts with training already recorded", () => {
    expect(needsFirstWorkoutSetup({ready:true,onboarding:{status:"complete"}})).toBe(false);
    expect(needsFirstWorkoutSetup({ready:true,onboarding:{status:"not_started"},hasPlan:true})).toBe(false);
    expect(needsFirstWorkoutSetup({ready:true,onboarding:{status:"not_started"},hasActivity:true})).toBe(false);
    expect(needsFirstWorkoutSetup({ready:true,onboarding:{status:"not_started"}})).toBe(true);
    expect(needsFirstWorkoutSetup({ready:true,onboarding:{status:"in_progress",guidedVersion:2},hasPlan:true})).toBe(true);
    expect(needsFirstWorkoutSetup({ready:false,onboarding:{status:"not_started"}})).toBe(false);
  });
  it("normalises a profile name without requiring a legal full name", () => {
    expect(cleanProfileName("  Mike   Swain  ")).toBe("Mike Swain");
  });
});
