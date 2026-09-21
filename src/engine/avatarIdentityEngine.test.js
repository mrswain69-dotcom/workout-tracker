import { describe, expect, it } from "vitest";
import { buildAvatarPersonalStats } from "./avatarIdentityEngine";

describe("avatar identity statistics", () => {
  it("uses only the requested avatar's prospective selection periods", () => {
    const stats = buildAvatarPersonalStats({
      avatarId: "p12_bounce_bolt",
      periods: [
        {
          avatar_id: "another_avatar",
          selected_at: "2026-09-01T00:00:00.000Z",
          deselected_at: "2026-09-10T00:00:00.000Z",
        },
        {
          avatar_id: "p12_bounce_bolt",
          selected_at: "2026-09-21T00:00:00.000Z",
          deselected_at: "2026-09-23T00:00:00.000Z",
        },
      ],
      groupAwards: [
        { awarded_at: "2026-09-09T12:00:00.000Z" },
        { awarded_at: "2026-09-22T12:00:00.000Z" },
      ],
      now: new Date("2026-09-30T00:00:00.000Z"),
    });

    expect(stats.firstSelectedAt).toBe("2026-09-21T00:00:00.000Z");
    expect(stats.selectedDurationMs).toBe(2 * 24 * 60 * 60 * 1000);
    expect(stats.selectionCount).toBe(1);
    expect(stats.competitionAchievements).toBe(1);
  });

  it("does not invent a selection before tracking begins", () => {
    const stats = buildAvatarPersonalStats({ avatarId: "p12_bounce_bolt" });
    expect(stats.firstSelectedAt).toBeNull();
    expect(stats.selectedDurationMs).toBe(0);
    expect(stats.xpEarned).toBe(0);
  });
});
