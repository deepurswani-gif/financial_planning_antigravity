/** Persist whether the user has completed / skipped welcome onboarding. */

export const WELCOME_SEEN_STORAGE_KEY = 'finbrella.welcome.seen.v1';

export function hasSeenWelcome() {
  try {
    return localStorage.getItem(WELCOME_SEEN_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function markWelcomeSeen() {
  try {
    localStorage.setItem(WELCOME_SEEN_STORAGE_KEY, '1');
  } catch {
    // Ignore quota / private-mode failures — onboarding can still proceed.
  }
}
