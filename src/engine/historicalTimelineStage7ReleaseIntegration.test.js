import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function filesBelow(directory, predicate = () => true) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(relative, predicate));
    else if (predicate(relative)) result.push(relative);
  }
  return result;
}

describe("Historical Timeline Stage 7 release contract", () => {
  it("keeps the production migration additive and free from historical backfill", () => {
    const migration = read("supabase/migrations/20260912163033_historical_timeline_stage1_birth_date.sql");

    expect(migration).toContain("alter table public.profiles");
    expect(migration).toContain("add column if not exists birth_date date");
    expect(migration).not.toMatch(/\bdefault\b/i);
    expect(migration).not.toMatch(/\bupdate\s+public\.profiles\b/i);
    expect(migration).not.toMatch(/\binsert\s+into\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("requires authentication and exact-profile RLS proof before privileged historical reads", () => {
    const source = read("supabase/functions/historical-timeline-data/index.ts");

    const authIndex = source.indexOf("userClient.auth.getUser(jwt)");
    const profileIndex = source.indexOf('.from("profiles")');
    const snapshotIndex = source.indexOf('.from("profile_consistency_schedule_snapshots")');
    const membershipIndex = source.indexOf('.from("group_memberships")');
    const awardIndex = source.indexOf('.from("group_progress_awards")');

    expect(authIndex).toBeGreaterThan(-1);
    expect(profileIndex).toBeGreaterThan(authIndex);
    expect(snapshotIndex).toBeGreaterThan(profileIndex);
    expect(membershipIndex).toBeGreaterThan(profileIndex);
    expect(awardIndex).toBeGreaterThan(membershipIndex);

    expect(source).toContain('.select("id,family_id,name,birth_date")');
    expect(source).toContain('.eq("id", profileId)');
    expect(source).toContain('.eq("profile_id", profileId)');
    expect(source).toContain('.eq("family_id", ownedProfile.family_id)');
    expect(source).toContain('.in("membership_id", membershipIds)');
    expect(source).not.toMatch(/adminClient\s*\.from\("profiles"\)/);
    expect(source).not.toMatch(/\.(?:insert|update|upsert|delete)\s*\(/);
  });

  it("keeps server-only historical authority behind the Edge Function client", () => {
    const source = read("src/historicalTimelineDb.js");

    expect(source).toContain('supabase.functions.invoke("historical-timeline-data"');
    expect(source).not.toContain('from("profile_consistency_schedule_snapshots")');
    expect(source).not.toContain('from("group_progress_awards")');
  });

  it("keeps private birth_date out of Group functions and Group UI", () => {
    const files = [
      ...filesBelow("supabase/functions", (file) =>
        /group-[^/\\]+[/\\].*\.ts$/.test(file.replace(/\\/g, "/"))
      ),
      ...filesBelow("src/groups", (file) => /\.(?:js|jsx)$/.test(file)),
    ];

    expect(files.length).toBeGreaterThan(0);
    for (const file of files) {
      expect(read(file), `${file} must not expose private birth_date`).not.toContain("birth_date");
    }
  });

  it("keeps the autobiography inside Progress and preserves derived-history integrity rules", () => {
    const section = read("src/components/progress/AssessmentAnalysisSection.jsx");
    const app = read("src/App.jsx");
    const ui = read("src/components/progress/PerformanceAutobiography.jsx");
    const milestones = read("src/engine/historicalMilestoneEngine.js");

    expect(section).toContain('import PerformanceAutobiography from "./PerformanceAutobiography.jsx"');
    expect(section).toContain("<PerformanceAutobiography");
    expect(app).not.toMatch(/\{\s*id:\s*["'](?:timeline|history|career|autobiography)["']/i);

    expect(ui).toContain("Performance Autobiography");
    expect(ui).toContain("View evidence");
    expect(ui).toContain("Three years of real history unlocks the full career view");
    expect(milestones).toContain("universalPercentage: null");
    expect(milestones).toContain('state: "metric_specific_only"');
  });

  it("ships all Stage 0–6 architecture records and the Stage 6 hardening regression suite", () => {
    for (let stage = 0; stage <= 6; stage += 1) {
      expect(
        fs.existsSync(path.join(root, `docs/historical-timeline-stage${stage}.md`)),
        `missing historical timeline stage ${stage} architecture record`
      ).toBe(true);
    }

    const hardening = read("src/engine/historicalTimelineStage6Hardening.test.js");
    expect(hardening).toContain("corrections and deletions");
    expect(hardening).toContain("same-day source ordering");
    expect(hardening).toContain("birthday chapter boundaries");
    expect(hardening).toContain("leap-day rule");
    expect(hardening).toContain("legacy, block and structured Session history");
    expect(hardening).toContain("privacy and dense-mobile safeguards");
  });
});
