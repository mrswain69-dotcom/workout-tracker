import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("profile entry buffering", () => {
  it("does not persist bodyweight on every keystroke", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    expect(app).toContain("CommitOnBlurInput");
    expect(app).toContain("onBlur={commit}");
    expect(app).toContain("Saves when you leave the field or press Enter.");
    expect(app).not.toContain('onChange={async (v) => {\n                          if (!(await ensureUnlocked("change bodyweight"))');
  });
});
