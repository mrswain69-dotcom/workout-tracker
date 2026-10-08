// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { BADGE_CARDS } from "../../config/badges.js";
import { sportsMasteryState, unrealStarKey } from "../../engine/sportsMasteryProgression.js";
import SportsMasteryCabinet from "./SportsMasteryCabinet.jsx";
afterEach(cleanup);
beforeEach(()=>{
  HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","");};
  HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");};
});
const card=BADGE_CARDS.find(c=>c.sportKey==="football");
function show(sessions,claimedKeys=new Set(),onClaim=vi.fn().mockResolvedValue(true)) {
  const state=sportsMasteryState(card,sessions,claimedKeys);
  const result=render(<SportsMasteryCabinet card={card} state={state} claimedKeys={claimedKeys} onClaim={onClaim} lastDate="2026-10-05"/>);
  return {...result,onClaim};
}
it("shows only the trophy cabinet until Details opens, with future stages hidden",()=>{
  show(5); expect(screen.queryByText("counted sessions")).toBeNull();
  expect(screen.getByRole("button",{name:"Next target: Gold, locked. View details"})).toBeTruthy();
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Details"}));
  const dialog=screen.getByRole("dialog",{name:"Football Mastery details"});
  expect(within(dialog).getByText("Bronze to Diamond")).toBeTruthy();
  expect(within(dialog).queryByText("Pro")).toBeNull();
  expect(within(dialog).queryByText("Unreal")).toBeNull();
});
it("puts previous earned badges in the rack and the next locked badge on the right",()=>{
  show(84,new Set(card.tiers.slice(0,5).map(t=>t.key)));
  expect(screen.getByRole("button",{name:"Football Mastery: Diamond. View details"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Next target: Pro, locked. View details"})).toBeTruthy();
  expect(within(screen.getByLabelText("Earlier earned badges")).getAllByRole("button")).toHaveLength(4);
  expect(screen.queryByRole("button",{name:"Claim"})).toBeNull();
});
it("opens from badge artwork and restores keyboard focus after Close or Escape",()=>{
  show(80); const opener=screen.getByRole("button",{name:"Football Mastery: Diamond. View details"});
  opener.focus(); fireEvent.click(opener); const close=screen.getByRole("button",{name:"Close"});
  expect(document.activeElement).toBe(close); fireEvent.click(close); expect(document.activeElement).toBe(opener);
  fireEvent.click(opener); fireEvent(screen.getByRole("dialog"),new Event("cancel",{bubbles:true,cancelable:true}));
  expect(screen.queryByRole("dialog")).toBeNull(); expect(document.activeElement).toBe(opener);
});
it("prevents repeated claim clicks and reports failures",async()=>{
  let finish; const onClaim=vi.fn(()=>new Promise(resolve=>{finish=resolve;}));
  show(1,new Set(),onClaim); const claim=screen.getByRole("button",{name:"Claim"});
  fireEvent.click(claim); fireEvent.click(claim); expect(onClaim).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button",{name:"Claiming…"}).disabled).toBe(true);
  finish(false); await waitFor(()=>expect(screen.getByRole("alert")).toBeTruthy());
});
it("shows an Unreal star as the next target and earned stars under the current badge",()=>{
  const claims=new Set(card.tiers.map(t=>t.key)); claims.add(unrealStarKey("football",1));
  show(480,claims);
  expect(screen.getByLabelText("1 Unreal stars claimed")).toBeTruthy();
  expect(screen.getByRole("button",{name:"Next target: Unreal star 2. View details"})).toBeTruthy();
  expect(screen.getByRole("button",{name:"Claim star"})).toBeTruthy();
});
it("closes Details after a successful claim so the reward celebration is visible",async()=>{
  show(1); fireEvent.click(screen.getByRole("button",{name:"Details"}));
  fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:"Claim Bronze"}));
  await waitFor(()=>expect(screen.queryByRole("dialog")).toBeNull());
});

import { performanceBadgeState } from "../../engine/performanceBadgeProgression.js";
function showPerformance(card, value, claims = new Set()) {
  return render(<SportsMasteryCabinet card={card} state={performanceBadgeState(card,value,claims)} claimedKeys={claims}
    onClaim={vi.fn().mockResolvedValue(true)} faceText="5K" progressText="Best 5K: 25:00."
    requirementText={tier=>`${tier.threshold} ${card.comparator === "lte" ? "seconds or faster" : "sets"} · +${tier.xp} XP`}/>);
}
it("gives performance badges the same cabinet and a Diamond completion state",()=>{
  const card=BADGE_CARDS.find(c=>c.statKey==="stats.lifts.totalSets");
  showPerformance(card,card.tiers[4].threshold);
  expect(screen.getByText("Collection complete")).toBeTruthy();
  expect(within(screen.getByLabelText("Earlier earned badges")).getAllByRole("button")).toHaveLength(4);
  fireEvent.click(screen.getByRole("button",{name:"Details"}));
  const dialog=screen.getByRole("dialog");
  expect(within(dialog).getByText("All five tiers achieved.")).toBeTruthy();
  expect(within(dialog).queryByText(/next stage unlocks/)).toBeNull();
  expect(within(dialog).queryByText(/counted sessions/)).toBeNull();
  expect(within(dialog).getAllByText(/sets ·/).length).toBe(5);
});
it("shows pace requirements and correct earned status in the popup",()=>{
  const card=BADGE_CARDS.find(c=>c.comparator==="lte");
  showPerformance(card,card.tiers[2].threshold);
  fireEvent.click(screen.getByRole("button",{name:"Details"}));
  const dialog=screen.getByRole("dialog");
  expect(within(dialog).getByLabelText(/Gold: .*earned/)).toBeTruthy();
  expect(within(dialog).getByLabelText(/Platinum: .*locked/)).toBeTruthy();
  expect(within(dialog).getByText("Best 5K: 25:00.")).toBeTruthy();
  expect(within(dialog).queryByRole("progressbar")).toBeNull();
});
