import fs from "node:fs";
import { describe, expect, it } from "vitest";

const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
const styles = fs.readFileSync(new URL("../styles.css", import.meta.url), "utf8");

describe("App Settings presentation", () => {
  it("presents data notes as clear account, privacy and sync guidance", () => {
    expect(app).toContain('className="settingsDataNotes"');
    expect(app).toContain("One family account");
    expect(app).toContain("Private profile stats");
    expect(app).toContain("Automatic sync");
    expect(styles).toContain(".settingsDataNotes__grid");
  });

  it("locks prestige frame controls by XP and uses one colour picker", () => {
    expect(app).toContain("prestigeFrameState.earned");
    expect(app).toContain('Status: <b>{prestigeFrameState.earned ? "Earned" : "Not yet"}</b>');
    expect(app).toContain("PRESTIGE_FRAME_OPTIONS.map");
    expect(app).toContain("avatarFrameDemo__stage");
    expect(app).not.toContain('value={selectedAvatarFrame}\n        onChange');
  });
});
