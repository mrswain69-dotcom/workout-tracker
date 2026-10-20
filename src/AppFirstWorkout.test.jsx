// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import * as db from "./db.js";
import { isDayGreenForXp, computeXpFromLogs } from "./engine/xpEngine.js";
const state=vi.hoisted(()=>({name:"Athlete",plan:null,onboarding:null,logs:[]}));
vi.mock("./db.js",async(importOriginal)=>({
  ...await importOriginal(),
  isSupabaseReady:()=>true,
  getSession:async()=>({session:{user:{id:"test-user",user_metadata:{first_profile_name:"Mike",first_workout_setup:2}}}}),
  getOrCreateFamily:vi.fn(async()=>({family:{id:"test-family",welcome_email_sent_at:"2026-10-01",onboarding_state:state.onboarding}})),
  listProfiles:vi.fn(async()=>({data:[{id:"test-profile",name:state.name,age_group:"adult",plan_json:state.plan}]})),
  renameProfile:vi.fn(async(_id,name)=>{state.name=name;return {error:null};}),
  listProfileRecoveryPeriods:async()=>({data:[]}),
  getProfilePlan:vi.fn(async()=>({data:{plan_json:state.plan}})),
  upsertProfilePlan:vi.fn(async(_f,_p,plan)=>{state.plan=plan;return {data:{plan_json:plan},error:null};}),
  updateFamilyOnboardingState:vi.fn(async(_f,onboarding)=>{state.onboarding=onboarding;return {data:{id:"test-family",onboarding_state:onboarding,welcome_email_sent_at:"2026-10-01"}};}),
  listProfileStreakScheduleSnapshots:async()=>({data:[]}),
  listLogs:vi.fn(async()=>({data:state.logs})),
  getLog:vi.fn(async(_f,_p,date)=>({data:state.logs.find(row=>row.date_ymd===date)||null})),
  upsertLog:vi.fn(async(_f,_p,date,log)=>{const row={profile_id:"test-profile",date_ymd:date,log_json:log};state.logs=[...state.logs.filter(item=>item.date_ymd!==date),row];return {data:row};}),
}));
beforeEach(()=>{
  localStorage.clear();sessionStorage.clear();window.scrollTo=vi.fn();
  state.name="Athlete";state.plan={version:5,blocksByWeekday:Object.fromEntries(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day=>[day,[]]))};
  state.onboarding={version:1,status:"not_started",step:0};state.logs=[];vi.clearAllMocks();
});
afterEach(cleanup);
describe("new account to first recorded workout",()=>{
  it("uses the signup name, creates one activity and records it without a full weekly setup",async()=>{
    render(<App/>);
    await screen.findByRole("heading",{name:"Let’s make this your plan"});
    expect(db.renameProfile).toHaveBeenCalledWith("test-profile","Mike");
    expect(screen.queryByRole("dialog",{name:"Your week starts blank"})).toBeNull();
    fireEvent.click(screen.getByRole("button",{name:/Build my own/}));
    fireEvent.change(screen.getByLabelText("Activity name"),{target:{value:"Yoga"}});
    fireEvent.change(screen.getByLabelText("Minutes"),{target:{value:"20"}});
    fireEvent.click(screen.getByRole("button",{name:"Save activity"}));
    await screen.findByRole("heading",{name:"Your plan is ready to use"});
    expect(db.upsertProfilePlan).toHaveBeenCalled();
    expect(state.logs).toHaveLength(0);
    fireEvent.click(screen.getByRole("button",{name:"Start logging"}));
    await screen.findByText("Your first recorded session");
    const minutes=await screen.findByRole("spinbutton");
    expect(minutes.value).toBe("");
    fireEvent.change(minutes,{target:{value:"2"}});fireEvent.change(minutes,{target:{value:"20"}});
    expect(screen.getByRole("spinbutton")).toBe(minutes);
    await waitFor(()=>expect(db.upsertLog).toHaveBeenCalled());
    await waitFor(()=>expect(state.logs.some(row=>row.log_json.blocks?.some(block=>Number(block.duration?.minutes)===20))).toBe(true));
    expect(state.onboarding.status).toBe("complete");
  });
  it("does not redirect an established account or rename its profile",async()=>{
    state.name="Paul";state.onboarding={version:1,status:"complete"};
    render(<App/>);
    await screen.findByRole("main",{name:"Performance dashboard"});
    expect(screen.queryByRole("heading",{name:"Let’s make this your plan"})).toBeNull();
    expect(db.renameProfile).not.toHaveBeenCalled();
  });
  it("repeats a previous workout without copying completed sets and keeps its planned set count",async()=>{
    state.name="Paul";state.onboarding={version:1,status:"complete"};
    const yesterday=new Date();yesterday.setDate(yesterday.getDate()-1);
    const previousDate=`${yesterday.getFullYear()}-${String(yesterday.getMonth()+1).padStart(2,"0")}-${String(yesterday.getDate()).padStart(2,"0")}`;
    state.logs=[{profile_id:"test-profile",date_ymd:previousDate,log_json:{blocks:[{id:"old",typeId:"strength",label:"Legs",movements:[{id:"squat",name:"Squat",sets:3,reps:"10",trackWeight:true}],sets:{squat:[{reps:10,weight:20},{reps:10,weight:20},{reps:10,weight:20}]},completedAt:"old"}]}}];
    render(<App/>);
    fireEvent.click(await screen.findByRole("button", {name:/Today’s workout/}));
    fireEvent.click(await screen.findByRole("button",{name:"Repeat a previous workout"}));
    fireEvent.click(await screen.findByRole("button",{name:"Repeat this workout"}));
    const movement=(await screen.findByText("Squat")).closest(".focusedMovement");
    await waitFor(()=>expect(within(movement).getAllByRole("spinbutton")).toHaveLength(6));
    for(const input of within(movement).getAllByRole("spinbutton")) expect(input.value).toBe("");
    const copied=db.upsertLog.mock.calls.at(-1)[3].blocks[0];
    expect(copied.repeatedWorkout).toBe(true);expect(copied.sets).toEqual({});
    expect(copied.completedAt).toBeFalsy();
    expect(isDayGreenForXp({blocks:[copied]})).toBe(false);
    expect(computeXpFromLogs([{date_ymd:"2026-10-20",log:{blocks:[copied]}}],{})).toBe(0);
  });
});
