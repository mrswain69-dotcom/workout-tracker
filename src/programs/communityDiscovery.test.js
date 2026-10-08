import { describe, expect, it } from "vitest";
import { emptyCommunityContext, filterCommunity } from "./communityDiscovery.js";
const p = (id, extra = {}) => ({ id, title: id, purpose: "Speed", sport: "Football", difficulty: "beginner", age_band: "youth", week_count: 2, equipment: [], updated_at: "2026-10-08", ...extra });
describe("Community filters and helpful sorting", () => {
  it("combines saved, creator, purpose, age, equipment and duration filters", () => {
    const programmes = [p("a", { credentials_verified: true, creator_categories: ["Youth training"], equipment: ["Cones"], week_count: 4 }), p("b"), p("c", { credentials_verified: true, equipment: ["Cones"] })];
    const context = { ...emptyCommunityContext(), bookmarks: [{ program_id: "a" }, { program_id: "b" }] };
    expect(filterCommunity(programmes, context, { saved: true, verified: true, category: "Youth training", purpose: "Speed", age: "youth", equipment: "Cones", duration: "medium" }).map((p) => p.id)).toEqual(["a"]);
  });
  it("searches creator tags and distinguishes no-equipment and week ranges", () => {
    const programmes = [p("a", { creator_tags: ["Sprint expert"] }), p("b", { equipment: ["Bands"], week_count: 8 })];
    expect(filterCommunity(programmes, emptyCommunityContext(), { query: "sprint", equipment: "none", duration: "short" }).map((p) => p.id)).toEqual(["a"]);
    expect(filterCommunity(programmes, emptyCommunityContext(), { duration: "long" }).map((p) => p.id)).toEqual(["b"]);
  });
  it("uses confidence in feedback rather than promoting a single positive vote", () => {
    const programmes = [p("one"), p("established"), p("unrated")];
    const context = { ...emptyCommunityContext(), programmes: [{ program_id: "one", helpful: 1, not_helpful: 0 }, { program_id: "established", helpful: 40, not_helpful: 5 }] };
    expect(filterCommunity(programmes, context, { sort: "helpful" }).map((p) => p.id)).toEqual(["established", "one", "unrated"]);
    expect(programmes.map((p) => p.id)).toEqual(["one", "established", "unrated"]);
  });
});
