/**
 * Pure capability evaluation rules for the Experience Availability Resolver.
 *
 * All gating logic lives here. Smart Edit never evaluates capabilities.
 */

import {
  CAPABILITY_POLICIES,
  getRequiredCapabilities,
  isFeatureEnabled,
  isProductCapability,
  resolveUserCapabilities,
} from './capabilities';
import { availableModel, hiddenModel, lockedModel } from './availabilityModel';

/**
 * Evaluate a single required capability against the user's capability map.
 *
 * @param {string} required
 * @param {Record<string, boolean>} userCapabilities
 * @returns {'ok'|'lock'|'hide'}
 */
export function evaluateCapabilityRequirement(required, userCapabilities) {
  if (!isProductCapability(required)) return 'hide';
  if (userCapabilities?.[required]) return 'ok';

  const policy = CAPABILITY_POLICIES[required];
  if (!policy) return 'hide';
  if (policy.whenMissing === 'allow') return 'ok';
  if (policy.whenMissing === 'lock') return 'lock';
  return 'hide';
}

/**
 * Apply all rules for one experience + context → Availability Model.
 *
 * Rule order:
 *   1. Missing / invalid experience → hidden
 *   2. Future feature flag off → hidden
 *   3. Required capabilities (first unmet wins; hide beats lock)
 *   4. Otherwise available / launch
 *
 * @param {{ capability?: string, requiredCapabilities?: string[], futureFeature?: string|null }} experience
 * @param {{
 *   capabilities?: Record<string, boolean>,
 *   workspaceMode?: string,
 *   capability?: string,
 *   featureFlags?: Record<string, boolean>,
 * }} [context]
 */
export function evaluateAvailabilityRules(experience, context = {}) {
  if (!experience) {
    return hiddenModel({ reason: 'Unknown experience' });
  }

  if (!isFeatureEnabled(experience, context.featureFlags)) {
    return hiddenModel({
      reason: `Feature "${experience.futureFeature}" is not enabled`,
    });
  }

  const userCapabilities = resolveUserCapabilities(context);
  const required = getRequiredCapabilities(experience);

  let lockHit = null;
  for (const cap of required) {
    const outcome = evaluateCapabilityRequirement(cap, userCapabilities);
    if (outcome === 'ok') continue;
    if (outcome === 'hide') {
      const policy = CAPABILITY_POLICIES[cap];
      return hiddenModel({
        reason: policy?.reason ?? `Requires ${cap}`,
        requiredCapability: cap,
      });
    }
    if (outcome === 'lock' && !lockHit) {
      lockHit = cap;
    }
  }

  if (lockHit) {
    const policy = CAPABILITY_POLICIES[lockHit];
    return lockedModel({
      reason: policy?.reason ?? `Requires ${lockHit}`,
      subtitle: policy?.subtitle ?? null,
      requiredCapability: lockHit,
    });
  }

  return availableModel();
}
