// @vitest-environment jsdom
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProgramNotifications from "./ProgramNotifications.jsx";
import ProgramRecipientControls from "./ProgramRecipientControls.jsx";
import { checkpointComparisons } from "./ProgramCoachReports.jsx";
import { programCheckpointStatus } from "./programCheckpointStatus.js";
afterEach(cleanup);

describe("programme workflow privacy and lifecycle", () => {
  it("clears the prior profile inbox immediately and ignores its late response", async () => {
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    let resolveOld;
    const db = { listProgramNotifications: vi.fn((family, profile) => profile === "old" ? new Promise((r) => { resolveOld = r; }) : Promise.resolve({ data: [{ id: "new", title: "New profile offer", created_at: "2026-10-05", audience: "recipient" }] })),
      readProgramNotification: vi.fn(async () => ({ data: true })) };
    const view = render(<ProgramNotifications familyId="family" profileId="old" db={db} />);
    view.rerender(<ProgramNotifications familyId="family" profileId="new" db={db} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Notifications (1)" })).toBeTruthy());
    resolveOld({ data: [{ id: "old", title: "Old private offer", created_at: "2026-10-05" }] });
    fireEvent.click(screen.getByRole("button", { name: "Notifications (1)" }));
    expect(screen.queryByText("Old private offer")).toBeNull();
    expect(screen.getByText("New profile offer")).toBeTruthy();
  });
  it("reports a failed read and only opens an assignment after read succeeds", async () => {
    const db = { listProgramNotifications: vi.fn(async () => ({ data: [{ id: "n", title: "Programme offered", created_at: "2026-10-05" }] })),
      readProgramNotification: vi.fn(async () => ({ data: false, error: new Error("Offline") })) };
    const open = vi.fn();
    render(<ProgramNotifications familyId="f" profileId="p" db={db} onOpen={open} />);
    fireEvent.click(await screen.findByRole("button", { name: "Notifications (1)" }));
    fireEvent.click(screen.getByRole("button", { name: /Programme offered/ }));
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Offline");
    expect(open).not.toHaveBeenCalled();
    db.readProgramNotification.mockResolvedValue({ data: true });
    fireEvent.click(screen.getByRole("button", { name: /Programme offered/ }));
    await waitFor(() => expect(open).toHaveBeenCalled());
  });
  it("does not falsely enable sharing when the server rejects the change", async () => {
    const db = { listRecipientProgramControls: vi.fn(async () => ({ data: [{ assignment_id: "a", title: "Team plan", can_edit: false, can_copy: false, share_adherence: false, share_assessments: false }] })),
      setProgramReporting: vi.fn(async () => ({ error: new Error("Sharing unavailable") })) };
    render(<ProgramRecipientControls profileId="p" db={db} />);
    const check = await screen.findByRole("checkbox", { name: /adherence/ });
    fireEvent.click(check);
    expect(await screen.findByRole("alert")).toHaveProperty("textContent", "Sharing unavailable");
    expect(check.checked).toBe(false);
    expect(db.setProgramReporting).toHaveBeenCalledWith("a", true, false);
  });
  it("links completion to a checkpoint identity rather than another run of the same Assessment", () => {
    const cp = { id: "cp", due_date: "2026-10-05" };
    const unrelated = [{ status: "completed", program_checkpoint_id: "other" }];
    expect(programCheckpointStatus(cp, unrelated, "2026-10-04").state).toBe("upcoming");
    expect(programCheckpointStatus(cp, unrelated, "2026-10-11").state).toBe("due");
    expect(programCheckpointStatus(cp, unrelated, "2026-10-12").state).toBe("overdue");
    expect(programCheckpointStatus(cp, [{ status: "in_progress", program_checkpoint_id: "cp" }], "2026-10-12").state).toBe("in_progress");
    expect(programCheckpointStatus(cp, [{ status: "completed", program_checkpoint_id: "cp" }], "2026-10-12").state).toBe("completed");
  });
  it("compares outcomes only when the metric and dimensions match", () => {
    const before = { position: 1, name: "Sprint", value: 7, metric: { unit: "s", metricConfig: { distance: 40 } }, dimensions: { overall: 7 } };
    const cp = [{ phase: "Build", timing: "before", completedDate: "2026-10-05", results: [before] }, { phase: "Build", timing: "after", completedDate: "2026-10-11", results: [{ ...before, value: 6 }] }];
    expect(checkpointComparisons(cp)[0].change).toBe(-1);
    cp[1].results[0].metric = { unit: "s", metricConfig: { distance: 20 } };
    expect(checkpointComparisons(cp)[0].change).toBeNull();
  });
});
