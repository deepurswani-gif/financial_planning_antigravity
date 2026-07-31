/**
 * Product capabilities for Experience Availability.
 *
 * Distinct from Experience Registry's `capability` field (`any` | `summary` |
 * `full`), which declares what an experience *requires*. This vocabulary
 * describes what the *user* currently has, and is designed so new product
 * tiers can be added without touching Smart Edit.
 */

/** Stable product-capability keys. */
export const PRODUCT_CAPABILITIES = Object.freeze([
  'summary',
  'detailed',
  'advisor',
  'aiAssistant',
  'familyWorkspace',
  'premiumReports',
]);

const CAPABILITY_SET = new Set(PRODUCT_CAPABILITIES);

export function isProductCapability(value) {
  return CAPABILITY_SET.has(value);
}

/**
 * How Smart Edit / the product should behave when a required capability is
 * missing. Metadata-driven — Smart Edit never branches on capability ids.
 *
 * - `lock`  → show in search with lock styling; select → upgrade action
 * - `hide`  → omit from Smart Edit entirely
 * - `allow` → treat as satisfied (baseline / always-on)
 */
export const CAPABILITY_POLICIES = Object.freeze({
  summary: Object.freeze({
    whenMissing: 'allow',
    reason: null,
    subtitle: null,
  }),
  detailed: Object.freeze({
    whenMissing: 'lock',
    reason: 'Requires Complete Financial Planning',
    subtitle: 'Available in Complete Financial Planning',
  }),
  advisor: Object.freeze({
    whenMissing: 'hide',
    reason: 'Requires Advisor',
    subtitle: null,
  }),
  aiAssistant: Object.freeze({
    whenMissing: 'hide',
    reason: 'Requires AI Assistant',
    subtitle: null,
  }),
  familyWorkspace: Object.freeze({
    whenMissing: 'hide',
    reason: 'Requires Family Workspace',
    subtitle: null,
  }),
  premiumReports: Object.freeze({
    whenMissing: 'hide',
    reason: 'Requires Premium Reports',
    subtitle: null,
  }),
});

/**
 * Map Experience Registry `capability` values onto required product
 * capabilities. Empty array = no requirement (`any`).
 */
export const EXPERIENCE_CAPABILITY_REQUIREMENTS = Object.freeze({
  any: Object.freeze([]),
  summary: Object.freeze(['summary']),
  full: Object.freeze(['detailed']),
});

/**
 * Derive a capability map from workspace mode when the caller does not supply
 * an explicit capabilities object.
 *
 * @param {'summary'|'full'|string} [workspaceMode]
 * @returns {Readonly<Record<string, boolean>>}
 */
export function capabilitiesFromWorkspaceMode(workspaceMode) {
  const isFull = workspaceMode === 'full';
  return Object.freeze({
    summary: true,
    detailed: isFull,
    advisor: false,
    aiAssistant: false,
    familyWorkspace: false,
    premiumReports: false,
  });
}

/**
 * Normalize a resolver context into a frozen capability map.
 *
 * Precedence: explicit `capabilities` → derive from `workspaceMode` /
 * legacy `capability` (`summary` | `full`).
 *
 * @param {{
 *   capabilities?: Record<string, boolean>,
 *   workspaceMode?: 'summary'|'full'|string,
 *   capability?: 'summary'|'full'|string,
 *   featureFlags?: Record<string, boolean>,
 * }} [context]
 */
export function resolveUserCapabilities(context = {}) {
  if (context.capabilities && typeof context.capabilities === 'object') {
    const base = capabilitiesFromWorkspaceMode(
      context.workspaceMode ?? context.capability ?? 'summary',
    );
    return Object.freeze({ ...base, ...context.capabilities });
  }
  const mode = context.workspaceMode ?? context.capability ?? 'summary';
  return capabilitiesFromWorkspaceMode(mode);
}

/**
 * Resolve the product capabilities an experience requires.
 *
 * Prefers future metadata `requiredCapabilities` when present so new tiers can
 * be declared without changing this module's call sites. Falls back to the
 * Experience Registry `capability` field.
 *
 * @param {{ capability?: string, requiredCapabilities?: string[] }} experience
 * @returns {readonly string[]}
 */
export function getRequiredCapabilities(experience) {
  if (!experience) return Object.freeze([]);
  if (Array.isArray(experience.requiredCapabilities)) {
    return Object.freeze(
      experience.requiredCapabilities.filter((c) => isProductCapability(c)),
    );
  }
  const mapped = EXPERIENCE_CAPABILITY_REQUIREMENTS[experience.capability ?? 'any'];
  return mapped ?? EXPERIENCE_CAPABILITY_REQUIREMENTS.any;
}

/**
 * Optional feature-flag gate on an experience (`futureFeature` metadata).
 * Flags default to off when absent from context.
 *
 * @param {{ futureFeature?: string|null }} experience
 * @param {Record<string, boolean>} [featureFlags]
 */
export function isFeatureEnabled(experience, featureFlags) {
  const flag = experience?.futureFeature;
  if (!flag) return true;
  return Boolean(featureFlags?.[flag]);
}
