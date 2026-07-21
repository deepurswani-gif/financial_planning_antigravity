/**
 * Smart Edit model — pure, experience-driven view helpers for the Smart Edit
 * Drawer.
 *
 * As of Phase 4A.5 this consumes the Experience Registry (not raw registry
 * fields). Smart Edit searches and displays *experiences* — what the user
 * intends to edit — while the Experience Registry maps each to the correct
 * launch strategy and canonical field(s).
 *
 * Phase 5 augments search with the Dynamic Entity Resolver: the user's live
 * financial objects (LIC Jeevan Anand, HDFC FD, "Marriage" goal, …) are merged
 * in alongside the canonical experiences and ranked on a shared scale.
 */

import {
  listFrequentlyUpdatedExperiences,
  listExperienceCategories,
  searchExperiences,
  getUiCategory,
} from '../../../experienceRegistry';
import { searchEntities, matchScore } from './dynamicEntities';

const PRIORITY_WEIGHT = { critical: 5, high: 4, medium: 3, low: 2 };

/**
 * Curated + derived experiences ranked purely by quickEditPriority.
 * @param {{ limit?: number, minLevel?: string }} [options]
 */
export function buildFrequentlyUpdated(options = {}) {
  return listFrequentlyUpdatedExperiences({
    minLevel: options.minLevel ?? 'high',
    limit: options.limit ?? 6,
  }).map((experience) => describeExperience(experience, options));
}

/**
 * Category browse tree, one entry per non-empty UI category.
 * @param {{ capability?: 'summary'|'full' }} [options]
 * @returns {Array<{ id: string, label: string, items: object[] }>}
 */
export function buildCategoryTree(options = {}) {
  return listExperienceCategories().map((category) => ({
    id: category.id,
    label: category.label,
    items: category.experiences.map((experience) => describeExperience(experience, options)),
  }));
}

/**
 * Registry + entity search returning unified, ranked descriptors.
 *
 * Experience matches ("what kind of thing?") and dynamic entity matches ("which
 * specific thing?") are scored on a shared scale so a remembered object (e.g.
 * "LIC Jeevan Anand") can outrank the generic experience, while an unmatched
 * term (e.g. "FD") still falls back to the generic experience.
 *
 * @param {string} query
 * @param {{ limit?: number, capability?: 'summary'|'full',
 *   entities?: import('./dynamicEntities').DynamicEntity[] }} [options]
 */
export function searchSmartEdit(query, options = {}) {
  const q = String(query ?? '').trim();
  if (!q) return [];

  const entityResults = searchEntities(options.entities ?? [], q).map(({ entity, score }) => ({
    descriptor: describeEntity(entity),
    score,
  }));

  const experienceResults = searchExperiences(q).map((experience) => {
    const m = matchScore(q, experience.title, experience.aliases);
    // Experiences returned by the registry that only matched deeper corpus
    // (field text / business meaning) get a modest floor so they still show.
    const score = (m > 0 ? m : 20) + (PRIORITY_WEIGHT[experience.searchPriority] ?? 1) / 10;
    return { descriptor: describeExperience(experience, options), score };
  });

  const merged = [...entityResults, ...experienceResults]
    .filter((r) => r.descriptor)
    .sort((a, b) => b.score - a.score);

  const limited = options.limit ? merged.slice(0, options.limit) : merged;
  return limited.map((r) => r.descriptor);
}

/**
 * Presentation descriptor for a dynamic entity (search result row). Carries the
 * launch context (experienceId + instance identity + activation override) so
 * selecting it opens that exact object, bypassing the generic picker.
 *
 * @param {import('./dynamicEntities').DynamicEntity} entity
 */
export function describeEntity(entity) {
  if (!entity) return null;
  return {
    kind: 'entity',
    key: entity.entityId,
    experienceId: entity.experienceId,
    name: entity.displayName,
    category: entity.subtitle,
    description: null,
    location: null,
    experienceType: null,
    launchStrategy: null,
    isCollection: false,
    icon: entity.icon ?? null,
    // Launch context for exact-instance editing.
    entityId: entity.entityId,
    entityType: entity.entityType,
    instanceId: entity.instanceId,
    instanceIndex: entity.instanceIndex,
    activation: entity.activation ?? null,
  };
}

/**
 * Presentation descriptor for an experience (search result or browse row).
 *
 * @param {import('../../../experienceRegistry/schema').Experience} experience
 * @param {{ capability?: 'summary'|'full' }} [options]
 */
export function describeExperience(experience) {
  if (!experience) return null;
  const category = getUiCategory(experience.uiCategory);
  return {
    kind: 'experience',
    key: experience.id,
    experienceId: experience.id,
    name: experience.title,
    category: category?.label ?? experience.uiCategory ?? '',
    description: shortDescription(experience.businessMeaning),
    location: describeLocation(experience),
    experienceType: experience.experienceType,
    launchStrategy: experience.launchStrategy,
    isCollection: experience.experienceType === 'collection',
    icon: experience.icon ?? null,
  };
}

function shortDescription(businessMeaning) {
  if (!businessMeaning) return null;
  const text = String(businessMeaning).trim();
  if (text.length <= 90) return text;
  const clipped = text.slice(0, 90);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : 90).trim()}…`;
}

function describeLocation(experience) {
  switch (experience.launchStrategy) {
    case 'configure_modal':
      return 'Planner';
    case 'configure_screen':
    case 'mini_wizard':
      return 'Detailed planning';
    case 'collection_picker':
      return experience.capability === 'full' ? 'Detailed planning' : null;
    case 'readonly_explanation':
      return 'Overview';
    default:
      return null;
  }
}
