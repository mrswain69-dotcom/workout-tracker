import { describe, expect, it } from "vitest";
import fs from "node:fs";

function read(path) {
  return fs.readFileSync(new URL(path, import.meta.url), "utf8");
}

describe("public site, privacy and account lifecycle integration", () => {
  it("publishes the performance-first public site and legal surfaces", () => {
    const app = read("../App.jsx");
    const publicSite = read("../components/public/PublicSite.jsx");
    const legal = read("../components/legal/LegalContent.jsx");

    expect(app).toContain('import PublicSite from "./components/public/PublicSite.jsx"');
    expect(publicSite).toContain("Train hard. Train smart. Track progress. Build discipline.");
    expect(publicSite).toContain("PERFORMANCE-FIRST TRACKING & INTELLIGENCE");
    expect(publicSite).toContain("PrivacyNotice");
    expect(publicSite).toContain("CookiesNotice");
    expect(publicSite).toContain("TermsOfUse");
    expect(legal).toContain("does not sell personal information");
    expect(legal).toContain("under 13");
    expect(legal).toContain("not medical measurements");
  });

  it("requires legal acknowledgement before new account creation", () => {
    const app = read("../App.jsx");
    expect(app).toContain("termsAccepted");
    expect(app).toContain("Please agree to the Terms of Use");
    expect(app).toContain("If I am creating a profile for a child under 13");
  });

  it("keeps destructive account deletion behind server authority and password confirmation", () => {
    const adapter = read("../accountLifecycleDb.js");
    const edge = read("../../supabase/functions/account-lifecycle/index.ts");
    const settings = read("../components/settings/AccountPrivacyPanel.jsx");

    expect(adapter).toContain('supabase.functions.invoke("account-lifecycle"');
    expect(settings).toContain("Type DELETE to confirm");
    expect(settings).toContain('ensureUnlocked("permanently delete this Workout Tracker account")');
    expect(edge).toContain('action !== "delete_account"');
    expect(edge).toContain("signInWithPassword");
    expect(edge).toContain('confirmation !== "DELETE"');
    expect(edge).toContain('.from("families").delete()');
    expect(edge).toContain("admin.auth.admin.deleteUser");
    expect(edge).toContain("revokeFamilyStrava");
    expect(edge).toContain("deleteFamilyGroupArtifacts");
    expect(edge).toContain("strava_webhook_events");
    expect(edge).toContain("deleteFamilyProgramArtifacts");
    expect(edge).toContain("training_program_assignments");
    expect(edge).toContain("training_program_entitlements");
    expect(settings).toContain("createdChallengeCount");
    expect(settings).toContain("ownedProgramCount");
  });

  it("sends the welcome tutorial once and keeps deletion independent of email delivery", () => {
    const app = read("../App.jsx");
    const edge = read("../../supabase/functions/account-lifecycle/index.ts");
    const migration = read("../../supabase/migrations/20261001150000_account_lifecycle_privacy.sql");
    const welcomeTemplate = read("../../supabase/email-templates/welcome.html");

    expect(app).toContain("sendWelcomeTutorialEmail");
    expect(migration).toContain("welcome_email_sent_at");
    expect(edge).toContain("family.welcome_email_sent_at");
    expect(edge).toContain("Welcome to Workout Tracker");
    expect(edge).toContain("workout-log-mobile.webp");
    expect(edge).toContain("body-readiness-mobile.webp");
    expect(welcomeTemplate).toContain("workout-log-mobile.webp");
    expect(welcomeTemplate).toContain("body-readiness-mobile.webp");
    expect(edge).toContain("Your Workout Tracker account has been deleted");
    expect(edge).toMatch(/admin\.auth\.admin\.deleteUser[\s\S]*await sendEmail/);
  });
});
