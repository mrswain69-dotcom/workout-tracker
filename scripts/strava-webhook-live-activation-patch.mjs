import fs from "node:fs";

function replaceOnce(path, oldText, newText) {
  const source = fs.readFileSync(path, "utf8");
  if (!source.includes(oldText)) throw new Error(`Expected patch anchor not found in ${path}`);
  const updated = source.replace(oldText, newText);
  if (updated === source) throw new Error(`Patch made no change in ${path}`);
  fs.writeFileSync(path, updated);
}

const providerPath = "supabase/functions/_shared/stravaProvider.ts";
replaceOnce(
  providerPath,
  `function webhookSubscriptionUrl(subscriptionId = "") {\n  return subscriptionId\n    ? \`\${STRAVA_WEBHOOK_SUBSCRIPTIONS_URL}/\${encodeURIComponent(subscriptionId)}\`\n    : STRAVA_WEBHOOK_SUBSCRIPTIONS_URL;\n}\n\nexport async function ensureStravaWebhookSubscription() {\n  const config = stravaAppConfig();\n  if (!config.clientId || !config.clientSecret || !config.webhookVerifyToken || !config.webhookSigningSecret || !config.webhookCallbackUrl) {\n    return { state: "unavailable", reason: "missing_configuration", id: null, created: false, repaired: false };\n  }\n\n  const listUrl = new URL(STRAVA_WEBHOOK_SUBSCRIPTIONS_URL);\n  listUrl.searchParams.set("client_id", config.clientId);\n  listUrl.searchParams.set("client_secret", config.clientSecret);\n  const listedResponse = await fetch(listUrl);\n  const listedBody = await listedResponse.json().catch(() => []);\n  if (!listedResponse.ok) throw new Error(\`Strava webhook subscription lookup failed (\${listedResponse.status})\`);\n  const subscriptions = Array.isArray(listedBody) ? listedBody : [];`,
  `function webhookSubscriptionUrl(subscriptionId = "") {\n  return subscriptionId\n    ? \`\${STRAVA_WEBHOOK_SUBSCRIPTIONS_URL}/\${encodeURIComponent(subscriptionId)}\`\n    : STRAVA_WEBHOOK_SUBSCRIPTIONS_URL;\n}\n\nasync function listStravaWebhookSubscriptions(config = stravaAppConfig()) {\n  if (!config.clientId || !config.clientSecret) throw new Error("Strava application credentials are not configured");\n  const listUrl = new URL(STRAVA_WEBHOOK_SUBSCRIPTIONS_URL);\n  listUrl.searchParams.set("client_id", config.clientId);\n  listUrl.searchParams.set("client_secret", config.clientSecret);\n  const listedResponse = await fetch(listUrl);\n  const listedBody = await listedResponse.json().catch(() => []);\n  if (!listedResponse.ok) throw new Error(\`Strava webhook subscription lookup failed (\${listedResponse.status})\`);\n  return Array.isArray(listedBody) ? listedBody : [];\n}\n\nexport async function resolvedStravaWebhookVerifyToken() {\n  const config = stravaAppConfig();\n  if (config.webhookVerifyToken) return config.webhookVerifyToken;\n  if (!config.clientSecret) return "";\n  return (await sha256Hex(\`workout-tracker:strava:webhook:\${config.clientSecret}\`)).slice(0, 48);\n}\n\nexport async function isExpectedStravaWebhookSubscription(subscriptionId: unknown) {\n  const received = String(subscriptionId ?? "").trim();\n  if (!received) return false;\n  const config = stravaAppConfig();\n  if (config.webhookSubscriptionId && received === config.webhookSubscriptionId) return true;\n  if (!config.clientId || !config.clientSecret || !config.webhookCallbackUrl) return false;\n  const subscriptions = await listStravaWebhookSubscriptions(config);\n  return subscriptions.some((row: any) =>\n    String(row?.id ?? "") === received && String(row?.callback_url || "") === config.webhookCallbackUrl\n  );\n}\n\nexport async function ensureStravaWebhookSubscription() {\n  const config = stravaAppConfig();\n  const verifyToken = await resolvedStravaWebhookVerifyToken();\n  if (!config.clientId || !config.clientSecret || !verifyToken || !config.webhookCallbackUrl) {\n    return { state: "unavailable", reason: "missing_configuration", id: null, created: false, repaired: false };\n  }\n\n  const subscriptions = await listStravaWebhookSubscriptions(config);`
);
replaceOnce(
  providerPath,
  `      verify_token: config.webhookVerifyToken,`,
  `      verify_token: verifyToken,`
);

const webhookPath = "supabase/functions/strava-webhook/index.ts";
replaceOnce(
  webhookPath,
  `  json,\n  markStravaObservationDeleted,\n  refreshStravaAccessToken,`,
  `  isExpectedStravaWebhookSubscription,\n  json,\n  markStravaObservationDeleted,\n  refreshStravaAccessToken,\n  resolvedStravaWebhookVerifyToken,`
);
replaceOnce(
  webhookPath,
  `async function processEvent(adminClient: any, eventRow: any, event: any) {\n  try {\n    const { data: connection, error: connectionError } = await adminClient`,
  `async function processEvent(adminClient: any, eventRow: any, event: any) {\n  try {\n    const expectedSubscription = await isExpectedStravaWebhookSubscription(event.subscription_id);\n    if (!expectedSubscription) {\n      await markEvent(adminClient, eventRow.id, {\n        processed_at: new Date().toISOString(),\n        processing_error: "unexpected_subscription",\n      });\n      return;\n    }\n\n    const { data: connection, error: connectionError } = await adminClient`
);
replaceOnce(
  webhookPath,
  `    const verifyToken = url.searchParams.get("hub.verify_token") || "";\n    if (!config.webhookVerifyToken) return json({ error: "Webhook verification is not configured" }, 503);\n    if (mode !== "subscribe" || verifyToken !== config.webhookVerifyToken || !challenge) {`,
  `    const verifyToken = url.searchParams.get("hub.verify_token") || "";\n    const expectedVerifyToken = await resolvedStravaWebhookVerifyToken();\n    if (!expectedVerifyToken) return json({ error: "Webhook verification is not configured" }, 503);\n    if (mode !== "subscribe" || verifyToken !== expectedVerifyToken || !challenge) {`
);
replaceOnce(
  webhookPath,
  `  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);\n  if (!config.webhookSigningSecret) return json({ error: "Webhook signing is not configured" }, 503);\n\n  const signatureHeader = req.headers.get("X-Strava-Signature") || "";\n  const rawBody = await req.text();\n  if (!signatureHeader || !(await verifyWebhookSignature(rawBody, signatureHeader, config.webhookSigningSecret))) {\n    return json({ error: "Invalid webhook signature" }, 403);\n  }`,
  `  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);\n\n  const signatureHeader = req.headers.get("X-Strava-Signature") || "";\n  const rawBody = await req.text();\n  // Strava's current production webhook signing secret is not available to every app.\n  // Verify signatures whenever configured; otherwise authenticate the event against\n  // the application's single live subscription before any provider data is changed.\n  if (config.webhookSigningSecret && (!signatureHeader || !(await verifyWebhookSignature(rawBody, signatureHeader, config.webhookSigningSecret)))) {\n    return json({ error: "Invalid webhook signature" }, 403);\n  }`
);
replaceOnce(
  webhookPath,
  `    console.warn("Signed Strava webhook arrived on a subscription id different from the legacy configured id", {`,
  `    console.warn("Strava webhook arrived on a subscription id different from the legacy configured id", {`
);
replaceOnce(
  webhookPath,
  `    // Strava retries unacknowledged events. An identical signed body is already durable,`,
  `    // Strava retries unacknowledged events. An identical body is already durable,`
);

const testPath = "src/engine/verificationAutomaticPolish.test.js";
replaceOnce(
  testPath,
  `    expect(provider).toContain("export async function ensureStravaWebhookSubscription");\n    expect(provider).toContain('method: "DELETE"');`,
  `    expect(provider).toContain("export async function ensureStravaWebhookSubscription");\n    expect(provider).toContain("export async function resolvedStravaWebhookVerifyToken");\n    expect(provider).toContain("workout-tracker:strava:webhook:");\n    expect(provider).not.toContain("!config.webhookVerifyToken || !config.webhookSigningSecret");\n    expect(provider).toContain('method: "DELETE"');`
);
replaceOnce(
  testPath,
  `  it("keeps the signed webhook authoritative if self-healing changes a legacy subscription id", () => {\n    const webhook = read("supabase/functions/strava-webhook/index.ts");\n    expect(webhook).toContain("Signed Strava webhook arrived on a subscription id different from the legacy configured id");\n    expect(webhook).not.toContain('return json({ error: "Unexpected webhook subscription" }, 403)');\n  });`,
  `  it("supports Strava's live unsigned-delivery fallback without trusting arbitrary webhook payloads", () => {\n    const provider = read("supabase/functions/_shared/stravaProvider.ts");\n    const webhook = read("supabase/functions/strava-webhook/index.ts");\n    expect(provider).toContain("export async function isExpectedStravaWebhookSubscription");\n    expect(webhook).toContain("await isExpectedStravaWebhookSubscription(event.subscription_id)");\n    expect(webhook).toContain('processing_error: "unexpected_subscription"');\n    expect(webhook).toContain("if (config.webhookSigningSecret &&");\n    expect(webhook).not.toContain('return json({ error: "Webhook signing is not configured" }, 503)');\n  });`
);

const docsPath = "docs/verification-integration-stage2-strava.md";
replaceOnce(
  docsPath,
  `- \`STRAVA_WEBHOOK_VERIFY_TOKEN\`;\n- \`STRAVA_WEBHOOK_SIGNING_SECRET\`;\n- \`WORKOUT_TRACKER_APP_URL\`;\n- \`STRAVA_WEBHOOK_SUBSCRIPTION_ID\` after the one application-level subscription is created.`,
  `- \`WORKOUT_TRACKER_APP_URL\`;\n- optional \`STRAVA_WEBHOOK_VERIFY_TOKEN\` override (otherwise derived server-side from the Strava app secret);\n- optional \`STRAVA_WEBHOOK_SIGNING_SECRET\` when Strava exposes a usable signing secret for the application;\n- optional legacy \`STRAVA_WEBHOOK_SUBSCRIPTION_ID\` override. The live subscription is otherwise authenticated against Strava's application-level subscription API before processing.`
);

console.log("Applied Strava webhook live activation patch.");
