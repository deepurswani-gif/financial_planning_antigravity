/**
 * Experience Registry — the single source of truth for launching editing
 * experiences. It sits between Smart Edit and the frozen Question Registry.
 *
 * Assembly:
 *   1. curated experiences (explicit user intents)
 *   2. auto-derived experiences for every uncovered editable field
 *
 * Curated targets are "claimed" so derivation never produces duplicates.
 */

import { QUESTION_REGISTRY, listUiCategories, getUiCategory } from '../questionRegistry';
import { levelWeight } from '../questionRegistry/priorities';
import { normalizeExperience, assertExperience } from './schema';
import { CURATED_EXPERIENCES } from './experiences';
import { deriveExperiences } from './deriveExperiences';
import { getFieldById } from '../questionRegistry';
import { searchExperiences as searchExperienceList } from './search';
import { resolveLaunch } from './resolveLaunch';
import { resolveLanding } from './resolveLanding';
import { LANDING_TARGETS } from './landingTargets';

const curated = CURATED_EXPERIENCES.map(normalizeExperience);

const claimedFieldIds = new Set(
  curated.flatMap((experience) => experience.registryTargets ?? []),
);

const derived = deriveExperiences(claimedFieldIds, QUESTION_REGISTRY).map(normalizeExperience);

const ALL_EXPERIENCES = [...curated, ...derived];

// Fail fast in development on any malformed or duplicate experience.
const seenIds = new Set();
ALL_EXPERIENCES.forEach((experience) => {
  assertExperience(experience);
  if (seenIds.has(experience.id)) {
    throw new Error(`Duplicate experience id "${experience.id}"`);
  }
  seenIds.add(experience.id);
});

// Fail fast if any landing target references a field the registry doesn't know.
LANDING_TARGETS.forEach((target) => {
  if (!getFieldById(target.fieldId)) {
    throw new Error(
      `Landing target "${target.id}" references unknown field "${target.fieldId}"`,
    );
  }
});

/** @type {ReadonlyArray<import('./schema').Experience>} */
export const EXPERIENCE_REGISTRY = Object.freeze(ALL_EXPERIENCES);

const BY_ID = new Map(EXPERIENCE_REGISTRY.map((experience) => [experience.id, experience]));

export function getExperienceById(id) {
  return BY_ID.get(id) ?? null;
}

export function hasExperience(id) {
  return BY_ID.has(id);
}

export function listExperiences(options = {}) {
  let experiences = [...EXPERIENCE_REGISTRY];
  if (options.uiCategory) {
    experiences = experiences.filter((e) => e.uiCategory === options.uiCategory);
  }
  if (options.experienceType) {
    experiences = experiences.filter((e) => e.experienceType === options.experienceType);
  }
  if (options.curatedOnly) {
    experiences = experiences.filter((e) => !e.derived);
  }
  return experiences;
}

/** Registry-driven search over experiences. */
export function searchExperiences(query, options = {}) {
  return searchExperienceList(listExperiences(options), query);
}

/**
 * Frequently Updated experiences — ranked by quickEditPriority (metadata-driven).
 * @param {{ minLevel?: string, limit?: number }} [options]
 */
export function listFrequentlyUpdatedExperiences(options = {}) {
  const minWeight = levelWeight(options.minLevel ?? 'high');
  return EXPERIENCE_REGISTRY.filter((e) => levelWeight(e.quickEditPriority) >= minWeight)
    .slice()
    .sort(compareExperienceRank)
    .slice(0, options.limit ?? 6);
}

/**
 * Browse tree: one entry per non-empty UI category (in registry order), each
 * with its experiences ranked by edit priority then title.
 */
export function listExperienceCategories() {
  const byCategory = new Map();
  for (const experience of EXPERIENCE_REGISTRY) {
    const categoryId = experience.uiCategory;
    if (!categoryId) continue;
    if (!byCategory.has(categoryId)) byCategory.set(categoryId, []);
    byCategory.get(categoryId).push(experience);
  }
  return listUiCategories()
    .map((category) => ({
      id: category.id,
      label: category.label,
      experiences: (byCategory.get(category.id) ?? []).slice().sort(compareExperienceRank),
    }))
    .filter((category) => category.experiences.length > 0);
}

function compareExperienceRank(a, b) {
  const dw = levelWeight(b.quickEditPriority) - levelWeight(a.quickEditPriority);
  if (dw !== 0) return dw;
  const curatedDiff = Number(Boolean(b && !b.derived)) - Number(Boolean(a && !a.derived));
  if (curatedDiff !== 0) return curatedDiff;
  return a.title.localeCompare(b.title);
}

export { resolveLaunch, resolveLanding, getUiCategory };

export {
  resolveActivation,
  resolveInstanceActivation,
  buildActivationRequest,
} from './resolveActivation';
export { ACTIVATION_STRATEGIES, ACTIVATION, isActivationStrategy } from './activationStrategies';

export {
  EXPERIENCE_TYPES,
  LAUNCH_STRATEGIES,
  EXPERIENCE_CAPABILITIES,
} from './experienceTypes';

export {
  LANDING_TARGETS,
  LANDING_CONTROLS,
  getLandingTarget,
  isLandingTargetId,
  listLandingTargets,
} from './landingTargets';

/** Diagnostics for the DEV explorer / tests. */
export function getExperienceRegistryDiagnostics() {
  const coveredFieldIds = new Set(
    EXPERIENCE_REGISTRY.flatMap((e) => e.registryTargets ?? []),
  );
  const browsableFields = QUESTION_REGISTRY.filter(
    (f) => f.kind === 'field' || f.kind === 'collection',
  );
  const uncovered = browsableFields
    .filter((f) => !coveredFieldIds.has(f.id))
    .map((f) => f.id);
  return {
    total: EXPERIENCE_REGISTRY.length,
    curated: curated.length,
    derived: derived.length,
    uncoveredBrowsableFieldIds: uncovered,
  };
}
