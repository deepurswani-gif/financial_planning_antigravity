/**
 * Activation strategies — what should happen *after* Smart Edit has landed at
 * the correct destination. Phase 4A.7 completes the user's intent by activating
 * the first meaningful editing experience instead of stopping at the screen.
 */

export const ACTIVATION_STRATEGIES = Object.freeze([
  'openFocusedEditor', // open the Focused Edit overlay for a scalar value
  'openConfigureModal', // open an existing configure modal (loan, policy, calculator)
  'openConfigureScreen', // open an existing full-screen configure surface
  'openCollectionPicker', // multiple instances exist — let the user choose
  'openExistingInstance', // exactly one instance — open it directly
  'openAddFlow', // no instance yet — open the Add flow
  'noActivation', // land only; user acts (e.g. read-only, ambiguous by design)
]);

const SET = new Set(ACTIVATION_STRATEGIES);

export function isActivationStrategy(value) {
  return SET.has(value);
}

export const ACTIVATION = Object.freeze(
  ACTIVATION_STRATEGIES.reduce((acc, id) => {
    acc[id] = id;
    return acc;
  }, {}),
);
