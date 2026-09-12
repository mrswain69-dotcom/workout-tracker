import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

function filesBelow(directory, extension) {
  const absolute = path.join(root, directory);
  if (!fs.existsSync(absolute)) return [];
  const result = [];
  for (const entry of fs.readdirSync(absolute, { withFileTypes: true })) {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...filesBelow(relative, extension));
    else if (!extension || entry.name.endsWith(extension)) result.push(relative);
  }
  return result;
}

describe("Historical Timeline Stage 1 integration", () => {
  it("adds only a nullable private birth_date column without backfilling profiles", () => {
    const migration = read("supabase/migrations/20260912163033_historical_timeline_stage1_birth_date.sql");
    expect(migration).toContain("add column if not exists birth_date date");
    expect(migration).toMatch(/private family-only/i);
    expect(migration).not.toMatch(/update\s+public\.profiles/i);
    expect(migration).not.toMatch(/insert\s+into/i);
  });

  it("updates only the selected profile birth_date through the family-protected profiles table", () => {
    const source = read("src/profileBirthDateDb.js");
    expect(source).toContain('.from("profiles")');
    expect(source).toContain(".update({ birth_date: validated.value })");
    expect(source).toContain('.eq("id", profileId)');
    expect(source).toContain('.select("id,family_id,name,age_group,birth_date")');
    expect(source).not.toContain("plan_json");
  });

  it("keeps birth_date out of every Group Edge Function and Group UI source", () => {
    const groupFunctionFiles = filesBelow("supabase/functions", ".ts").filter((file) =>
      path.basename(path.dirname(file)).startsWith("group-")
    );
    const groupUiFiles = filesBelow("src/groups").filter((file) => /\.(js|jsx)$/.test(file));

    expect(groupFunctionFiles.length).toBeGreaterThan(0);
    expect(groupUiFiles.length).toBeGreaterThan(0);

    for (const file of [...groupFunctionFiles, ...groupUiFiles]) {
      expect(read(file), `${file} must not expose private birth_date`).not.toContain("birth_date");
    }
  });

  it("keeps age derivation pure and independent of age_group", () => {
    const source = read("src/engine/historicalAgeEngine.js");
    expect(source).toContain("calculateAgeOnDate");
    expect(source).toContain("historicalAgeChapter");
    expect(source).not.toContain("age_group");
  });
});
