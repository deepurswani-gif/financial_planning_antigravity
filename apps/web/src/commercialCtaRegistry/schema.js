/**
 * Commercial CTA schema helpers (metadata-only — no React imports).
 */

import {
  isCtaActionType,
  isExecutionStrategy,
  isAvailability,
  isRegulatoryStatus,
} from './ctaTypes';
import { isCapabilityKey } from './capabilities';

const ID_PATTERN = /^[a-z][a-zA-Z0-9]*$/;

/**
 * @typedef {object} CtaPayloadField
 * @property {string} type
 * @property {boolean} [required]
 */

/**
 * @typedef {object} CommercialCta
 * @property {string} id - stable camelCase id, e.g. "contactFinbrella"
 * @property {string} label - user-facing label
 * @property {string} description
 * @property {string|null} icon - icon hint (report resolves the actual glyph)
 * @property {string} actionType - semantic action (see CTA_ACTION_TYPES)
 * @property {'active'|'inactive'} availability
 * @property {'approved'|'pending'|'not_required'} regulatoryStatus
 * @property {string} executionStrategy - see EXECUTION_STRATEGIES
 * @property {string} analyticsEvent - event name for future analytics
 * @property {string|null} futureCapability - capability key that activates this CTA
 * @property {string|null} emailTemplateRef - references the existing email flow
 * @property {Record<string, CtaPayloadField>} payloadSchema - expected execution payload
 * @property {boolean} commercial - true if it advertises a regulated product/action
 * @property {string|null} fallbackCtaId - CTA to use when this one is unavailable
 */

/**
 * Apply safe defaults without mutating the source object.
 * @param {object} partial
 * @returns {CommercialCta}
 */
export function normalizeCta(partial) {
  return {
    id: partial.id,
    label: partial.label,
    description: partial.description ?? '',
    icon: partial.icon ?? null,
    actionType: partial.actionType,
    availability: partial.availability ?? 'inactive',
    regulatoryStatus: partial.regulatoryStatus ?? 'not_required',
    executionStrategy: partial.executionStrategy ?? 'noop',
    analyticsEvent: partial.analyticsEvent,
    futureCapability: partial.futureCapability ?? null,
    emailTemplateRef: partial.emailTemplateRef ?? null,
    payloadSchema: partial.payloadSchema ?? {},
    commercial: Boolean(partial.commercial),
    fallbackCtaId: partial.fallbackCtaId ?? null,
  };
}

/**
 * @param {CommercialCta} cta
 * @returns {string[]} validation error messages (empty if valid)
 */
export function validateCta(cta) {
  const errors = [];
  if (!cta || typeof cta !== 'object') return ['CTA must be an object'];

  if (!cta.id || typeof cta.id !== 'string') {
    errors.push('id is required');
  } else if (!ID_PATTERN.test(cta.id)) {
    errors.push(`id "${cta.id}" must be camelCase`);
  }

  if (!cta.label || typeof cta.label !== 'string') {
    errors.push('label is required');
  }

  if (!isCtaActionType(cta.actionType)) {
    errors.push(`actionType "${cta.actionType}" is invalid`);
  }

  if (!isAvailability(cta.availability)) {
    errors.push(`availability "${cta.availability}" is invalid`);
  }

  if (!isRegulatoryStatus(cta.regulatoryStatus)) {
    errors.push(`regulatoryStatus "${cta.regulatoryStatus}" is invalid`);
  }

  if (!isExecutionStrategy(cta.executionStrategy)) {
    errors.push(`executionStrategy "${cta.executionStrategy}" is invalid`);
  }

  if (!cta.analyticsEvent || typeof cta.analyticsEvent !== 'string') {
    errors.push('analyticsEvent is required');
  }

  if (cta.futureCapability != null && !isCapabilityKey(cta.futureCapability)) {
    errors.push(`futureCapability "${cta.futureCapability}" is not a known capability key`);
  }

  if (cta.payloadSchema == null || typeof cta.payloadSchema !== 'object') {
    errors.push('payloadSchema must be an object');
  }

  if (cta.emailTemplateRef != null && typeof cta.emailTemplateRef !== 'string') {
    errors.push('emailTemplateRef must be a string or null');
  }

  // An email execution strategy must reference an email template.
  if (cta.executionStrategy === 'email' && !cta.emailTemplateRef) {
    errors.push('executionStrategy "email" requires an emailTemplateRef');
  }

  return errors;
}

/**
 * @param {CommercialCta} cta
 * @throws {Error}
 */
export function assertCta(cta) {
  const errors = validateCta(cta);
  if (errors.length) {
    throw new Error(`Invalid commercial CTA "${cta?.id ?? '?'}": ${errors.join('; ')}`);
  }
  return cta;
}
