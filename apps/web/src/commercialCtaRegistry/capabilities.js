/**
 * Commercial capability flags.
 *
 * Capability-aware resolution: as regulatory approvals, product offerings and
 * platform integrations mature, flipping a flag here (and marking the CTA active
 * in ctas.js) activates a richer CTA. Reports never change — only the resolver
 * and this configuration do.
 *
 * Today, only assistance (Contact Finbrella) is enabled. Every commercial
 * capability is off pending regulatory approval.
 */

export const COMMERCIAL_CAPABILITY_KEYS = Object.freeze([
  'assistance.contactFinbrella',
  'content.learnMore',
  'insights.monitor',
  'insights.celebrate',
  'commerce.viewPlans',
  'commerce.comparePlans',
  'commerce.buyProduct',
  'commerce.startSip',
  'commerce.increaseSip',
  'documents.upload',
  'advisory.bookConsultation',
]);

const CAPABILITY_SET = new Set(COMMERCIAL_CAPABILITY_KEYS);

export function isCapabilityKey(value) {
  return CAPABILITY_SET.has(value);
}

/** The only capability enabled today. */
export const DEFAULT_COMMERCIAL_CAPABILITIES = Object.freeze({
  'assistance.contactFinbrella': true,
});

/**
 * A CTA with no `futureCapability` is always considered enabled.
 * @param {Record<string, boolean>} [capabilities]
 * @param {string|null} key
 */
export function isCapabilityEnabled(capabilities, key) {
  if (!key) return true;
  const caps = capabilities ?? DEFAULT_COMMERCIAL_CAPABILITIES;
  return Boolean(caps[key]);
}
