/**
 * Question Registry schema helpers (metadata-only — no React imports).
 */

import { isDomainId } from './domains';
import { isUiCategoryId } from './uiCategories';
import { isLevel } from './priorities';
import { isEditExperienceType, defaultEditExperienceType } from './editExperiences';
import { SECTION_IDS, isStableSectionId } from '../components/FinancialWorkspace/sectionIds';

export const FIELD_KINDS = Object.freeze(['field', 'collection', 'collectionItemField']);
export const VALUE_TYPES = Object.freeze([
  'date',
  'number',
  'currency',
  'percent',
  'boolean',
  'enum',
  'text',
  'year',
  'tel',
]);
export const SURFACE_ROLES = Object.freeze(['primary', 'recap', 'breakdown']);
export const SAVE_SCOPES = Object.freeze(['field', 'hosts', 'collection_instance', 'surface']);
export const FLOWS = Object.freeze(['summary', 'detailed']);

const ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;
const STABLE_SECTION_VALUES = new Set(Object.values(SECTION_IDS));

/**
 * @typedef {object} EditSurface
 * @property {'summary' | 'detailed'} flow
 * @property {string} sectionId
 * @property {string} questionId
 * @property {'summary' | 'full'} [capability]
 * @property {'primary' | 'recap' | 'breakdown'} [role]
 */

/**
 * @typedef {object} QuestionField
 * @property {string} id
 * @property {'field' | 'collection' | 'collectionItemField'} kind
 * @property {string} label
 * @property {string} [shortLabel]
 * @property {string[]} [aliases]
 * @property {string} domain
 * @property {string} uiCategory
 * @property {string} [valueType]
 * @property {'critical'|'high'|'medium'|'low'} importance
 * @property {'critical'|'high'|'medium'|'low'} quickEditPriority
 * @property {number} [searchBoost]
 * @property {string} [businessMeaning]
 * @property {object} editExperience
 * @property {object} [savePolicy]
 * @property {object} [state]
 * @property {EditSurface[]} [editSurfaces]
 * @property {object} [preferredSurface]
 * @property {object} [visibility]
 * @property {object} [validation]
 * @property {string[]} [relatedFieldIds]
 * @property {string[]} [itemFieldIds]
 * @property {string} [collectionId]
 * @property {string[]} [impacts]
 * @property {string[]} [tags]
 */

/**
 * @param {QuestionField} field
 * @returns {string[]} validation error messages (empty if valid)
 */
export function validateField(field) {
  const errors = [];
  if (!field || typeof field !== 'object') {
    return ['Field must be an object'];
  }

  if (!field.id || typeof field.id !== 'string') {
    errors.push('id is required');
  } else if (!ID_PATTERN.test(field.id)) {
    errors.push(`id "${field.id}" must be dotted camelCase segments`);
  }

  if (!FIELD_KINDS.includes(field.kind)) {
    errors.push(`kind must be one of ${FIELD_KINDS.join(', ')}`);
  }

  if (!field.label || typeof field.label !== 'string') {
    errors.push('label is required');
  }

  if (!isDomainId(field.domain)) {
    errors.push(`domain "${field.domain}" is invalid`);
  }

  if (!isUiCategoryId(field.uiCategory)) {
    errors.push(`uiCategory "${field.uiCategory}" is invalid`);
  }

  if (!isLevel(field.importance)) {
    errors.push('importance must be one of critical|high|medium|low');
  }

  if (!isLevel(field.quickEditPriority)) {
    errors.push('quickEditPriority must be one of critical|high|medium|low');
  }

  if (field.valueType != null && !VALUE_TYPES.includes(field.valueType)) {
    errors.push(`valueType "${field.valueType}" is invalid`);
  }

  const experience = field.editExperience;
  if (!experience || typeof experience !== 'object') {
    errors.push('editExperience is required');
  } else if (!isEditExperienceType(experience.type)) {
    errors.push(`editExperience.type "${experience.type}" is invalid`);
  }

  if (field.savePolicy?.scope != null && !SAVE_SCOPES.includes(field.savePolicy.scope)) {
    errors.push(`savePolicy.scope "${field.savePolicy.scope}" is invalid`);
  }

  if (field.kind === 'field' || field.kind === 'collectionItemField') {
    if (!field.state?.path) {
      errors.push('state.path is required for field kinds');
    }
  }

  if (field.kind === 'collection') {
    if (!field.state?.path) {
      errors.push('state.path is required for collections');
    }
    if (!Array.isArray(field.itemFieldIds)) {
      errors.push('itemFieldIds is required for collections');
    }
  }

  if (field.kind === 'collectionItemField' && !field.collectionId) {
    errors.push('collectionId is required for collectionItemField');
  }

  const surfaces = field.editSurfaces ?? [];
  if (!Array.isArray(surfaces)) {
    errors.push('editSurfaces must be an array');
  } else {
    surfaces.forEach((surface, index) => {
      if (!FLOWS.includes(surface.flow)) {
        errors.push(`editSurfaces[${index}].flow is invalid`);
      }
      const sectionOk =
        surface.sectionId &&
        (STABLE_SECTION_VALUES.has(surface.sectionId) || isStableSectionId(surface.sectionId));
      if (!sectionOk) {
        errors.push(`editSurfaces[${index}].sectionId "${surface.sectionId}" is not a stable section id`);
      }
      if (!surface.questionId || typeof surface.questionId !== 'string') {
        errors.push(`editSurfaces[${index}].questionId is required`);
      }
      if (surface.role != null && !SURFACE_ROLES.includes(surface.role)) {
        errors.push(`editSurfaces[${index}].role is invalid`);
      }
      if (surface.capability != null && surface.capability !== 'summary' && surface.capability !== 'full') {
        errors.push(`editSurfaces[${index}].capability is invalid`);
      }
    });
  }

  if (Array.isArray(field.aliases)) {
    field.aliases.forEach((alias, index) => {
      if (typeof alias !== 'string' || !alias.trim()) {
        errors.push(`aliases[${index}] must be a non-empty string`);
      }
    });
  }

  return errors;
}

/**
 * @param {QuestionField} field
 * @throws {Error}
 */
export function assertField(field) {
  const errors = validateField(field);
  if (errors.length) {
    throw new Error(`Invalid registry field "${field?.id ?? '?'}": ${errors.join('; ')}`);
  }
  return field;
}

/**
 * Apply safe defaults without mutating the source object.
 * @param {object} partial
 * @returns {import('./schema').QuestionField}
 */
export function normalizeField(partial) {
  const kind = partial.kind ?? 'field';
  const editExperience = partial.editExperience ?? {
    type: defaultEditExperienceType(kind),
  };
  const defaultSaveScope =
    editExperience.type === 'question'
      ? 'hosts'
      : editExperience.type === 'collection'
        ? 'collection_instance'
        : 'field';

  return {
    ...partial,
    kind,
    aliases: partial.aliases ?? [],
    searchBoost: partial.searchBoost ?? 0,
    tags: partial.tags ?? [],
    impacts: partial.impacts ?? [],
    relatedFieldIds: partial.relatedFieldIds ?? [],
    editSurfaces: partial.editSurfaces ?? [],
    visibility: partial.visibility ?? { allOf: [] },
    editExperience,
    savePolicy: {
      scope: defaultSaveScope,
      recalculate: 'impacts',
      returnTo: 'origin_report',
      ...(partial.savePolicy ?? {}),
    },
    preferredSurface: {
      whenCapabilitySummary: 'summary',
      whenCapabilityFull: 'summary',
      ...(partial.preferredSurface ?? {}),
    },
  };
}
