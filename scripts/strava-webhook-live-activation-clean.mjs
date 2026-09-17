import fs from "node:fs";

function replaceOnce(path, oldText, newText) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(oldText)) throw new Error(`Expected patch anchor not found in ${path}`);
  const updated = source.replace(oldText, newText);
  if (updated === source) throw new Error(`Patch made no change in ${path}`);
  fs.writeFileSync(path, updated);
}

const provider = "supabase/functions/_shared/stravaProvider.ts";
replaceOnce(provider,
`function webhookSubscriptionUrl(subscriptionId = "") {
  return subscriptionId
    ? \`${STRAVA_WEBHOOK_SUBSCRIPTIONS_URL}/\${encodeURIComponent(subscriptionId)}\`
    : STRAVA_WEBHOOK_SUBSCRIPTIONS_URL;
}

export async function ensureStravaWebhookSubscription() {
  const config = stravaAppConfig();
  if (!config.clientId || !config.clientSecret || !config.webhookVerifyToken || !config.webhookSigningSecret || !config.webhookCallbackUrl) {
    return { state: "unavailable", reason: "missing_configuration", id: null, created: false, repaired: false };
  }

  const listUrl = new URL(STRAVA_WEBHOOK_SUBSCRIPTIONS_URL);
  listUrl.searchParams.set("client_id", config.clientId);
  listUrl.searchParams.set("client_secret", config.clientSecret);
  const listedResponse = await fetch(listUrl);
  const listedBody = await listedResponse.json().catch(() => []);
  if (!listedResponse.ok) throw new Error(\`Strava webhook subscription lookup failed (\${listedResponse.status})\`);
  const subscriptions = Array.isArray(listedBody) ? listedBody : [];`,
`function webhookSubscriptionUrl(subscriptionId = "") {
  return subscriptionId
    ? \`${STRAVA_WEBHOOK_SUBSCRIPTIONS_URL}/\${encodeURIComponent(subscriptionId)}\`
    : STRAVA_WEBHOOK_SUBSCRIPTIONS_URL;
}

async function listStravaWebhookSubscriptions(config = stravaAppConfig()) {
  if (!config.clientId || !config.clientSecret) throw new Error("Strava application credentials are not configured");
  const listUrl = new URL(STRAVA_WEBHOOK_SUBSCRIPTIONS_URL);
  listUrl.searchParams.set("client_id", config.clientId);
  listUrl.searchParams.set("client_secret", config.clientSecret);
  const listedResponse = await fetch(listUrl);
  const listedBody = await listedResponse.json().catch(() => []);
  if (!listedResponse.ok) throw new Error(\`Strava webhook subscription lookup failed (\${listedResponse.status})\`);
  return Array.isArray(listedBody) ? listedBody : [];
}

export async function resolvedStravaWebhookVerifyToken() {
  const config = stravaAppConfig();
  if (config.webhookVerifyToken) return config.webhookVerifyToken;
  if (!config.clientSecret) return "";
  return (await sha256Hex(\`workout-tracker:strava:webhook:\${config.clientSecret}\`)).slice(0, 48);
}

export async function isExpectedStravaWebhookSubscription(subscriptionId: unknown) {
  const received = String(subscriptionId ?? "").trim();
  if (!received) return false;
  const config = stravaAppConfig();
  if (config.webhookSubscriptionId && received === config.webhookSubscriptionId) return true;
  if (!config.clientId || !config.clientSecret || !config.webhookCallbackUrl) return false;
  const subscriptions = await listStravaWebhookSubscriptions(config);
  return subscriptions.some((row: any) =>
    String(row?.id ?? "") === received && String(row?.callback_url || "") === config.webhookCallbackUrl
  );
}

export async function ensureStravaWebhookSubscription() {
  const config = stravaAppConfig();
  const verifyToken = await resolvedStravaWebhookVerifyToken();
  if (!config.clientId || !config.clientSecret || !verifyToken || !config.webhookCallbackUrl) {
    return { state: "unavailable", reason: "missing_configuration", id: null, created: false, repaired: false };
  }

  const subscriptions = await listStravaWebhookSubscriptions(config);`);
replaceOnce(provider, `      verify_token: config.webhookVerifyToken,`, `      verify_token: verifyToken,`);

const webhook = "supabase/functions/strava-webhook/index.ts";
replaceOnce(webhook,
`  json,
  markStravaObservationDeleted,
  refreshStravaAccessToken,`,
`  isExpectedStravaWebhookSubscription,
  json,
  markStravaObservationDeleted,
  refreshStravaAccessToken,
  resolvedStravaWebhookVerifyToken,`);
replaceOnce(webhook,
`async function processEvent(adminClient: any, eventRow: any, event: any) {
  try {
    const { data: connection, error: connectionError } = await adminClient`,
`async function processEvent(adminClient: any, eventRow: any, event: any) {
  try {
    const expectedSubscription = await isExpectedStravaWebhookSubscription(event.subscription_id);
    if (!expectedSubscription) {
      await markEvent(adminClient, eventRow.id, {
        processed_at: new Date().toISOString(),
        processing_error: "unexpected_subscription",
      });
      return;
    }

    const { data: connection, error: connectionError } = await adminClient`);
replaceOnce(webhook,
`    const verifyToken = url.searchParams.get("hub.verify_token") || "";
    if (!config.webhookVerifyToken) return json({ error: "Webhook verification is not configured" }, 503);
    if (mode !== "subscribe" || verifyToken !== config.webhookVerifyToken || !challenge) {`,
`    const verifyToken = url.searchParams.get("hub.verify_token") || "";
    const expectedVerifyToken = await resolvedStravaWebhookVerifyToken();
    if (!expectedVerifyToken) return json({ error: "Webhook verification is not configured" }, 503);
    if (mode !== "subscribe" || verifyToken !== expectedVerifyToken || !challenge) {`);
replaceOnce(webhook,
`  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!config.webhookSigningSecret) return json({ error: "Webhook signing is not configured" }, 503);

  const signatureHeader = req.headers.get("X-Strava-Signature") || "";
  const rawBody = await req.text();
  if (!signatureHeader || !(await verifyWebhookSignature(rawBody, signatureHeader, config.webhookSigningSecret))) {
    return json({ error: "Invalid webhook signature" }, 403);
  }`,
`  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const signatureHeader = req.headers.get("X-Strava-Signature") || "";
  const rawBody = await req.text();
  // Verify signatures whenever configured. If Strava has not supplied a signing secret,
  // authenticate the event against the application's live subscription before data changes.
  if (config.webhookSigningSecret && (!signatureHeader || !(await verifyWebhookSignature(rawBody, signatureHeader, config.webhookSigningSecret)))) {
    return json({ error: "Invalid webhook signature" }, 403);
  }`);
replaceOnce(webhook, `    console.warn("Signed Strava webhook arrived on a subscription id different from the legacy configured id", {`, `    console.warn("Strava webhook arrived on a subscription id different from the legacy configured id", {`);
replaceOnce(webhook, `    // Strava retries unacknowledged events. An identical signed body is already durable,`, `    // Strava retries unacknowledged events. An identical body is already durable,`);

const polishTest = "src/engine/verificationAutomaticPolish.test.js";
replaceOnce(polishTest,
`    expect(provider).toContain("export async function ensureStravaWebhookSubscription");
    expect(provider).toContain('method: "DELETE"');`,
`    expect(provider).toContain("export async function ensureStravaWebhookSubscription");
    expect(provider).toContain("export async function resolvedStravaWebhookVerifyToken");
    expect(provider).toContain("workout-tracker:strava:webhook:");
    expect(provider).not.toContain("!config.webhookVerifyToken || !config.webhookSigningSecret");
    expect(provider).toContain('method: "DELETE"');`);
replaceOnce(polishTest,
`  it("keeps the signed webhook authoritative if self-healing changes a legacy subscription id", () => {
    const webhook = read("supabase/functions/strava-webhook/index.ts");
    expect(webhook).toContain("Signed Strava webhook arrived on a subscription id different from the legacy configured id");
    expect(webhook).not.toContain('return json({ error: "Unexpected webhook subscription" }, 403)');
  });`,
`  it("supports Strava's live unsigned-delivery fallback without trusting arbitrary webhook payloads", () => {
    const provider = read("supabase/functions/_shared/stravaProvider.ts");
    const webhook = read("supabase/functions/strava-webhook/index.ts");
    expect(provider).toContain("export async function isExpectedStravaWebhookSubscription");
    expect(webhook).toContain("await isExpectedStravaWebhookSubscription(event.subscription_id)");
    expect(webhook).toContain('processing_error: "unexpected_subscription"');
    expect(webhook).toContain("if (config.webhookSigningSecret &&");
    expect(webhook).not.toContain('return json({ error: "Webhook signing is not configured" }, 503)');
  });`);

const docs = "docs/verification-integration-stage2-strava.md";
replaceOnce(docs,
`- \`STRAVA_WEBHOOK_VERIFY_TOKEN\`;
- \`STRAVA_WEBHOOK_SIGNING_SECRET\`;
- \`WORKOUT_TRACKER_APP_URL\`;
- \`STRAVA_WEBHOOK_SUBSCRIPTION_ID\` after the one application-level subscription is created.`,
`- \`WORKOUT_TRACKER_APP_URL\`;
- optional \`STRAVA_WEBHOOK_VERIFY_TOKEN\` override (otherwise derived server-side from the Strava app secret);
- optional \`STRAVA_WEBHOOK_SIGNING_SECRET\` when Strava exposes a usable signing secret for the application;
- optional legacy \`STRAVA_WEBHOOK_SUBSCRIPTION_ID\` override. The live subscription is otherwise authenticated against Strava's application-level subscription API before processing.`);

const groupTest = "src/groups/GroupHub.test.jsx";
const groupSource = fs.readFileSync(groupTest, "utf8");
const groupUpdated = groupSource.replaceAll("2026-09-17T12:00:00Z", "2099-09-17T12:00:00Z");
if (groupUpdated === groupSource) throw new Error("Expired Groups fixture anchor not found");
fs.writeFileSync(groupTest, groupUpdated);

console.log("Applied clean Strava webhook live activation patch.");
