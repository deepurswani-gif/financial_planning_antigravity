/**
 * Registry-driven deep links for push / in-app destinations.
 * Never open marketing Home — always a meaningful workspace surface.
 */

import { financialWorkspacePath } from '../components/FinancialWorkspace/workspaceNavConfig';
import { SECTION_IDS } from '../components/FinancialWorkspace/sectionIds';

/**
 * @typedef {object} DeepLinkDefinition
 * @property {string} id
 * @property {string} label
 * @property {'workspace'|'workspace_report'|'workspace_section'|'smart_edit'} type
 * @property {'summary'|'full'} [mode]
 * @property {string} [reportId]
 * @property {string} [sectionId]
 * @property {string} [land]
 * @property {string} [control]
 */

/** @type {ReadonlyArray<DeepLinkDefinition>} */
export const DEEP_LINK_REGISTRY = Object.freeze([
  Object.freeze({
    id: 'workspace.default',
    label: 'Financial Workspace',
    type: 'workspace',
    mode: 'full',
  }),
  Object.freeze({
    id: 'report.protectionGap',
    label: 'Protection Gap Report',
    type: 'workspace_report',
    mode: 'full',
    reportId: 'fix_your_financial_gaps',
  }),
  Object.freeze({
    id: 'report.putMoneyToWork',
    label: 'Put Your Money To Work',
    type: 'workspace_report',
    mode: 'full',
    reportId: 'put_your_money_to_work',
  }),
  Object.freeze({
    id: 'report.goals',
    label: 'Goals Report',
    type: 'workspace_section',
    mode: 'full',
    sectionId: SECTION_IDS.DREAMS_AND_GOALS,
    reportId: 'future_self',
  }),
  Object.freeze({
    id: 'report.monthlySummary',
    label: 'Monthly Summary',
    type: 'workspace_report',
    mode: 'full',
    // Closest product surface for “where your money went” until a dedicated monthly summary report ships.
    reportId: 'your_money_flow',
  }),
  Object.freeze({
    id: 'smart_edit.ready',
    label: 'Smart Edit',
    type: 'smart_edit',
    mode: 'full',
    // sectionId / land supplied at resolve time for future Smart Edit targets
  }),
]);

const BY_ID = new Map(DEEP_LINK_REGISTRY.map((d) => [d.id, d]));

export function getDeepLinkById(id) {
  return BY_ID.get(id) ?? null;
}

export function isDeepLinkId(value) {
  return BY_ID.has(value);
}

export function listDeepLinks() {
  return [...DEEP_LINK_REGISTRY];
}

/**
 * Resolve a registry deep link into a concrete workspace path + FCM data fields.
 * @param {string} deepLinkId
 * @param {{ sectionId?: string, land?: string, control?: string, collection?: string }} [params]
 */
export function resolveDeepLink(deepLinkId, params = {}) {
  const def = getDeepLinkById(deepLinkId);
  if (!def) {
    return {
      deepLinkId,
      label: 'Financial Workspace',
      path: financialWorkspacePath('full'),
      valid: false,
    };
  }

  const mode = def.mode === 'summary' ? 'summary' : 'full';
  let path;

  switch (def.type) {
    case 'workspace_report':
      path = financialWorkspacePath(mode, { report: def.reportId });
      break;
    case 'workspace_section':
      path = financialWorkspacePath(mode, {
        report: def.reportId,
        edit: def.sectionId || params.sectionId,
      });
      break;
    case 'smart_edit':
      path = financialWorkspacePath(mode, {
        report: def.reportId || params.reportId,
        edit: params.sectionId || def.sectionId,
        land: params.land || def.land,
        control: params.control || def.control,
        collection: params.collection,
      });
      break;
    case 'workspace':
    default:
      path = financialWorkspacePath(mode, {
        report: params.reportId,
      });
      break;
  }

  return {
    deepLinkId: def.id,
    label: def.label,
    type: def.type,
    path,
    valid: true,
  };
}
