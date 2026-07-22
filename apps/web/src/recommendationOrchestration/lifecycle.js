/**
 * Recommendation Lifecycle model.
 *
 * The Recommendation Registry is immutable metadata. The Orchestration Engine
 * produces dynamic *instances* whose runtime state is described by this
 * lifecycle. Instances are re-derived from signals on every run, so lifecycle
 * transitions are pure and stateless here — a future store may persist a
 * lifecycle overlay (e.g. "dismissed ids") and replay it onto fresh instances
 * without any redesign.
 *
 * Only ACTIVE recommendations are currently rendered. The remaining states are
 * defined so future channels (dashboard, notifications, advisor CRM) can adopt
 * transitions without changing the engine.
 */

/** @typedef {'active'|'satisfied'|'dismissed'|'pending_assistance'|'completed'|'expired'} LifecycleStatus */

export const LIFECYCLE_STATUS = Object.freeze({
  ACTIVE: 'active',
  SATISFIED: 'satisfied',
  DISMISSED: 'dismissed',
  PENDING_ASSISTANCE: 'pending_assistance',
  COMPLETED: 'completed',
  EXPIRED: 'expired',
});

/** @type {ReadonlyArray<LifecycleStatus>} */
export const LIFECYCLE_STATES = Object.freeze(Object.values(LIFECYCLE_STATUS));

// Only these statuses are surfaced to consumers today.
const RENDERABLE_STATES = Object.freeze(new Set([LIFECYCLE_STATUS.ACTIVE]));

// Allowed transitions. Kept intentionally permissive-but-explicit so future
// phases can wire real transitions (dismiss, mark satisfied, escalate to
// assistance, complete) without touching the engine core.
const ALLOWED_TRANSITIONS = Object.freeze({
  [LIFECYCLE_STATUS.ACTIVE]: [
    LIFECYCLE_STATUS.SATISFIED,
    LIFECYCLE_STATUS.DISMISSED,
    LIFECYCLE_STATUS.PENDING_ASSISTANCE,
    LIFECYCLE_STATUS.COMPLETED,
    LIFECYCLE_STATUS.EXPIRED,
  ],
  [LIFECYCLE_STATUS.PENDING_ASSISTANCE]: [
    LIFECYCLE_STATUS.ACTIVE,
    LIFECYCLE_STATUS.COMPLETED,
    LIFECYCLE_STATUS.DISMISSED,
    LIFECYCLE_STATUS.EXPIRED,
  ],
  [LIFECYCLE_STATUS.SATISFIED]: [LIFECYCLE_STATUS.ACTIVE, LIFECYCLE_STATUS.EXPIRED],
  [LIFECYCLE_STATUS.DISMISSED]: [LIFECYCLE_STATUS.ACTIVE],
  [LIFECYCLE_STATUS.EXPIRED]: [LIFECYCLE_STATUS.ACTIVE],
  [LIFECYCLE_STATUS.COMPLETED]: [],
});

export function isLifecycleStatus(status) {
  return LIFECYCLE_STATES.includes(status);
}

export function isRenderableStatus(status) {
  return RENDERABLE_STATES.has(status);
}

/** True when a recommendation instance should currently be surfaced. */
export function isRenderable(instance) {
  return isRenderableStatus(instance?.status);
}

export function canTransition(from, to) {
  if (!isLifecycleStatus(from) || !isLifecycleStatus(to)) return false;
  return (ALLOWED_TRANSITIONS[from] ?? []).includes(to);
}

function nowIso(now) {
  return new Date(now ?? Date.now()).toISOString();
}

/**
 * Pure transition — returns a new instance with the next status and a bumped
 * updatedAt. Invalid transitions return the instance unchanged.
 * @template {{status: LifecycleStatus, updatedAt?: string}} T
 * @param {T} instance
 * @param {LifecycleStatus} to
 * @param {number} [now]
 * @returns {T}
 */
export function applyTransition(instance, to, now) {
  if (!instance || !canTransition(instance.status, to)) return instance;
  return { ...instance, status: to, updatedAt: nowIso(now) };
}

/**
 * Apply an optional lifecycle overlay to a freshly created (active) instance.
 * Overlay maps recommendationId -> desired status. Only valid transitions are
 * applied; everything else is left ACTIVE. This is how a future store can
 * persist "dismissed"/"satisfied" without introducing new persistence here.
 * @param {{recommendationId: string, status: LifecycleStatus}} instance
 * @param {Record<string, LifecycleStatus>} [overrides]
 * @param {number} [now]
 */
export function applyLifecycleOverride(instance, overrides, now) {
  const desired = overrides?.[instance.recommendationId];
  if (!desired || desired === instance.status) return instance;
  return applyTransition(instance, desired, now);
}
