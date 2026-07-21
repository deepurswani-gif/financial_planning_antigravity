/**
 * Edit Session model + URL serialization.
 *
 * An Edit Session is the single unit of an editing interaction. It captures:
 *  - what is being edited (canonical field id + optional collection instance)
 *  - where it will be edited (resolved registry surface + experience)
 *  - where the user came from (origin report) so we can Return-to-Origin
 *
 * The session is registry-driven: the target is resolved from the frozen
 * Question Registry, never from hardcoded mappings.
 */

import { getFieldById, resolveEditTarget } from '../questionRegistry';
import { resolveSectionId } from '../components/FinancialWorkspace/sectionIds';

let sessionCounter = 0;

/**
 * @typedef {object} EditOrigin
 * @property {'summary'|'full'} [workspaceMode]
 * @property {string|null} [reportId]         originating report to return to
 * @property {string|null} [reportSectionId]  optional DOM scroll anchor
 * @property {'quick_edit'|'report_drill_in'|'drawer_section'|'deep_link'|'ai'|'unknown'} [source]
 */

/**
 * @typedef {object} EditSession
 * @property {string} id
 * @property {'focused'} mode
 * @property {string} fieldId
 * @property {string|null} instanceId
 * @property {object} target      resolved surface { sectionId, questionId, experience, capability, flow, role }
 * @property {EditOrigin} origin
 * @property {string} startedAt
 */

/**
 * Create an Edit Session for a canonical field.
 *
 * @param {string} fieldId
 * @param {object} [options]
 * @param {EditOrigin} [options.origin]
 * @param {'quick'|'breakdown'|'recap'} [options.intent]
 * @param {'summary'|'full'} [options.capability]
 * @param {string|null} [options.instanceId]
 * @param {() => string} [options.now]  injectable clock (tests)
 * @param {() => string} [options.idFactory] injectable id (tests)
 * @returns {EditSession}
 * @throws {Error} when the field is unknown to the registry
 */
export function createEditSession(fieldId, options = {}) {
  const field = getFieldById(fieldId);
  if (!field) {
    throw new Error(`Unknown registry field "${fieldId}" — cannot start edit session`);
  }

  const capability = options.capability === 'full' ? 'full' : 'summary';
  const intent = options.intent ?? 'quick';
  const target = resolveEditTarget(field, { capability, intent });

  const now = options.now ? options.now() : new Date().toISOString();
  const id = options.idFactory ? options.idFactory() : `es_${++sessionCounter}_${Date.now()}`;

  return {
    id,
    mode: 'focused',
    fieldId,
    instanceId: options.instanceId ?? null,
    target,
    origin: normalizeOrigin(options.origin),
    startedAt: now,
  };
}

function normalizeOrigin(origin = {}) {
  return {
    workspaceMode: origin.workspaceMode === 'full' ? 'full' : origin.workspaceMode === 'summary' ? 'summary' : null,
    reportId: origin.reportId ?? null,
    reportSectionId: origin.reportSectionId ?? null,
    source: origin.source ?? 'unknown',
  };
}

/**
 * Serialize an Edit Session into URL params (backward compatible with the
 * existing ?mode/report/section/edit contract; adds field/q/instance/editMode).
 *
 * @param {EditSession} session
 * @param {URLSearchParams} [base] existing params to extend
 * @returns {URLSearchParams}
 */
export function encodeEditSessionToParams(session, base) {
  const params = new URLSearchParams(base ? base.toString() : '');
  const mode = session.origin.workspaceMode ?? session.target.capability ?? 'full';
  params.set('mode', mode === 'summary' ? 'summary' : 'full');
  if (session.origin.reportId) params.set('report', session.origin.reportId);
  else params.delete('report');

  if (session.target.sectionId) params.set('edit', resolveSectionId(session.target.sectionId));
  if (session.target.questionId) params.set('q', session.target.questionId);
  params.set('field', session.fieldId);
  params.set('editMode', 'focused');
  if (session.instanceId) params.set('instance', session.instanceId);
  else params.delete('instance');

  // `section` (scroll anchor) only applies once we've returned to a report.
  if (session.origin.reportSectionId) params.set('section', session.origin.reportSectionId);
  return params;
}

/**
 * Rebuild an Edit Session from URL params. Returns null when no focused edit
 * is described (so existing section-only `?edit=` links are untouched).
 *
 * @param {URLSearchParams} params
 * @returns {EditSession | null}
 */
export function decodeEditSessionFromParams(params) {
  const fieldId = params.get('field');
  const editMode = params.get('editMode');
  if (!fieldId || editMode !== 'focused') return null;
  if (!getFieldById(fieldId)) return null;

  const capability = params.get('mode') === 'summary' ? 'summary' : 'full';
  return createEditSession(fieldId, {
    capability,
    instanceId: params.get('instance') ?? null,
    origin: {
      workspaceMode: capability,
      reportId: params.get('report') ?? null,
      reportSectionId: params.get('section') ?? null,
      source: 'deep_link',
    },
  });
}

/**
 * Clear all focused-edit params, keeping mode + report (+ optional section) so
 * the shell returns to the originating report.
 *
 * @param {EditSession} session
 * @param {URLSearchParams} [base]
 * @returns {URLSearchParams}
 */
export function encodeReturnToOriginParams(session, base) {
  const params = new URLSearchParams(base ? base.toString() : '');
  params.delete('edit');
  params.delete('q');
  params.delete('field');
  params.delete('editMode');
  params.delete('instance');

  const mode = session.origin.workspaceMode ?? 'full';
  params.set('mode', mode === 'summary' ? 'summary' : 'full');
  if (session.origin.reportId) params.set('report', session.origin.reportId);
  if (session.origin.reportSectionId) params.set('section', session.origin.reportSectionId);
  else params.delete('section');
  return params;
}
