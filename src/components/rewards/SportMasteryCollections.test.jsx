// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import MasteryDisclosure from "./MasteryDisclosure.jsx";
import SportMasteryCollections from "./SportMasteryCollections.jsx";
afterEach(cleanup);

it("starts locked and claimed collections collapsed, with content unmounted", () => {
  render(<MasteryDisclosure title="Football" status="Bronze" claimable={false}><img alt="Portrait" /></MasteryDisclosure>);
  expect(screen.queryByRole("img")).toBeNull();
  const toggle = screen.getByRole("button", { name: /Football/ });
  expect(toggle.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(toggle);
  expect(screen.getByRole("img")).toBeTruthy();
  expect(toggle.getAttribute("aria-expanded")).toBe("true");
});
it("opens claimable rewards and retains the current view after claiming, then collapses on the next visit", () => {
  const view = claimable => <MasteryDisclosure title="Yoga" claimable={claimable}><span>Collection</span></MasteryDisclosure>;
  const result = render(view(true));
  expect(screen.getByText("Collection")).toBeTruthy();
  result.rerender(view(false));
  expect(screen.getByText("Collection")).toBeTruthy();
  result.unmount();
  render(view(false));
  expect(screen.queryByText("Collection")).toBeNull();
});
it("opens a newly eligible collection after asynchronous progress arrives", () => {
  const view = claimable => <MasteryDisclosure title="Cycling" claimable={claimable}><span>New reward</span></MasteryDisclosure>;
  const result = render(view(false));
  expect(screen.queryByText("New reward")).toBeNull();
  result.rerender(view(true));
  expect(screen.getByText("New reward")).toBeTruthy();
});
it("Earned includes claimed and ready-to-claim identities; All includes locked collections", () => {
  const series = [
    {sportKey:"claimed",avatars:[{claimed:true}]},
    {sportKey:"ready",avatars:[{claimable:true}]},
    {sportKey:"locked",avatars:[{unlockedBySessions:false}]},
    {sportKey:"unfinished",avatars:[{unlockedBySessions:true,claimable:false}]},
  ];
  render(<SportMasteryCollections series={series} renderSeries={item => <span key={item.sportKey}>{item.sportKey}</span>} />);
  expect(screen.getByText("claimed")).toBeTruthy();
  expect(screen.getByText("ready")).toBeTruthy();
  expect(screen.queryByText("locked")).toBeNull();
  expect(screen.queryByText("unfinished")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"All",exact:true}));
  expect(screen.getByText("locked")).toBeTruthy();
  expect(screen.getByText("unfinished")).toBeTruthy();
});
it("explains an empty earned view and resets disclosure state for another profile", () => {
  const result = render(<SportMasteryCollections series={[]} renderSeries={() => null} />);
  expect(screen.getByText(/No Sport Mastery avatars earned yet/)).toBeTruthy();
  result.rerender(<MasteryDisclosure key="profile-a" title="Golf" claimable={true}>Profile A</MasteryDisclosure>);
  expect(screen.getByText("Profile A")).toBeTruthy();
  result.rerender(<MasteryDisclosure key="profile-b" title="Golf" claimable={false}>Profile B</MasteryDisclosure>);
  expect(screen.queryByText("Profile B")).toBeNull();
});
