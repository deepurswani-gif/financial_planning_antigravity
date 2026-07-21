import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { detailedReportSteps } from './detailedReportSteps';

/**
 * Optional host adapter for detail-report navigation.
 * Financial Workspace registers an in-shell switcher; standalone uses router fallback.
 * Reports must not import workspace context — they call these helpers only.
 *
 * @typedef {{
 *   navigateToDetailReport?: (reportId: string) => void,
 *   getDetailReportPath?: (reportId: string, options?: { section?: string }) => string,
 * }} ReportNavigationHost
 */

/** @type {ReportNavigationHost | null} */
let hostAdapter = null;

/**
 * @param {ReportNavigationHost | null} adapter
 * @returns {() => void} unregister
 */
export function registerReportNavigationHost(adapter) {
  hostAdapter = adapter;
  return () => {
    if (hostAdapter === adapter) {
      hostAdapter = null;
    }
  };
}

/**
 * @param {string} reportId
 * @param {{ section?: string }} [options]
 */
export function getDetailReportPath(reportId, options = {}) {
  if (hostAdapter?.getDetailReportPath) {
    return hostAdapter.getDetailReportPath(reportId, options);
  }
  const step = detailedReportSteps.find((s) => s.slug === reportId);
  const path = step?.path ?? detailedReportSteps[0].path;
  if (options.section) return `${path}#${options.section}`;
  return path;
}

/**
 * Host-aware navigation between detail report sections.
 * Workspace host → tab switch; otherwise → React Router path.
 */
export function useNavigateToDetailReport() {
  const navigate = useNavigate();

  return useCallback(
    (reportId) => {
      if (hostAdapter?.navigateToDetailReport) {
        hostAdapter.navigateToDetailReport(reportId);
        return;
      }
      navigate(getDetailReportPath(reportId));
    },
    [navigate]
  );
}
