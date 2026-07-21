/**
 * Activation resolver — decides what happens once Smart Edit has landed.
 *
 * Two pure functions:
 *   - `resolveActivation(experience, landing, { instances })` — the metadata-
 *     driven decision (focused editor vs configure modal vs collection vs none).
 *   - `resolveInstanceActivation(instances)` — the instance-count rule for
 *     collections (Add when empty, open when exactly one, pick when many).
 *
 * The resolver never guesses which financial object to open when several exist:
 * it returns `openCollectionPicker` so the user always chooses.
 */

import { ACTIVATION } from './activationStrategies';

/**
 * @typedef {object} ActivationRequest
 * @property {string} experienceId
 * @property {string} strategy               one of ACTIVATION_STRATEGIES
 * @property {string|null} channel           component activation channel (e.g. "loanModal")
 * @property {string|null} key               deterministic sub-key (e.g. loan type)
 * @property {boolean} collection            true when instance-count refinement applies
 * @property {string|null} collectionFieldId collection whose instances are edited
 * @property {string|null} questionId        landing question (for context)
 */

/**
 * Instance-count rule for collections. Pure + independent of any component.
 * @param {Array} instances
 * @returns {'openAddFlow'|'openExistingInstance'|'openCollectionPicker'}
 */
export function resolveInstanceActivation(instances) {
  const list = Array.isArray(instances) ? instances : [];
  if (list.length === 0) return ACTIVATION.openAddFlow;
  if (list.length === 1) return ACTIVATION.openExistingInstance;
  return ACTIVATION.openCollectionPicker;
}

/**
 * @param {import('./schema').Experience} experience
 * @param {import('./resolveLanding').LandingResolution|null} [landing]
 * @param {{ instances?: Array }} [context]
 * @returns {string} activation strategy
 */
export function resolveActivation(experience, landing = null, context = {}) {
  if (!experience) return ACTIVATION.noActivation;

  const control = landing?.control ?? null;
  const activation = experience.activation ?? null;

  // Scalars always open the Focused Edit overlay directly.
  if (control === 'scalar' || experience.launchStrategy === 'focused_edit_session') {
    return ACTIVATION.openFocusedEditor;
  }

  if (experience.launchStrategy === 'configure_modal') {
    return ACTIVATION.openConfigureModal;
  }

  if (experience.launchStrategy === 'readonly_explanation') {
    return ACTIVATION.noActivation;
  }

  // Collection experiences refine by instance count (when instances known).
  if (activation?.collection) {
    if (context.instances != null) return resolveInstanceActivation(context.instances);
    return ACTIVATION.openCollectionPicker;
  }

  // Deterministic configure (a single known object — e.g. Home Loan, Life
  // policy modal). Reuses the existing configure component; no guessing.
  if (activation?.channel) {
    return activation.screen ? ACTIVATION.openConfigureScreen : ACTIVATION.openConfigureModal;
  }

  return ACTIVATION.noActivation;
}

/**
 * Build the request Smart Edit hands to a section component's activation hook.
 * Component-agnostic: the section maps `channel` (+ `key`) to its own setters.
 * @param {import('./schema').Experience} experience
 * @param {import('./resolveLanding').LandingResolution|null} landing
 * @returns {ActivationRequest|null}
 */
export function buildActivationRequest(experience, landing) {
  const activation = experience?.activation ?? null;
  if (!activation?.channel) return null;
  return {
    experienceId: experience.id,
    strategy: resolveActivation(experience, landing),
    channel: activation.channel,
    key: activation.key ?? null,
    collection: Boolean(activation.collection),
    collectionFieldId: landing?.collectionFieldId ?? null,
    questionId: landing?.questionId ?? null,
  };
}
