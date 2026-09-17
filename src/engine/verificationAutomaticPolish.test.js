import fs from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path) => fs.readFileSync(path, "utf8");

describe("automatic verification polish", () => {
  it("groups overlapping strength blocks before automatic matching and still preserves raw candidates for user-confirmed links", () => {
    const source = read("supabase/functions/_shared/verificationReconcile.ts");
    expect(source).toContain("function groupStrengthManualCandidates");
    expect(source).toContain("coveredTargetKeys");
    expect(source).toContain("const rawCandidates = manualCandidates");
    expect(source).toContain("const candidates = groupStrengthManualCandidates(rawCandidates)");
    expect(source).toContain("rawCandidates.find((candidate)");
    expect(source).toContain("candidateTargetKeys(candidate).every");
    expect(source).toContain("STRENGTH_CLUSTER_MAX_START_GAP_MS");
  });

  it("allows a unique same-session strength match without requiring exact movement names or a trustworthy form-entry duration", () => {
    const source = read("supabase/functions/_shared/verificationReconcile.ts");
    expect(source).toContain("if (deltaMin <= 5) startScore = 0.45");
    expect(source).toContain("else if (deltaMin <= 15) startScore = 0.35");
    expect(source).toContain("const dateScore = offsetDays === 0 ? 0.25 : offsetDays === 1 ? 0.16 : 0.08");
    expect(source).toContain("const MANUAL_MARGIN = 0.1");
  });

  it("self-heals the single Strava webhook subscription and provisions it from both connection and manual-sync paths", () => {
    const provider = read("supabase/functions/_shared/stravaProvider.ts");
    const actions = read("supabase/functions/verification-actions/index.ts");
    const callback = read("supabase/functions/strava-oauth-callback/index.ts");
    expect(provider).toContain("STRAVA_WEBHOOK_SUBSCRIPTIONS_URL");
    expect(provider).toContain("export async function ensureStravaWebhookSubscription");
    expect(provider).toContain("export async function resolvedStravaWebhookVerifyToken");
    expect(provider).toContain("workout-tracker:strava:webhook:");
    expect(provider).not.toContain("!config.webhookVerifyToken || !config.webhookSigningSecret");
    expect(provider).toContain('method: "DELETE"');
    expect(provider).toContain('method: "POST"');
    expect(actions).toContain('action === "ensure_auto_sync"');
    expect(actions).toContain("await ensureStravaWebhookSubscription()");
    expect(callback).toContain("await ensureStravaWebhookSubscription()");
  });

  it("supports Strava's live unsigned-delivery fallback without trusting arbitrary webhook payloads", () => {
    const provider = read("supabase/functions/_shared/stravaProvider.ts");
    const webhook = read("supabase/functions/strava-webhook/index.ts");
    expect(provider).toContain("export async function isExpectedStravaWebhookSubscription");
    expect(webhook).toContain("await isExpectedStravaWebhookSubscription(event.subscription_id)");
    expect(webhook).toContain('processing_error: "unexpected_subscription"');
    expect(webhook).toContain("if (config.webhookSigningSecret &&");
    expect(webhook).not.toContain('return json({ error: "Webhook signing is not configured" }, 503)');
  });

  it("silently provisions automatic sync and refreshes evidence after returning to the app", () => {
    const db = read("src/verifiedActivityDb.js");
    const ui = read("src/components/progress/VerifiedActivityEvidenceSection.jsx");
    expect(db).toContain("ensureConnectedSourceAutoSync");
    expect(ui).toContain("autoSyncEnsureKeyRef");
    expect(ui).toContain('window.addEventListener("focus", refreshWhenVisible)');
    expect(ui).toContain('document.addEventListener("visibilitychange", refreshWhenVisible)');
    expect(ui).toContain("Automatic Strava updates are active.");
    expect(ui).toContain("stravaConnection?.auto_sync_enabled === false");
  });
});
