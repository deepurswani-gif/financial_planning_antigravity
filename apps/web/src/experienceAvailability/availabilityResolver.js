/**
 * Experience Availability Resolver — single authority for capability
 * enforcement between the Experience Registry and Smart Edit.
 *
 * Experience Registry  →  what can be edited (capability-agnostic catalogue)
 * Availability Resolver → whether the current user may edit it
 * Smart Edit            → render + launch according to the Availability Model
 *
 * All functions are pure.
 */

import { evaluateAvailabilityRules } from './rules';
import { assertAvailabilityModel, validateAvailabilityContext } from './validateAvailability';
import { getRequiredCapabilities, resolveUserCapabilities } from './capabilities';

/**
 * Resolve availability for one experience.
 *
 * @param {object} experience - Experience Registry entry (or compatible shape)
 * @param {{
 *   capabilities?: Record<string, boolean>,
 *   workspaceMode?: 'summary'|'full'|string,
 *   capability?: 'summary'|'full'|string,
 *   featureFlags?: Record<string, boolean>,
 * }} [context]
 * @returns {Readonly<import('./availabilityModel').AvailabilityModel>}
 */
export function resolveExperienceAvailability(experience, context = {}) {
  const model = evaluateAvailabilityRules(experience, context);
  return assertAvailabilityModel(model);
}

/**
 * Resolve availability for a list of experiences, omitting hidden ones.
 *
 * @param {object[]} experiences
 * @param {Parameters<typeof resolveExperienceAvailability>[1]} [context]
 * @returns {ReadonlyArray<{ experience: object, availability: import('./availabilityModel').AvailabilityModel }>}
 */
export function resolveAvailableExperiences(experiences, context = {}) {
  const list = Array.isArray(experiences) ? experiences : [];
  return Object.freeze(
    list
      .map((experience) => ({
        experience,
        availability: resolveExperienceAvailability(experience, context),
      }))
      .filter((entry) => !entry.availability.hidden),
  );
}

/**
 * Diagnostics for tooling / tests — never used for UX decisions.
 *
 * @param {object[]} experiences
 * @param {Parameters<typeof resolveExperienceAvailability>[1]} [context]
 */
export function getAvailabilityDiagnostics(experiences, context = {}) {
  const list = Array.isArray(experiences) ? experiences : [];
  const contextCheck = validateAvailabilityContext(context);
  const userCapabilities = resolveUserCapabilities(context);

  let available = 0;
  let locked = 0;
  let hidden = 0;
  const byRequiredCapability = Object.create(null);
  const samples = { available: [], locked: [], hidden: [] };

  for (const experience of list) {
    const availability = resolveExperienceAvailability(experience, context);
    const required = getRequiredCapabilities(experience);
    const key = required.length ? required.join('+') : 'none';
    byRequiredCapability[key] = (byRequiredCapability[key] ?? 0) + 1;

    if (availability.hidden) {
      hidden += 1;
      if (samples.hidden.length < 5) samples.hidden.push(experience?.id ?? null);
    } else if (availability.locked) {
      locked += 1;
      if (samples.locked.length < 5) samples.locked.push(experience?.id ?? null);
    } else if (availability.available) {
      available += 1;
      if (samples.available.length < 5) samples.available.push(experience?.id ?? null);
    }
  }

  return Object.freeze({
    total: list.length,
    available,
    locked,
    hidden,
    userCapabilities,
    byRequiredCapability: Object.freeze(byRequiredCapability),
    samples: Object.freeze({
      available: Object.freeze(samples.available),
      locked: Object.freeze(samples.locked),
      hidden: Object.freeze(samples.hidden),
    }),
    context: Object.freeze({
      ok: contextCheck.ok,
      errors: Object.freeze([...contextCheck.errors]),
      warnings: Object.freeze([...contextCheck.warnings]),
    }),
  });
}
