/**
 * Persisted mobile product-tour progress (per user).
 * - intro: first visit while on Summary capability
 * - detailed: first visit after Detailed (full) unlock
 */

import { WORKSPACE_TOUR_STORAGE_KEY_PREFIX } from './workspaceTourConfig';
import {
  WORKSPACE_CAPABILITY_FULL,
  WORKSPACE_CAPABILITY_SUMMARY,
} from './workspaceCapabilityStorage';

export function getWorkspaceTourStorageKey(userId) {
  return `${WORKSPACE_TOUR_STORAGE_KEY_PREFIX}.${userId || 'guest'}`;
}

export function createDefaultTourState() {
  return {
    completedIntro: false,
    completedDetailedUnlock: false,
  };
}

export function hydrateTourState(raw) {
  const defaults = createDefaultTourState();
  if (!raw || typeof raw !== 'object') return defaults;
  return {
    completedIntro: Boolean(raw.completedIntro),
    completedDetailedUnlock: Boolean(raw.completedDetailedUnlock),
  };
}

export function loadWorkspaceTourState(userId) {
  try {
    const raw = localStorage.getItem(getWorkspaceTourStorageKey(userId));
    if (!raw) return createDefaultTourState();
    return hydrateTourState(JSON.parse(raw));
  } catch {
    return createDefaultTourState();
  }
}

export function saveWorkspaceTourState(userId, state) {
  try {
    localStorage.setItem(
      getWorkspaceTourStorageKey(userId),
      JSON.stringify(hydrateTourState(state)),
    );
  } catch (error) {
    console.warn('Failed to save workspace tour state:', error);
  }
}

/**
 * Decide whether to auto-start the mobile tour, and which trigger.
 * @param {{ completedIntro?: boolean, completedDetailedUnlock?: boolean }} state
 * @param {string | null} capability
 * @returns {'intro' | 'detailed' | null}
 */
export function resolveAutoTourTrigger(state, capability) {
  const hydrated = hydrateTourState(state);

  if (capability === WORKSPACE_CAPABILITY_FULL && !hydrated.completedDetailedUnlock) {
    return 'detailed';
  }

  if (
    (capability === WORKSPACE_CAPABILITY_SUMMARY || capability == null) &&
    !hydrated.completedIntro
  ) {
    return 'intro';
  }

  return null;
}

/**
 * Mark the active auto-tour (or a manual run) as finished/skipped.
 * Manual completion only clears milestones the user has already unlocked,
 * so a Summary-era replay still allows the Detailed-unlock auto-tour.
 * @param {{ completedIntro?: boolean, completedDetailedUnlock?: boolean }} state
 * @param {'intro' | 'detailed' | 'manual'} trigger
 * @param {string | null} [capability]
 */
export function markTourCompleted(state, trigger, capability = null) {
  const next = hydrateTourState(state);

  if (trigger === 'intro') {
    next.completedIntro = true;
  } else if (trigger === 'detailed') {
    next.completedIntro = true;
    next.completedDetailedUnlock = true;
  } else if (trigger === 'manual') {
    next.completedIntro = true;
    if (capability === WORKSPACE_CAPABILITY_FULL) {
      next.completedDetailedUnlock = true;
    }
  }

  return next;
}
