// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./creatorDb.js", async (importOriginal) => { const original = await importOriginal(); return { ...original, getCreator: vi.fn(), saveCreator: vi.fn(), listCreatorRequests: vi.fn(), reviewerAccess: vi.fn(), reviewCreatorRequest: vi.fn(), submitCreatorRequest: vi.fn(), uploadCreatorFile: vi.fn(), creatorFileUrl: vi.fn() }; });
import * as db from "./creatorDb.js";
import CreatorProfileEditor, { CreatorBiography, CreatorProfileDialog } from "./CreatorProfile.jsx";
const profile = { id: "creator", display_name: "Coach Sam", headline: "Strength coach", bio: "Evidence-based training", experience: "Community coaching", years_experience: 8, role: "coach", categories: ["Strength"], tags: ["Football"], qualifications: [{ name: "Coaching award", issuer: "Sports body", reference_url: "https://example.com/register" }], website: "", photo_path: "", published: true, credential_revision: 1, verified_revision: null, verified_at: null, verified_summary: "" };
beforeEach(() => { vi.clearAllMocks(); db.getCreator.mockResolvedValue({ data: profile, error: null }); db.listCreatorRequests.mockResolvedValue({ data: [], error: null }); db.reviewerAccess.mockResolvedValue({ data: false, error: null }); });
afterEach(() => cleanup());
describe("creator biography and verification", () => {
 it("shows self-declared credentials without inventing a verified mark", () => {
  render(<CreatorBiography creator={profile} />);
  expect(screen.getByText("Coaching award")).toBeTruthy();
  expect(screen.getByText(/Qualifications are self-declared/)).toBeTruthy();
  expect(screen.queryByText("Verified creator")).toBeNull();
  expect(screen.getByText("8 years of experience")).toBeTruthy();
 });
 it("shows the review scope and date for a current verified revision", () => {
  render(<CreatorBiography creator={{ ...profile, verified_revision: 1, verified_at: "2026-10-08T12:00:00Z", verified_summary: "Identity and qualification checked." }} />);
  expect(screen.getByText("Verified creator")).toBeTruthy();
  expect(screen.getByText("Identity and qualification checked.")).toBeTruthy();
  expect(screen.getByText(/does not certify every programme/)).toBeTruthy();
 });
 it("withholds an old verified mark after a credential revision", () => {
  render(<CreatorBiography creator={{ ...profile, verified_revision: 1, credential_revision: 2, verified_at: "2026-10-08" }} />);
  expect(screen.queryByText("Verified creator")).toBeNull();
 });
 it("does not submit changed qualifications before saving them", async () => {
  render(<CreatorProfileEditor profileId="creator" profileName="Sam" />);
  await screen.findByDisplayValue("Coach Sam");
  fireEvent.change(screen.getByLabelText("Evidence / verification statement"), { target: { value: "Please check my certificate." } });
  expect(screen.getByRole("button", { name: "Submit verification request" }).disabled).toBe(false);
  fireEvent.change(screen.getByLabelText("Qualification 1"), { target: { value: "Different certificate" } });
  expect(screen.getByRole("button", { name: "Submit verification request" }).disabled).toBe(true);
  expect(db.submitCreatorRequest).not.toHaveBeenCalled();
 });
 it("submits explicit evidence only for the selected saved profile", async () => {
  db.submitCreatorRequest.mockResolvedValue({ data: "request", error: null });
  render(<CreatorProfileEditor profileId="creator" profileName="Sam" authorize={async () => true} />);
  await screen.findByDisplayValue("Coach Sam");
  fireEvent.change(screen.getByLabelText("Evidence / verification statement"), { target: { value: "Please check my certificate." } });
  fireEvent.click(screen.getByRole("button", { name: "Submit verification request" }));
  await waitFor(() => expect(db.submitCreatorRequest).toHaveBeenCalledWith("creator", "Please check my certificate.", []));
  await screen.findByText("Verification request submitted for review.");
 });
 it("requires authorization before saving public creator details", async () => {
  const authorize = vi.fn(async () => false);
  render(<CreatorProfileEditor profileId="creator" authorize={authorize} />);
  await screen.findByDisplayValue("Coach Sam");
  fireEvent.click(screen.getByRole("button", { name: "Save creator profile" }));
  await waitFor(() => expect(authorize).toHaveBeenCalled());
  expect(db.saveCreator).not.toHaveBeenCalled();
 });
 it("shows the private evidence review queue only to authorised reviewers", async () => {
  db.reviewerAccess.mockResolvedValue({ data: true, error: null });
  db.listCreatorRequests.mockImplementation(async (id) => ({ data: id ? [] : [{ id: "request", snapshot: { display_name: "Applicant", role: "coach", qualifications: [] }, status: "pending", statement: "Qualification statement", evidence_paths: [], review_note: "" }], error: null }));
  db.reviewCreatorRequest.mockResolvedValue({ data: true, error: null });
  render(<CreatorProfileEditor profileId="creator" />);
  await screen.findByText("Creator verification review");
  fireEvent.click(screen.getByText("Creator verification review"));
  await screen.findByText("Applicant · pending");
  fireEvent.change(screen.getByLabelText("Decision"), { target: { value: "approved" } });
  fireEvent.change(screen.getByLabelText("Decision explanation / public approval summary"), { target: { value: "Identity checked with awarding body." } });
  fireEvent.click(screen.getByRole("button", { name: "Save review decision" }));
  await waitFor(() => expect(db.reviewCreatorRequest).toHaveBeenCalledWith("request", "approved", "Identity checked with awarding body."));
 });
 it("opens a linked bio and its programme catalogue and returns focus on close", async () => {
  const onClose = vi.fn(), onProgram = vi.fn();
  const opener = document.createElement("button"); document.body.appendChild(opener); opener.focus();
  const view = render(<CreatorProfileDialog id="creator" programmes={[{ id: "p", creator_id: "creator", title: "Sprint plan", week_count: 2 }]} onClose={onClose} onProgram={onProgram} />);
  await screen.findByText("Coach Sam");
  fireEvent.click(screen.getByRole("button", { name: /Sprint plan/ }));
  expect(onProgram).toHaveBeenCalledWith(expect.objectContaining({ id: "p" }));
  fireEvent.click(screen.getByRole("button", { name: "Close" })); expect(onClose).toHaveBeenCalled();
  view.unmount(); expect(document.activeElement).toBe(opener); opener.remove();
 });
});
