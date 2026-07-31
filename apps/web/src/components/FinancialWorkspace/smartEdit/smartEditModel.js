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
 *
 * Capability enforcement is owned exclusively by the Experience Availability
 * Resolver. This model never inspects product tiers itself — it only attaches
 * the Availability Model and omits hidden experiences.
 */

import {
  listFrequentlyUpdatedExperiences,
  listExperienceCategories,
  searchExperiences,
  getUiCategory,
  getExperienceById,
} from '../../../experienceRegistry';
import { resolveExperienceAvailability } from '../../../experienceAvailability';
import { searchEntities, matchScore } from './dynamicEntities';

const PRIORITY_WEIGHT = { critical: 5, high: 4, medium: 3, low: 2 };

/**
 * @param {{ capability?: 'summary'|'full', workspaceMode?: string,
 *   capabilities?: Record<string, boolean>, featureFlags?: Record<string, boolean> }} [options]
 */
function availabilityContext(options = {}) {
  // Default to full so callers that omit capability retain pre-resolver
  // behaviour (everything launchable). Smart Edit always passes capability.
  const capability = options.capability ?? 'full';
  return {
    capability,
    workspaceMode: options.workspaceMode ?? capability,
    capabilities: options.capabilities,
    featureFlags: options.featureFlags,
  };
}

/**
 * Curated + derived experiences ranked purely by quickEditPriority.
 * Hidden experiences are omitted; locked ones remain with availability metadata.
 *
 * @param {{ limit?: number, minLevel?: string, capability?: 'summary'|'full' }} [options]
 */
export function buildFrequentlyUpdated(options = {}) {
  const items = [];
  // Fetch a wider pool so hidden entries don't shrink the visible limit.
  const pool = listFrequentlyUpdatedExperiences({
    minLevel: options.minLevel ?? 'high',
    limit: Math.max((options.limit ?? 6) * 4, 24),
  });
  for (const experience of pool) {
    const descriptor = describeExperience(experience, options);
    if (!descriptor) continue;
    items.push(descriptor);
    if (items.length >= (options.limit ?? 6)) break;
  }
  return items;
}

/**
 * Category browse tree, one entry per non-empty UI category.
 * Hidden experiences are omitted; locked ones remain visible.
 *
 * @param {{ capability?: 'summary'|'full' }} [options]
 * @returns {Array<{ id: string, label: string, items: object[] }>}
 */
export function buildCategoryTree(options = {}) {
  return listExperienceCategories()
    .map((category) => ({
      id: category.id,
      label: category.label,
      items: category.experiences
        .map((experience) => describeExperience(experience, options))
        .filter(Boolean),
    }))
    .filter((category) => category.items.length > 0);
}

/**
 * Registry + entity search returning unified, ranked descriptors.
 *
 * Experience matches ("what kind of thing?") and dynamic entity matches ("which
 * specific thing?") are scored on a shared scale so a remembered object (e.g.
 * "LIC Jeevan Anand") can outrank the generic experience, while an unmatched
 * term (e.g. "FD") still falls back to the generic experience.
 *
 * Hidden experiences / entities are omitted. Locked ones stay in results.
 *
 * @param {string} query
 * @param {{ limit?: number, capability?: 'summary'|'full',
 *   entities?: import('./dynamicEntities').DynamicEntity[] }} [options]
 */
export function searchSmartEdit(query, options = {}) {
  const q = String(query ?? '').trim();
  if (!q) return [];

  const entityResults = searchEntities(options.entities ?? [], q)
    .map(({ entity, score }) => ({
      descriptor: describeEntity(entity, options),
      score,
    }))
    .filter((r) => r.descriptor);

  const experienceResults = searchExperiences(q)
    .map((experience) => {
      const m = matchScore(q, experience.title, experience.aliases);
      // Experiences returned by the registry that only matched deeper corpus
      // (field text / business meaning) get a modest floor so they still show.
      const score = (m > 0 ? m : 20) + (PRIORITY_WEIGHT[experience.searchPriority] ?? 1) / 10;
      return { descriptor: describeExperience(experience, options), score };
    })
    .filter((r) => r.descriptor);

  const merged = [...entityResults, ...experienceResults].sort(
    (a, b) => b.score - a.score,
  );

  const limited = options.limit ? merged.slice(0, options.limit) : merged;
  return limited.map((r) => r.descriptor);
}

/**
 * Presentation descriptor for a dynamic entity (search result row). Carries the
 * launch context (experienceId + instance identity + activation override) so
 * selecting it opens that exact object, bypassing the generic picker.
 *
 * Availability is inherited from the backing experience.
 *
 * @param {import('./dynamicEntities').DynamicEntity} entity
 * @param {{ capability?: 'summary'|'full' }} [options]
 */
export function describeEntity(entity, options = {}) {
  if (!entity) return null;
  const experience = getExperienceById(entity.experienceId);
  const availability = resolveExperienceAvailability(
    experience ?? { id: entity.experienceId, capability: 'any' },
    availabilityContext(options),
  );
  if (availability.hidden) return null;

  return {
    kind: 'entity',
    key: entity.entityId,
    experienceId: entity.experienceId,
    name: entity.displayName,
    category: entity.subtitle,
    description: availability.locked ? availability.subtitle : null,
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
    availability,
  };
}

/**
 * Presentation descriptor for an experience (search result or browse row).
 * Returns null when the Availability Resolver marks the experience hidden.
 *
 * @param {import('../../../experienceRegistry/schema').Experience} experience
 * @param {{ capability?: 'summary'|'full' }} [options]
 */
export function describeExperience(experience, options = {}) {
  if (!experience) return null;
  const availability = resolveExperienceAvailability(
    experience,
    availabilityContext(options),
  );
  if (availability.hidden) return null;

  const category = getUiCategory(experience.uiCategory);
  return {
    kind: 'experience',
    key: experience.id,
    experienceId: experience.id,
    name: experience.title,
    category: category?.label ?? experience.uiCategory ?? '',
    description: availability.locked
      ? availability.subtitle
      : shortDescription(experience.businessMeaning),
    location: availability.locked ? null : describeLocation(experience),
    experienceType: experience.experienceType,
    launchStrategy: experience.launchStrategy,
    isCollection: experience.experienceType === 'collection',
    icon: experience.icon ?? null,
    availability,
  };
}

/**
 * Whether selecting a Smart Edit row should launch editing.
 * Locked / unavailable rows must not launch.
 *
 * @param {object|string|null} target
 * @param {{ capability?: 'summary'|'full' }} [options]
 */
export function canLaunchSmartEditTarget(target, options = {}) {
  if (target == null) return false;
  if (typeof target === 'string' && target.startsWith('__')) return true;
  const availability = resolveTargetAvailability(target, options);
  return availability.available === true && availability.action === 'launch';
}

/**
 * Resolve availability for a launch target (descriptor or experience id).
 * Used by the drawer when deciding launch vs locked callback.
 *
 * @param {object|string} target
 * @param {{ capability?: 'summary'|'full' }} [options]
 */
export function resolveTargetAvailability(target, options = {}) {
  if (typeof target === 'string') {
    if (target.startsWith('__')) {
      return resolveExperienceAvailability(
        { id: target, capability: 'any' },
        availabilityContext(options),
      );
    }
    const experience = getExperienceById(target);
    return resolveExperienceAvailability(
      experience ?? { id: target, capability: 'any' },
      availabilityContext(options),
    );
  }
  if (target?.availability) return target.availability;
  const experience = getExperienceById(target?.experienceId);
  return resolveExperienceAvailability(
    experience ?? { id: target?.experienceId, capability: 'any' },
    availabilityContext(options),
  );
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
