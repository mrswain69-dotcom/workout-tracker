import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.116.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function validYmd(value: unknown) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function londonYmd(value: Date | string | null | undefined = new Date()) {
  const date = value instanceof Date ? value : new Date(value || "");
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${byType.year}-${byType.month}-${byType.day}`;
}

function platformKey(jsonName: string, singleName: string, legacyName: string) {
  const single = Deno.env.get(singleName);
  if (single) return single;
  const encoded = Deno.env.get(jsonName);
  if (encoded) {
    try {
      const parsed = JSON.parse(encoded);
      if (parsed?.default) return String(parsed.default);
    } catch {
      // Fall through while environments complete key migration.
    }
  }
  return Deno.env.get(legacyName) || "";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const publishableKey = platformKey(
      "SUPABASE_PUBLISHABLE_KEYS",
      "SUPABASE_PUBLISHABLE_KEY",
      "SUPABASE_ANON_KEY"
    );
    const secretKey = platformKey(
      "SUPABASE_SECRET_KEYS",
      "SUPABASE_SECRET_KEY",
      "SUPABASE_SERVICE_ROLE_KEY"
    );
    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Historical Timeline service is missing required Supabase environment keys.");
      return json({ error: "Historical Timeline service unavailable" }, 503);
    }

    const userClient = createClient(supabaseUrl, publishableKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${jwt}` } },
    });
    const adminClient = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    if (authError || !authData?.user) return json({ error: "Authentication required" }, 401);

    const body = await req.json().catch(() => ({}));
    const profileId = typeof body?.profileId === "string" ? body.profileId : "";
    const referenceDate = validYmd(body?.referenceDate) ? body.referenceDate : londonYmd();
    if (!profileId) return json({ error: "Athlete profile is required" }, 400);

    // Privacy boundary: prove ownership of this exact profile through the normal
    // profile RLS policy before making any privileged historical reads.
    const { data: ownedProfile, error: profileError } = await userClient
      .from("profiles")
      .select("id,family_id,birth_date")
      .eq("id", profileId)
      .maybeSingle();
    if (profileError || !ownedProfile) {
      return json({ error: "Athlete profile not available" }, 403);
    }

    const [snapshotsResult, membershipsResult] = await Promise.all([
      adminClient
        .from("profile_consistency_schedule_snapshots")
        .select("profile_id,effective_date,schedule_json")
        .eq("profile_id", profileId)
        .lte("effective_date", referenceDate)
        .order("effective_date", { ascending: true }),
      adminClient
        .from("group_memberships")
        .select("id")
        .eq("profile_id", profileId)
        .eq("family_id", ownedProfile.family_id)
        .order("joined_at", { ascending: true }),
    ]);

    if (snapshotsResult.error || membershipsResult.error) {
      console.error(
        "Historical Timeline source read failed",
        snapshotsResult.error || membershipsResult.error
      );
      return json({ error: "Historical Timeline history unavailable" }, 500);
    }

    const membershipIds = (membershipsResult.data || [])
      .map((row: any) => row?.id)
      .filter(Boolean);

    let awards: any[] = [];
    if (membershipIds.length) {
      const { data, error } = await adminClient
        .from("group_progress_awards")
        .select(
          "id,group_id,membership_id,period_type,period_start,period_end,season_number,award_type,rank,score_value,score_unit,score_version,awarded_at"
        )
        .in("membership_id", membershipIds)
        .lte("period_end", referenceDate)
        .order("period_end", { ascending: true })
        .order("id", { ascending: true });
      if (error) {
        console.error("Historical Timeline award read failed", error);
        return json({ error: "Historical Timeline history unavailable" }, 500);
      }
      awards = data || [];
    }

    return json({
      profile: {
        id: ownedProfile.id,
        birthDate: ownedProfile.birth_date || null,
      },
      consistencySnapshots: snapshotsResult.data || [],
      groupAwards: awards,
      knowledge: {
        sourceAvailable: false,
        milestones: [],
      },
      referenceDate,
    });
  } catch (error) {
    console.error("Historical Timeline service failed", error);
    return json({ error: "Historical Timeline service failed" }, 500);
  }
});
