import fs from "node:fs";

function edit(path, transforms) {
  let value = fs.readFileSync(path, "utf8");
  for (const [label, from, to] of transforms) {
    if (!value.includes(from)) throw new Error(`${path}: missing ${label}`);
    value = value.replace(from, to);
  }
  fs.writeFileSync(path, value);
}

edit("src/App.jsx", [
  [
    "ConnectionsSettings import",
    'import ProgressDashboard from "./components/progress/ProgressDashboard.jsx";\nconst GroupHub',
    'import ProgressDashboard from "./components/progress/ProgressDashboard.jsx";\nimport ConnectionsSettings from "./components/settings/ConnectionsSettings.jsx";\nconst GroupHub',
  ],
  [
    "manage tab visibility",
    '{["settings", "plan", "assessments"].includes(tab) && (',
    '{["settings", "plan", "assessments", "connections"].includes(tab) && (',
  ],
  [
    "Connections manage tab",
    '        ["assessments", "Assessments"],\n      ].map(([key, label]) => (',
    '        ["assessments", "Assessments"],\n        ["connections", "Connections"],\n      ].map(([key, label]) => (',
  ],
  [
    "Connections settings surface",
    '{tab === "settings" && (',
    `{tab === "connections" && (\n  <ConnectionsSettings\n    profiles={profiles}\n    initialProfileId={activeProfileId}\n    authorizeMutation={ensureUnlocked}\n  />\n)}\n\n{tab === "settings" && (`,
  ],
]);

edit("src/components/progress/ProgressDashboard.jsx", [
  [
    "VerifiedActivityEvidenceSection import",
    'import "./ProgressDashboard.css";',
    'import VerifiedActivityEvidenceSection from "./VerifiedActivityEvidenceSection.jsx";\nimport "./ProgressDashboard.css";',
  ],
  [
    "verification data state",
    '  const [trainingRangeKey, setTrainingRangeKey] = useState("recent28");\n  const resolvedReferenceDate = referenceDate || todayYmd();',
    '  const [trainingRangeKey, setTrainingRangeKey] = useState("recent28");\n  const [verificationData, setVerificationData] = useState(null);\n  const resolvedReferenceDate = referenceDate || todayYmd();\n\n  useEffect(() => {\n    setVerificationData(null);\n  }, [profileId]);',
  ],
  [
    "read-only verified evidence",
    '      <div className="progress-section">\n        <SectionHeading kicker="ASSESSMENTS" title="Benchmark progress">',
    '      <VerifiedActivityEvidenceSection\n        profileId={profileId}\n        profileName={profileName}\n        onDataChange={setVerificationData}\n      />\n\n      <div className="progress-section">\n        <SectionHeading kicker="ASSESSMENTS" title="Benchmark progress">',
  ],
  [
    "verification payload into long-range analysis",
    '          assessmentLibrary={remoteData.assessmentLibrary}\n          onOpenAssessments={onOpenAssessments}\n        />',
    '          assessmentLibrary={remoteData.assessmentLibrary}\n          onOpenAssessments={onOpenAssessments}\n          verificationData={verificationData}\n        />',
  ],
]);

edit("supabase/functions/_shared/stravaProvider.ts", [
  [
    "connection preference helper",
    'function localDateFromStrava(activity: any) {',
    `export const DEFAULT_EXTERNAL_CONNECTION_PREFERENCES = Object.freeze({\n  activity_data_enabled: true,\n  performance_metrics_enabled: true,\n  heart_rate_enabled: false,\n  route_location_enabled: false,\n  health_recovery_enabled: false,\n  include_private_activities: false,\n});\n\nexport async function loadExternalConnectionPreferences(adminClient: any, connection: any) {\n  if (!adminClient || !connection?.profile_id || !connection?.provider) {\n    return { ...DEFAULT_EXTERNAL_CONNECTION_PREFERENCES };\n  }\n  const { data, error } = await adminClient\n    .from("external_connection_preferences")\n    .select("activity_data_enabled,performance_metrics_enabled,heart_rate_enabled,route_location_enabled,health_recovery_enabled,include_private_activities")\n    .eq("profile_id", connection.profile_id)\n    .eq("provider", connection.provider)\n    .maybeSingle();\n  if (error) throw error;\n  return { ...DEFAULT_EXTERNAL_CONNECTION_PREFERENCES, ...(data || {}) };\n}\n\nfunction localDateFromStrava(activity: any) {`,
  ],
  [
    "normalize preferences signature",
    'export function normalizeStravaActivity(connection: any, activity: any) {',
    'export function normalizeStravaActivity(connection: any, activity: any, preferences: any = DEFAULT_EXTERNAL_CONNECTION_PREFERENCES) {',
  ],
  [
    "heart rate stream",
    '    average_heart_rate_bpm: finiteOrNull(activity?.average_heartrate),\n    max_heart_rate_bpm: finiteOrNull(activity?.max_heartrate),\n    elevation_gain_m: finiteOrNull(activity?.total_elevation_gain),\n    calories_kcal: finiteOrNull(activity?.calories),',
    '    average_heart_rate_bpm: preferences.heart_rate_enabled ? finiteOrNull(activity?.average_heartrate) : null,\n    max_heart_rate_bpm: preferences.heart_rate_enabled ? finiteOrNull(activity?.max_heartrate) : null,\n    elevation_gain_m: preferences.performance_metrics_enabled ? finiteOrNull(activity?.total_elevation_gain) : null,\n    calories_kcal: preferences.performance_metrics_enabled ? finiteOrNull(activity?.calories) : null,',
  ],
  [
    "upsert preference enforcement",
    'export async function upsertStravaObservation(adminClient: any, connection: any, activity: any) {\n  const row = normalizeStravaActivity(connection, activity);\n  if (!row) throw new Error("Strava activity cannot be normalized");',
    'export async function upsertStravaObservation(adminClient: any, connection: any, activity: any, preferences: any = null) {\n  const resolvedPreferences = preferences || await loadExternalConnectionPreferences(adminClient, connection);\n  if (!resolvedPreferences.activity_data_enabled) return null;\n  const row = normalizeStravaActivity(connection, activity, resolvedPreferences);\n  if (!row) throw new Error("Strava activity cannot be normalized");',
  ],
  [
    "initial import preference load",
    '  let imported = 0;\n\n  for (let page = 1; page <= 10; page += 1) {',
    '  let imported = 0;\n  const preferences = await loadExternalConnectionPreferences(adminClient, connection);\n  if (!preferences.activity_data_enabled) return 0;\n\n  for (let page = 1; page <= 10; page += 1) {',
  ],
  [
    "initial import preference application",
    '    for (const activity of activities) {\n      await upsertStravaObservation(adminClient, connection, activity);\n      imported += 1;\n    }',
    '    for (const activity of activities) {\n      const stored = await upsertStravaObservation(adminClient, connection, activity, preferences);\n      if (stored) imported += 1;\n    }',
  ],
]);

edit("supabase/functions/strava-oauth-start/index.ts", [
  [
    "remove client private authority",
    '    const includePrivate = body?.includePrivate === true;\n    if (!profileId)',
    '    if (!profileId)',
  ],
  [
    "server private preference",
    '    if (profileError || !ownedProfile) return json({ error: "Athlete profile not available" }, 403, corsHeaders);\n\n    const state = randomUrlSafe(32);',
    '    if (profileError || !ownedProfile) return json({ error: "Athlete profile not available" }, 403, corsHeaders);\n\n    const { data: connectionPreferences, error: preferenceError } = await adminClient\n      .from("external_connection_preferences")\n      .select("include_private_activities")\n      .eq("profile_id", profileId)\n      .eq("provider", "strava")\n      .maybeSingle();\n    if (preferenceError) throw preferenceError;\n    const includePrivate = connectionPreferences?.include_private_activities === true;\n\n    const state = randomUrlSafe(32);',
  ],
]);

edit("supabase/functions/strava-oauth-callback/index.ts", [
  [
    "provider account label",
    '    const grantedScopes = cleanScopes(tokenData?.scope);\n    if (!accessToken || !athleteId) {',
    '    const grantedScopes = cleanScopes(tokenData?.scope);\n    const providerAccountLabel = [tokenData?.athlete?.firstname, tokenData?.athlete?.lastname]\n      .map((value) => typeof value === "string" ? value.trim() : "")\n      .filter(Boolean)\n      .join(" ") || (typeof tokenData?.athlete?.username === "string" ? tokenData.athlete.username.trim() : "") || null;\n    if (!accessToken || !athleteId) {',
  ],
  [
    "connection label persistence",
    '      provider_account_id: athleteId,\n      status: scopeOkay ? "active" : "error",',
    '      provider_account_id: athleteId,\n      provider_account_label: providerAccountLabel ? providerAccountLabel.slice(0, 240) : null,\n      status: scopeOkay ? "active" : "error",',
  ],
  [
    "connection label selection",
    '.select("id,family_id,profile_id,provider,provider_account_id,status,scopes")',
    '.select("id,family_id,profile_id,provider,provider_account_id,provider_account_label,status,scopes")',
  ],
]);

console.log("Stage 7.1 connection management patch applied");
