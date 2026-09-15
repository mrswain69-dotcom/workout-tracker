import { describe, expect, it } from "vitest";
import { groupManualMatchCandidates } from "./VerifiedActivityEvidenceSection.jsx";

describe("VerifiedActivityEvidenceSection strength-session candidate grouping", () => {
  it("offers overlapping Workout Tracker strength blocks as one physical strength session", () => {
    const grouped = groupManualMatchCandidates([
      {
        manualLogId: "log-1",
        manualBlockId: "Mon_main",
        logDate: "2026-09-14",
        label: "Legs and Chest",
        activityType: "strength",
        startedAt: "2026-09-15T18:55:24.886Z",
        completedAt: "2026-09-15T19:15:35.108Z",
        durationSec: 1210,
        score: 1,
      },
      {
        manualLogId: "log-1",
        manualBlockId: "extra-situps",
        logDate: "2026-09-14",
        label: "Strength",
        activityType: "strength",
        startedAt: "2026-09-15T19:11:03.817Z",
        completedAt: "2026-09-15T19:15:35.108Z",
        durationSec: 271,
        score: 0.91,
      },
    ]);

    expect(grouped).toHaveLength(1);
    expect(grouped[0].manualBlockId).toBe("Mon_main");
    expect(grouped[0].displayLabel).toBe("Strength session · 2 Workout Tracker blocks");
    expect(grouped[0].groupedCount).toBe(2);
    expect(grouped[0].durationSec).toBeGreaterThan(1200);
  });

  it("does not merge separate strength sessions just because they share a Workout Tracker log", () => {
    const grouped = groupManualMatchCandidates([
      { manualLogId: "log-1", manualBlockId: "a", activityType: "strength", startedAt: "2026-09-15T18:00:00Z", completedAt: "2026-09-15T18:20:00Z", score: 0.9 },
      { manualLogId: "log-1", manualBlockId: "b", activityType: "strength", startedAt: "2026-09-15T20:00:00Z", completedAt: "2026-09-15T20:20:00Z", score: 0.8 },
    ]);

    expect(grouped).toHaveLength(2);
    expect(grouped.every((candidate) => !candidate.groupedCount)).toBe(true);
  });
});
