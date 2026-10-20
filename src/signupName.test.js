import { beforeEach, describe, expect, it, vi } from "vitest";
const auth=vi.hoisted(()=>({getSession:vi.fn(),signUp:vi.fn()}));
vi.mock("./supabaseClient",()=>({supabase:{auth}}));
import { signUp } from "./db.js";
beforeEach(()=>{auth.getSession.mockResolvedValue({data:{session:null},error:null});auth.signUp.mockResolvedValue({data:{session:null},error:null});});
describe("signup profile name",()=>{
  it("stores the chosen display name in metadata so it survives email confirmation",async()=>{
    await signUp("test@example.invalid","example-password","  Mike   Swain ");
    expect(auth.signUp).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({data:{first_profile_name:"Mike Swain",first_workout_setup:2}})}));
  });
});
