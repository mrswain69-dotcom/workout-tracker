import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("blank-plan onboarding release contract", () => {
  it("keeps existing accounts opted out while new accounts default to the tutorial", () => {
    const migration = fs.readFileSync(
      new URL("../../supabase/migrations/20260921170000_account_onboarding_state.sql", import.meta.url),
      "utf8"
    );
    expect(migration).toContain("'status', 'complete'");
    expect(migration).toContain("'{\"version\":1,\"status\":\"not_started\",\"step\":0}'::jsonb");
    expect(migration).toContain("f.owner_user_id = auth.uid()");
  });

  it("creates neutral blank profiles instead of prototype family profiles", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    expect(app).toContain('addProfile(fam.id, "Athlete", blankPlanForNewProfile())');
    expect(app).not.toContain('addProfile(fam.id, "Wilf")');
    expect(app).not.toContain('addProfile(fam.id, "Xander")');
    expect(app).not.toContain('getOrCreateFamily("Swain Family")');
    expect(app).toContain("if (hasBlocks) {");
    expect(app).not.toContain("if (hasBlocks && plan.blocksByWeekday[weekday].length > 0)");
  });

  it("exposes replay and the two blank-day actions", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    const dashboard = fs.readFileSync(
      new URL("../components/dashboard/PerformanceDashboard.jsx", import.meta.url),
      "utf8"
    );
    expect(app).toContain("Restart tutorial");
    expect(dashboard).toContain("Build my weekly plan");
    expect(dashboard).toContain("Log an extra activity");
    expect(dashboard).toContain("It will not increase or break your streak.");
  });
});
