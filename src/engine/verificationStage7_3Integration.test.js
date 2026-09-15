import fs from "node:fs";
import { describe, expect, it } from "vitest";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("Verification Stage 7.3 integration authority", () => {
  const engine = read("./verificationAutoPopulationEngine.js");
  const helper = read("../../supabase/functions/_shared/verificationAutoPopulate.ts");
  const reconcile = read("../../supabase/functions/_shared/verificationReconcile.ts");
  const endpoint = read("../../supabase/functions/verification-auto-populate/index.ts");
  const migration = read("../../supabase/migrations/20260915183000_verification_stage7_3_auto_population.sql");
  const app = read("../App.jsx");

  it("keeps automatic population inside the bounded 0-3 day preference window", () => {
    expect(engine).toContain("Math.max(0, Math.min(3");
    expect(helper).toContain("auto_log_window_days");
    expect(helper).toContain("isDateInsideAutoPopulationWindow");
  });

  it("does not make strength or Sessions provider-created auto-population targets", () => {
    expect(engine).toContain('"strength"');
    expect(engine).toContain('typeId === "session"');
    expect(engine).toContain('typeId: "cardio"');
    expect(engine).not.toContain('typeId: "session",\n    isExtra: true');
  });

  it("stores field-level provenance and has a reversible undo path", () => {
    expect(engine).toContain("verificationPopulation");
    expect(engine).toContain("importedValue");
    expect(engine).toContain("previousValue");
    expect(engine).toContain('state: "imported"');
    expect(engine).toContain('record.state = "manual_override"');
    expect(engine).toContain("undoVerifiedActivityPopulation");
    expect(endpoint).toContain('action === "undo"');
  });

  it("uses a server-only suppression table so an undone activity is not immediately recreated", () => {
    expect(migration).toContain("external_activity_population_controls");
    expect(migration).toContain("enable row level security");
    expect(migration).toContain("revoke all on table public.external_activity_population_controls from anon, authenticated");
    expect(helper).toContain("skippedSuppressed");
    expect(helper).toContain('suppress_reason: "user_undo"');
  });

  it("runs population after reconciliation so OAuth, webhook and manual source checks share one authority path", () => {
    expect(reconcile).toContain('import { applyRecentVerifiedAutoPopulationForProfile } from "./verificationAutoPopulate.ts"');
    expect(reconcile).toContain("await applyRecentVerifiedAutoPopulationForProfile(adminClient, profileId)");
  });

  it("keeps the endpoint authenticated and owner-scoped before server-authority writes", () => {
    expect(endpoint).toContain("Authentication required");
    expect(endpoint).toContain('.from("profiles")');
    expect(endpoint).toContain('.eq("id", profileId)');
    expect(endpoint).toContain("applyRecentVerifiedAutoPopulationForProfile");
  });

  it("does not introduce a verification XP bonus or multiplier", () => {
    expect(helper).toContain("rewardBonusXp: 0");
    expect(helper).toContain("rewardMultiplier: 1");
    expect(engine).not.toContain("bonusXp");
    expect(engine).not.toContain("multiplier");
  });

  it("refreshes both the selected log and history after an external auto-population change", () => {
    expect(app).toContain("externalLogRevision");
    expect(app).toContain("onAutoPopulationChanged");
    expect(app).toContain("logJson={logForDay}");
  });
});
