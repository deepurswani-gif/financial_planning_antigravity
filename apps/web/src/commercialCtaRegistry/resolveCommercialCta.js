/**
 * Commercial CTA Resolver.
 *
 * Consumes Recommendation Resolver output and decides how the recommendation's
 * action is presented and executed. Responsibilities:
 *   1. inspect recommendation action metadata
 *   2. inspect application capabilities
 *   3. inspect regulatory availability
 *   4. determine the final CTA
 *   5. determine the execution strategy
 *
 * It NEVER performs financial calculations and NEVER duplicates recommendation
 * metadata — it only reads the recommendation's `action` and `id`.
 *
 * To avoid a circular import with index.js the core takes the CTA list as its
 * first argument; index.js binds it to COMMERCIAL_CTA_REGISTRY.
 *
 * Current business rule: every commercial recommendation resolves to
 * "Contact Finbrella for Help" because the ideal CTAs are inactive pending
 * regulatory approval. As capabilities mature, only this resolver + the registry
 * change; reports remain untouched.
 */

import { ACTION_TYPE_TO_CTA, DEFAULT_FALLBACK_CTA_ID } from './actionMap';
import { DEFAULT_COMMERCIAL_CAPABILITIES, isCapabilityEnabled } from './capabilities';
import { buildCtaAnalytics } from './analytics';

/**
 * @typedef {object} ResolvedCta
 * @property {string} ctaId
 * @property {string} label
 * @property {string} description
 * @property {string|null} icon
 * @property {string} actionType
 * @property {string} executionStrategy
 * @property {'active'|'inactive'} availability
 * @property {string} regulatoryStatus
 * @property {string|null} emailTemplateRef
 * @property {Record<string, unknown>} payloadSchema
 * @property {boolean} commercial
 * @property {string|null} requestedCtaId - ideal CTA before fallback
 * @property {boolean} fallbackApplied
 * @property {import('./analytics').CtaAnalytics} analytics
 */

function isUsable(cta, capabilities) {
  if (!cta) return false;
  if (cta.availability !== 'active') return false;
  if (cta.regulatoryStatus === 'pending') return false;
  return isCapabilityEnabled(capabilities, cta.futureCapability);
}

function toResolved(cta, { recommendation, requestedCtaId, fallbackApplied, originatingReport }) {
  return Object.freeze({
    ctaId: cta.id,
    label: cta.label,
    description: cta.description,
    icon: cta.icon,
    actionType: cta.actionType,
    executionStrategy: cta.executionStrategy,
    availability: cta.availability,
    regulatoryStatus: cta.regulatoryStatus,
    emailTemplateRef: cta.emailTemplateRef,
    payloadSchema: cta.payloadSchema,
    commercial: cta.commercial,
    requestedCtaId: requestedCtaId ?? null,
    fallbackApplied: Boolean(fallbackApplied),
    analytics: buildCtaAnalytics({
      recommendation,
      cta,
      requestedCtaId,
      originatingReport,
      fallbackApplied,
    }),
  });
}

/**
 * @param {import('../commercialCtaRegistry/schema').CommercialCta[]} ctas
 * @param {{ id?: string, action?: { type?: string } }} recommendation - resolved recommendation
 * @param {{ capabilities?: Record<string, boolean>, report?: string, originatingReport?: string }} [context]
 * @returns {ResolvedCta|null} null when the recommendation has no CTA
 */
export function resolveCommercialCta(ctas, recommendation, context = {}) {
  const byId = new Map((ctas ?? []).map((cta) => [cta.id, cta]));
  const capabilities = context.capabilities ?? DEFAULT_COMMERCIAL_CAPABILITIES;
  const originatingReport = context.report ?? context.originatingReport ?? null;

  const actionType = recommendation?.action?.type ?? 'none';
  const requestedCtaId = ACTION_TYPE_TO_CTA[actionType] ?? null;
  if (!requestedCtaId) return null;

  const requested = byId.get(requestedCtaId) ?? null;

  if (isUsable(requested, capabilities)) {
    return toResolved(requested, {
      recommendation,
      requestedCtaId,
      fallbackApplied: false,
      originatingReport,
    });
  }

  // Fall back down the chain to the first usable CTA (defaulting to the
  // universal assistance CTA).
  const fallbackId = requested?.fallbackCtaId ?? DEFAULT_FALLBACK_CTA_ID;
  const fallback = byId.get(fallbackId) ?? byId.get(DEFAULT_FALLBACK_CTA_ID) ?? null;
  if (!fallback) return null;

  return toResolved(fallback, {
    recommendation,
    requestedCtaId,
    fallbackApplied: true,
    originatingReport,
  });
}

/**
 * Resolver diagnostics — explains, without side effects, how a recommendation
 * would resolve and why (useful for tooling and tests).
 */
export function explainResolution(ctas, recommendation, context = {}) {
  const capabilities = context.capabilities ?? DEFAULT_COMMERCIAL_CAPABILITIES;
  const actionType = recommendation?.action?.type ?? 'none';
  const requestedCtaId = ACTION_TYPE_TO_CTA[actionType] ?? null;
  const byId = new Map((ctas ?? []).map((cta) => [cta.id, cta]));
  const requested = requestedCtaId ? byId.get(requestedCtaId) : null;
  const resolved = resolveCommercialCta(ctas, recommendation, context);

  let reason = 'no_cta_for_action';
  if (requestedCtaId && resolved) {
    if (!resolved.fallbackApplied) reason = 'requested_cta_usable';
    else if (!requested) reason = 'requested_cta_missing';
    else if (requested.availability !== 'active') reason = 'requested_cta_inactive';
    else if (requested.regulatoryStatus === 'pending') reason = 'regulatory_pending';
    else if (!isCapabilityEnabled(capabilities, requested.futureCapability)) reason = 'capability_disabled';
    else reason = 'fallback_applied';
  }

  return {
    actionType,
    requestedCtaId,
    resolvedCtaId: resolved?.ctaId ?? null,
    fallbackApplied: resolved?.fallbackApplied ?? false,
    reason,
  };
}
