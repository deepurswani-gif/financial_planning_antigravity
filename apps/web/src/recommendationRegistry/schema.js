/**
 * Recommendation Registry schema helpers (metadata-only — no React imports).
 *
 * A Recommendation is 100% declarative metadata. It carries NO executable
 * functions: applicability is expressed via a stable `triggerId` (evaluated by
 * the resolver) and text is expressed via `{token}` templates (interpolated by
 * the resolver from a signals snapshot).
 */

import { getFieldById } from '../questionRegistry';
import { isCategoryId } from './categories';
import { isRecommendationType } from './recommendationTypes';
import { isSeverity } from './severity';
import { isTriggerId } from './triggers';
import { isReportId } from './reports';
import { isActionType, normalizeAction } from './actions';

const ID_PATTERN = /^[a-z][a-zA-Z0-9]*(\.[a-z][a-zA-Z0-9]*)+$/;

/**
 * @typedef {object} Recommendation
 * @property {string} id - dotted camelCase, e.g. "protection.lifeGap"
 * @property {string} title - short human title
 * @property {string} summary - one-line template ({token} placeholders allowed)
 * @property {string} [description] - longer template
 * @property {string} category - high-level domain (see categories.js)
 * @property {string} [type] - granular recommendation type (see recommendationTypes.js)
 * @property {string} severity - metadata only (see severity.js)
 * @property {number} priority - lower = higher priority (resolver sort key)
 * @property {string} triggerId - stable trigger id (see triggers.js)
 * @property {string[]} reports - report ids this recommendation may surface in
 * @property {string[]} relatedDomains - related question-registry domains
 * @property {string[]} relatedFields - related canonical question-registry field ids
 * @property {string[]} relatedMetrics - related engine metric names (free-form)
 * @property {string[]} supportingMetrics - signal keys to expose to the report
 * @property {string} [businessMeaning] - why this recommendation exists
 * @property {string[]} tags
 * @property {import('./actions').RecommendationAction} action - metadata-only action placeholder
 * @property {null} aiExplanation - reserved placeholder for a future AI phase
 */

/**
 * Apply safe defaults without mutating the source object.
 * Mirrors experienceRegistry: pulls a default businessMeaning from the first
 * related question-registry field rather than duplicating it.
 * @param {object} partial
 * @returns {Recommendation}
 */
export function normalizeRecommendation(partial) {
  const relatedFields = partial.relatedFields ?? [];
  const primaryFieldId = relatedFields[0] ?? null;
  const primaryField = primaryFieldId ? getFieldById(primaryFieldId) : null;

  return {
    id: partial.id,
    title: partial.title,
    summary: partial.summary,
    description: partial.description ?? '',
    category: partial.category,
    type: partial.type ?? null,
    severity: partial.severity ?? 'informational',
    priority: partial.priority ?? 50,
    triggerId: partial.triggerId ?? 'ALWAYS',
    reports: partial.reports ?? [],
    relatedDomains: partial.relatedDomains ?? [],
    relatedFields,
    relatedMetrics: partial.relatedMetrics ?? [],
    supportingMetrics: partial.supportingMetrics ?? [],
    businessMeaning: partial.businessMeaning ?? primaryField?.businessMeaning ?? null,
    tags: partial.tags ?? [],
    action: normalizeAction(partial.action),
    aiExplanation: null,
  };
}

/**
 * @param {Recommendation} recommendation
 * @returns {string[]} validation error messages (empty if valid)
 */
export function validateRecommendation(recommendation) {
  const errors = [];
  if (!recommendation || typeof recommendation !== 'object') {
    return ['Recommendation must be an object'];
  }

  if (!recommendation.id || typeof recommendation.id !== 'string') {
    errors.push('id is required');
  } else if (!ID_PATTERN.test(recommendation.id)) {
    errors.push(`id "${recommendation.id}" must be dotted camelCase segments`);
  }

  if (!recommendation.title || typeof recommendation.title !== 'string') {
    errors.push('title is required');
  }

  if (!recommendation.summary || typeof recommendation.summary !== 'string') {
    errors.push('summary is required');
  }

  if (!isCategoryId(recommendation.category)) {
    errors.push(`category "${recommendation.category}" is invalid`);
  }

  if (recommendation.type != null && !isRecommendationType(recommendation.type)) {
    errors.push(`type "${recommendation.type}" is invalid`);
  }

  if (!isSeverity(recommendation.severity)) {
    errors.push(`severity "${recommendation.severity}" is invalid`);
  }

  if (typeof recommendation.priority !== 'number' || !(recommendation.priority > 0)) {
    errors.push('priority must be a positive number');
  }

  if (!isTriggerId(recommendation.triggerId)) {
    errors.push(`triggerId "${recommendation.triggerId}" is invalid`);
  }

  if (!Array.isArray(recommendation.reports)) {
    errors.push('reports must be an array');
  } else {
    recommendation.reports.forEach((reportId) => {
      if (!isReportId(reportId)) {
        errors.push(`reports contains invalid report id "${reportId}"`);
      }
    });
  }

  for (const key of ['relatedDomains', 'relatedFields', 'relatedMetrics', 'supportingMetrics', 'tags']) {
    if (!Array.isArray(recommendation[key])) {
      errors.push(`${key} must be an array`);
    }
  }

  const action = recommendation.action;
  if (!action || typeof action !== 'object' || !isActionType(action.type)) {
    errors.push(`action.type "${action?.type}" is invalid`);
  }

  if (recommendation.aiExplanation != null) {
    errors.push('aiExplanation must remain null in this phase');
  }

  return errors;
}

/**
 * @param {Recommendation} recommendation
 * @throws {Error}
 */
export function assertRecommendation(recommendation) {
  const errors = validateRecommendation(recommendation);
  if (errors.length) {
    throw new Error(
      `Invalid recommendation "${recommendation?.id ?? '?'}": ${errors.join('; ')}`,
    );
  }
  return recommendation;
}
