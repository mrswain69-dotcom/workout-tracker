import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Historical Timeline Stage 4 integration contract", () => {
  it("composes the autobiography from existing historical authorities", () => {
    const source = read("src/engine/historicalAutobiographyEngine.js");
    expect(source).toContain("buildHistoricalAgeChapters");
    expect(source).toContain("composeHistoricalMilestones");
    expect(source).toContain("buildCareerSummaryFoundation");
    expect(source).toContain('sourceType === "group_award"');
  });

  it("reuses canonical Consistency and workout streak authorities", () => {
    const source = read("src/engine/historicalMilestoneEngine.js");
    expect(source).toContain('from "./consistencyEngine.js"');
    expect(source).toContain('from "./badgeStatsV2.js"');
    expect(source).toContain("scoreConsistencyWindow");
    expect(source).toContain("buildBadgeStatsV2");
  });

  it("keeps lifetime improvement metric-specific and Knowledge opt-in", () => {
    const source = read("src/engine/historicalMilestoneEngine.js");
    expect(source).toContain("universalPercentage: null");
    expect(source).toContain('state: "metric_specific_only"');
    expect(source).toContain('state: "not_available_yet"');
    expect(source).toContain("sourceAvailable = false");
  });

  it("introduces no Stage 4 database migration or historical backfill", () => {
    const migrations = fs.readdirSync(path.join(root, "supabase/migrations"));
    expect(
      migrations.some((name) => /historical.*stage4|stage4.*historical/i.test(name))
    ).toBe(false);

    const source = read("src/engine/historicalMilestoneEngine.js");
    expect(source).not.toMatch(/\.from\(["'](?:logs|profiles|assessment_runs|group_progress_awards)["']\)/);
    expect(source).not.toMatch(/\.(?:insert|update|delete|upsert)\s*\(/);
  });
});
