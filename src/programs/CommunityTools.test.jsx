// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./communityDiscoveryDb.js", () => ({ communityContext: vi.fn(), bookmarkCommunity: vi.fn(), voteCommunity: vi.fn(), copyCommunity: vi.fn(), reportCommunity: vi.fn(), listCommunityReports: vi.fn(), reviewCommunityReport: vi.fn() }));
import * as db from "./communityDiscoveryDb.js";
import { CommunityModeration, CommunityProgramTools, CommunityReportForm } from "./CommunityTools.jsx";
const program = { id: "programme", title: "Sprint plan", current_version_id: "v1", purpose: "Speed" };
const context = { programmes: [{ program_id: "programme", allow_copy: true, can_vote: true, helpful: 2, not_helpful: 0, my_vote: null }], bookmarks: [], reviewer: false };
beforeEach(() => {
  vi.clearAllMocks(); db.communityContext.mockResolvedValue({ data: context });
  for (const name of ["bookmarkCommunity", "voteCommunity", "copyCommunity", "reportCommunity", "reviewCommunityReport"]) db[name].mockResolvedValue({ data: name === "copyCommunity" ? "private-copy" : true });
  db.listCommunityReports.mockResolvedValue({ data: [] });
});
afterEach(cleanup);
describe("Community member controls", () => {
  it("saves for the selected profile and gives confirmation", async () => {
    render(<CommunityProgramTools profileId="wilf" program={program} authorize={async () => true} onCopied={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Save for later").disabled).toBe(false));
    fireEvent.click(screen.getByText("Save for later"));
    expect(await screen.findByText("Saved for later. Your active plan is unchanged.")).toBeTruthy();
    expect(db.bookmarkCommunity).toHaveBeenCalledWith("wilf", "programme", true);
  });
  it("honours no-copy permissions and prevents self-voting", async () => {
    db.communityContext.mockResolvedValue({ data: { ...context, programmes: [{ ...context.programmes[0], allow_copy: false, can_vote: false }] } });
    render(<CommunityProgramTools profileId="paul" program={program} />);
    await screen.findByText(/has not allowed personal library copies/);
    expect(screen.getByText("Copy and adapt").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Helpful" }).disabled).toBe(true);
  });
  it("allows removing an existing vote", async () => {
    db.communityContext.mockResolvedValue({ data: { ...context, programmes: [{ ...context.programmes[0], my_vote: true }] } });
    render(<CommunityProgramTools profileId="wilf" program={program} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Helpful" }).getAttribute("aria-pressed")).toBe("true"));
    fireEvent.click(screen.getByRole("button", { name: "Helpful" }));
    await waitFor(() => expect(db.voteCommunity).toHaveBeenCalledWith("wilf", program, null));
  });
  it("copies only after naming the copy, without applying a plan", async () => {
    const copied = vi.fn(); render(<CommunityProgramTools profileId="wilf" program={program} onCopied={copied} />);
    await waitFor(() => expect(screen.getByText("Copy and adapt").disabled).toBe(false));
    fireEvent.click(screen.getByText("Copy and adapt"));
    fireEvent.change(screen.getByLabelText("Name your personal copy"), { target: { value: "My speed programme" } });
    fireEvent.click(screen.getByText("Create personal copy"));
    await waitFor(() => expect(copied).toHaveBeenCalledWith("private-copy"));
    expect(db.copyCommunity).toHaveBeenCalledWith("wilf", program, "My speed programme");
  });
  it("does not mutate when profile authorisation is denied", async () => {
    render(<CommunityProgramTools profileId="wilf" program={program} authorize={async () => false} />);
    await waitFor(() => expect(screen.getByText("Save for later").disabled).toBe(false));
    fireEvent.click(screen.getByText("Save for later"));
    await waitFor(() => expect(db.bookmarkCommunity).not.toHaveBeenCalled());
  });
  it("submits a private creator report with clear acknowledgement", async () => {
    render(<CommunityReportForm profileId="wilf" target={{ creatorId: "creator", name: "Coach" }} onClose={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("What should we review?"), { target: { value: "Please check this claimed certification." } });
    fireEvent.click(screen.getByText("Submit report"));
    expect(await screen.findByText("Report submitted privately for review. Thank you.")).toBeTruthy();
    expect(db.reportCommunity).toHaveBeenCalledWith("wilf", { creatorId: "creator", name: "Coach" }, "safety", "Please check this claimed certification.");
  });
  it("surfaces backend failures instead of silently reverting", async () => {
    db.bookmarkCommunity.mockResolvedValue({ error: new Error("Programme is no longer available") });
    render(<CommunityProgramTools profileId="wilf" program={program} />);
    await waitFor(() => expect(screen.getByText("Save for later").disabled).toBe(false)); fireEvent.click(screen.getByText("Save for later"));
    expect(await screen.findByText("Programme is no longer available")).toBeTruthy();
  });
  it("ignores a late response from a previous selected profile", async () => {
    let finish; db.communityContext.mockImplementation((id) => id === "old" ? new Promise((r) => { finish = r; }) : Promise.resolve({ data: context }));
    const view = render(<CommunityProgramTools profileId="old" program={program} />);
    view.rerender(<CommunityProgramTools profileId="new" program={program} />);
    await waitFor(() => expect(screen.getByText("Save for later").disabled).toBe(false));
    finish({ data: { ...context, programmes: [{ ...context.programmes[0], allow_copy: false }] } });
    await waitFor(() => expect(screen.getByText("Copy and adapt").disabled).toBe(false));
  });
});
describe("moderation controls", () => {
  it("requires a decision note and records the reviewer action", async () => {
    db.listCommunityReports.mockResolvedValue({ data: [{ id: "report", target_name: "Sprint plan", reason: "safety", status: "open", details: "A concern to check", created_at: "2026-10-08", actions: [] }] });
    render(<CommunityModeration authorize={async () => true} />);
    await screen.findByText("Sprint plan · safety · open");
    fireEvent.click(screen.getByText("Sprint plan · safety · open"));
    expect(screen.getByText("Save review decision").disabled).toBe(true);
    fireEvent.change(screen.getByLabelText("Private decision note"), { target: { value: "Reviewing the evidence provided." } });
    fireEvent.click(screen.getByText("Save review decision"));
    await waitFor(() => expect(db.reviewCommunityReport).toHaveBeenCalledWith("report", "reviewing", "Reviewing the evidence provided."));
  });
});
