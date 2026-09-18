import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("profile recovery production engine parity", () => {
  it("keeps suspended physical blocks and recovery XP rules in server XP mirrors", () => {
    for (const path of [
      "supabase/functions/group-xp-leaderboard/xpEngine.js",
      "supabase/functions/group-seasons-awards/xpEngine.js",
      "supabase/functions/group-challenges/groupChallengeXpEngine.js",
    ]) {
      const source = read(path);
      expect(source).toContain("suspendedByRecoveryMode");
      expect(source).toContain("profileRecoveryMode");
      expect(source).toContain("isProfileRecoveryModeLog");
      expect(source).toContain("injuryPhysioComplete");
      expect(source).toContain("illnessRecoveryComplete");
    }
  });

  it("keeps recovery-mode Consistency substitution in every server mirror", () => {
    for (const path of [
      "supabase/functions/group-consistency-leaderboard/consistencyEngine.js",
      "supabase/functions/group-challenges/consistencyEngine.js",
      "supabase/functions/group-seasons-awards/consistencyEngine.js",
    ]) {
      const source = read(path);
      expect(source).toContain('completionSource: "recovery_mode"');
      expect(source).toContain("profileRecoveryModeCompletedOnDay");
    }
  });
});
