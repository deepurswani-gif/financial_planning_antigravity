/**
 * Landing resolver — turns an experience into a concrete landing destination.
 *
 * It combines the experience's declared `landingTarget` (or a default derived
 * from the experience type) with the Question Registry's `editSurfaces` (via
 * `resolveEditTarget`) to produce the stable (section, question) the user should
 * land on. It is pure and introduces no new navigation mappings.
 */

import { getFieldById, resolveEditTarget } from '../questionRegistry';
import { getLandingTarget, defaultControlForExperienceType } from './landingTargets';

/**
 * @typedef {object} LandingResolution
 * @property {string|null} landingTargetId
 * @property {'scalar'|'question'|'configure'|'collection'} control
 * @property {string|null} fieldId
 * @property {string|null} sectionId
 * @property {string|null} questionId
 * @property {string|null} collectionFieldId
 */

/**
 * @param {import('./schema').Experience} experience
 * @param {{ capability?: 'summary'|'full' }} [context]
 * @returns {LandingResolution|null}
 */
export function resolveLanding(experience, context = {}) {
  if (!experience) return null;
  const capability = context.capability === 'full' ? 'full' : 'summary';

  const explicit = experience.landingTarget ? getLandingTarget(experience.landingTarget) : null;
  const fieldId = explicit?.fieldId ?? (experience.registryTargets ?? [])[0] ?? null;
  const control = explicit?.control ?? defaultControlForExperienceType(experience.experienceType);
  if (!fieldId) {
    return {
      landingTargetId: experience.landingTarget ?? null,
      control,
      fieldId: null,
      sectionId: null,
      questionId: null,
      collectionFieldId: null,
    };
  }

  const field = getFieldById(fieldId);
  // Scalars open in a Focused overlay, so surface flow is irrelevant — take the
  // primary. Section-based landings (question/configure/collection) should land
  // on the detailed surface for full users (where Configure controls live) and
  // the summary surface otherwise.
  const intent = control === 'scalar' ? 'quick' : capability === 'full' ? 'breakdown' : 'quick';
  const target = field ? resolveEditTarget(field, { capability, intent }) : null;

  const collectionFieldId =
    control === 'collection'
      ? explicit?.collectionFieldId ??
        (field?.kind === 'collection' ? field.id : field?.collectionId ?? null)
      : null;

  return {
    landingTargetId: experience.landingTarget ?? null,
    control,
    fieldId,
    sectionId: target?.sectionId ?? null,
    questionId: target?.questionId ?? null,
    collectionFieldId,
  };
}
