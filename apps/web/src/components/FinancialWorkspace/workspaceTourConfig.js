/** Mobile Financial Dashboard product tour — step targets and copy. */

export const WORKSPACE_TOUR_STORAGE_KEY_PREFIX = 'finbrella.workspaceTour.v1';

/** data-tour attribute values — must match anchors in mobile chrome. */
export const WORKSPACE_TOUR_TARGETS = {
  hub: 'workspace-hub',
  smartEdit: 'workspace-smart-edit',
  tools: 'workspace-tools',
  mode: 'workspace-mode',
  workflow: 'workspace-workflow',
  report: 'workspace-report',
};

/**
 * @typedef {'intro' | 'detailed' | 'manual'} WorkspaceTourTrigger
 */

/**
 * @param {WorkspaceTourTrigger} [trigger]
 * @returns {{
 *   id: string,
 *   target: string,
 *   title: string,
 *   body: string,
 *   openHub?: 'edit' | 'reports' | 'tools' | null,
 * }[]}
 */
export function getWorkspaceTourSteps(trigger = 'intro') {
  const modeBody =
    trigger === 'detailed'
      ? 'Detailed is unlocked. Switch here anytime to go deeper into your plan.'
      : 'Flip between a quick Summary and deeper Detailed reports. Detailed unlocks after planning.';

  return [
    {
      id: 'hub',
      target: WORKSPACE_TOUR_TARGETS.hub,
      title: 'Your menu',
      body: 'Open Smart Edit, Reports, and Tools from here — your control center for the dashboard.',
      openHub: null,
    },
    {
      id: 'smartEdit',
      target: WORKSPACE_TOUR_TARGETS.smartEdit,
      title: 'Smart Edit',
      body: 'Change any of your information here — income, goals, assets, and more — without going back through Summary or Detailed Planning.',
      openHub: 'edit',
    },
    {
      id: 'tools',
      target: WORKSPACE_TOUR_TARGETS.tools,
      title: 'Calculators & tools',
      body: 'Run SIPs, loans, and more without leaving your dashboard.',
      openHub: null,
    },
    {
      id: 'mode',
      target: WORKSPACE_TOUR_TARGETS.mode,
      title: 'Summary & Detailed',
      body: modeBody,
      openHub: null,
    },
    {
      id: 'workflow',
      target: WORKSPACE_TOUR_TARGETS.workflow,
      title: 'Move between reports',
      body: 'Use Previous, Next, or the dots to walk through each chapter of your plan.',
      openHub: null,
    },
    {
      id: 'report',
      target: WORKSPACE_TOUR_TARGETS.report,
      title: 'Your report',
      body: 'Insights and recommendations live here — scroll to explore your money story.',
      openHub: null,
    },
  ];
}
