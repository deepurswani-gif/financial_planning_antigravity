/**
 * Commercial CTA Framework — the single source of truth for commercial actions.
 *
 * Architecture:
 *
 *   Financial Engine
 *          |
 *   Recommendation Registry
 *          |
 *   Recommendation Resolver
 *          |
 *   Commercial CTA Resolver   <-- this framework
 *          |
 *   Reports (render CTA objects only)
 *
 * Recommendations answer "what should the user do next?"; the Commercial CTA
 * Framework answers "how can Finbrella help?". It consumes recommendation output
 * and never duplicates recommendation metadata. Reports render the resolved CTA
 * object and hardcode nothing (labels, visibility, actions, navigation, email).
 */

import { normalizeCta, assertCta } from './schema';
import { validateRegistry } from './validateRegistry';
import { COMMERCIAL_CTAS } from './ctas';
import {
  resolveCommercialCta as resolveFromList,
  explainResolution as explainFromList,
} from './resolveCommercialCta';

const ALL_CTAS = COMMERCIAL_CTAS.map(normalizeCta);

// Fail fast in development on any malformed or duplicate CTA.
const seenIds = new Set();
ALL_CTAS.forEach((cta) => {
  assertCta(cta);
  if (seenIds.has(cta.id)) {
    throw new Error(`Duplicate CTA id "${cta.id}"`);
  }
  seenIds.add(cta.id);
});

/** @type {ReadonlyArray<import('./schema').CommercialCta>} */
export const COMMERCIAL_CTA_REGISTRY = Object.freeze(ALL_CTAS);

const BY_ID = new Map(COMMERCIAL_CTA_REGISTRY.map((cta) => [cta.id, cta]));

export function getCtaById(id) {
  return BY_ID.get(id) ?? null;
}

export function hasCta(id) {
  return BY_ID.has(id);
}

export function listCtas(options = {}) {
  let list = [...COMMERCIAL_CTA_REGISTRY];
  if (options.availability) list = list.filter((c) => c.availability === options.availability);
  if (options.commercial != null) list = list.filter((c) => c.commercial === options.commercial);
  return list;
}

export function listActiveCtas() {
  return listCtas({ availability: 'active' });
}

/**
 * Resolve the CTA for a resolved recommendation.
 * @param {{ id?: string, action?: { type?: string } }} recommendation
 * @param {{ capabilities?: Record<string, boolean>, report?: string }} [context]
 * @returns {import('./resolveCommercialCta').ResolvedCta|null}
 */
export function resolveCommercialCta(recommendation, context = {}) {
  return resolveFromList(COMMERCIAL_CTA_REGISTRY, recommendation, context);
}

/** Explain how a recommendation resolves (diagnostics, no side effects). */
export function explainResolution(recommendation, context = {}) {
  return explainFromList(COMMERCIAL_CTA_REGISTRY, recommendation, context);
}

/** Registry diagnostics for tests / tooling. */
export function getCommercialCtaRegistryDiagnostics() {
  const result = validateRegistry(COMMERCIAL_CTA_REGISTRY);
  return { total: COMMERCIAL_CTA_REGISTRY.length, ...result };
}

export { validateRegistry };
export { buildCtaAnalytics } from './analytics';
export {
  CTA_ACTION_TYPES,
  EXECUTION_STRATEGIES,
  AVAILABILITY,
  REGULATORY_STATUS,
  isCtaActionType,
  isExecutionStrategy,
  isAvailability,
  isRegulatoryStatus,
} from './ctaTypes';
export {
  COMMERCIAL_CAPABILITY_KEYS,
  DEFAULT_COMMERCIAL_CAPABILITIES,
  isCapabilityKey,
  isCapabilityEnabled,
} from './capabilities';
export { ACTION_TYPE_TO_CTA, DEFAULT_FALLBACK_CTA_ID } from './actionMap';
