import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import {
  createAdminClient,
  epochToIso,
  fetchStravaActivity,
  json,
  markStravaObservationDeleted,
  refreshStravaAccessToken,
  sha256Hex,
  stravaAppConfig,
  upsertStravaObservation,
} from "../_shared/stravaProvider.ts";

function parseSignatureHeader(header: string) {
  const parts = Object.fromEntries(
    header.split(",").map((part) => {
      const index = part.indexOf("=");
      return index === -1 ? [part.trim(), ""] : [part.slice(0, index).trim(), part.slice(index + 1).trim()];
    })
  );
  return { timestamp: parts.t || "", signature: parts.v1 || "" };
}

function hexBytes(value: string) {
  if (!/^[0-9a-f]+$/i.test(value) || value.length % 2 !== 0) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

async function verifyWebhookSignature(rawBody: string, header: string, secret: string) {
  const { timestamp, signature } = parseSignatureHeader(header);
  const timestampSeconds = Number(timestamp);
  const signatureBytes = hexBytes(signature);
  if (!Number.isFinite(timestampSeconds) || !signatureBytes) return false;
  if (Math.abs(Date.now() / 1000 - timestampSeconds) > 300) return false;

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );
  return await crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    new TextEncoder().encode(`${timestamp}.${rawBody}`)
  );
}

async function markEvent(adminClient: any, eventId: string, values: Record<string, unknown>) {
  await adminClient.from("strava_webhook_events").update(values).eq("id", eventId);
}

async function processEvent(adminClient: any, eventRow: any, event: any) {
  try {
    const { data: connection, error: connectionError } = await adminClient
      .from("external_connections")
      .select("id,family_id,profile_id,provider,provider_account_id,status,scopes")
      .eq("provider", "strava")
      .eq("provider_account_id", String(event.owner_id))
      .maybeSingle();
    if (connectionError) throw connectionError;

    if (!connection) {
      await markEvent(adminClient, eventRow.id, {
        processed_at: new Date().toISOString(),
        processing_error: "connection_not_found",
      });
      return;
    }

    await markEvent(adminClient, eventRow.id, { connection_id: connection.id });

    const deauthorized =
      event.object_type === "athlete" &&
      event.updates &&
      String(event.updates.authorized).toLowerCase() === "false";

    if (deauthorized) {
      const disconnectedAt = new Date().toISOString();
      await Promise.all([
        adminClient
          .from("external_connections")
          .update({ status: "disconnected", disconnected_at: disconnectedAt, last_error_code: null })
          .eq("id", connection.id),
        adminClient.from("external_connection_access_tokens").delete().eq("connection_id", connection.id),
        adminClient.from("external_connection_refresh_tokens").delete().eq("connection_id", connection.id),
      ]);
      await markEvent(adminClient, eventRow.id, {
        processed_at: new Date().toISOString(),
        processing_error: null,
      });
      return;
    }

    if (event.object_type !== "activity") {
      await markEvent(adminClient, eventRow.id, {
        processed_at: new Date().toISOString(),
        processing_error: null,
      });
      return;
    }

    if (event.aspect_type === "delete") {
      await markStravaObservationDeleted(adminClient, connection.id, String(event.object_id));
      await markEvent(adminClient, eventRow.id, {
        processed_at: new Date().toISOString(),
        processing_error: null,
      });
      return;
    }

    const accessToken = await refreshStravaAccessToken(adminClient, connection.id);
    const activity = await fetchStravaActivity(accessToken, String(event.object_id));
    if (!activity) {
      await markStravaObservationDeleted(adminClient, connection.id, String(event.object_id));
    } else {
      await upsertStravaObservation(adminClient, connection, activity);
    }

    await adminClient
      .from("external_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error_code: null })
      .eq("id", connection.id);
    await markEvent(adminClient, eventRow.id, {
      processed_at: new Date().toISOString(),
      processing_error: null,
    });
  } catch (error) {
    console.error("Strava webhook background processing failed", error);
    await markEvent(adminClient, eventRow.id, {
      processed_at: new Date().toISOString(),
      processing_error: String((error as any)?.message || error).slice(0, 1000),
    });
  }
}

Deno.serve(async (req: Request) => {
  const config = stravaAppConfig();

  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode") || "";
    const challenge = url.searchParams.get("hub.challenge") || "";
    const verifyToken = url.searchParams.get("hub.verify_token") || "";
    if (!config.webhookVerifyToken) return json({ error: "Webhook verification is not configured" }, 503);
    if (mode !== "subscribe" || verifyToken !== config.webhookVerifyToken || !challenge) {
      return json({ error: "Webhook verification failed" }, 403);
    }
    return json({ "hub.challenge": challenge });
  }

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  if (!config.webhookSigningSecret) return json({ error: "Webhook signing is not configured" }, 503);

  const signatureHeader = req.headers.get("X-Strava-Signature") || "";
  const rawBody = await req.text();
  if (!signatureHeader || !(await verifyWebhookSignature(rawBody, signatureHeader, config.webhookSigningSecret))) {
    return json({ error: "Invalid webhook signature" }, 403);
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return json({ error: "Invalid webhook payload" }, 400);
  }

  const validObjectType = event?.object_type === "activity" || event?.object_type === "athlete";
  const validAspect = ["create", "update", "delete"].includes(event?.aspect_type);
  const eventTime = epochToIso(event?.event_time);
  const subscriptionId = Number(event?.subscription_id);
  const ownerId = Number(event?.owner_id);
  const objectId = Number(event?.object_id);
  if (
    !validObjectType ||
    !validAspect ||
    !eventTime ||
    !Number.isFinite(subscriptionId) ||
    !Number.isFinite(ownerId) ||
    !Number.isFinite(objectId)
  ) {
    return json({ error: "Incomplete webhook payload" }, 400);
  }
  if (config.webhookSubscriptionId && String(subscriptionId) !== config.webhookSubscriptionId) {
    return json({ error: "Unexpected webhook subscription" }, 403);
  }

  const adminClient = createAdminClient();
  if (!adminClient) return json({ error: "Webhook service unavailable" }, 503);

  const eventKey = await sha256Hex(rawBody);
  const { data: eventRow, error: insertError } = await adminClient
    .from("strava_webhook_events")
    .insert({
      event_key: eventKey,
      subscription_id: subscriptionId,
      owner_id: ownerId,
      object_type: event.object_type,
      object_id: objectId,
      aspect_type: event.aspect_type,
      updates: event.updates && typeof event.updates === "object" ? event.updates : {},
      event_time: eventTime,
    })
    .select("id,event_key")
    .single();

  if (insertError) {
    // Strava retries unacknowledged events. An identical signed body is already durable,
    // so a uniqueness retry should be acknowledged without processing it twice.
    if ((insertError as any)?.code === "23505") return json({ ok: true, duplicate: true });
    console.error("Strava webhook event persistence failed", insertError);
    return json({ error: "Webhook persistence failed" }, 500);
  }

  EdgeRuntime.waitUntil(processEvent(adminClient, eventRow, event));
  return json({ ok: true });
});
