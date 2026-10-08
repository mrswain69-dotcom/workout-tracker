export const emptyCommunityContext = () => ({ programmes: [], bookmarks: [], reviewer: false });
export function filterCommunity(programmes, context, filters) {
  const query = (filters.query || "").trim().toLowerCase();
  const saved = new Set(context.bookmarks.map((b) => b.program_id));
  const stats = new Map(context.programmes.map((s) => [s.program_id, s]));
  const matches = programmes.filter((p) => {
    if (filters.saved && !saved.has(p.id)) return false;
    if (filters.verified && !p.credentials_verified) return false;
    if (filters.sport && p.sport !== filters.sport) return false;
    if (filters.difficulty && p.difficulty !== filters.difficulty) return false;
    if (filters.purpose && p.purpose !== filters.purpose) return false;
    if (filters.age && p.age_band !== filters.age) return false;
    if (filters.category && !(p.creator_categories || []).includes(filters.category)) return false;
    if (filters.equipment === "none" && (p.equipment || []).length) return false;
    if (filters.equipment && filters.equipment !== "none" && !(p.equipment || []).includes(filters.equipment)) return false;
    const weeks = Number(p.week_count || 1);
    if (filters.duration === "short" && weeks > 2) return false;
    if (filters.duration === "medium" && (weeks < 3 || weeks > 6)) return false;
    if (filters.duration === "long" && weeks < 7) return false;
    return !query || [p.title, p.description, p.purpose, p.sport, p.creator_name, p.creator_headline, ...(p.creator_categories || []), ...(p.creator_tags || []), ...(p.tags || []), ...(p.equipment || [])].join(" ").toLowerCase().includes(query);
  });
  return matches.sort((a, b) => {
    if (filters.sort === "helpful") {
      // Wilson lower bound avoids placing a lone positive vote above established feedback.
      const score = (p) => { const s = stats.get(p.id) || {}; const yes = Number(s.helpful || 0), n = yes + Number(s.not_helpful || 0); if (!n) return 0; const z = 1.96, ratio = yes / n; return (ratio + z*z/(2*n) - z*Math.sqrt((ratio*(1-ratio)+z*z/(4*n))/n))/(1+z*z/n); };
      const difference = score(b) - score(a);
      if (difference) return difference;
    }
    if (filters.sort === "duration") return Number(a.week_count || 1) - Number(b.week_count || 1) || a.title.localeCompare(b.title);
    return (Date.parse(b.updated_at) || 0) - (Date.parse(a.updated_at) || 0) || a.title.localeCompare(b.title);
  });
}
