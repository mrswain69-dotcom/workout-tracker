// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BADGE_CARDS } from "../../config/badges.js";
import { sportsMasteryState } from "../../engine/sportsMasteryProgression.js";
import SportsMasteryMilestones from "./SportsMasteryMilestones.jsx";
afterEach(cleanup);
const card=BADGE_CARDS.find(c=>c.sportKey==="football");
function show(sessions,claims=new Set()) { render(<SportsMasteryMilestones card={card} state={sportsMasteryState(card,sessions,claims)} claimedKeys={claims}/>); }
it("does not mount prestige or Unreal details before Diamond",()=>{
  show(79); expect(screen.getByRole("region",{name:"Bronze to Diamond"})).toBeTruthy();
  for(const name of ["Pro","Champion","Elite","Unreal"]) expect(screen.queryByText(name)).toBeNull();
  expect(screen.queryByRole("region",{name:"Pro to Elite"})).toBeNull();
});
it("separates foundation and prestige at Diamond, keeping Unreal hidden",()=>{
  show(80); expect(screen.getByRole("region",{name:"Pro to Elite"})).toBeTruthy();
  expect(screen.getAllByText("Pro").length).toBeGreaterThan(0); expect(screen.queryByText("Unreal")).toBeNull();
});
it("reveals the separate Unreal stage only at Elite",()=>{
  show(240); expect(screen.getByRole("region",{name:"Unreal"})).toBeTruthy();
  expect(screen.getByText(/every further 80/)).toBeTruthy();
});
it("retains a legitimately claimed prestige stage after editing logs",()=>{
  show(0,new Set([card.tiers[7].key])); expect(screen.getByRole("region",{name:"Unreal"})).toBeTruthy();
});
