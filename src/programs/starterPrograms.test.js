import { describe, expect, it } from "vitest";
import { flattenProgramWeeks } from "../engine/planCycleEngine.js";
import { buildStarterPrograms } from "./starterPrograms.js";

describe("starter Programs", () => {
  it("builds valid one-week Programs with real block content", () => {
    const programs = buildStarterPrograms("2026-10-02");
    expect(programs).toHaveLength(4);
    for (const program of programs) {
      const weeks = flattenProgramWeeks(program.content);
      expect(weeks).toHaveLength(1);
      expect(program.content.program.startDate).toBe("2026-09-28");
      const blocks = Object.values(weeks[0].week.blocksByWeekday).flat();
      expect(blocks.length).toBeGreaterThan(0);
      expect(blocks.some((block) => block.typeId === "hiit" || block.typeId === "box")).toBe(false);
    }
  });

  it("keeps starter identifiers stable", () => {
    const first = buildStarterPrograms("2026-10-02");
    const second = buildStarterPrograms("2026-10-03");
    expect(second.map((program) => program.id)).toEqual(first.map((program) => program.id));
    expect(second[0].content.program.phases[0].weeks[0].blocksByWeekday.Mon[0].id)
      .toBe(first[0].content.program.phases[0].weeks[0].blocksByWeekday.Mon[0].id);
  });
});
