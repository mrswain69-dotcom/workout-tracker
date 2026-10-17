// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import * as db from "./db.js";

vi.mock("./db.js", async (importOriginal) => {
  const original = await importOriginal();
  const block = { id: "strength", typeId: "strength", label: "Shoulders and Triceps", movements: [{ id: "press", name: "Shoulder Press", sets: 3, trackWeight: true, reps: "12" }] };
  const blocksByWeekday = Object.fromEntries(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => [day, [block]]));
  const plan = {
    version: 5,
    blocksByWeekday,
    program: {
      version: 1,
      name: "Test program",
      startDate: "2026-09-28",
      completionMode: "repeat",
      phases: [{ id: "phase", name: "Main phase", weeks: [{ id: "week", name: "Week 1", blocksByWeekday }] }],
    },
  };
  return {
    ...original,
    isSupabaseReady: () => true,
    getSession: vi.fn(async () => ({ session: { user: { id: "user" } } })),
    getOrCreateFamily: async () => ({ family: { id: "family", welcome_email_sent_at: "2026-10-01" } }),
    listProfiles: vi.fn(async () => ({ data: [{ id: "paul", name: "Paul", age_group: "adult" }] })),
    listProfileRecoveryPeriods: async () => ({ data: [] }),
    getProfilePlan: vi.fn(async () => ({ data: { plan_json: plan } })),
    listProfileStreakScheduleSnapshots: vi.fn(async () => ({ data: [] })),
    listLogs: vi.fn(async () => ({ data: [] })),
    getLog: vi.fn(async () => ({ data: null })),
    upsertLog: vi.fn(async (_family, _profile, _date, log) => ({ data: { log_json: log } })),
  };
});

const defaultPlanRead = vi.mocked(db.getProfilePlan).getMockImplementation();

beforeEach(() => {
  vi.mocked(db.getSession).mockReset().mockResolvedValue({session:{user:{id:"user"}}});
  vi.mocked(db.getProfilePlan).mockReset().mockImplementation(defaultPlanRead);
  vi.mocked(db.listProfiles).mockClear();
  vi.mocked(db.listProfiles).mockResolvedValue({ data: [{ id: "paul", name: "Paul", age_group: "adult" }] });
  vi.mocked(db.listProfileStreakScheduleSnapshots).mockReset().mockResolvedValue({ data: [] });
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem("wt_log_navigation_v1", JSON.stringify({ tab: "log", date: "2026-10-01" }));
  vi.mocked(db.getLog).mockReset().mockResolvedValue({ data: null });
  vi.mocked(db.listLogs).mockReset().mockResolvedValue({ data: [] });
  vi.mocked(db.upsertLog).mockReset().mockImplementation(async (_f, _p, _d, log) => ({ data: { log_json: log } }));
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

async function ready() {
  const result = render(<App />);
  await screen.findByText("Shoulder Press");
  return result;
}

function dateButton() {
  return document.querySelector(".activityCalendar__trigger");
}

function chooseDate(dateYmd) {
  fireEvent.click(dateButton());
  fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${dateYmd}\\.`) }));
}

describe("actual Log navigation", () => {
  it("refreshes multiple visited days from another device without reloading the page", async () => {
    const payload = (reps) => ({ blocks: [{ id: "strength", typeId: "strength", sets: { press: [{ reps, weight: "25" }] } }] });
    let remoteReps = "10";
    vi.mocked(db.listLogs).mockImplementation(async () => ({ data: ["2026-10-01", "2026-10-02"].map((date) =>
      ({ id: date, profile_id: "paul", date_ymd: date, log_json: payload(remoteReps) })) }));
    vi.mocked(db.getLog).mockImplementation(async () => ({ data: { log_json: payload(remoteReps) } }));
    await ready();
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("10"));
    chooseDate("2026-10-02");
    await waitFor(() => expect(db.getLog).toHaveBeenCalledWith("family", "paul", "2026-10-02"));
    chooseDate("2026-10-01");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("10"));
    remoteReps = "24";
    fireEvent(window, new Event("focus"));
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("24"));
    chooseDate("2026-10-02");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("24"));
  });

  it.each(["calendar", "dashboard"])("keeps saved historical sets visible after a failed date refresh from %s", async (source) => {
    const saved = { blocks: [{ id: "strength", typeId: "strength", label: "Shoulders and Triceps", movements: [{ id: "press", name: "Shoulder Press", sets: 3, trackWeight: true }], sets: { press: [{ reps: "18", weight: "25" }] } }] };
    vi.mocked(db.listLogs).mockResolvedValue({ data: [{ profile_id: "paul", date_ymd: "2026-10-02", log_json: saved }] });
    let finish;
    vi.mocked(db.getLog).mockImplementation(async (_f, _p, date) => date === "2026-10-02"
      ? new Promise((resolve) => { finish = resolve; })
      : { data: null });
    await ready();
    if (source === "dashboard") {
      fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
      fireEvent.click(await screen.findByRole("button", { name: /^2026-10-02\./ }));
    } else chooseDate("2026-10-02");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("18"));
    expect(screen.getAllByRole("spinbutton")[1].value).toBe("25");
    await act(async () => finish({ data: null, error: new Error("Temporary date read failure") }));
    expect(screen.getAllByRole("spinbutton")[0].value).toBe("18");
  });

  it("hydrates the visible date when history arrives after an empty date read", async () => {
    const saved = { blocks: [{ id: "strength", typeId: "strength", sets: { press: [{ reps: "21", weight: "30" }] } }] };
    let finishHistory;
    vi.mocked(db.listLogs).mockImplementation(() => new Promise((resolve) => { finishHistory = resolve; }));
    render(<App />);
    await waitFor(() => expect(db.getLog).toHaveBeenCalledWith("family", "paul", "2026-10-01"));
    await act(async () => finishHistory({ data: [{ profile_id: "paul", date_ymd: "2026-10-01", log_json: saved }] }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("21"));
    expect(screen.getAllByRole("spinbutton")[1].value).toBe("30");
  });

  it("restores the Log date and keeps typed reps/weight when leaving and returning", async () => {
    const first = await ready();
    expect(dateButton().textContent).toContain("01/10/2026");
    const fields = screen.getAllByRole("spinbutton");
    fireEvent.change(fields[0], { target: { value: "12" } });
    fireEvent.change(fields[1], { target: { value: "22.5" } });
    chooseDate("2026-10-02");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe(""));
    chooseDate("2026-10-01");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("12"));
    expect(screen.getAllByRole("spinbutton")[1].value).toBe("22.5");
    await waitFor(() => expect(db.upsertLog).toHaveBeenCalled(), { timeout: 2000 });
    const persisted = vi.mocked(db.upsertLog).mock.calls.at(-1)[3];
    vi.mocked(db.getLog).mockResolvedValue({ data: { log_json: persisted } });
    // The browser refresh should restore the tab, date and saved activity.
    first.unmount();
    await ready();
    expect(dateButton().textContent).toContain("01/10/2026");
    expect(screen.getByRole("button", { name: "Log" }).className).toContain("active");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("12"));
    expect(screen.getAllByRole("spinbutton")[1].value).toBe("22.5");
  });

  it("shows a named extra immediately while its save is still pending, retaining existing sets", async () => {
    await ready();
    const fields = screen.getAllByRole("spinbutton");
    fireEvent.change(fields[0], { target: { value: "12" } });
    fireEvent.change(fields[1], { target: { value: "22.5" } });
    let finish;
    vi.mocked(db.upsertLog).mockImplementationOnce((_f, _p, _d, log) => new Promise((resolve) => { finish = () => resolve({ data: { log_json: log } }); }));
    fireEvent.click(screen.getByRole("button", { name: "+ Extra block for today" }));
    fireEvent.change(screen.getByPlaceholderText("e.g. Extra strength — uses movement name if blank"), { target: { value: "Extra arms" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Extra push-ups"), { target: { value: "Dips" } });
    fireEvent.click(screen.getByRole("button", { name: "+ Add extra block" }));
    await screen.findByText("Extra arms");
    expect(screen.getByText("Extra block added").getAttribute("role")).toBe("status");
    expect(screen.queryByPlaceholderText("e.g. Extra push-ups")).toBeNull();
    expect(screen.getByText("One-day extra · This date only")).toBeTruthy();
    expect(screen.getByText("Dips")).toBeTruthy();
    expect(screen.queryByText("Untitled strength block")).toBeNull();
    await waitFor(() => expect(finish).toBeTypeOf("function"));
    chooseDate("2026-10-02");
    await act(async () => finish());
    expect(screen.queryByText("Extra arms")).toBeNull();
    chooseDate("2026-10-01");
    await screen.findByText("Extra arms");
    const summary = screen.getByRole("button", { name: /Shoulders and Triceps/ });
    if (summary.getAttribute("aria-expanded") === "false") fireEvent.click(summary);
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("12"));
    expect(screen.getAllByRole("spinbutton")[1].value).toBe("22.5");
  });
});


describe("profile switching", () => {
  async function twoProfiles() {
    vi.mocked(db.listProfiles).mockResolvedValue({ data: [
      { id: "paul", name: "Paul", age_group: "adult" },
      { id: "xander", name: "Xander", age_group: "child" },
    ] });
    await ready();
    fireEvent.click(screen.getByRole("button", { name: "Dashboard" }));
  }

  function switchProfile(id) {
    const selector = Array.from(document.querySelectorAll("select"))
      .find((select) => Array.from(select.options).some((option) => option.value === "xander"));
    fireEvent.change(selector, { target: { value: id } });
  }

  it("waits for the selected profile's streak schedule even after its history arrives", async () => {
    await twoProfiles();
    let finishSnapshots;
    vi.mocked(db.listProfileStreakScheduleSnapshots).mockImplementation((profile) => profile === "xander"
      ? new Promise((resolve) => { finishSnapshots = resolve; }) : Promise.resolve({ data: [] }));
    switchProfile("xander");
    await waitFor(() => expect(finishSnapshots).toBeTypeOf("function"));
    await waitFor(() => expect(db.listLogs).toHaveBeenCalledWith("family", "xander", 2000));
    expect(screen.queryByText("Plan history")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading Xander’s data");
    await act(async () => finishSnapshots({ data: [] }));
    await screen.findByText("Plan history");
    expect(screen.queryByText("Loading Xander’s data")).toBeNull();
  });

  it("keeps the dashboard hidden while history is delayed and shows retry after a failed read", async () => {
    await twoProfiles();
    let failHistory;
    vi.mocked(db.listLogs).mockImplementation((_family, profile) => profile === "xander"
      ? new Promise((resolve) => { failHistory = resolve; }) : Promise.resolve({ data: [] }));
    switchProfile("xander");
    await waitFor(() => expect(failHistory).toBeTypeOf("function"));
    expect(screen.queryByText("Plan history")).toBeNull();
    await act(async () => failHistory({ error: new Error("network failed") }));
    await waitFor(() => expect(db.listLogs.mock.calls.filter((call) => call[1] === "xander").length).toBe(2));
    await act(async () => failHistory({ error: new Error("network failed") }));
    await screen.findByRole("button", { name: "Try again" });
    expect(screen.queryByText("Plan history")).toBeNull();
    vi.mocked(db.listLogs).mockResolvedValue({ data: [] });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await screen.findByText("Plan history");
    expect(screen.getByRole("heading", { name: /^Xander/ })).toBeTruthy();
  });

  it("waits for the authoritative plan even when a cached plan exists", async () => {
    await twoProfiles();
    localStorage.setItem("wt_plan_profile_xander", localStorage.getItem("wt_plan_profile_paul"));
    let finishPlan;
    vi.mocked(db.getProfilePlan).mockImplementation((family, profile) => profile === "xander"
      ? new Promise((resolve) => { finishPlan = resolve; }) : defaultPlanRead(family, profile));
    switchProfile("xander");
    await waitFor(() => expect(finishPlan).toBeTypeOf("function"));
    expect(screen.queryByText("Plan history")).toBeNull();
    expect(screen.getByRole("status").textContent).toContain("Loading Xander’s data");
    await act(async () => finishPlan(await defaultPlanRead("family", "xander")));
    await screen.findByText("Plan history");
  });

  it("shows each profile's saved sets after switching back and forth", async () => {
    const saved = (reps) => ({ blocks: [{ id: "strength", typeId: "strength", sets: { press: [{ reps, weight: "30" }] } }] });
    vi.mocked(db.listLogs).mockImplementation(async (_family, profile) => ({ data: [
      { profile_id: profile, date_ymd: "2026-10-01", log_json: saved(profile === "paul" ? "12" : "21") },
    ] }));
    await twoProfiles();
    switchProfile("xander");
    await screen.findByRole("heading", { name: /^Xander/ });
    fireEvent.click(screen.getByRole("button", { name: "Log" }));
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("21"));
    switchProfile("paul");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("12"));
    switchProfile("xander");
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("21"));
  });

  it("does not clear a loaded profile when the existing selection is chosen again", async () => {
    await twoProfiles();
    const readCount = db.listLogs.mock.calls.length;
    switchProfile("paul");
    await act(async () => {});
    expect(screen.getByText("Plan history")).toBeTruthy();
    expect(db.listLogs.mock.calls.length).toBe(readCount);
  });
});

describe('pending log recovery in the actual app',()=>{
  it('restores failed edits after remount, retries, and clears only after server confirmation',async()=>{
    vi.mocked(db.upsertLog).mockResolvedValue({error:new Error('Offline')});
    const first=await ready();
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'17'}});
    fireEvent.change(screen.getAllByRole('spinbutton')[1],{target:{value:'24.5'}});
    await screen.findByText('Saved on this device · waiting to sync',{}, {timeout:2500});
    await waitFor(()=>expect(db.upsertLog).toHaveBeenCalled(),{timeout:2500});
    await waitFor(()=>expect(screen.queryByText('Syncing…')).toBeNull());
    const pendingKeys=()=>Object.keys(localStorage).filter(k=>k.startsWith('wt_log_outbox_v1:'));
    expect(pendingKeys()).toHaveLength(1);
    first.unmount();
    // The server has no row: only the durable local draft can restore these values.
    await ready();
    await waitFor(()=>expect(screen.getAllByRole('spinbutton')[0].value).toBe('17'));
    expect(screen.getAllByRole('spinbutton')[1].value).toBe('24.5');
    await waitFor(()=>expect(screen.queryByText('Syncing…')).toBeNull());
    vi.mocked(db.upsertLog).mockImplementation(async(_f,_p,_d,log)=>({data:{id:'saved-row',log_json:log}}));
    fireEvent.click(screen.getByRole('button',{name:'Retry sync'}));
    await waitFor(()=>expect(pendingKeys()).toHaveLength(0));
    expect(screen.getAllByRole('spinbutton')[0].value).toBe('17');
    // No full history download per save: one initial load per mounted app.
    expect(db.listLogs).toHaveBeenCalledTimes(2);
  });
  it('retains interrupted requests for retry on reconnection',async()=>{
    vi.mocked(db.upsertLog).mockRejectedValue(new Error('Connection lost'));
    await ready();
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'19'}});
    await waitFor(()=>expect(db.upsertLog).toHaveBeenCalled(),{timeout:2500});
    await screen.findByText('Saved on this device · waiting to sync');
    vi.mocked(db.upsertLog).mockImplementation(async(_f,_p,_d,log)=>({data:{log_json:log}}));
    fireEvent(window,new Event('online'));
    await waitFor(()=>expect(Object.keys(localStorage).filter(k=>k.startsWith('wt_log_outbox_v1:'))).toHaveLength(0));
    expect(screen.getAllByRole('spinbutton')[0].value).toBe('19');
  });
});

it('never replays signed-out account drafts into a different signed-in account',async()=>{
  vi.mocked(db.upsertLog).mockResolvedValue({error:new Error('Offline')});
  await ready();
  fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'23'}});
  await waitFor(()=>expect(db.upsertLog).toHaveBeenCalled(),{timeout:2500});
  const calls=db.upsertLog.mock.calls.length;
  await act(async()=>window.dispatchEvent(new CustomEvent('wt-auth-state',{detail:{event:'SIGNED_OUT',session:null}})));
  expect(screen.queryByText('Shoulder Press')).toBeNull();
  fireEvent(window,new Event('online'));
  expect(db.upsertLog).toHaveBeenCalledTimes(calls);
  vi.mocked(db.getSession).mockResolvedValue({session:{user:{id:'other-user'}}});
  await act(async()=>window.dispatchEvent(new CustomEvent('wt-native-auth',{detail:{session:{user:{id:'other-user'}}}})));
  await screen.findByText('Shoulder Press');
  expect(screen.getAllByRole('spinbutton')[0].value).toBe('');
  fireEvent(window,new Event('online'));
  expect(db.upsertLog).toHaveBeenCalledTimes(calls);
});

describe('versioned log conflict review',()=>{
  afterEach(()=>vi.unstubAllEnvs());
  const dayLog=reps=>({blocks:[{id:'strength',typeId:'strength',label:'Shoulders and Triceps',movements:[{id:'press',name:'Shoulder Press',sets:3,trackWeight:true}],sets:{press:[{reps:String(reps),weight:'25'}]}}]});
  async function versionedReady() {
    vi.stubEnv('VITE_LOG_SYNC_MODE','versioned');
    const row={id:'day-row',profile_id:'paul',date_ymd:'2026-10-01',row_version:3,log_json:dayLog(10)};
    vi.mocked(db.listLogs).mockResolvedValue({data:[row]});vi.mocked(db.getLog).mockResolvedValue({data:row});
    await ready();await waitFor(()=>expect(screen.getAllByRole('spinbutton')[0].value).toBe('10'));
  }
  it('retains local entries on conflict and lets the user choose the account version',async()=>{
    await versionedReady();
    const remote={id:'day-row',profile_id:'paul',date_ymd:'2026-10-01',row_version:4,log_json:dayLog(12)};
    vi.mocked(db.upsertLog).mockResolvedValue({conflict:{row:remote}});
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'15'}});
    fireEvent.click(await screen.findByRole('button',{name:'Review saved changes'},{timeout:2500}));
    expect(screen.getByRole('dialog',{name:'Review workout changes'})).toBeTruthy();
    expect(screen.getByText('15 reps · 25 kg')).toBeTruthy();expect(screen.getByText('12 reps · 25 kg')).toBeTruthy();
    expect(db.upsertLog.mock.calls.at(-1)[4].expectedVersion).toBe(3);
    fireEvent.click(screen.getByRole('button',{name:'Use account version'}));
    await waitFor(()=>expect(screen.getAllByRole('spinbutton')[0].value).toBe('12'));
    expect(Object.keys(localStorage).filter(k=>k.startsWith('wt_log_outbox_v1:'))).toHaveLength(0);
    fireEvent(window,new Event('online'));expect(db.upsertLog).toHaveBeenCalledTimes(1);
  });
  it('uses the reviewed server version when the user explicitly keeps their entries',async()=>{
    await versionedReady();
    const remote={id:'day-row',row_version:4,log_json:dayLog(12)};
    vi.mocked(db.upsertLog).mockResolvedValueOnce({conflict:{row:remote}}).mockImplementation(async(_f,_p,_d,log)=>({data:{id:'day-row',row_version:5,log_json:log}}));
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'15'}});
    fireEvent.click(await screen.findByRole('button',{name:'Review saved changes'},{timeout:2500}));
    fireEvent.click(screen.getByRole('button',{name:'Keep my entries'}));
    await waitFor(()=>expect(db.upsertLog).toHaveBeenCalledTimes(2));
    expect(db.upsertLog.mock.calls[1][4].expectedVersion).toBe(4);
    await waitFor(()=>expect(Object.keys(localStorage).filter(k=>k.startsWith('wt_log_outbox_v1:'))).toHaveLength(0));
    expect(screen.getAllByRole('spinbutton')[0].value).toBe('15');
  });
  it('uses the version from a clean cross-device refresh after a local save',async()=>{
    await versionedReady();
    let remote={id:'day-row',profile_id:'paul',date_ymd:'2026-10-01',row_version:3,log_json:dayLog(10)};
    vi.mocked(db.listLogs).mockImplementation(async()=>({data:[remote]}));
    vi.mocked(db.getLog).mockImplementation(async()=>({data:remote}));
    vi.mocked(db.upsertLog).mockImplementation(async(_f,_p,_d,log)=>{
      remote={...remote,row_version:remote.row_version+1,log_json:log};return {data:remote};
    });
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'15'}});
    await waitFor(()=>expect(Object.keys(localStorage).filter(k=>k.startsWith('wt_log_outbox_v1:'))).toHaveLength(0),{timeout:2500});
    remote={...remote,row_version:6,log_json:dayLog(24)};
    fireEvent(window,new Event('focus'));
    await waitFor(()=>expect(screen.getAllByRole('spinbutton')[0].value).toBe('24'));
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'25'}});
    await waitFor(()=>expect(db.upsertLog).toHaveBeenCalledTimes(2),{timeout:2500});
    expect(db.upsertLog.mock.calls[1][4].expectedVersion).toBe(6);
  });
  it('advances the next local write after an earlier in-flight save succeeds',async()=>{
    await versionedReady();let finish;let version=3;
    vi.mocked(db.upsertLog).mockImplementationOnce((_f,_p,_d,log)=>new Promise(resolve=>{finish=()=>resolve({data:{row_version:++version,log_json:log}});})).mockImplementation(async(_f,_p,_d,log)=>({data:{row_version:++version,log_json:log}}));
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'15'}});
    await waitFor(()=>expect(finish).toBeTypeOf('function'),{timeout:2500});
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'16'}});
    await act(async()=>finish());
    await waitFor(()=>expect(db.upsertLog).toHaveBeenCalledTimes(2),{timeout:2500});
    expect(db.upsertLog.mock.calls[1][4].expectedVersion).toBe(4);
    await waitFor(()=>expect(Object.keys(localStorage).filter(k=>k.startsWith('wt_log_outbox_v1:'))).toHaveLength(0));
    fireEvent.change(screen.getAllByRole('spinbutton')[0],{target:{value:'17'}});
    await waitFor(()=>expect(db.upsertLog).toHaveBeenCalledTimes(3),{timeout:2500});
    expect(db.upsertLog.mock.calls[2][4].expectedVersion).toBe(5);
  });
});
