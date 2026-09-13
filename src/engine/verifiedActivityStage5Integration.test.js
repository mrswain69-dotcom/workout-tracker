import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

describe("Verification Integration Stage 5 authority contract", () => {
  it("renders verified cardio inside Performance Autobiography without passing it into historical PB engines", () => {
    const autobiography = read("src/components/progress/PerformanceAutobiography.jsx");

    expect(autobiography).toContain(
      'import VerifiedCardioAutobiographyEvidence from "./VerifiedCardioAutobiographyEvidence.jsx"'
    );
    expect(autobiography).toContain("verificationData = null");
    expect(autobiography).toContain("<VerifiedCardioAutobiographyEvidence");
    expect(autobiography).toContain("verificationData={verificationData}");

    const historicalCall = autobiography.slice(
      autobiography.indexOf("buildHistoricalAutobiographyFoundation({"),
      autobiography.indexOf("const chapters = foundation.chapters")
    );
    expect(historicalCall).not.toContain("verificationData");
    expect(historicalCall).not.toContain("verifiedCardio");
  });

  it("shares one read-side verification payload between Connected Sources and Autobiography", () => {
    const section = read("src/components/progress/AssessmentAnalysisSection.jsx");

    expect(section).toContain("const [verificationData, setVerificationData] = useState(null)");
    expect(section).toContain("onDataChange={setVerificationData}");
    expect(section).toContain("verificationData={verificationData}");
  });

  it("keeps canonical improvement observations independent of external verification", () => {
    const historicalAge = read("src/engine/historicalAgeChapterEngine.js");
    const improvement = read("src/engine/groupImprovementEngine.js");

    expect(historicalAge).toContain("buildImprovementObservations({");
    expect(historicalAge).toContain("workoutLogs: scopedWorkoutLogs");
    expect(historicalAge).toContain("assessmentRuns: scopedAssessment.runs");
    expect(historicalAge).not.toContain("verifiedCardioEvidenceEngine");
    expect(historicalAge).not.toContain("verificationData");
    expect(improvement).not.toContain("verifiedCardioEvidenceEngine");
    expect(improvement).not.toContain("verificationData");
  });

  it("does not make verified cardio an XP or badge dependency", () => {
    const xp = read("src/engine/xpEngine.js");
    const badges = read("src/engine/badgeStatsV2.js");
    const evidence = read("src/engine/verifiedCardioEvidenceEngine.js");

    expect(xp).not.toContain("verifiedCardioEvidenceEngine");
    expect(xp).not.toContain("verificationData");
    expect(badges).not.toContain("verifiedCardioEvidenceEngine");
    expect(badges).not.toContain("verificationData");
    expect(evidence).toContain('authority: "verified_evidence_only"');
    expect(evidence).toContain("rewardXp: 0");
  });

  it("keeps the browser verification layer read-only with respect to Workout Tracker logs", () => {
    const db = read("src/verifiedActivityDb.js");
    const progress = read("src/components/progress/VerifiedActivitySection.jsx");

    expect(db).not.toContain('.from("logs")');
    expect(db).not.toMatch(/\.from\([^)]*\)\s*\.(?:insert|update|upsert|delete)\s*\(/);
    expect(progress).not.toMatch(/upsertLog|saveLog|awardXp|claimReward|grantXp/);
    expect(progress).toContain("Evidence only · PB authority unchanged");
  });
});
