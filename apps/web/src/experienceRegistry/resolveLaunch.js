/**
 * Experience resolver — turns an experience + context into a concrete launch
 * descriptor that Smart Edit dispatches. It reuses the Question Registry's
 * `resolveEditTarget` to find the existing surface (section/flow); it never
 * introduces new navigation mappings.
 *
 * The resolver is pure: it returns a descriptor, it does not perform effects.
 */

import { getFieldById, resolveEditTarget } from '../questionRegistry';
import { resolveLanding } from './resolveLanding';

/**
 * @typedef {object} LaunchDescriptor
 * @property {string} experienceId
 * @property {string} strategy            one of LAUNCH_STRATEGIES
 * @property {'summary'|'full'} capability
 * @property {string|null} fieldId        primary registry field (focused edits)
 * @property {'quick'|'breakdown'|'recap'} [intent]
 * @property {string|null} sectionId      existing section to open (configure/collection)
 * @property {string|null} calculatorId   existing calculator modal id
 * @property {string|null} instanceId     collection instance (when known)
 * @property {object|null} picker         picker spec (collections)
 * @property {object|null} collectionResolver
 * @property {string|null} explanation    read-only prose
 * @property {string|null} landingTargetId  stable landing id (navigation intent)
 * @property {string|null} landingQuestionId question the user should land on
 * @property {'scalar'|'question'|'configure'|'collection'|null} landingControl
 * @property {string|null} collectionFieldId collection whose instances are edited
 */

/**
 * @param {import('./schema').Experience} experience
 * @param {{ capability?: 'summary'|'full', intent?: string, instanceId?: string }} [context]
 * @returns {LaunchDescriptor}
 */
export function resolveLaunch(experience, context = {}) {
  if (!experience) return null;
  const capability = context.capability === 'full' ? 'full' : 'summary';
  const primaryId = (experience.registryTargets ?? [])[0] ?? null;
  const primary = primaryId ? getFieldById(primaryId) : null;

  const landing = resolveLanding(experience, { capability }) ?? {};

  const base = {
    experienceId: experience.id,
    strategy: experience.launchStrategy,
    capability,
    fieldId: primaryId,
    intent: context.intent ?? defaultIntent(experience),
    sectionId: null,
    calculatorId: null,
    instanceId: context.instanceId ?? null,
    picker: experience.picker ?? null,
    collectionResolver: experience.collectionResolver ?? null,
    explanation: null,
    landingTargetId: landing.landingTargetId ?? null,
    landingQuestionId: landing.questionId ?? null,
    landingControl: landing.control ?? null,
    collectionFieldId: landing.collectionFieldId ?? null,
  };

  switch (experience.launchStrategy) {
    case 'focused_edit_session':
      return base;

    case 'configure_modal':
      return {
        ...base,
        calculatorId: experience.configureComponent?.calculatorId ?? null,
        sectionId:
          experience.configureComponent?.sectionId ??
          landing.sectionId ??
          resolveSection(primary, capability, base.intent),
      };

    case 'configure_screen':
    case 'collection_picker':
    case 'mini_wizard':
      return {
        ...base,
        sectionId:
          experience.configureComponent?.sectionId ??
          landing.sectionId ??
          resolveSection(primary, capability, base.intent),
      };

    case 'readonly_explanation':
      return {
        ...base,
        explanation: experience.businessMeaning ?? primary?.businessMeaning ?? null,
        sectionId: landing.sectionId ?? resolveSection(primary, capability, base.intent),
      };

    default:
      return base;
  }
}

function defaultIntent(experience) {
  if (experience.experienceType === 'collection') return 'recap';
  if (experience.launchStrategy === 'configure_screen') return 'breakdown';
  return 'quick';
}

function resolveSection(field, capability, intent) {
  if (!field) return null;
  try {
    const target = resolveEditTarget(field, { capability, intent });
    return target?.sectionId ?? null;
  } catch {
    return null;
  }
}
