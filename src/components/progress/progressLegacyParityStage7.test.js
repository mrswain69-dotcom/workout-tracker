import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const appSource = fs.readFileSync(path.join(process.cwd(), "src/App.jsx"), "utf8");

describe("Phase 3 Stage 7 legacy Stats parity decision", () => {
  it("retains the legacy Stats compatibility layer until truthful Progress parity exists", () => {
    expect(appSource).toContain("progressLegacyStats");
    expect(appSource).toContain('SummaryStat label="Best cardio speed"');
    expect(appSource).toContain('SummaryStat label="Best cardio distance"');
    expect(appSource).toContain('label="Most active day"');
    expect(appSource).toContain('label="Most active week"');
    expect(appSource).toContain('>Weekly chart</div>');
    expect(appSource).toContain('>Most improved this month</div>');
  });

  it("still mounts Progress before the retained compatibility statistics", () => {
    const progressIndex = appSource.indexOf("<ProgressDashboard");
    const legacyIndex = appSource.indexOf('className="grid2cols progressLegacyStats"');
    expect(progressIndex).toBeGreaterThan(-1);
    expect(legacyIndex).toBeGreaterThan(progressIndex);
  });
});
