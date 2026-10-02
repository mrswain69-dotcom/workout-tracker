import { describe, expect, it } from "vitest";
import {
  findUnmigratedLegacyTemplates,
  legacyTemplateToProgramContent,
} from "./trainingProgramMigration.js";

describe("saved weekly plan migration", () => {
  it("converts a legacy week into share-safe Program content", () => {
    const content = legacyTemplateToProgramContent({
      id: "template-1",
      name: "Match week",
      plan_json: {
        version: 3,
        activityTypes: [{ id: "strength", name: "Strength", kind: "strength" }],
        blocksByWeekday: {
          Mon: [{ id: "block-1", typeId: "strength", label: "Strength" }],
        },
        meta: { privateValue: "must not migrate" },
      },
    }, "2026-10-02");

    expect(content.program.name).toBe("Match week");
    expect(content.program.phases[0].weeks).toHaveLength(1);
    expect(content.program.phases[0].weeks[0].blocksByWeekday.Mon[0].id).toBe("block-1");
    expect(content).not.toHaveProperty("meta");
  });

  it("only returns templates that have not already been migrated", () => {
    const pending = findUnmigratedLegacyTemplates(
      [{ id: "one" }, { id: "two" }],
      [{ legacy_plan_template_id: "one" }]
    );
    expect(pending).toEqual([{ id: "two" }]);
  });
});
