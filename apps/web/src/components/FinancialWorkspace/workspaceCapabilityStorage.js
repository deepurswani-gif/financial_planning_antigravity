/**
 * Persisted workspace capability — highest unlocked tier for a user.
 * Separate from onboarding progress and workspace UI state.
 */

export const WORKSPACE_CAPABILITY_SUMMARY = 'summary';
export const WORKSPACE_CAPABILITY_FULL = 'full';

const STORAGE_KEY_PREFIX = 'finbrella.workspaceCapability.v1';

export function getWorkspaceCapabilityStorageKey(userId) {
  return `${STORAGE_KEY_PREFIX}.${userId || 'guest'}`;
}

export function normalizeWorkspaceCapability(capability) {
  return capability === WORKSPACE_CAPABILITY_FULL
    ? WORKSPACE_CAPABILITY_FULL
    : WORKSPACE_CAPABILITY_SUMMARY;
}

export function loadWorkspaceCapability(userId) {
  try {
    const raw = localStorage.getItem(getWorkspaceCapabilityStorageKey(userId));
    if (raw === WORKSPACE_CAPABILITY_FULL || raw === WORKSPACE_CAPABILITY_SUMMARY) {
      return raw;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveWorkspaceCapability(userId, capability) {
  if (!userId || !capability) return;
  try {
    localStorage.setItem(
      getWorkspaceCapabilityStorageKey(userId),
      normalizeWorkspaceCapability(capability)
    );
  } catch (error) {
    console.warn('Failed to save workspace capability:', error);
  }
}

/**
 * Derive capability from plan signals when no explicit capability is stored.
 * Full capability is never inferred — it must be set explicitly on detailed completion.
 */
export function deriveWorkspaceCapability({ storedCapability, summaryReportGeneratedAt }) {
  if (storedCapability === WORKSPACE_CAPABILITY_FULL) return WORKSPACE_CAPABILITY_FULL;
  if (storedCapability === WORKSPACE_CAPABILITY_SUMMARY) return WORKSPACE_CAPABILITY_SUMMARY;
  if (summaryReportGeneratedAt) return WORKSPACE_CAPABILITY_SUMMARY;
  return null;
}

/**
 * Upgrade capability — never downgrade unless forced (debug).
 */
export function resolveEffectiveCapability({
  storedCapability,
  summaryReportGeneratedAt,
  forceCapability = null,
}) {
  if (forceCapability) return normalizeWorkspaceCapability(forceCapability);

  const derived = deriveWorkspaceCapability({ storedCapability, summaryReportGeneratedAt });
  return derived;
}

export function capabilityToWorkspaceMode(capability) {
  return capability === WORKSPACE_CAPABILITY_FULL
    ? WORKSPACE_CAPABILITY_FULL
    : WORKSPACE_CAPABILITY_SUMMARY;
}
