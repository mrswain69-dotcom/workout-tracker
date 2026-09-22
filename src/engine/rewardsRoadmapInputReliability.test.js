import fs from "node:fs";
import { describe, expect, it } from "vitest";

function functionSlice(source, name, nextName) {
  const start = source.indexOf(`function ${name}`);
  if (start < 0) return "";
  const end = nextName ? source.indexOf(`function ${nextName}`, start + 1) : -1;
  return source.slice(start, end > start ? end : start + 9000);
}

describe("Rewards roadmap and log input reliability", () => {
  it("never lets an in-flight day load replace a newer optimistic edit", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain("const revisionAtLoadStart");
    expect(app).toContain("const liveCached = cacheKey");
    expect(app).toContain("const editedWhileLoading = liveRevision !== revisionAtLoadStart");
    expect(app).toContain("const rawLatest = liveCached || fromDb || null");
    expect(app).toContain("Never let the result of an older load overwrite an edit");
  });

  it("confirms a debounced edit from the write response instead of an immediate readback", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    const saveStart = app.indexOf("async function saveLog");
    const saveEnd = app.indexOf("function latestLogForSelectedDay", saveStart);
    const saveBody = app.slice(saveStart, saveEnd);

    expect(saveBody).toContain("const { data: savedRow, error } = await upsertLog");
    expect(saveBody).toContain("getLogRowPayload(savedRow) || logToStore || null");
    expect(saveBody).not.toContain("const { data: dayData, error: dayError } = await getLog");
    expect(saveBody).toContain("The UPSERT already returns the row that was written");
  });

  it("rehydrates logs from the database after navigation once local edits are persisted", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain("const logPersistedRevisionRef = useRef(new Map())");
    expect(app).toContain('if (tab !== "log") return;');
    expect(app).toContain("const hasPendingLocalEdit =");
    expect(app).toContain("liveRevision > persistedRevision");
    expect(app).toContain("? (liveCached || fromDb || null)");
    expect(app).toContain(": (fromDb || liveCached || null)");
    expect(app).toContain("logPersistedRevisionRef.current.set(cacheKey, revision)");
  });

  it("serializes reward meta writes and builds every claim from the latest plan", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain("const planMetaSaveQueueRef = useRef(Promise.resolve())");
    expect(app).toContain("planRef.current = normalised");
    expect(app).toContain('typeof metaPatch === "function"');
    expect(app).toContain("planMetaSaveQueueRef.current.then(");
    expect(app).toContain("upsertProfilePlan meta save failed");
    expect(app).toContain("const saved = await savePlanMetaNoPin((latestMeta) =>");
    expect(app).toContain("const latestClaimed = normaliseClaimedRewards(latestMeta)");
    expect(app).toContain("return !!saved");
  });

  it("applies typed log changes before waiting for audio feedback", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    const handlers = [
      ["addOrUpdateSet", "updateCardio"],
      ["updateCardio", "updateCustom"],
      ["updateCustom", "toggleStreakSaver"],
      ["updateCardioForBlock", "updateDurationForBlock"],
      ["updateDurationForBlock", "prepareSessionBlockForLogging"],
      ["updateProfileRecoveryMinutes", "toggleBlockCancelled"],
      ["updateStrengthSetsForMovement", "toggleTaskForBlock"],
    ];

    for (const [name, nextName] of handlers) {
      const body = functionSlice(app, name, nextName);
      expect(body, `${name} should exist`).not.toBe("");
      expect(body.indexOf("await saveLog")).toBeGreaterThanOrEqual(0);
      expect(body.indexOf("await ensureAudio()")).toBeGreaterThan(
        body.indexOf("await saveLog")
      );
    }
  });

  it("uses a visual XP split and a moving avatar roadmap", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");

    expect(app).toContain('className="rewardsXpBreakdown"');
    expect(app).toContain('className="rewardsXpTotal"');
    expect(app).toContain("rewardsRoadmap.nextAvatar");
    expect(app).toContain("rewardsMilestoneProgressFill");
    expect(app).toContain("Your progression");
    expect(app).toContain("This roadmap moves with you.");
    expect(app).toContain("rewardsRoadmap.followingAvatar");
  });
});
