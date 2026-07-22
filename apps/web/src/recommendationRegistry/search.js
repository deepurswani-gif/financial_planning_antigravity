import { severityWeight } from './severity';

/**
 * Search recommendations by id, title, summary, type, category or tags.
 * Pure scorer with a stable id tiebreak (mirrors questionRegistry/search.js).
 *
 * @param {import('./schema').Recommendation[]} recommendations
 * @param {string} query
 * @returns {import('./schema').Recommendation[]}
 */
export function searchRecommendations(recommendations, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [...recommendations];

  const scored = [];
  for (const rec of recommendations) {
    const id = rec.id.toLowerCase();
    const title = (rec.title ?? '').toLowerCase();
    const summary = (rec.summary ?? '').toLowerCase();
    const type = (rec.type ?? '').toLowerCase();
    const category = (rec.category ?? '').toLowerCase();
    const tags = (rec.tags ?? []).map((t) => String(t).toLowerCase());

    let score = 0;
    if (id === q) score = 100;
    else if (id.includes(q)) score = 80;
    else if (title === q) score = 70;
    else if (title.includes(q)) score = 55;
    else if (type === q || category === q) score = 50;
    else if (tags.some((t) => t === q)) score = 45;
    else if (summary.includes(q)) score = 35;
    else if (tags.some((t) => t.includes(q))) score = 30;
    else continue;

    score += severityWeight(rec.severity) / 10;
    scored.push({ rec, score });
  }

  scored.sort((a, b) => b.score - a.score || a.rec.id.localeCompare(b.rec.id));
  return scored.map((s) => s.rec);
}
