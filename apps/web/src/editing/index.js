/**
 * Finbrella Editing Platform — public surface.
 *
 * The reusable, registry-driven editing framework. Every editing entry point
 * (Quick Edit, AI-assisted edits, report links, deep links) consumes these
 * primitives so they share one Edit Session lifecycle, one Save Pipeline, and
 * consistent Return-to-Origin behaviour.
 */

export {
  EDIT_STATES,
  EDIT_EVENTS,
  createInitialEditState,
  editSessionReducer,
  isActive,
  isEditing,
  isSaving,
  isError,
  canSave,
} from './editSessionMachine';

export {
  createEditSession,
  encodeEditSessionToParams,
  decodeEditSessionFromParams,
  encodeReturnToOriginParams,
} from './editSession';

export { runSavePipeline, SAVE_PHASES } from './savePipeline';
export { validateFieldValue, validateFieldValues, coerceValue } from './validation';
export {
  parsePath,
  getRootKey,
  readValueByPath,
  computeRootUpdate,
} from './planAccessor';

export { EditingProvider, useEditing, useOptionalEditing } from './EditingProvider';
export { default as FocusedEditShell } from './FocusedEditShell';
