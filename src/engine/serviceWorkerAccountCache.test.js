import fs from "node:fs";
import vm from "node:vm";
import { describe, expect, it, vi } from "vitest";

function worker() {
  const handlers = {};
  const cache = { match: vi.fn(async () => new Response("stale account data")), put: vi.fn(), addAll: vi.fn(async () => {}) };
  const caches = { open: vi.fn(async () => cache), keys: vi.fn(async () => ["runtime-wt-v6", "static-wt-v6", "runtime-wt-v7"]), delete: vi.fn(async () => true) };
  const self = { location: { origin: "https://workouttrackerapp.io" },
    addEventListener: (name, fn) => { handlers[name] = fn; }, clients: { claim: vi.fn(async () => {}) } };
  const fetch = vi.fn(async () => new Response("fresh"));
  vm.runInNewContext(fs.readFileSync(new URL("../../public/sw.js", import.meta.url), "utf8"), { self, caches, fetch, URL, Response });
  return { handlers, caches, cache, fetch };
}

describe("offline worker keeps account reads on the network", () => {
  it.each([
    "https://project.supabase.co/rest/v1/logs?profile_id=eq.athlete",
    "https://project.supabase.co/rest/v1/external_activity_links?profile_id=eq.athlete",
    "https://project.supabase.co/auth/v1/user",
    "https://workouttrackerapp.io/api/logs",
  ])("never intercepts or caches %s", (url) => {
    const w = worker(), respondWith = vi.fn();
    w.handlers.fetch({ request: new Request(url), respondWith, waitUntil: vi.fn() });
    expect(respondWith).not.toHaveBeenCalled();
    expect(w.caches.open).not.toHaveBeenCalled();
  });
  it("does not cache even static paths carrying an authorization header", () => {
    const w = worker(), respondWith = vi.fn();
    w.handlers.fetch({ request: new Request("https://workouttrackerapp.io/assets/private.js", { headers: { Authorization: "Bearer test" } }), respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  });
  it("still serves static assets from the offline cache", async () => {
    const w = worker(); let response;
    w.handlers.fetch({ request: new Request("https://workouttrackerapp.io/assets/app-hash.js"), respondWith: (p) => { response = p; }, waitUntil: vi.fn() });
    expect(await (await response).text()).toBe("stale account data");
  });
  it("removes old runtime caches that may contain stale private responses", async () => {
    const w = worker(); let activated;
    w.handlers.activate({ waitUntil: (p) => { activated = p; } });
    await activated;
    expect(w.caches.delete).toHaveBeenCalledWith("runtime-wt-v6");
    expect(w.caches.delete).toHaveBeenCalledWith("static-wt-v6");
    expect(w.caches.delete).not.toHaveBeenCalledWith("runtime-wt-v7");
  });
});
