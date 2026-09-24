import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => fs.readFileSync(path, "utf8");

describe("Strava unmatched activity block integration", () => {
  it("persists Ask, Automatic and Never as a bounded per-athlete preference", () => {
    const migration = read("supabase/migrations/20260924104658_strava_unmatched_activity_blocks.sql");
    const endpoint = read("supabase/functions/external-connection-preferences/index.ts");
    const settings = read("src/components/settings/ConnectionsSettings.jsx");

    expect(migration).toContain("unmatched_activity_action text not null default 'ask'");
    expect(migration).toContain("unmatched_activity_action in ('ask', 'automatic', 'never')");
    expect(endpoint).toContain('unmatched_activity_action: "ask"');
    expect(endpoint).toContain('["ask", "automatic", "never"].includes(action)');
    expect(settings).toContain('label="Unmatched recorded activities"');
    expect(settings).toContain("Manual Strava entries never qualify");
  });

  it("keeps manual provider entries out of both automatic and explicit Log creation", () => {
    const helper = read("supabase/functions/_shared/verificationAutoPopulate.ts");
    const endpoint = read("supabase/functions/verification-auto-populate/index.ts");

    expect(helper).toContain("row?.source_manual_entry !== true");
    expect(helper).toContain('? "manual_entry"');
    expect(endpoint).toContain('result.requestedOutcome === "manual_entry"');
    expect(endpoint).toContain("Manual Strava entries cannot verify or create Workout Tracker activities");
    expect(endpoint).toContain('code: "manual_provider_entry"');
  });

  it("offers explicit Add/Don't add controls and remembers a declined activity", () => {
    const ui = read("src/components/progress/VerifiedActivityEvidenceSection.jsx");
    const endpoint = read("supabase/functions/verification-auto-populate/index.ts");
    const helper = read("supabase/functions/_shared/verificationAutoPopulate.ts");

    expect(ui).toContain("Add to Log on recorded date");
    expect(ui).toContain("Don't add this activity");
    expect(endpoint).toContain('action === "add_unmatched"');
    expect(endpoint).toContain('action === "decline_unmatched"');
    expect(helper).toContain('suppress_reason: "user_declined"');
    expect(helper).toContain("forceExtraBlock: true");
  });

  it("creates duration-only strength evidence without strength-volume authority", () => {
    const engine = read("src/engine/verificationAutoPopulationEngine.js");

    expect(engine).toContain('typeId: "duration"');
    expect(engine).toContain("Exercise, set, rep and weight details were not imported.");
    expect(engine).not.toContain('typeId: "strength",\n    isExtra: true');
  });
});
