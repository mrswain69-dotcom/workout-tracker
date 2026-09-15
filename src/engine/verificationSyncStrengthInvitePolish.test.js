import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => fs.readFileSync(path, "utf8");

const actions = read("supabase/functions/verification-actions/index.ts");
const reconcile = read("supabase/functions/_shared/verificationReconcile.ts");
const progress = read("src/components/progress/VerifiedActivityEvidenceSection.jsx");
const progressCss = read("src/components/progress/VerifiedActivityInteractions.css");
const connectionCss = read("src/components/settings/ConnectionsSettings.css");
const groupHub = read("src/groups/GroupHub.jsx");

describe("verification sync, strength matching and invite polish", () => {
  it("recognises Strava WeightTraining as strength on both server matching paths", () => {
    expect(actions).toContain("weight_?training");
    expect(reconcile).toContain("weight_?training");
  });

  it("uses real strength-session timing for conservative cross-day automatic matching", () => {
    expect(reconcile).toContain("function strengthSessionAutoScore");
    expect(reconcile).toContain("candidate.startedAt");
    expect(reconcile).toContain("deltaMin <= 5");
    expect(reconcile).toContain("Math.abs(offset) > USER_MATCH_WINDOW_DAYS");
    expect(reconcile).toContain("date_offset_days: offset");
  });

  it("preserves user-confirmed strength links as session evidence rather than movement-duration proof", () => {
    const manualOnlyGuard = reconcile.indexOf('if (candidate.manualOnly) return canonicalActivityFamily(group.activityType) === "strength"');
    const distanceGuard = reconcile.indexOf("if (!metricWithin(group.distanceM", manualOnlyGuard);
    expect(manualOnlyGuard).toBeGreaterThan(-1);
    expect(distanceGuard).toBeGreaterThan(manualOnlyGuard);
  });

  it("updates successful provider sync time and exposes sync from Progress", () => {
    expect(actions).toContain("last_sync_at: syncedAt");
    expect(progress).toContain("checkConnectedSources");
    expect(progress).toContain('"Run sync"');
    expect(progress).toContain("manualSyncCooldown");
  });

  it("keeps mobile verification controls inside their card and makes sync feedback readable", () => {
    expect(progressCss).toContain(".verified-match-finder>button");
    expect(progressCss).toContain("max-width:100%");
    expect(progressCss).toContain("overflow-wrap:anywhere");
    expect(connectionCss).toContain("background:#10313b");
    expect(connectionCss).toContain("color:#effcff");
  });

  it("keeps every one-use secret generated in the current Groups window copyable and revokable", () => {
    expect(groupHub).toContain("privateInviteSecrets");
    expect(groupHub).toContain("latestPrivateInviteCode");
    expect(groupHub).toContain('copyText(generatedCode, "Private invite copied.")');
    expect(groupHub).toContain("handleRevokeInvite(latestPrivateInvite)");
    expect(groupHub).not.toContain("const [newInviteCode");
  });
});
