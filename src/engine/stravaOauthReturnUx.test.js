import fs from "node:fs";
import { describe, expect, it } from "vitest";

function read(path) { return fs.readFileSync(path, "utf8"); }

describe("Strava OAuth return UX", () => {
  it("routes recognised provider returns to Connections and clears one-shot query state", () => {
    const app = read("src/App.jsx");
    expect(app).toContain('provider !== "strava"');
    expect(app).toContain('providerReturn ? "connections" : "dashboard"');
    expect(app).toContain('clearProviderReturnFromUrl()');
    expect(app).toContain('connectionReturn={providerReturn}');
    expect(app).toContain('initialProfileId={providerReturn?.profileId || activeProfileId}');
  });

  it("returns the exact athlete profile id from the Strava callback", () => {
    const provider = read("supabase/functions/_shared/stravaProvider.ts");
    const callback = read("supabase/functions/strava-oauth-callback/index.ts");
    expect(provider).toContain('if (profileId) url.searchParams.set("profile", profileId)');
    expect(callback).toContain('return redirect("connected", "", oauthState.profile_id)');
    expect(callback).toContain('fixedAppRedirect(status, detail, profileId)');
  });
});
