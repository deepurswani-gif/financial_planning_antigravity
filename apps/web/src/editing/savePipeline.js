/**
 * Save Pipeline — the single save path for every editing entry point.
 *
 * Ordered phases:
 *   1. validate     — registry-driven field validation
 *   2. persist      — commit value(s) to the plan + durable store
 *   3. recalculate  — mark impacted reports/calculations stale (registry impacts)
 *   4. close        — close the Edit Session
 *   5. return       — navigate back to the originating report
 *
 * Pure orchestration: all effects are injected as `deps`, so the pipeline is
 * fully unit-testable and reused by Quick Edit, AI edits, deep links, etc.
 *
 * On failure the pipeline stops, reports the failing phase, and never advances
 * to close/return — the caller keeps the session open for retry.
 */

export const SAVE_PHASES = Object.freeze([
  'validate',
  'persist',
  'recalculate',
  'close',
  'return',
]);

/**
 * @typedef {object} SavePipelineDeps
 * @property {() => ({ valid: boolean, errors: string[], values?: any })} validate
 * @property {(values: any) => Promise<void> | void} persist
 * @property {(impacts: string[]) => Promise<void> | void} recalculate
 * @property {() => Promise<void> | void} close
 * @property {() => Promise<void> | void} returnToOrigin
 * @property {() => string[]} [getImpacts]  registry impacts for the field(s)
 * @property {(phase: string) => void} [onPhase]  progress hook (telemetry/UI)
 */

/**
 * @typedef {object} SaveResult
 * @property {boolean} ok
 * @property {string} [phase]      the phase that failed
 * @property {string[]} [errors]   validation or error messages
 * @property {string[]} [impacts]  reports/calculations recalculated
 */

/**
 * Run the save pipeline.
 * @param {SavePipelineDeps} deps
 * @returns {Promise<SaveResult>}
 */
export async function runSavePipeline(deps) {
  const {
    validate,
    persist,
    recalculate,
    close,
    returnToOrigin,
    getImpacts,
    onPhase,
  } = deps;

  // 1. validate
  onPhase?.('validate');
  const validation = validate ? validate() : { valid: true };
  if (!validation.valid) {
    return { ok: false, phase: 'validate', errors: validation.errors ?? ['Validation failed'] };
  }

  // 2. persist
  onPhase?.('persist');
  try {
    await persist?.(validation.values);
  } catch (err) {
    return { ok: false, phase: 'persist', errors: [errorMessage(err, 'Failed to save changes')] };
  }

  // 3. recalculate
  onPhase?.('recalculate');
  const impacts = getImpacts ? getImpacts() : [];
  try {
    await recalculate?.(impacts);
  } catch (err) {
    return { ok: false, phase: 'recalculate', errors: [errorMessage(err, 'Failed to update reports')] };
  }

  // 4. close
  onPhase?.('close');
  try {
    await close?.();
  } catch (err) {
    return { ok: false, phase: 'close', errors: [errorMessage(err, 'Failed to close edit session')] };
  }

  // 5. return
  onPhase?.('return');
  try {
    await returnToOrigin?.();
  } catch (err) {
    return { ok: false, phase: 'return', errors: [errorMessage(err, 'Failed to return to report')] };
  }

  return { ok: true, impacts };
}

function errorMessage(err, fallback) {
  if (!err) return fallback;
  if (typeof err === 'string') return err;
  return err.message || fallback;
}
