/**
 * Edit Session state machine — the single editing lifecycle for Finbrella.
 *
 * Pure and framework-agnostic: no React, no side effects. Every current and
 * future editing entry point (Quick Edit, AI-assisted edits, report links,
 * deep links) drives edits through these states so behaviour stays consistent.
 *
 *   Idle → Starting → Editing → Saving → Returning → Idle
 *                \                 \
 *                 → Error ←---------/
 *
 * The machine only models transitions; the actual work (resolving targets,
 * validating, persisting, recalculating, navigating) is performed by the
 * Save Pipeline and the EditingProvider, which advance the machine via events.
 */

export const EDIT_STATES = Object.freeze({
  IDLE: 'idle',
  STARTING: 'starting',
  EDITING: 'editing',
  SAVING: 'saving',
  RETURNING: 'returning',
  ERROR: 'error',
});

export const EDIT_EVENTS = Object.freeze({
  START: 'START',
  RESOLVED: 'RESOLVED',
  START_FAILED: 'START_FAILED',
  CHANGE: 'CHANGE',
  REQUEST_SAVE: 'REQUEST_SAVE',
  SAVE_SUCCESS: 'SAVE_SUCCESS',
  SAVE_FAILED: 'SAVE_FAILED',
  RETURN_DONE: 'RETURN_DONE',
  CANCEL: 'CANCEL',
  RETRY: 'RETRY',
  RESET: 'RESET',
});

/**
 * @typedef {object} EditMachineContext
 * @property {string} state
 * @property {import('./editSession').EditSession | null} session
 * @property {any} draft            current in-progress value(s)
 * @property {boolean} dirty
 * @property {'validate'|'persist'|'recalculate'|'close'|'return'|'start'|null} failedPhase
 * @property {string | null} error
 */

/** @returns {EditMachineContext} */
export function createInitialEditState() {
  return {
    state: EDIT_STATES.IDLE,
    session: null,
    draft: undefined,
    dirty: false,
    failedPhase: null,
    error: null,
  };
}

const NO_TRANSITION = Symbol('no-transition');

/**
 * Compute the next machine context for an event. Invalid transitions are
 * ignored (returns the same context) so callers never crash on races.
 *
 * @param {EditMachineContext} ctx
 * @param {{ type: string, [key: string]: any }} event
 * @returns {EditMachineContext}
 */
export function editSessionReducer(ctx, event) {
  const next = transition(ctx, event);
  return next === NO_TRANSITION ? ctx : next;
}

function transition(ctx, event) {
  switch (event.type) {
    case EDIT_EVENTS.RESET:
      return createInitialEditState();

    case EDIT_EVENTS.START: {
      // A start request is accepted from Idle or Error (recover), or when
      // explicitly restarting. Never interrupt an in-flight Saving state.
      if (ctx.state === EDIT_STATES.SAVING) return NO_TRANSITION;
      return {
        ...createInitialEditState(),
        state: EDIT_STATES.STARTING,
        session: event.session ?? null,
      };
    }

    case EDIT_EVENTS.RESOLVED: {
      if (ctx.state !== EDIT_STATES.STARTING) return NO_TRANSITION;
      return {
        ...ctx,
        state: EDIT_STATES.EDITING,
        session: event.session ?? ctx.session,
        draft: event.draft,
        dirty: false,
        failedPhase: null,
        error: null,
      };
    }

    case EDIT_EVENTS.START_FAILED: {
      if (ctx.state !== EDIT_STATES.STARTING) return NO_TRANSITION;
      return {
        ...ctx,
        state: EDIT_STATES.ERROR,
        failedPhase: 'start',
        error: event.error ?? 'Failed to start editing',
      };
    }

    case EDIT_EVENTS.CHANGE: {
      if (ctx.state !== EDIT_STATES.EDITING) return NO_TRANSITION;
      return {
        ...ctx,
        draft: event.draft,
        dirty: true,
      };
    }

    case EDIT_EVENTS.REQUEST_SAVE: {
      if (ctx.state !== EDIT_STATES.EDITING) return NO_TRANSITION;
      return {
        ...ctx,
        state: EDIT_STATES.SAVING,
        failedPhase: null,
        error: null,
      };
    }

    case EDIT_EVENTS.SAVE_SUCCESS: {
      if (ctx.state !== EDIT_STATES.SAVING) return NO_TRANSITION;
      return {
        ...ctx,
        state: EDIT_STATES.RETURNING,
        dirty: false,
      };
    }

    case EDIT_EVENTS.SAVE_FAILED: {
      if (ctx.state !== EDIT_STATES.SAVING) return NO_TRANSITION;
      return {
        ...ctx,
        state: EDIT_STATES.ERROR,
        failedPhase: event.phase ?? 'persist',
        error: event.error ?? 'Save failed',
      };
    }

    case EDIT_EVENTS.CANCEL: {
      // Cancel from Editing or Error goes straight to Returning (no persist).
      if (ctx.state === EDIT_STATES.EDITING || ctx.state === EDIT_STATES.ERROR) {
        return {
          ...ctx,
          state: EDIT_STATES.RETURNING,
          dirty: false,
          failedPhase: null,
          error: null,
        };
      }
      return NO_TRANSITION;
    }

    case EDIT_EVENTS.RETRY: {
      if (ctx.state !== EDIT_STATES.ERROR) return NO_TRANSITION;
      // Retrying a failed start returns to Starting; any other failed phase
      // returns to Editing so the user can review and re-save.
      if (ctx.failedPhase === 'start') {
        return { ...ctx, state: EDIT_STATES.STARTING, failedPhase: null, error: null };
      }
      return { ...ctx, state: EDIT_STATES.EDITING, failedPhase: null, error: null };
    }

    case EDIT_EVENTS.RETURN_DONE: {
      if (ctx.state !== EDIT_STATES.RETURNING) return NO_TRANSITION;
      return createInitialEditState();
    }

    default:
      return NO_TRANSITION;
  }
}

/** Convenience predicates for consumers. */
export const isActive = (ctx) =>
  ctx.state !== EDIT_STATES.IDLE && ctx.state !== EDIT_STATES.RETURNING;
export const isEditing = (ctx) => ctx.state === EDIT_STATES.EDITING;
export const isSaving = (ctx) => ctx.state === EDIT_STATES.SAVING;
export const isError = (ctx) => ctx.state === EDIT_STATES.ERROR;
export const canSave = (ctx) => ctx.state === EDIT_STATES.EDITING;
