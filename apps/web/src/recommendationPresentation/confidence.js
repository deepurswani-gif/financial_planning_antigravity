/**
 * Optional confidence indicator vocabulary.
 *
 * Presentation consumes `instance.confidence` when present and omits the
 * indicator entirely when absent. Never synthesize confidence from other fields.
 */

export const CONFIDENCE_STATES = Object.freeze({
  HIGH: 'high',
  NEEDS_MORE_INFORMATION: 'needs_more_information',
  ESTIMATED: 'estimated',
});

export const CONFIDENCE_COPY = Object.freeze({
  [CONFIDENCE_STATES.HIGH]: Object.freeze({
    state: CONFIDENCE_STATES.HIGH,
    label: 'High Confidence',
    message: 'Based on the information currently available.',
  }),
  [CONFIDENCE_STATES.NEEDS_MORE_INFORMATION]: Object.freeze({
    state: CONFIDENCE_STATES.NEEDS_MORE_INFORMATION,
    label: 'Needs More Information',
    message:
      'Some financial information is incomplete. Updating it may improve this recommendation.',
  }),
  [CONFIDENCE_STATES.ESTIMATED]: Object.freeze({
    state: CONFIDENCE_STATES.ESTIMATED,
    label: 'Estimated',
    message: 'This recommendation is based on estimated values and planning assumptions.',
  }),
});

/**
 * @param {unknown} confidence
 * @returns {{ state: string, label: string, message: string }|null}
 */
export function resolveConfidencePresentation(confidence) {
  if (confidence == null) return null;
  const state = typeof confidence === 'string' ? confidence : confidence?.state;
  if (!state) return null;
  return CONFIDENCE_COPY[state] ?? null;
}
