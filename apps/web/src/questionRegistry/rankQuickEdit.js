import { levelWeight } from './priorities';

/**
 * Quick Edit ranking uses quickEditPriority only (not importance).
 */

/**
 * @param {import('./schema').QuestionField[]} fields
 * @param {{ minLevel?: string, limit?: number, kinds?: string[] }} [options]
 */
export function listFrequentlyUpdated(fields, options = {}) {
  const minWeight = levelWeight(options.minLevel ?? 'critical');
  const kinds = new Set(options.kinds ?? ['field']);
  return fields
    .filter(
      (f) =>
        kinds.has(f.kind) &&
        levelWeight(f.quickEditPriority) >= minWeight,
    )
    .sort(compareQuickEditRank)
    .slice(0, options.limit ?? 12);
}

/**
 * @param {import('./schema').QuestionField[]} fields
 * @param {{ excludeIds?: string[], limit?: number, kinds?: string[] }} [options]
 */
export function listSuggested(fields, options = {}) {
  const exclude = new Set(options.excludeIds ?? []);
  const kinds = new Set(options.kinds ?? ['field']);
  const frequent = listFrequentlyUpdated(fields, { kinds: [...kinds] });
  frequent.forEach((f) => exclude.add(f.id));

  return fields
    .filter(
      (f) =>
        kinds.has(f.kind) &&
        !exclude.has(f.id) &&
        (f.quickEditPriority === 'high' || f.quickEditPriority === 'critical'),
    )
    .sort(compareQuickEditRank)
    .slice(0, options.limit ?? 12);
}

/**
 * Default pin candidates: quickEditPriority critical fields.
 * @param {import('./schema').QuestionField[]} fields
 */
export function listDefaultPinFieldIds(fields) {
  return fields
    .filter((f) => f.kind === 'field' && f.quickEditPriority === 'critical')
    .sort(compareQuickEditRank)
    .map((f) => f.id);
}

function compareQuickEditRank(a, b) {
  const dw = levelWeight(b.quickEditPriority) - levelWeight(a.quickEditPriority);
  if (dw !== 0) return dw;
  const boost = (b.searchBoost ?? 0) - (a.searchBoost ?? 0);
  if (boost !== 0) return boost;
  return a.id.localeCompare(b.id);
}
