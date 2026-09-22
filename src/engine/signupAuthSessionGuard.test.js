import fs from "node:fs";
import { describe, expect, it } from "vitest";

describe("signup auth session guard", () => {
  it("clears any stale browser session before creating a new account", () => {
    const db = fs.readFileSync(new URL("../db.js", import.meta.url), "utf8");
    expect(db).toContain('supabase.auth.signOut({ scope: "local" })');
    expect(db).toContain("const { error: clearError } = await clearLocalAuthSession()");
  });

  it("uses the current Workout Tracker origin for signup and resend confirmation links", () => {
    const db = fs.readFileSync(new URL("../db.js", import.meta.url), "utf8");
    expect(db).toContain("getBrowserAuthRedirectUrl");
    expect(db).toContain("{ options: { emailRedirectTo } }");
    expect(db).toContain("supabase.auth.resend");
  });

  it("does not enter the app when signup requires email confirmation", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    expect(app).toContain("if (data?.session?.user)");
    expect(app).toContain("Account created. Check your email and confirm your address");
    expect(app).toContain("Resend confirmation email");
    expect(app).not.toContain('const fn = mode === "signup" ? signUp : signIn');
  });

  it("only leaves the signed-in app after Supabase confirms local sign-out", () => {
    const app = fs.readFileSync(new URL("../App.jsx", import.meta.url), "utf8");
    expect(app).toContain('console.error("signOut failed", error)');
    expect(app).toContain("setFamily(null)");
    expect(app).toContain("setProfiles([])");
  });
});
