import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createAdminClient, createUserClient, json } from "../_shared/stravaProvider.ts";
import { reconcileVerifiedActivitiesForProfile } from "../_shared/verificationReconcile.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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
    const profileId = typeof body?.profileId === "string" ? body.profileId.trim() : "";
    if (!profileId) return json({ error: "Athlete profile is required" }, 400, corsHeaders);

    // Resolve the exact target through ordinary profile RLS before any server-authority reconciliation.
    const { data: ownedProfile, error: profileError } = await userClient
      .from("profiles")
      .select("id")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError || !ownedProfile) return json({ error: "Athlete profile not available" }, 403, corsHeaders);

    const result = await reconcileVerifiedActivitiesForProfile(adminClient, ownedProfile.id);
    return json(result, 200, corsHeaders);
  } catch (error) {
    console.error("Verification reconciliation failed", error);
    return json({ error: "Verification reconciliation failed" }, 500, corsHeaders);
  }
});
