// @vitest-environment jsdom
import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App.jsx";
import * as db from "./db.js";

vi.mock("./db.js", async (importOriginal) => {
  const original = await importOriginal();
  const block = { id: "strength", typeId: "strength", label: "Shoulders and Triceps", movements: [{ id: "press", name: "Shoulder Press", sets: 3, trackWeight: true, reps: "12" }] };
  const plan = { version: 3, blocksByWeekday: Object.fromEntries(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => [day, [block]])) };
  return {
    ...original,
    isSupabaseReady: () => true,
    getSession: async () => ({ session: { user: { id: "user" } } }),
    getOrCreateFamily: async () => ({ family: { id: "family", welcome_email_sent_at: "2026-10-01" } }),
    listProfiles: async () => ({ data: [{ id: "paul", name: "Paul", age_group: "adult" }] }),
    listProfileRecoveryPeriods: async () => ({ data: [] }),
    getProfilePlan: async () => ({ data: { plan_json: plan } }),
    listProfileStreakScheduleSnapshots: async () => ({ data: [] }),
    listLogs: vi.fn(async () => ({ data: [] })),
    getLog: vi.fn(async () => ({ data: null })),
    upsertLog: vi.fn(async (_family, _profile, _date, log) => ({ data: { log_json: log } })),
  };
});

beforeEach(() => {
  localStorage.clear(); sessionStorage.clear();
  sessionStorage.setItem("wt_log_navigation_v1", JSON.stringify({ tab: "log", date: "2026-10-01" }));
  vi.mocked(db.getLog).mockReset().mockResolvedValue({ data: null });
  vi.mocked(db.upsertLog).mockReset().mockImplementation(async (_f, _p, _d, log) => ({ data: { log_json: log } }));
  window.scrollTo = vi.fn();
});
afterEach(cleanup);

async function ready() {
  const result = render(<App />);
  await screen.findByText("Shoulder Press");
  return result;
}

function dateInput() { return document.querySelector('.logDateControls input[type="date"]') || document.querySelector('input[type="date"]'); }

describe("actual Log navigation", () => {
  it("restores the Log date and keeps typed reps/weight when leaving and returning", async () => {
    const first = await ready();
    expect(dateInput().value).toBe("2026-10-01");
    const fields = screen.getAllByRole("spinbutton");
    fireEvent.change(fields[0], { target: { value: "12" } });
    fireEvent.change(fields[1], { target: { value: "22.5" } });
    fireEvent.change(dateInput(), { target: { value: "2026-10-02" } });
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe(""));
    fireEvent.change(dateInput(), { target: { value: "2026-10-01" } });
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("12"));
    expect(screen.getAllByRole("spinbutton")[1].value).toBe("22.5");
    await waitFor(() => expect(db.upsertLog).toHaveBeenCalled(), { timeout: 2000 });
    const persisted = vi.mocked(db.upsertLog).mock.calls.at(-1)[3];
    vi.mocked(db.getLog).mockResolvedValue({ data: { log_json: persisted } });
    // The browser refresh should restore the tab, date and saved activity.
    first.unmount();
    await ready();
    expect(dateInput().value).toBe("2026-10-01");
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
    fireEvent.change(dateInput(), { target: { value: "2026-10-02" } });
    await act(async () => finish());
    expect(screen.queryByText("Extra arms")).toBeNull();
    fireEvent.change(dateInput(), { target: { value: "2026-10-01" } });
    await screen.findByText("Extra arms");
    const summary = screen.getByRole("button", { name: /Shoulders and Triceps/ });
    if (summary.getAttribute("aria-expanded") === "false") fireEvent.click(summary);
    await waitFor(() => expect(screen.getAllByRole("spinbutton")[0].value).toBe("12"));
    expect(screen.getAllByRole("spinbutton")[1].value).toBe("22.5");
  });
});
