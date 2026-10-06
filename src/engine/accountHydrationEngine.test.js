import { describe, expect, it, vi } from "vitest";
import {
  getAccountHydrationPhase,
  runAccountLoadWithRetry,
} from "./accountHydrationEngine.js";

describe("account hydration", () => {
  it("retries one transient read failure", async () => {
    const load = vi.fn()
      .mockRejectedValueOnce(new Error("temporary auth propagation failure"))
      .mockResolvedValueOnce({ ok: true });

    await expect(runAccountLoadWithRetry(load, { delayMs: 0 })).resolves.toEqual({ ok: true });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("surfaces the final error after the retry is exhausted", async () => {
    const load = vi.fn().mockRejectedValue(new Error("database unavailable"));

    await expect(runAccountLoadWithRetry(load, { delayMs: 0 })).rejects.toThrow(
      "database unavailable"
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("bounds a hung read, retries, and rejects without waiting forever", async () => {
    vi.useFakeTimers();
    try {
      const load = vi.fn(() => new Promise(() => {}));
      const pending = runAccountLoadWithRetry(load, { timeoutMs: 100, delayMs: 10 });
      const result = expect(pending).rejects.toThrow("Training data request timed out");
      await vi.advanceTimersByTimeAsync(210);
      await result;
      expect(load).toHaveBeenCalledTimes(2);
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps the dashboard gated until profile, plan and logs are ready", () => {
    const base = {
      authed: true,
      accountLoadState: "ready",
      familyId: "family-1",
      activeProfileId: "profile-1",
      planReady: true,
      logsReady: true,
      snapshotsReady: true,
    };

    expect(getAccountHydrationPhase(base)).toBe("ready");
    expect(getAccountHydrationPhase({ ...base, snapshotsReady: false })).toBe("loading");
    expect(getAccountHydrationPhase({ ...base, logsReady: false })).toBe("loading");
    expect(getAccountHydrationPhase({ ...base, planReady: false })).toBe("loading");
    expect(getAccountHydrationPhase({ ...base, accountLoadError: "failed" })).toBe("error");
    expect(getAccountHydrationPhase({ ...base, authed: false })).toBe("signed_out");
  });
});
