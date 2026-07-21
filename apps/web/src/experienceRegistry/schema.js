/**
 * Experience model — schema, normalization and validation.
 *
 * Experiences layer *intent* on top of the frozen Question Registry. They never
 * duplicate field metadata: labels/aliases/businessMeaning are pulled from the
 * referenced `registryTargets` at read time. An experience only adds what the
 * registry cannot express — the user-facing intent, the launch strategy, and
 * (where needed) which existing configure component / collection to open.
 */

import { getFieldById, getUiCategory } from '../questionRegistry';
import { isLevel } from '../questionRegistry/priorities';
import {
  isExperienceType,
  isLaunchStrategy,
  isExperienceCapability,
  defaultLaunchStrategy,
} from './experienceTypes';
import { isLandingTargetId } from './landingTargets';

const ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

/**
 * @typedef {object} Experience
 * @property {string} id                       stable experience id (e.g. "income.salary")
 * @property {string} title                    user-facing intent title (e.g. "Monthly Salary")
 * @property {string[]} aliases                extra intent-level search synonyms
 * @property {'scalar'|'configure'|'collection'|'wizard'|'read_only'} experienceType
 * @property {string} launchStrategy           one of LAUNCH_STRATEGIES
 * @property {'any'|'summary'|'full'} capability
 * @property {string|null} icon                optional icon key (lucide name)
 * @property {string[]} registryTargets        canonical field ids; [0] is primary
 * @property {object|null} picker              picker strategy (collections)
 * @property {object|null} configureComponent  existing configure component reference
 * @property {object|null} collectionResolver  how to resolve instances (collections)
 * @property {'critical'|'high'|'medium'|'low'} searchPriority
 * @property {'critical'|'high'|'medium'|'low'} quickEditPriority
 * @property {string|null} uiCategory          override; else derived from primary target
 * @property {string|null} businessMeaning     override; else derived from primary target
 * @property {string|null} landingTarget       stable landing target id (navigation intent)
 * @property {object|null} activation          activation intent: { channel, key?, collection?, screen? }
 * @property {boolean} derived                 true when auto-derived from a field
 */

/**
 * Apply safe defaults without mutating the source.
 * @param {object} partial
 * @returns {Experience}
 */
export function normalizeExperience(partial) {
  const experienceType = partial.experienceType ?? 'scalar';
  const primaryId = (partial.registryTargets ?? [])[0] ?? null;
  const primary = primaryId ? getFieldById(primaryId) : null;

  return {
    id: partial.id,
    title: partial.title,
    aliases: partial.aliases ?? [],
    experienceType,
    launchStrategy: partial.launchStrategy ?? defaultLaunchStrategy(experienceType),
    capability: partial.capability ?? 'any',
    icon: partial.icon ?? null,
    registryTargets: partial.registryTargets ?? [],
    picker: partial.picker ?? null,
    configureComponent: partial.configureComponent ?? null,
    collectionResolver: partial.collectionResolver ?? null,
    searchPriority: partial.searchPriority ?? primary?.quickEditPriority ?? 'medium',
    quickEditPriority: partial.quickEditPriority ?? primary?.quickEditPriority ?? 'medium',
    uiCategory: partial.uiCategory ?? primary?.uiCategory ?? null,
    businessMeaning: partial.businessMeaning ?? primary?.businessMeaning ?? null,
    landingTarget: partial.landingTarget ?? null,
    activation: partial.activation ?? null,
    derived: Boolean(partial.derived),
  };
}

/**
 * @param {Experience} experience
 * @returns {string[]} error messages (empty when valid)
 */
export function validateExperience(experience) {
  const errors = [];
  if (!experience || typeof experience !== 'object') return ['Experience must be an object'];

  if (!experience.id || !ID_PATTERN.test(experience.id)) {
    errors.push(`id "${experience.id}" must be dotted camelCase segments`);
  }
  if (!experience.title || typeof experience.title !== 'string') {
    errors.push('title is required');
  }
  if (!isExperienceType(experience.experienceType)) {
    errors.push(`experienceType "${experience.experienceType}" is invalid`);
  }
  if (!isLaunchStrategy(experience.launchStrategy)) {
    errors.push(`launchStrategy "${experience.launchStrategy}" is invalid`);
  }
  if (!isExperienceCapability(experience.capability)) {
    errors.push(`capability "${experience.capability}" is invalid`);
  }
  if (!isLevel(experience.searchPriority)) {
    errors.push('searchPriority must be critical|high|medium|low');
  }
  if (!isLevel(experience.quickEditPriority)) {
    errors.push('quickEditPriority must be critical|high|medium|low');
  }
  if (experience.uiCategory && !getUiCategory(experience.uiCategory)) {
    errors.push(`uiCategory "${experience.uiCategory}" is not a known UI category`);
  }
  if (experience.landingTarget && !isLandingTargetId(experience.landingTarget)) {
    errors.push(`landingTarget "${experience.landingTarget}" is not a known landing target`);
  }
  if (experience.activation != null) {
    if (typeof experience.activation !== 'object') {
      errors.push('activation must be an object');
    } else if (!experience.activation.channel || typeof experience.activation.channel !== 'string') {
      errors.push('activation.channel is required when activation is set');
    }
  }

  if (!Array.isArray(experience.registryTargets)) {
    errors.push('registryTargets must be an array');
  } else {
    experience.registryTargets.forEach((fieldId) => {
      if (!getFieldById(fieldId)) {
        errors.push(`registryTargets references unknown field "${fieldId}"`);
      }
    });
  }

  // Strategy-specific requirements.
  switch (experience.launchStrategy) {
    case 'focused_edit_session':
      if (!experience.registryTargets.length) {
        errors.push('focused_edit_session requires at least one registry target');
      }
      break;
    case 'configure_modal':
      if (!experience.configureComponent) {
        errors.push('configure_modal requires a configureComponent');
      }
      break;
    case 'collection_picker':
      if (!experience.collectionResolver && !experience.registryTargets.length) {
        errors.push('collection_picker requires a collectionResolver or a collection target');
      }
      break;
    default:
      break;
  }

  return errors;
}

/**
 * @param {Experience} experience
 * @throws {Error}
 */
export function assertExperience(experience) {
  const errors = validateExperience(experience);
  if (errors.length) {
    throw new Error(`Invalid experience "${experience?.id ?? '?'}": ${errors.join('; ')}`);
  }
  return experience;
}
