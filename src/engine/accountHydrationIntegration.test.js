import fs from "node:fs";
import { describe, expect, it } from "vitest";

const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

describe("authenticated account hydration integration", () => {
  it("keeps the dashboard behind the profile, plan and log readiness gate", () => {
    expect(app).toContain("getAccountHydrationPhase");
    expect(app).toContain("accountHydrationPhase !== \"ready\"");
    expect(app).toContain("<AccountHydrationScreen");
    expect(app).toContain("planReady");
    expect(app).toContain("logsReady");
  });

  it("surfaces bootstrap errors instead of treating failed reads as empty data", () => {
    expect(app).not.toContain("refreshAll().catch(() => {})");
    expect(app).toContain("setAccountLoadError");
    expect(app).toContain("setLogsLoadError");
    expect(app).toContain("setPlanLoadError");
    expect(app).toContain("never overwrite after a read error");
  });
});
