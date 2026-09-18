import { describe, expect, it } from "vitest";
import {
  applyProfileRecoveryModeToPlannedBlocks,
  buildProfileRecoveryPlanBlock,
  getProfileRecoveryModeForDate,
  profileRecoveryBlockComplete,
} from "./recoveryModeEngine.js";

describe("profile recovery mode engine", () => {
  it("uses the active period today and resumes normal immediately when it is ended", () => {
    const open = {
      id: "r1",
      profile_id: "p1",
      mode: "injury",
      started_on: "2026-09-18",
      ended_on: null,
      started_at: "2026-09-18T07:00:00Z",
      ended_at: null,
    };
    expect(getProfileRecoveryModeForDate([open], "p1", "2026-09-18", "2026-09-18")?.mode).toBe("injury");

    const ended = { ...open, ended_on: "2026-09-18", ended_at: "2026-09-18T08:00:00Z" };
    expect(getProfileRecoveryModeForDate([ended], "p1", "2026-09-18", "2026-09-18")).toBeNull();
    expect(getProfileRecoveryModeForDate([ended], "p1", "2026-09-18", "2026-09-19")?.mode).toBe("injury");
  });

  it("pauses physical plan blocks, keeps tasks active and adds one recovery block", () => {
    const blocks = applyProfileRecoveryModeToPlannedBlocks(
      [{ id: "s1", typeId: "strength" }, { id: "t1", typeId: "tasks" }],
      { profileId: "p1", dateYmd: "2026-09-18", mode: "injury" }
    );
    expect(blocks).toHaveLength(3);
    expect(blocks.find((block) => block.id === "s1")?.suspendedByRecoveryMode).toBe(true);
    expect(blocks.find((block) => block.id === "t1")?.suspendedByRecoveryMode).toBe(false);
    expect(blocks.find((block) => block.isProfileRecoveryBlock)?.label).toBe("Today’s Physio");
  });

  it("completes injury recovery from total physio minutes and illness recovery from confirmation", () => {
    const injury = buildProfileRecoveryPlanBlock({ profileId: "p1", dateYmd: "2026-09-18", mode: "injury" });
    expect(profileRecoveryBlockComplete(injury)).toBe(false);
    expect(profileRecoveryBlockComplete({ ...injury, duration: { minutes: 12 } })).toBe(true);
    const illness = buildProfileRecoveryPlanBlock({ profileId: "p1", dateYmd: "2026-09-18", mode: "illness" });
    expect(profileRecoveryBlockComplete(illness)).toBe(false);
    expect(profileRecoveryBlockComplete({ ...illness, recoveryDone: true })).toBe(true);
  });
});
