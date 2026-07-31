/**
 * Immutable Availability Model returned by the Experience Availability Resolver.
 *
 * Smart Edit renders and launches solely from this model — it never inspects
 * product capabilities or experience.capability itself.
 */

/** @typedef {'launch'|'upgrade'|'none'} AvailabilityAction */

/**
 * @typedef {object} AvailabilityModel
 * @property {boolean} available
 * @property {boolean} locked
 * @property {boolean} hidden
 * @property {string|null} reason
 * @property {string|null} subtitle - short Smart Edit lock copy
 * @property {AvailabilityAction} action
 * @property {string|null} requiredCapability - first unmet capability, if any
 */

export const AVAILABILITY_ACTIONS = Object.freeze(['launch', 'upgrade', 'none']);

/**
 * @param {Partial<AvailabilityModel>} partial
 * @returns {Readonly<AvailabilityModel>}
 */
export function createAvailabilityModel(partial = {}) {
  return Object.freeze({
    available: Boolean(partial.available),
    locked: Boolean(partial.locked),
    hidden: Boolean(partial.hidden),
    reason: partial.reason ?? null,
    subtitle: partial.subtitle ?? null,
    action: partial.action ?? 'none',
    requiredCapability: partial.requiredCapability ?? null,
  });
}

/** Experience may be launched. */
export function availableModel() {
  return createAvailabilityModel({
    available: true,
    locked: false,
    hidden: false,
    reason: null,
    subtitle: null,
    action: 'launch',
    requiredCapability: null,
  });
}

/**
 * Experience is visible but not launchable — upgrade path.
 * @param {{ reason?: string|null, subtitle?: string|null, requiredCapability?: string|null }} [opts]
 */
export function lockedModel(opts = {}) {
  return createAvailabilityModel({
    available: false,
    locked: true,
    hidden: false,
    reason: opts.reason ?? 'Requires Complete Financial Planning',
    subtitle: opts.subtitle ?? 'Available in Complete Financial Planning',
    action: 'upgrade',
    requiredCapability: opts.requiredCapability ?? null,
  });
}

/**
 * Experience must not appear in Smart Edit.
 * @param {{ reason?: string|null, requiredCapability?: string|null }} [opts]
 */
export function hiddenModel(opts = {}) {
  return createAvailabilityModel({
    available: false,
    locked: false,
    hidden: true,
    reason: opts.reason ?? null,
    subtitle: null,
    action: 'none',
    requiredCapability: opts.requiredCapability ?? null,
  });
}
