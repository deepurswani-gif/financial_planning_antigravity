/**
 * Validate Availability Models and resolver context shapes.
 * Pure — returns diagnostics; never throws (callers may assert).
 */

import { AVAILABILITY_ACTIONS } from './availabilityModel';
import { isProductCapability, PRODUCT_CAPABILITIES } from './capabilities';

/**
 * @param {import('./availabilityModel').AvailabilityModel} model
 * @returns {{ ok: boolean, errors: string[] }}
 */
export function validateAvailabilityModel(model) {
  const errors = [];
  if (!model || typeof model !== 'object') {
    return { ok: false, errors: ['availability model is required'] };
  }
  if (typeof model.available !== 'boolean') errors.push('available must be boolean');
  if (typeof model.locked !== 'boolean') errors.push('locked must be boolean');
  if (typeof model.hidden !== 'boolean') errors.push('hidden must be boolean');
  if (model.reason != null && typeof model.reason !== 'string') {
    errors.push('reason must be string or null');
  }
  if (model.subtitle != null && typeof model.subtitle !== 'string') {
    errors.push('subtitle must be string or null');
  }
  if (!AVAILABILITY_ACTIONS.includes(model.action)) {
    errors.push(`action "${model.action}" is invalid`);
  }
  if (
    model.requiredCapability != null &&
    !isProductCapability(model.requiredCapability)
  ) {
    errors.push(`requiredCapability "${model.requiredCapability}" is invalid`);
  }

  // Invariant checks
  if (model.available && (model.locked || model.hidden)) {
    errors.push('available models cannot be locked or hidden');
  }
  if (model.available && model.action !== 'launch') {
    errors.push('available models must use action "launch"');
  }
  if (model.locked && model.hidden) {
    errors.push('locked and hidden are mutually exclusive');
  }
  if (model.locked && model.action !== 'upgrade') {
    errors.push('locked models must use action "upgrade"');
  }
  if (model.hidden && model.action !== 'none') {
    errors.push('hidden models must use action "none"');
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {unknown} context
 * @returns {{ ok: boolean, errors: string[], warnings: string[] }}
 */
export function validateAvailabilityContext(context) {
  const errors = [];
  const warnings = [];
  if (context == null) return { ok: true, errors, warnings };
  if (typeof context !== 'object') {
    return { ok: false, errors: ['context must be an object'], warnings };
  }

  if (context.capabilities != null) {
    if (typeof context.capabilities !== 'object') {
      errors.push('capabilities must be an object');
    } else {
      for (const key of Object.keys(context.capabilities)) {
        if (!isProductCapability(key)) {
          warnings.push(`unknown capability key "${key}"`);
        }
      }
      for (const known of PRODUCT_CAPABILITIES) {
        if (!(known in context.capabilities)) {
          warnings.push(`capabilities missing key "${known}"`);
        }
      }
    }
  }

  if (
    context.workspaceMode != null &&
    context.workspaceMode !== 'summary' &&
    context.workspaceMode !== 'full'
  ) {
    warnings.push(`unusual workspaceMode "${context.workspaceMode}"`);
  }

  return { ok: errors.length === 0, errors, warnings };
}

/**
 * Assert a model is valid; throws on failure (dev / tests).
 * @param {import('./availabilityModel').AvailabilityModel} model
 */
export function assertAvailabilityModel(model) {
  const { ok, errors } = validateAvailabilityModel(model);
  if (!ok) {
    throw new Error(`Invalid Availability Model: ${errors.join('; ')}`);
  }
  return model;
}
