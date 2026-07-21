import React, { useCallback } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { getSectionById, isAdvancedSection } from './sectionRegistry';
import {
  DEFAULT_DETAIL_TAB_ID,
  DEFAULT_SUMMARY_REPORT_ID,
  financialWorkspacePath,
} from './workspaceNavConfig';
import { isDrawerItemLocked } from './workspaceCapabilities';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useFinancialWorkspace } from './FinancialWorkspaceContext';
import { useAuth } from '../../contexts/AuthContext';
import { loadWorkspaceCapability } from './workspaceCapabilityStorage';

/**
 * Renders an editable financial section inside the permanent workspace shell.
 * Reuses existing form components without redesigning question order.
 */
export default function WorkspaceSectionEditor({ sectionId }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { workspaceCapability } = useFinancialPlan();
  const { user } = useAuth();
  const { setDrawerOpen } = useFinancialWorkspace();

  const section = sectionId ? getSectionById(sectionId) : null;
  const effectiveCapability = workspaceCapability ?? loadWorkspaceCapability(user?.id);
  const locked = sectionId ? isDrawerItemLocked(effectiveCapability, sectionId) : true;

  const handleBackToReports = useCallback(() => {
    const modeFromQuery = searchParams.get('mode');
    const mode =
      effectiveCapability === 'full'
        ? 'full'
        : effectiveCapability === 'summary'
          ? 'summary'
          : modeFromQuery === 'summary'
            ? 'summary'
            : 'full';

    const reportFromQuery = searchParams.get('report');
    const report =
      reportFromQuery ??
      (mode === 'full' ? DEFAULT_DETAIL_TAB_ID : DEFAULT_SUMMARY_REPORT_ID);

    navigate(financialWorkspacePath(mode, { report }));
  }, [navigate, effectiveCapability, searchParams]);

  if (!section || locked) {
    return (
      <Navigate
        to={financialWorkspacePath(
          effectiveCapability === 'full' ? 'full' : 'summary',
          {
            report:
              searchParams.get('report') ??
              (effectiveCapability === 'full'
                ? DEFAULT_DETAIL_TAB_ID
                : DEFAULT_SUMMARY_REPORT_ID),
          },
        )}
        replace
      />
    );
  }

  const SectionComponent = section.component;

  return (
    <div className="fw-section-editor">
      <div className="fw-section-editor-bar">
        <button
          type="button"
          className="fw-section-editor-back"
          onClick={handleBackToReports}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Back to Reports
        </button>
        <span className="fw-section-editor-title">{section.label}</span>
        <button
          type="button"
          className="fw-section-editor-menu"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
        >
          Menu
        </button>
      </div>
      <div
        className={`fw-section-editor-body ${
          isAdvancedSection(sectionId) ? 'fw-section-editor-body--detailed' : 'fw-section-editor-body--summary'
        }`}
      >
        <SectionComponent />
      </div>
    </div>
  );
}
