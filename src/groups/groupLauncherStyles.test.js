import fs from "node:fs";
import { describe, expect, it } from "vitest";

const main = fs.readFileSync(new URL("../main.jsx", import.meta.url), "utf8");
const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const hubCss = fs.readFileSync(new URL("./GroupHub.css", import.meta.url), "utf8");

describe("Group launcher eager-style regression", () => {
  it("loads the launcher stylesheet before the lazy Group Hub is opened", () => {
    expect(main).toContain("import './groups/GroupHub.css'");
    expect(app).toContain('className="groupHeaderButton"');
    expect(app).toContain('aria-label="Open Groups"');
  });

  it("keeps a visible 44px launcher and explicit SVG size", () => {
    const normalizedCss = hubCss.replace(/\s+/g, "");
    expect(normalizedCss).toContain(".groupHeaderButton{width:44px;height:44px;min-width:44px");
    expect(normalizedCss).toContain(".groupHeaderButtonsvg{width:23px;height:23px}");
  });
});
