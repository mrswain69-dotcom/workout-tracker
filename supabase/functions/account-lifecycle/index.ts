import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { revokeStravaToken } from "../_shared/stravaProvider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const APP_URL = Deno.env.get("APP_PUBLIC_URL") || "https://workout-tracker-ivory-tau.vercel.app";
const SUPPORT_EMAIL = "support@workouttrackerapp.io";
const FROM_EMAIL = "Workout Tracker <support@workouttrackerapp.io>";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function adminClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  if (!url || !serviceRole) return null;
  return createClient(url, serviceRole, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function anonymousClient() {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return null;
  return createClient(url, anon, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function authenticatedClient(jwt: string) {
  const url = Deno.env.get("SUPABASE_URL") || "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || "";
  if (!url || !anon) return null;
  return createClient(url, anon, {
    global: { headers: { Authorization: `Bearer ${jwt}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function shell(title: string, body: string) {
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#0f1117;font-family:Arial,Helvetica,sans-serif;color:#ecf6ff">
  <div style="max-width:620px;margin:0 auto;padding:28px 18px 38px">
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
      <div style="width:36px;height:36px;border-radius:10px;background:#ff6b16;color:white;display:grid;place-items:center;font-weight:900;font-size:22px">⚡</div>
      <div><div style="font-weight:900;font-size:18px">Workout Tracker</div><div style="font-size:11px;color:#9baabc">Build Strength. Build Habits.</div></div>
    </div>
    <div style="border:1px solid #27313d;border-radius:22px;background:#171b23;overflow:hidden">
      <div style="padding:26px 26px 8px"><h1 style="font-size:28px;line-height:1.1;margin:0">${title}</h1></div>
      <div style="padding:10px 26px 28px;color:#bcc9d6;line-height:1.55;font-size:15px">${body}</div>
    </div>
    <div style="text-align:center;color:#77879a;font-size:11px;line-height:1.5;margin-top:18px">
      Workout Tracker account email · <a href="mailto:${SUPPORT_EMAIL}" style="color:#00e5ff">Need help?</a>
    </div>
  </div>
</body>
</html>`;
}

function welcomeHtml() {
  const visual = (n: string, heading: string, copy: string, accent: string) => `
    <div style="margin:14px 0;padding:14px;border:1px solid #2a3440;border-radius:14px;background:#0f131a">
      <div style="display:flex;gap:12px;align-items:flex-start">
        <div style="flex:0 0 28px;height:28px;border-radius:9px;background:${accent};color:#071216;display:grid;place-items:center;font-weight:900">${n}</div>
        <div><div style="color:#f4f8fb;font-weight:800">${heading}</div><div style="margin-top:3px;color:#94a4b5;font-size:13px">${copy}</div></div>
      </div>
    </div>`;
  return shell(
    "Welcome to Workout Tracker",
    `<p style="margin-top:0">Your account is ready. Workout Tracker starts blank on purpose: your plan should reflect the training you actually do.</p>
    <div style="margin:18px 0;padding:16px;border-radius:16px;background:linear-gradient(135deg,#121a24,#132c2a);border:1px solid #24424a">
      <div style="color:#00e5ff;font-size:11px;font-weight:900;letter-spacing:.08em">THE QUICK START</div>
      ${visual("1","Name your athlete profile","Open Settings → People. Family accounts can contain more than one athlete profile.","#00e5ff")}
      ${visual("2","Build the weekly plan","Use Plan to add strength, cardio, sessions, recovery or tasks to the days they belong.","#00ff88")}
      ${visual("3","Log the work in the moment","The Log is where targets, recent performance and today’s results come together.","#00e5ff")}
      ${visual("4","Review progress and rewards","Progress shows the record you are building. Rewards reinforce effort, improvement and consistency.","#00ff88")}
    </div>
    <p><strong style="color:#f4f8fb">The core idea:</strong> while you train, see what you did last time, what the target is today and whether you are improving.</p>
    <p style="margin:22px 0 4px"><a href="${APP_URL}" style="display:inline-block;background:#00e5ff;color:#071216;text-decoration:none;font-weight:900;border-radius:12px;padding:12px 18px">Open Workout Tracker</a></p>
    <p style="font-size:12px;color:#7f8fa0">You can replay the in-app tutorial at any time from Settings.</p>`
  );
}

function deletedHtml() {
  return shell(
    "Your Workout Tracker account has been deleted",
    `<p style="margin-top:0">The Workout Tracker account linked to this email address has been permanently deleted, together with the associated Workout Tracker application data.</p>
    <p>Any supported connected source was disconnected as part of the deletion process where possible. Deleting Workout Tracker does not delete an account you hold directly with a third-party provider.</p>
    <p>If you did not request this deletion, contact <a href="mailto:${SUPPORT_EMAIL}" style="color:#00e5ff">${SUPPORT_EMAIL}</a>.</p>`
  );
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = Deno.env.get("RESEND_API_KEY") || "";
  if (!key) return { sent: false, reason: "email_service_not_configured" };
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from: FROM_EMAIL, to: [to], subject, html }),
  });
  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error("Transactional email failed", response.status, detail.slice(0, 500));
    return { sent: false, reason: "email_send_failed" };
  }
  return { sent: true };
}

async function revokeFamilyStrava(admin: ReturnType<typeof adminClient>, familyId: string) {
  if (!admin) return;
  const { data: connections } = await admin
    .from("external_connections")
    .select("id,provider")
    .eq("family_id", familyId)
    .eq("provider", "strava");

  for (const connection of connections || []) {
    const [{ data: access }, { data: refresh }] = await Promise.all([
      admin.from("external_connection_access_tokens").select("access_token").eq("connection_id", connection.id).maybeSingle(),
      admin.from("external_connection_refresh_tokens").select("refresh_token").eq("connection_id", connection.id).maybeSingle(),
    ]);
    try {
      await revokeStravaToken(String(refresh?.refresh_token || access?.access_token || ""));
    } catch (error) {
      console.warn("Strava revoke failed during account deletion", connection.id, error);
    }
    await Promise.all([
      admin.from("external_connection_access_tokens").delete().eq("connection_id", connection.id),
      admin.from("external_connection_refresh_tokens").delete().eq("connection_id", connection.id),
    ]);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const jwt = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Authentication required" }, 401);

    const userClient = authenticatedClient(jwt);
    const admin = adminClient();
    if (!userClient || !admin) return json({ error: "Account service unavailable" }, 503);

    const { data: authData, error: authError } = await userClient.auth.getUser(jwt);
    const user = authData?.user;
    if (authError || !user?.id || !user.email) return json({ error: "Authentication required" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "";

    const { data: family } = await admin
      .from("families")
      .select("id,welcome_email_sent_at")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (action === "summary") {
      if (!family?.id) return json({ profileCount: 0, createdGroupCount: 0, connectedSourceCount: 0 });
      const [{ count: profileCount }, { count: createdGroupCount }, { count: connectedSourceCount }] = await Promise.all([
        admin.from("profiles").select("id", { count: "exact", head: true }).eq("family_id", family.id),
        admin.from("groups").select("id", { count: "exact", head: true }).eq("created_by_family_id", family.id),
        admin.from("external_connections").select("id", { count: "exact", head: true }).eq("family_id", family.id).eq("status", "active"),
      ]);
      return json({
        profileCount: profileCount || 0,
        createdGroupCount: createdGroupCount || 0,
        connectedSourceCount: connectedSourceCount || 0,
      });
    }

    if (action === "send_welcome") {
      if (!family?.id) return json({ error: "Family account not ready" }, 409);
      if (family.welcome_email_sent_at) return json({ sent: false, alreadySent: true });

      const mail = await sendEmail(user.email, "Welcome to Workout Tracker", welcomeHtml());
      if (!mail.sent) return json({ sent: false, reason: mail.reason }, 503);

      const { error: updateError } = await admin
        .from("families")
        .update({ welcome_email_sent_at: new Date().toISOString() })
        .eq("id", family.id);
      if (updateError) throw updateError;

      return json({ sent: true });
    }

    if (action !== "delete_account") return json({ error: "Unsupported account action" }, 400);

    const password = typeof body?.password === "string" ? body.password : "";
    const confirmation = typeof body?.confirmation === "string" ? body.confirmation.trim() : "";
    if (confirmation !== "DELETE") return json({ error: "Type DELETE to confirm permanent account deletion" }, 400);
    if (!password) return json({ error: "Password confirmation is required" }, 400);

    const anon = anonymousClient();
    if (!anon) return json({ error: "Password confirmation service unavailable" }, 503);
    const { error: passwordError } = await anon.auth.signInWithPassword({ email: user.email, password });
    if (passwordError) return json({ error: "Password confirmation failed" }, 403);

    if (family?.id) {
      await revokeFamilyStrava(admin, family.id);
      const { error: familyDeleteError } = await admin.from("families").delete().eq("id", family.id);
      if (familyDeleteError) throw familyDeleteError;
    }

    const { error: authDeleteError } = await admin.auth.admin.deleteUser(user.id);
    if (authDeleteError) throw authDeleteError;

    // The account must remain deleted even if the courtesy email cannot be sent.
    await sendEmail(user.email, "Your Workout Tracker account has been deleted", deletedHtml());

    return json({ deleted: true });
  } catch (error) {
    console.error("Account lifecycle action failed", error);
    return json({ error: "The account action could not be completed" }, 500);
  }
});
