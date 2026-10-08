// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ rpc: vi.fn(), storage: { from: vi.fn() } }));
vi.mock("../supabaseClient", () => ({ supabase: mock }));
import { uploadCreatorFile, saveCreator, creatorFileUrl } from "./creatorDb.js";
describe("creator upload and RPC boundaries", () => {
 it("rejects SVG, HTML and oversized evidence before upload", async () => {
  for (const file of [{ type: "image/svg+xml", size: 100 }, { type: "text/html", size: 50 }, { type: "application/pdf", size: 6 * 1024 * 1024 }]) expect((await uploadCreatorFile("creator", "evidence", file)).error).toBeTruthy();
  expect(mock.storage.from).not.toHaveBeenCalled();
 });
 it("stores evidence in a private creator-specific path", async () => {
  const upload = vi.fn(async () => ({ data: {}, error: null })); mock.storage.from.mockReturnValue({ upload });
  const file = new File(["test"], "certificate.pdf", { type: "application/pdf" });
  const result = await uploadCreatorFile("creator", "evidence", file);
  expect(mock.storage.from).toHaveBeenCalledWith("creator-evidence");
  expect(upload).toHaveBeenCalledWith(expect.stringMatching(/^creator\/evidence\/[a-f0-9-]+\.pdf$/), file, expect.objectContaining({ upsert: false }));
  expect(result.data.path.startsWith("creator/evidence/")).toBe(true);
 });
 it("normalises the saved profile RPC row and retains owner identity", async () => {
  mock.rpc.mockResolvedValue({ data: [{ display_name: "Sam" }], error: null });
  expect((await saveCreator("creator", { display_name: "Sam" })).data.display_name).toBe("Sam");
  expect(mock.rpc).toHaveBeenCalledWith("creator_save_profile", { p_profile_id: "creator", p_details: { display_name: "Sam" } });
 });
 it("uses expiring signed URLs for evidence instead of public URLs", async () => {
  const createSignedUrl = vi.fn(async () => ({ data: { signedUrl: "url" }, error: null })); mock.storage.from.mockReturnValue({ createSignedUrl });
  await creatorFileUrl("creator/evidence/file.pdf", "evidence");
  expect(mock.storage.from).toHaveBeenCalledWith("creator-evidence");
  expect(createSignedUrl).toHaveBeenCalledWith("creator/evidence/file.pdf", 600);
 });
});
