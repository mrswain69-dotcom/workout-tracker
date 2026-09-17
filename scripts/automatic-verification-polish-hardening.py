from pathlib import Path


def replace_once(path, old, new):
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected patch marker not found in {path}: {old[:120]!r}")
    p.write_text(text.replace(old, new, 1))

# Do not merge genuinely separate same-day strength sessions just because a stale completion timestamp overlaps them.
path = "supabase/functions/_shared/verificationReconcile.ts"
replace_once(path,
'''const STRENGTH_CLUSTER_TOLERANCE_MS = 2 * 60 * 1000;
const STRENGTH_AUTO_DURATION_MAX_MS = 2 * 60 * 60 * 1000;''',
'''const STRENGTH_CLUSTER_TOLERANCE_MS = 2 * 60 * 1000;
const STRENGTH_CLUSTER_MAX_START_GAP_MS = 90 * 60 * 1000;
const STRENGTH_AUTO_DURATION_MAX_MS = 2 * 60 * 60 * 1000;''')
replace_once(path,
'''        if (peerInterval.start <= clusterEnd + STRENGTH_CLUSTER_TOLERANCE_MS && peerInterval.end >= clusterStart - STRENGTH_CLUSTER_TOLERANCE_MS) {''',
'''        if (
          peerInterval.start <= clusterEnd + STRENGTH_CLUSTER_TOLERANCE_MS &&
          peerInterval.end >= clusterStart - STRENGTH_CLUSTER_TOLERANCE_MS &&
          Math.abs(peerInterval.start - clusterStart) <= STRENGTH_CLUSTER_MAX_START_GAP_MS
        ) {''')

path = "src/components/progress/VerifiedActivityEvidenceSection.jsx"
replace_once(path,
'''  const toleranceMs = 2 * 60 * 1000;
''',
'''  const toleranceMs = 2 * 60 * 1000;
  const maxStartGapMs = 90 * 60 * 1000;
''')
replace_once(path,
'''        if (peerInterval.start <= clusterEnd + toleranceMs && peerInterval.end >= clusterStart - toleranceMs) {''',
'''        if (
          peerInterval.start <= clusterEnd + toleranceMs &&
          peerInterval.end >= clusterStart - toleranceMs &&
          Math.abs(peerInterval.start - clusterStart) <= maxStartGapMs
        ) {''')
replace_once(path,
'''    if (!key || autoSyncEnsureKeyRef.current === key || typeof api.ensureConnectedSourceAutoSync !== "function") return;''',
'''    if (!key || stravaConnection?.auto_sync_enabled === false || autoSyncEnsureKeyRef.current === key || typeof api.ensureConnectedSourceAutoSync !== "function") return;''')

# Respect a future per-connection auto-sync off switch on server paths too.
path = "supabase/functions/verification-actions/index.ts"
replace_once(path,
'''      if (connectionError || !connection || connection.status !== "active") return json({ error: "Provider is not connected" }, 409, corsHeaders);
      let autoSync: any;
      try {''',
'''      if (connectionError || !connection || connection.status !== "active") return json({ error: "Provider is not connected" }, 409, corsHeaders);
      if (connection.auto_sync_enabled === false) return json({ provider, autoSync: { state: "disabled", id: null, created: false, repaired: false } }, 200, corsHeaders);
      let autoSync: any;
      try {''')
replace_once(path,
'''        .select("id,family_id,profile_id,provider,status,last_manual_sync_at")''',
'''        .select("id,family_id,profile_id,provider,status,auto_sync_enabled,last_manual_sync_at")''')
replace_once(path,
'''      let autoSync: any;
      try {
        autoSync = await ensureStravaWebhookSubscription();
      } catch (error) {
        console.error("Strava automatic sync provisioning failed during manual sync", error);
        autoSync = { state: "error", reason: String((error as any)?.message || error), id: null, created: false, repaired: false };
      }
      const accessToken = await refreshStravaAccessToken(adminClient, connection.id);''',
'''      let autoSync: any = { state: "disabled", id: null, created: false, repaired: false };
      if (connection.auto_sync_enabled !== false) {
        try {
          autoSync = await ensureStravaWebhookSubscription();
        } catch (error) {
          console.error("Strava automatic sync provisioning failed during manual sync", error);
          autoSync = { state: "error", reason: String((error as any)?.message || error), id: null, created: false, repaired: false };
        }
      }
      const accessToken = await refreshStravaAccessToken(adminClient, connection.id);''')

path = "supabase/functions/strava-webhook/index.ts"
replace_once(path,
'''      .select("id,family_id,profile_id,provider,provider_account_id,status,scopes")''',
'''      .select("id,family_id,profile_id,provider,provider_account_id,status,auto_sync_enabled,scopes")''')
replace_once(path,
'''    await markEvent(adminClient, eventRow.id, { connection_id: connection.id });

    const deauthorized =''',
'''    await markEvent(adminClient, eventRow.id, { connection_id: connection.id });

    if (connection.auto_sync_enabled === false) {
      await markEvent(adminClient, eventRow.id, {
        processed_at: new Date().toISOString(),
        processing_error: "auto_sync_disabled",
      });
      return;
    }

    const deauthorized =''')

path = "src/engine/verificationAutomaticPolish.test.js"
replace_once(path,
'''    expect(source).toContain("candidateTargetKeys(candidate).every");
''',
'''    expect(source).toContain("candidateTargetKeys(candidate).every");
    expect(source).toContain("STRENGTH_CLUSTER_MAX_START_GAP_MS");
''')
replace_once(path,
'''    expect(ui).toContain("Automatic Strava updates are active.");
''',
'''    expect(ui).toContain("Automatic Strava updates are active.");
    expect(ui).toContain("stravaConnection?.auto_sync_enabled === false");
''')

print("Automatic verification hardening patch applied")
