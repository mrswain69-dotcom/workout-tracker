// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { BADGE_CARDS } from "../../config/badges.js";
import { sportsMasteryState } from "../../engine/sportsMasteryProgression.js";
import SportsMasteryMilestones from "./SportsMasteryMilestones.jsx";
afterEach(cleanup);
const card=BADGE_CARDS.find(c=>c.sportKey==="football");
it("shows compact prestige milestones with the complete history collapsed",()=>{
  const claims=new Set(card.tiers.slice(0,5).map(t=>t.key));
  render(<SportsMasteryMilestones state={sportsMasteryState(card,80,claims)} claimedKeys={claims}/>);
  expect(screen.getByText("◆ Diamond achieved")).toBeTruthy();
  expect(screen.getByText("Achievement history and counting rules").closest("details").open).toBe(false);
  expect(screen.getAllByText("Pro")).toHaveLength(2);
});
it("shows Unreal and the repeat rule after Elite",()=>{
  const claims=new Set(card.tiers.slice(0,8).map(t=>t.key));
  render(<SportsMasteryMilestones state={sportsMasteryState(card,240,claims)} claimedKeys={claims}/>);
  expect(screen.getByText("Elite achieved")).toBeTruthy();
  expect(screen.getByText(/every further 80/)).toBeTruthy();
});
