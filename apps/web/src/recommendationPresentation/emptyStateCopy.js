/**
 * Positive empty-state copy for recommendation lists.
 */

export const DEFAULT_EMPTY_MESSAGE =
  'Excellent! No immediate actions are required.';

export const EMPTY_MESSAGE_BY_SURFACE = Object.freeze({
  safety_net: 'Your financial plan looks healthy in this area — no safety-net actions right now.',
  useful_insights: 'Excellent! No immediate actions are required.',
  invest_surplus: 'Your surplus plan looks clear — no deployment actions right now.',
});

export function resolveEmptyMessage(surfaceOrCustom) {
  if (!surfaceOrCustom) return DEFAULT_EMPTY_MESSAGE;
  return EMPTY_MESSAGE_BY_SURFACE[surfaceOrCustom] ?? surfaceOrCustom;
}
