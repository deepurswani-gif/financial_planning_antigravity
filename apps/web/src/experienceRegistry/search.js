/**
 * Experience search — driven by the experience's intent plus the metadata of
 * its registry targets (labels, aliases, business meaning). No metadata is
 * duplicated: field text is read from the Question Registry at search time.
 *
 * Ranking blends match strength with `searchPriority` and the primary target's
 * `searchBoost`, so the most relevant *intent* surfaces first.
 */

import { getFieldById } from '../questionRegistry';
import { levelWeight } from '../questionRegistry/priorities';

/**
 * Build the lowercased searchable corpus for an experience.
 * @param {import('./schema').Experience} experience
 */
export function buildSearchCorpus(experience) {
  const titles = [experience.title];
  const aliases = [...(experience.aliases ?? [])];
  const fieldText = [];
  for (const fieldId of experience.registryTargets ?? []) {
    const field = getFieldById(fieldId);
    if (!field) continue;
    if (field.label) fieldText.push(field.label);
    if (field.shortLabel) fieldText.push(field.shortLabel);
    (field.aliases ?? []).forEach((a) => fieldText.push(a));
  }
  return {
    titles: titles.map((t) => t.toLowerCase()),
    aliases: aliases.map((a) => a.toLowerCase()),
    fieldText: fieldText.map((t) => t.toLowerCase()),
  };
}

function primaryBoost(experience) {
  const primary = getFieldById((experience.registryTargets ?? [])[0]);
  return primary?.searchBoost ?? 0;
}

/**
 * @param {import('./schema').Experience[]} experiences
 * @param {string} query
 * @returns {import('./schema').Experience[]}
 */
export function searchExperiences(experiences, query) {
  const q = String(query ?? '').trim().toLowerCase();
  if (!q) return [];

  const scored = [];
  for (const experience of experiences) {
    const corpus = buildSearchCorpus(experience);
    const match = matchScore(corpus, q);
    if (match <= 0) continue;
    const score =
      match + levelWeight(experience.searchPriority) / 10 + primaryBoost(experience) / 10;
    scored.push({ experience, score });
  }

  scored.sort((a, b) => b.score - a.score || a.experience.id.localeCompare(b.experience.id));
  return scored.map((s) => s.experience);
}

function matchScore(corpus, q) {
  let best = 0;
  for (const t of corpus.titles) {
    if (t === q) best = Math.max(best, 100);
    else if (t.startsWith(q)) best = Math.max(best, 70);
    else if (t.includes(q)) best = Math.max(best, 60);
  }
  for (const a of corpus.aliases) {
    if (a === q) best = Math.max(best, 75);
    else if (a.includes(q)) best = Math.max(best, 48);
  }
  for (const f of corpus.fieldText) {
    if (f === q) best = Math.max(best, 55);
    else if (f.includes(q)) best = Math.max(best, 35);
  }
  return best;
}
