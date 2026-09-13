import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { scoreConsistencyWindow } from "./consistencyEngine.js";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function verifiedRun(overrides = {}) {
  return {
    id: "v1",
    date: "2026-09-14",
    cardioKind: "run",
    distanceKm: 5,
    durationMin: 25,
    providers: ["strava"],
    authority: "verified_evidence_only",
    rewardXp: 0,
    ...overrides,
  };
}

const schedule = {
  Mon: [{ id: "run", typeId: "run" }],
  Tue: [{ id: "duration", typeId: "duration" }],
  Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
};

describe("Verification Integrations Stage 6", () => {
  it("lets genuine verified cardio satisfy the canonical personal Consistency score without a synthetic manual log", () => {
    const result = scoreConsistencyWindow({
      window: { startDate: "2026-09-14", endDate: "2026-09-14", complete: true },
      scheduleSnapshots: [{ effective_date: "2026-09-01", schedule_json: schedule }],
      logs: [],
      verifiedCardioEvidence: [verifiedRun()],
    });

    expect(result).toMatchObject({
      available: true,
      plannedDays: 1,
      completedDays: 1,
      consistencyPct: 100,
    });
    expect(result.dayResults[0]).toMatchObject({
      completionSource: "verified",
      manualCompletedBlocks: 0,
      verifiedCompletedBlocks: 1,
    });
  });

  it("leaves generic duration manual because historical schedule snapshots do not contain enough semantics to prove what activity was planned", () => {
    const result = scoreConsistencyWindow({
      window: { startDate: "2026-09-15", endDate: "2026-09-15", complete: true },
      scheduleSnapshots: [{ effective_date: "2026-09-01", schedule_json: schedule }],
      logs: [],
      verifiedCardioEvidence: [verifiedRun({ date: "2026-09-15" })],
    });

    expect(result).toMatchObject({ plannedDays: 1, completedDays: 0, consistencyPct: 0 });
    expect(result.dayResults[0]).toMatchObject({ completionSource: "none", verifiedCompletedBlocks: 0 });
  });

  it("does not double-count manual plus provider evidence for the same planned block", () => {
    const result = scoreConsistencyWindow({
      window: { startDate: "2026-09-14", endDate: "2026-09-14", complete: true },
      scheduleSnapshots: [{ effective_date: "2026-09-01", schedule_json: schedule }],
      logs: [{
        date_ymd: "2026-09-14",
        log: {
          blocks: [{
            id: "run",
            typeId: "run",
            loggedAt: "2026-09-14T17:00:00.000Z",
            cardio: { distanceKm: 5, durationMin: 25 },
          }],
        },
      }],
      verifiedCardioEvidence: [verifiedRun({ matchedManual: true, manualBlockId: "run" })],
    });

    expect(result).toMatchObject({ plannedDays: 1, completedDays: 1, consistencyPct: 100 });
    expect(result.dayResults[0]).toMatchObject({
      completionSource: "manual",
      completedBlocks: 1,
      manualCompletedBlocks: 1,
      verifiedCompletedBlocks: 0,
    });
  });

  it("keeps reward and improvement authorities isolated from the Stage 6 completion policy", () => {
    const policy = read("src/engine/verifiedPlanCompletionEngine.js");
    const consistency = read("src/engine/consistencyEngine.js");
    const xp = read("src/engine/xpEngine.js");
    const improvement = read("src/engine/groupImprovementEngine.js");

    expect(policy).toContain('rewardXp: 0');
    expect(policy).toContain('authority: "verified_evidence_only"');
    expect(policy).not.toMatch(/from\s+["'].\/xpEngine/);
    expect(policy).not.toMatch(/from\s+["'].\/groupImprovementEngine/);
    expect(consistency).toContain("verifiedCardioEvidence");
    expect(xp).not.toContain("verifiedCardioEvidence");
    expect(improvement).not.toContain("verifiedCardioEvidence");
  });

  it("keeps Group Consistency server scorers manual-only until a privacy-safe server adapter is explicitly added", () => {
    for (const file of [
      "supabase/functions/group-consistency-leaderboard/consistencyEngine.js",
      "supabase/functions/group-seasons-awards/consistencyEngine.js",
      "supabase/functions/group-challenges/consistencyEngine.js",
    ]) {
      const source = read(file);
      expect(source).not.toContain("verifiedCardioEvidence");
      expect(source).not.toContain("external_activity_observations");
      expect(source).not.toContain("external_connections");
    }
  });
});
