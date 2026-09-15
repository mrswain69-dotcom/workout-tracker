import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, createUserClient, json } from "../_shared/stravaProvider.ts";
import {
  applyRecentVerifiedAutoPopulationForProfile,
  undoVerifiedAutoPopulationForProfile,
} from "../_shared/verificationAutoPopulate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function text(value: unknown) {
  return value === null || value === undefined ? "" : String(value).trim();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405, corsHeaders);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Authentication required" }, 401, corsHeaders);

    const userClient = createUserClient(jwt);
    const adminClient = createAdminClient();
    if (!userClient || !adminClient) return json({ error: "Verification service unavailable" }, 503, corsHeaders);

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) return json({ error: "Authentication required" }, 401, corsHeaders);

    const body = await req.json().catch(() => ({}));
    const action = text(body?.action || "apply");
    const profileId = text(body?.profileId);
    if (!profileId) return json({ error: "Athlete profile is required" }, 400, corsHeaders);

    const owned = await userClient.from("profiles")
      .select("id,archived")
      .eq("id", profileId)
      .maybeSingle();
    if (owned.error || !owned.data || owned.data.archived) return json({ error: "Athlete profile is not available" }, 404, corsHeaders);

    if (action === "apply") {
      const result = await applyRecentVerifiedAutoPopulationForProfile(adminClient, profileId, {
        actorUserId: authData.user.id,
      });
      return json(result, 200, corsHeaders);
    }

    if (action === "undo") {
      const verifiedActivityId = text(body?.verifiedActivityId);
      if (!verifiedActivityId) return json({ error: "Verified activity is required" }, 400, corsHeaders);
      const result = await undoVerifiedAutoPopulationForProfile(
        adminClient,
        profileId,
        verifiedActivityId,
        authData.user.id
      );
      return json(result, 200, corsHeaders);
    }

    return json({ error: "Unsupported auto-population action" }, 400, corsHeaders);
  } catch (error) {
    console.error("Verification auto-population failed", error);
    return json({ error: error instanceof Error ? error.message : "Verification auto-population failed" }, 500, corsHeaders);
  }
});
