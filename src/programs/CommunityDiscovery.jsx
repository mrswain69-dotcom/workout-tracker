import React, { useMemo, useState } from "react";
import { VerifiedCreatorMark } from "./CreatorProfile.jsx";
import { filterCommunity } from "./communityDiscovery.js";
import { bookmarkCommunity } from "./communityDiscoveryDb.js";
import { CommunityModeration } from "./CommunityTools.jsx";

const defaults = { query: "", sport: "", difficulty: "", purpose: "", age: "", equipment: "", duration: "", category: "", verified: false, saved: false, sort: "recent" };
const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (s) => s.toUpperCase());
export default function CommunityDiscovery({ programmes, loading, context, contextError, profileId, authorize, onOpen, onCreator, onRefresh, busy }) {
  const [filters, setFilters] = useState(defaults), [notice, setNotice] = useState(""), [removing, setRemoving] = useState("");
  const change = (key, value) => setFilters((old) => ({ ...old, [key]: value }));
  const visible = useMemo(() => filterCommunity(programmes, context, filters), [programmes, context, filters]);
  const stats = useMemo(() => new Map(context.programmes.map((p) => [p.program_id, p])), [context]);
  const catalogueIds = new Set(programmes.map((p) => p.id));
  const outsideCatalogue = context.bookmarks.filter((b) => !catalogueIds.has(b.program_id));
  const options = (key) => [...new Set(programmes.flatMap((p) => Array.isArray(p[key]) ? p[key] : [p[key]]).filter(Boolean))].sort();
  const select = (name, key, values) => <label>{name}<select value={filters[key]} onChange={(e) => change(key, e.target.value)}><option value="">All {name.toLowerCase()}</option>{values.map((v) => <option key={v} value={v}>{label(v)}</option>)}</select></label>;
  async function remove(bookmark) {
    if (removing || !(await authorize("remove a saved programme"))) return;
    setRemoving(bookmark.program_id); setNotice("");
    try { const r = await bookmarkCommunity(profileId, bookmark.program_id, false); if (r.error) throw r.error; await onRefresh(); setNotice("Removed from Saved programmes."); } catch (e) { setNotice(e.message); } finally { setRemoving(""); }
  }
  return <section className="trainingProgramCommunity" aria-labelledby="community-programs-title">
    <div className="communityProgramHero"><div><span className="communityEyebrow">WORKOUT TRACKER COMMUNITY</span><h3 id="community-programs-title">Find Programs built for real training</h3><p>Discover useful programmes from athletes, coaches and creators for your goals, interests and experience level.</p></div><div className="communityPrinciples"><span>Free programmes</span><span>Meet the creators</span><span>Make it your own</span></div></div>
    <div className="communityToolActions" aria-label="Community browsing"><button type="button" aria-pressed={!filters.saved} onClick={() => change("saved", false)}>Browse programmes</button><button type="button" aria-pressed={filters.saved} onClick={() => change("saved", true)}>Saved programmes ({context.bookmarks.length})</button></div>
    <p>Preview a programme, save it for later, or choose how it fits into your training plan.</p>
    {notice || contextError ? <p role="status">{notice || contextError}</p> : null}
    <div className="communityBrowseToolbar"><label>Search<input value={filters.query} onChange={(e) => change("query", e.target.value)} placeholder="Football, strength, recovery, creator…" /></label>{select("Sport", "sport", options("sport"))}{select("Difficulty", "difficulty", ["all_levels", "beginner", "intermediate", "advanced"])}</div>
    <details><summary>More filters</summary><div className="communityFilters">{select("Purpose", "purpose", options("purpose"))}{select("Age range", "age", options("age_band"))}
      <label>Equipment<select value={filters.equipment} onChange={(e) => change("equipment", e.target.value)}><option value="">Any equipment</option><option value="none">No equipment listed</option>{options("equipment").map((e) => <option key={e} value={e}>{e}</option>)}</select></label>
      <label>Duration<select value={filters.duration} onChange={(e) => change("duration", e.target.value)}><option value="">Any duration</option><option value="short">1–2 weeks</option><option value="medium">3–6 weeks</option><option value="long">7+ weeks</option></select></label>
      {select("Creator specialism", "category", options("creator_categories"))}<label className="communityVerifiedFilter"><input type="checkbox" checked={filters.verified} onChange={(e) => change("verified", e.target.checked)} />Verified creators only</label></div></details>
    <div className="communityToolActions"><label>Sort by <select value={filters.sort} onChange={(e) => change("sort", e.target.value)}><option value="recent">Recently updated</option><option value="helpful">Most helpful</option><option value="duration">Shortest first</option></select></label><button type="button" onClick={() => setFilters({ ...defaults, saved: filters.saved })}>Clear filters</button></div>
    {filters.sort === "helpful" ? <small>Uses helpful and not-helpful votes for the current version, with more confidence given to programmes that have more feedback.</small> : null}
    {loading ? <p role="status">Loading Community Programs…</p> : null}
    {!loading && visible.length ? <div className="communityProgramGrid">{visible.map((p) => <article className="communityProgramCard" key={p.id}>
      <div className="communityProgramCardTop"><div><span className="communityFreeBadge">FREE</span><h4>{p.title}</h4></div>{p.credentials_verified ? <VerifiedCreatorMark verified /> : <span className="communityCreatorBadge">{label(p.creator_role || "community")}</span>}</div>
      {p.creator_id ? <button type="button" className="creatorLink" onClick={() => onCreator(p.creator_id)}>By {p.creator_name} · View creator bio</button> : <p className="muted">Creator bio not yet available</p>}
      {p.description ? <p>{p.description}</p> : null}<div className="communityProgramCardMeta">{p.sport ? <span>{p.sport}</span> : null}<span>{label(p.difficulty || "all_levels")}</span><span>{p.week_count || 1} weeks</span></div>
      {p.purpose ? <div className="communityProgramCardPurpose">{p.purpose}</div> : null}<p className="communityFeedbackCount">{stats.get(p.id)?.helpful || 0} helpful · {stats.get(p.id)?.not_helpful || 0} not helpful{context.bookmarks.some((b) => b.program_id === p.id) ? " · Saved" : ""}</p>
      <button type="button" className="communityViewProgram" disabled={!!busy} onClick={() => onOpen(p)}>{busy === `community:${p.id}` ? "Opening…" : "View Program"}</button>
    </article>)}</div> : null}
    {!loading && !visible.length ? <div className="communityEmptyState"><strong>{filters.saved ? "No saved programmes match these filters." : programmes.length ? "No programmes match these filters." : "No free Community Programs have been published yet."}</strong><p>{programmes.length || filters.saved ? "Try clearing filters, or browse programmes to save one for later." : "Be the first to share a programme: open its details in My Programs and choose Publish free."}</p></div> : null}
    {filters.saved && outsideCatalogue.length ? <section><h4>Other saved programmes</h4>{outsideCatalogue.map((b) => <article key={b.program_id} className="communitySavedUnavailable"><strong>{b.title}</strong><p>{b.available ? "This programme is saved; open it to view its current details." : "This programme is no longer available in Community. Any plan you already adopted is kept."}</p><div className="communityToolActions">{b.available ? <button type="button" disabled={!!busy} onClick={() => onOpen({ id: b.program_id })}>View saved programme</button> : null}<button type="button" disabled={!!removing} onClick={() => remove(b)}>Remove saved programme</button></div></article>)}</section> : null}
    {context.reviewer ? <details className="communityModerationEntry"><summary>Review Community reports</summary><CommunityModeration authorize={authorize} onChanged={onRefresh} /></details> : null}
  </section>;
}
