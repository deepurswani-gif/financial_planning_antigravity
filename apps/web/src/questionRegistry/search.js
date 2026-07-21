import { levelWeight } from './priorities';

/**
 * Search registry fields by id, label, shortLabel, or aliases.
 * Ranking for Quick Edit search boosts quickEditPriority (not importance).
 *
 * @param {import('./schema').QuestionField[]} fields
 * @param {string} query
 * @returns {import('./schema').QuestionField[]}
 */
export function searchFields(fields, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [...fields];

  const scored = [];
  for (const field of fields) {
    const id = field.id.toLowerCase();
    const label = field.label.toLowerCase();
    const shortLabel = (field.shortLabel ?? '').toLowerCase();
    const aliases = (field.aliases ?? []).map((a) => a.toLowerCase());

    let score = 0;
    if (id === q) score = 100;
    else if (id.includes(q)) score = 80;
    else if (label === q || shortLabel === q) score = 70;
    else if (label.includes(q) || shortLabel.includes(q)) score = 50;
    else if (aliases.some((a) => a === q)) score = 60;
    else if (aliases.some((a) => a.includes(q))) score = 40;
    else continue;

    score += (field.searchBoost ?? 0) + levelWeight(field.quickEditPriority) / 10;
    scored.push({ field, score });
  }

  scored.sort((a, b) => b.score - a.score || a.field.id.localeCompare(b.field.id));
  return scored.map((s) => s.field);
}
