import {
  DEFAULT_DETAIL_TAB_ID,
  DEFAULT_SUMMARY_REPORT_ID,
  FINANCIAL_WORKSPACE_PATH,
  financialWorkspacePath,
  SUMMARY_FLOW_ENTRY_PATH,
} from './workspaceNavConfig';
import {
  WORKSPACE_CAPABILITY_FULL,
  WORKSPACE_CAPABILITY_SUMMARY,
  capabilityToWorkspaceMode,
  resolveEffectiveCapability,
} from './workspaceCapabilityStorage';

/**
 * Resolve where a user should land after login or at app root.
 * Workspace entry depends only on highest unlocked capability, not onboarding progress.
 */
export function resolveWorkspaceEntry({
  workspaceCapability,
  summaryReportGeneratedAt,
  storedCapability = null,
}) {
  const capability = resolveEffectiveCapability({
    storedCapability: workspaceCapability ?? storedCapability,
    summaryReportGeneratedAt,
  });

  if (!capability) {
    return SUMMARY_FLOW_ENTRY_PATH;
  }

  const mode = capabilityToWorkspaceMode(capability);
  const report =
    capability === WORKSPACE_CAPABILITY_FULL
      ? DEFAULT_DETAIL_TAB_ID
      : DEFAULT_SUMMARY_REPORT_ID;

  return financialWorkspacePath(mode, { report });
}

/**
 * Normalize a requested workspace mode against the user's capability.
 * Full-capability users must never be routed into Summary workspace.
 */
export function resolveWorkspaceModeForCapability(requestedMode, capability) {
  if (capability === WORKSPACE_CAPABILITY_FULL) {
    return WORKSPACE_CAPABILITY_FULL;
  }
  return requestedMode === WORKSPACE_CAPABILITY_SUMMARY
    ? WORKSPACE_CAPABILITY_SUMMARY
    : WORKSPACE_CAPABILITY_SUMMARY;
}

export function isWorkspaceRoute(pathname) {
  return pathname === FINANCIAL_WORKSPACE_PATH || pathname.startsWith(`${FINANCIAL_WORKSPACE_PATH}/`);
}

export function isOnboardingRoute(pathname) {
  return (
    pathname.startsWith('/summary-flow') ||
    (pathname.startsWith('/detailed-flow') && !pathname.startsWith('/detailed-flow/existing-app'))
  );
}

export { WORKSPACE_CAPABILITY_SUMMARY, WORKSPACE_CAPABILITY_FULL };
