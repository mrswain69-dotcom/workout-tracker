import fs from "node:fs";
import { describe, expect, it } from "vitest";

const doctrine = fs.readFileSync(
  new URL("../../docs/historical-timeline-stage0.md", import.meta.url),
  "utf8"
);

describe("Historical Timeline Stage 0 contract", () => {
  it("locks real attained-age chapters instead of guessing from age_group or calendar year", () => {
    expect(doctrine).toContain("does **not** store a date of birth");
    expect(doctrine).toContain("nullable, family-private `birth_date`");
    expect(doctrine).toContain("`age_group` is **not** used to infer an exact age");
    expect(doctrine).toContain("no guessed dates of birth");
  });

  it("protects existing history and refuses synthetic autobiography evidence", () => {
    expect(doctrine).toContain("workout-log rows: **499**");
    expect(doctrine).toContain("no rewrite/backfill of the 499 historical logs");
    expect(doctrine).toContain("no fake Assessment history");
    expect(doctrine).toContain("no fake frozen Group awards");
    expect(doctrine).toContain("Knowledge milestones stay unavailable until a genuine Knowledge history source exists");
  });

  it("keeps heterogeneous performance measures separate and non-causal", () => {
    expect(doctrine).toContain("Strength is not one universal number");
    expect(doctrine).toContain("Unlike units are never summed into a synthetic cardio score");
    expect(doctrine).toContain("no synthetic universal strength/cardio/lifetime-improvement score");
    expect(doctrine).toContain("no causal claim from correlation");
  });

  it("keeps autobiography private and inside the existing Progress navigation", () => {
    expect(doctrine).toContain("birth_date` is private family/profile data");
    expect(doctrine).toContain("Group-facing identity remains the existing safe nickname/avatar/frame contract");
    expect(doctrine).toContain("will **not** add a fourth primary mobile tab");
    expect(doctrine).toContain("Initial placement is inside `Progress`");
    expect(doctrine).toContain("**Stage 7:** final full regression/security gate");
  });
});
