import { describe, expect, it } from "vitest";
import fs from "node:fs";

const read = (path) => fs.readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

describe("Strava webhook live activation", () => {
  it("does not require optional webhook secrets to provision automatic sync", () => {
    const provider = read("supabase/functions/_shared/stravaProvider.ts");
    const webhook = read("supabase/functions/strava-webhook/index.ts");
    expect(provider).toContain("resolvedStravaWebhookVerifyToken");
    expect(provider).toContain("isExpectedStravaWebhookSubscription");
    expect(provider).not.toContain("!config.webhookVerifyToken || !config.webhookSigningSecret");
    expect(webhook).toContain("await isExpectedStravaWebhookSubscription(event.subscription_id)");
    expect(webhook).toContain("if (config.webhookSigningSecret &&");
  });
});
