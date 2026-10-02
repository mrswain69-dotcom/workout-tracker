import fs from "node:fs";
import { describe, expect, it } from "vitest";

const app = fs.readFileSync("src/App.jsx", "utf8");

describe("plan block type consolidation", () => {
  it("offers one Strength / HIIT / Box authoring block", () => {
    expect(app).toContain("+ Strength / HIIT / Box block");
    expect(app).not.toContain('addBlockToDay("hiit")');
    expect(app).not.toContain('addBlockToDay("box")');
  });

  it("keeps older HIIT and Box blocks readable through the combined label", () => {
    expect(app).toContain('typeId === "hiit"');
    expect(app).toContain('typeId === "box"');
    expect(app).toContain('"Strength / HIIT / Box"');
  });
});
