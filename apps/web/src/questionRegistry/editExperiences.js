/**
 * Preferred Focused Edit interaction models.
 */

export const EDIT_EXPERIENCE_TYPES = Object.freeze([
  'single_value',
  'question',
  'section',
  'collection',
  'breakdown',
  'modal',
]);

export function isEditExperienceType(type) {
  return EDIT_EXPERIENCE_TYPES.includes(type);
}

/**
 * @param {'field' | 'collection' | 'collectionItemField'} kind
 * @returns {string}
 */
export function defaultEditExperienceType(kind) {
  if (kind === 'collection') return 'collection';
  if (kind === 'collectionItemField') return 'collection';
  return 'single_value';
}
