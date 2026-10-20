// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import FirstWorkoutSetup from "./FirstWorkoutSetup.jsx";
afterEach(cleanup);
describe("first workout setup", () => {
  it("resumes an unfinished activity draft on the same device", () => {
    const key="first-workout-test-draft";localStorage.removeItem(key);
    const first=render(<FirstWorkoutSetup profileName="Mike" draftStorageKey={key} />);
    fireEvent.click(screen.getByRole("button",{name:/Build my own/}));
    fireEvent.change(screen.getByLabelText("Activity name"),{target:{value:"Yoga"}});
    fireEvent.change(screen.getByLabelText("Minutes"),{target:{value:"20"}});
    first.unmount();
    render(<FirstWorkoutSetup profileName="Mike" draftStorageKey={key} />);
    expect(screen.getByLabelText("Activity name").value).toBe("Yoga");
    expect(screen.getByLabelText("Minutes").value).toBe("20");
    localStorage.removeItem(key);
  });
  it("offers three starting routes without applying a programme", () => {
    const onPrograms=vi.fn(),onLog=vi.fn(),onSave=vi.fn();
    render(<FirstWorkoutSetup profileName="Mike" onPrograms={onPrograms} onLog={onLog} onSave={onSave} />);
    fireEvent.click(screen.getByRole("button",{name:/Use a programme/}));
    expect(onPrograms).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button",{name:/Log something today/}));
    expect(onLog).toHaveBeenCalledOnce();expect(onSave).not.toHaveBeenCalled();
  });
  it("saves one activity, supports typing several characters and goes to its planned log", async () => {
    const onSave=vi.fn(async()=>({date:"2026-10-20"})),onLog=vi.fn(),onRename=vi.fn();
    render(<FirstWorkoutSetup profileName="Mike" todayWeekday="Tue" onSave={onSave} onLog={onLog} onRename={onRename} />);
    fireEvent.click(screen.getByRole("button",{name:/Build my own/}));
    fireEvent.change(screen.getByLabelText("Activity name"),{target:{value:"Yoga"}});
    const minutes=screen.getByLabelText("Minutes");
    fireEvent.change(minutes,{target:{value:"2"}});fireEvent.change(minutes,{target:{value:"20"}});
    expect(screen.getByLabelText("Minutes")).toBe(minutes);
    fireEvent.click(screen.getByLabelText("Thu"));
    fireEvent.click(screen.getByRole("button",{name:"Save activity"}));
    await screen.findByRole("heading",{name:"Your plan is ready to use"});
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({name:"Yoga",minutes:"20",days:["Tue","Thu"]}));
    expect(onRename).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button",{name:"Start logging"}));expect(onLog).toHaveBeenCalledWith("2026-10-20");
  });
  it("keeps entered details when saving fails", async () => {
    render(<FirstWorkoutSetup profileName="Mike" onSave={async()=>{throw new Error("Connection lost");}} />);
    fireEvent.click(screen.getByRole("button",{name:/Build my own/}));
    fireEvent.change(screen.getByLabelText("Activity name"),{target:{value:"Yoga"}});
    fireEvent.click(screen.getByRole("button",{name:"Save activity"}));
    await screen.findByRole("alert");expect(screen.getByRole("alert").textContent).toBe("Connection lost");
    expect(screen.getByLabelText("Activity name").value).toBe("Yoga");
    await waitFor(()=>expect(screen.getByRole("button",{name:"Save activity"}).disabled).toBe(false));
  });
});
