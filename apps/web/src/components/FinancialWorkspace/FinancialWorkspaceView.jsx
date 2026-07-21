import React, { useState, useRef, useLayoutEffect, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { signOut } from '../../services/authService';
import { useFinancialWorkspace } from './FinancialWorkspaceContext';
import StickyTopAppBar from './StickyTopAppBar';
import SecondaryNavigation from './SecondaryNavigation';
import SummaryReportNavigation from './SummaryReportNavigation';
import DetailReportTabs from './DetailReportTabs';
import ReportContextBar from './ReportContextBar';
import ActiveWorkspace from './ActiveWorkspace';
import WorkspaceContent from './WorkspaceContent';
import ReservedQuickActions from './ReservedQuickActions';
import ReservedWidgets from './ReservedWidgets';
import WorkflowNavigationBar from './WorkflowNavigationBar';
import SmartEditDrawer from './SmartEditDrawer';
import CalculatorModal from './CalculatorModal';
import UnlockPlanningDialog from './UnlockPlanningDialog';
import {
  DETAILED_FLOW_ENTRY_PATH,
  DEFAULT_DETAIL_TAB_ID,
  DEFAULT_SUMMARY_REPORT_ID,
  FINANCIAL_WORKSPACE_PATH,
  LEGACY_EXISTING_APP_PATH,
  getDetailReportLabel,
  getSummaryReportLabel,
  financialWorkspacePath,
} from './workspaceNavConfig';
import { registerReportNavigationHost } from '../DetailedReport/reportNavigation';
import {
  canUseCalculators,
  canUseDetailReports,
  isSummaryMode,
  normalizeWorkspaceMode,
} from './workspaceCapabilities';
import WorkspaceSectionEditor from './WorkspaceSectionEditor';
import { isKnownSectionId } from './sectionRegistry';
import { resolveSectionId } from './sectionIds';
import { loadWorkspaceCapability } from './workspaceCapabilityStorage';
import { useEditing } from '../../editing/EditingProvider';
import { getExperienceById, resolveLaunch, buildActivationRequest } from '../../experienceRegistry';
import { SmartEditActivationContext } from './smartEdit/activationChannel';

/**
 * Scroll to a section id inside the workspace scroll container.
 * Retries briefly so keep-alive report panes can finish painting.
 */
function scrollWorkspaceSectionIntoView(sectionId) {
  const tryScroll = () => {
    const el = document.getElementById(sectionId);
    if (!el) return false;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return true;
  };

  const timers = [0, 50, 150, 350].map((ms) => setTimeout(tryScroll, ms));
  return () => timers.forEach(clearTimeout);
}

/**
 * Financial Workspace shell — single implementation, Summary Mode or Full Mode.
 */
export default function FinancialWorkspaceView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const {
    familyMembers,
    savePlanData,
    handleLogoutCleanup,
    planStartMonth,
    lastSaved,
    workspaceCapability,
  } = useFinancialPlan();
  const effectiveWorkspaceCapability = workspaceCapability ?? loadWorkspaceCapability(user?.id);
  const {
    state,
    setMode,
    selectPrimary,
    openCalculator,
    selectSummaryReport,
    selectDetailReport,
    workflowPrevious,
    workflowNext,
    setDrawerOpen,
    getDrawerAction,
    canWorkflowPrevious,
    canWorkflowNext,
    setWorkspaceScroll,
  } = useFinancialWorkspace();

  const { startEditSession } = useEditing();

  // Smart Edit activation channel — publishes an activation request that the
  // mounted section consumes via useSmartEditActivation (no DOM / click hacks).
  const [activationRequest, setActivationRequest] = useState(null);
  const requestActivation = useCallback((req) => {
    setActivationRequest(req ? { ...req, nonce: Date.now() + Math.random() } : null);
  }, []);
  const clearActivation = useCallback(() => setActivationRequest(null), []);
  const activationContextValue = useMemo(
    () => ({ request: activationRequest, clearActivation }),
    [activationRequest, clearActivation],
  );

  const {
    mode,
    activePrimaryId,
    activeSecondaryId,
    activeSummaryReportId,
    activeDetailReportId,
    workspaceFocus,
    drawerOpen,
  } = state;

  const summaryMode = isSummaryMode(mode);
  const calculatorsLocked = !canUseCalculators(mode);
  const detailReportsLocked = !canUseDetailReports(mode);
  const editQueryId = searchParams.get('edit');
  const editSectionId = editQueryId ? resolveSectionId(editQueryId) : null;
  const editingSection = Boolean(editSectionId && isKnownSectionId(editSectionId));
  const queryMode = searchParams.get('mode');
  const queryReport = searchParams.get('report');
  const querySection = searchParams.get('section');

  // Enforce the user's highest unlocked capability for permanent workspace routing.
  useEffect(() => {
    if (!effectiveWorkspaceCapability) return;
    const targetMode =
      effectiveWorkspaceCapability === 'full' ? 'full' : 'summary';
    if (targetMode !== mode) {
      setMode(targetMode);
    }
  }, [effectiveWorkspaceCapability, mode, setMode]);

  const [unlockOpen, setUnlockOpen] = useState(false);

  const primaryTabRefs = useRef({});
  const toolbarTrackRef = useRef(null);
  const [toolbarCenterPx, setToolbarCenterPx] = useState(null);

  const selfMember = familyMembers?.find((m) => m.relation === 'Self');
  const userInitials = selfMember?.name
    ? selfMember.name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : user?.email?.[0]?.toUpperCase() || 'U';

  // Sync mode + entry report from ?mode=&report=&section= (product flow entry).
  useEffect(() => {
    const fromQuery = queryMode;
    const report = queryReport;
    const section = querySection;

    const shouldScroll = Boolean(section) && !editQueryId;

    const resolveTargetMode = () => {
      if (fromQuery !== 'summary' && fromQuery !== 'full') return null;
      if (effectiveWorkspaceCapability === 'full') return 'full';
      if (effectiveWorkspaceCapability === 'summary') return 'summary';
      return normalizeWorkspaceMode(fromQuery);
    };

    const targetMode = resolveTargetMode();
    if (targetMode) {
      setMode(targetMode);
      if (targetMode === 'summary') {
        selectSummaryReport(report || DEFAULT_SUMMARY_REPORT_ID);
      } else {
        selectDetailReport(report || DEFAULT_DETAIL_TAB_ID);
      }
      if (!shouldScroll) {
        setWorkspaceScroll(0);
        const content = document.querySelector('.fw-workspace-content');
        if (content) content.scrollTop = 0;
      }
    }

    if (!shouldScroll) return undefined;
    return scrollWorkspaceSectionIntoView(section);
  }, [
    queryMode,
    queryReport,
    querySection,
    setMode,
    selectSummaryReport,
    selectDetailReport,
    setWorkspaceScroll,
    effectiveWorkspaceCapability,
  ]);

  const registerPrimaryTabRef = useCallback((id, el) => {
    if (el) primaryTabRefs.current[id] = el;
    else delete primaryTabRefs.current[id];
  }, []);

  const syncToolbarAnchor = useCallback(() => {
    if (!activePrimaryId) {
      setToolbarCenterPx(null);
      return;
    }
    const tab = primaryTabRefs.current[activePrimaryId];
    const track = toolbarTrackRef.current;
    if (!tab || !track) return;
    const tabRect = tab.getBoundingClientRect();
    const trackRect = track.getBoundingClientRect();
    setToolbarCenterPx(tabRect.left + tabRect.width / 2 - trackRect.left);
  }, [activePrimaryId]);

  useLayoutEffect(() => {
    syncToolbarAnchor();
    const onResize = () => syncToolbarAnchor();
    window.addEventListener('resize', onResize);
    const raf = requestAnimationFrame(() => syncToolbarAnchor());
    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(raf);
    };
  }, [syncToolbarAnchor]);

  const openUnlockDialog = useCallback(() => {
    setUnlockOpen(true);
  }, []);

  const closeUnlockDialog = useCallback(() => {
    setUnlockOpen(false);
  }, []);

  const goToDetailedPlanning = useCallback(() => {
    setUnlockOpen(false);
    setDrawerOpen(false);
    navigate(DETAILED_FLOW_ENTRY_PATH);
  }, [navigate, setDrawerOpen]);

  useEffect(() => {
    return registerReportNavigationHost({
      navigateToDetailReport: (reportId) => {
        if (!canUseDetailReports(mode)) {
          openUnlockDialog();
          return;
        }
        selectDetailReport(reportId);
      },
      getDetailReportPath: (reportId, { section } = {}) =>
        financialWorkspacePath(mode, { report: reportId, section }),
    });
  }, [selectDetailReport, mode, openUnlockDialog]);

  const monthShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const now = new Date();
  const planStartLabel =
    typeof planStartMonth === 'number' && planStartMonth >= 0 && planStartMonth < 12
      ? monthShort[planStartMonth]
      : '—';
  const currentMonthLabel = monthShort[now.getMonth()];
  const lastUpdatedLabel = lastSaved
    ? new Date(lastSaved).toLocaleString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

  const contextFields = [
    {
      id: 'current_report',
      label: 'Current Report',
      value:
        workspaceFocus === 'summary' || summaryMode
          ? getSummaryReportLabel(activeSummaryReportId)
          : getDetailReportLabel(activeDetailReportId),
    },
    { id: 'plan_start', label: 'Plan Start', value: planStartLabel },
    { id: 'current_month', label: 'Current Month', value: currentMonthLabel },
    { id: 'last_updated', label: 'Last Updated', value: lastUpdatedLabel },
    { id: 'projection_year', label: 'Projection Year', value: String(now.getFullYear()) },
  ];

  const handleDrawerItem = async (itemId, meta = {}) => {
    if (meta.locked) {
      setDrawerOpen(false);
      openUnlockDialog();
      return;
    }

    const action = getDrawerAction(itemId);
    setDrawerOpen(false);

    if (action.type === 'open_calculator' && action.calculatorId) {
      if (!canUseCalculators(mode)) {
        openUnlockDialog();
        return;
      }
      openCalculator(action.calculatorId);
      return;
    }

    if (action.type === 'open_section' && action.sectionId) {
      const reportId = mode === 'summary' ? activeSummaryReportId : activeDetailReportId;
      navigate(financialWorkspacePath(mode, { report: reportId, edit: action.sectionId }));
      return;
    }

    if (action.type === 'navigate' && action.path) {
      navigate(action.path);
      return;
    }

    if (action.type === 'logout') {
      if (savePlanData) {
        try {
          await savePlanData();
        } catch (e) {
          console.error('Save failed on logout', e);
        }
      }
      await signOut();
      handleLogoutCleanup?.();
      navigate('/', { replace: true });
    }
  };

  /**
   * Launch an editing experience from Smart Edit. Consumes the Experience
   * Registry to resolve the correct launch strategy, then dispatches it using
   * existing platform capabilities only (Edit Session, calculator modal,
   * section editor). No new routing is introduced.
   */
  const handleLaunchExperience = (arg) => {
    // `arg` is either an experience id (footer utilities) or a full result
    // descriptor from the drawer. Dynamic-entity descriptors additionally carry
    // instance identity + an activation override so we open that exact object.
    const item = typeof arg === 'string' ? { experienceId: arg } : arg || {};
    const experienceId = item.experienceId;
    const entityLaunch = item.kind === 'entity' ? item : null;

    if (experienceId === '__settings__') {
      setDrawerOpen(false);
      return true;
    }
    if (experienceId === '__logout__') {
      handleDrawerItem('logout');
      return true;
    }

    const experience = getExperienceById(experienceId);
    if (!experience) return true;

    const capability = summaryMode ? 'summary' : 'full';
    const reportId = summaryMode ? activeSummaryReportId : activeDetailReportId;
    const origin = { workspaceMode: capability, reportId };
    const descriptor = resolveLaunch(experience, { capability });

    switch (descriptor.strategy) {
      case 'focused_edit_session':
        if (descriptor.fieldId) {
          startEditSession(descriptor.fieldId, {
            intent: descriptor.intent,
            capability,
            origin,
            instanceId: entityLaunch?.instanceId ?? descriptor.instanceId,
          });
        }
        break;

      case 'configure_modal':
        if (calculatorsLocked) {
          openUnlockDialog();
          break;
        }
        if (descriptor.calculatorId) openCalculator(descriptor.calculatorId);
        break;

      case 'configure_screen':
      case 'collection_picker':
      case 'mini_wizard':
      case 'readonly_explanation':
      default:
        if (descriptor.sectionId) {
          // Activation: publish a request so the section auto-opens the correct
          // editing experience once mounted (openConfigureModal / add / picker).
          // For a known entity, use its activation override (with the exact
          // instance index/key) so the section opens *that* object — no picker.
          const activation = entityLaunch?.activation
            ? {
                experienceId,
                strategy: 'openExistingInstance',
                channel: entityLaunch.activation.channel,
                key: entityLaunch.activation.key ?? null,
                index: entityLaunch.activation.index ?? null,
                collection: false,
                collectionFieldId: descriptor.collectionFieldId ?? null,
                questionId: descriptor.landingQuestionId ?? null,
              }
            : buildActivationRequest(experience, {
                control: descriptor.landingControl,
                questionId: descriptor.landingQuestionId,
                collectionFieldId: descriptor.collectionFieldId,
              });
          requestActivation(activation);
          navigate(
            financialWorkspacePath(summaryMode ? 'summary' : 'full', {
              report: reportId,
              edit: descriptor.sectionId,
              // Landing target: jump straight to the right question/control so
              // the user never has to chevron-browse after Smart Edit.
              land: descriptor.landingQuestionId,
              control: descriptor.landingControl,
              collection: descriptor.collectionFieldId,
            }),
          );
        } else if (descriptor.fieldId) {
          // No existing section surface — fall back to a focused edit of the value.
          startEditSession(descriptor.fieldId, {
            intent: descriptor.intent,
            capability,
            origin,
          });
        }
        break;
    }
    return true;
  };

  const handleSummaryReportSelect = (reportId) => {
    selectSummaryReport(reportId);
    if (!editingSection) return;

    const nextQuery = new URLSearchParams(searchParams);
    nextQuery.delete('edit');
    // In Summary Mode, the URL report param represents summary report id.
    // In Full Mode, the URL report param represents a detail tab id, so we must not overwrite it.
    if (mode === 'summary') {
      nextQuery.set('report', reportId);
    }
    navigate(`${FINANCIAL_WORKSPACE_PATH}?${nextQuery.toString()}`);
  };

  const handleDetailTabSelect = (reportId) => {
    selectDetailReport(reportId);
    if (!editingSection) return;

    const nextQuery = new URLSearchParams(searchParams);
    nextQuery.delete('edit');
    // In Full Mode, the URL report param represents the detail tab id.
    if (mode === 'full') {
      nextQuery.set('report', reportId);
    }
    navigate(`${FINANCIAL_WORKSPACE_PATH}?${nextQuery.toString()}`);
  };

  const exitEditingToReports = useCallback(() => {
    if (!editingSection) return;
    const nextQuery = new URLSearchParams(searchParams);
    nextQuery.delete('edit');
    navigate(`${FINANCIAL_WORKSPACE_PATH}?${nextQuery.toString()}`);
  }, [editingSection, navigate, searchParams]);

  const handleBackToSummaryReports = () => {
    handleSummaryReportSelect(activeSummaryReportId || DEFAULT_SUMMARY_REPORT_ID);
  };

  const showLegacyDevButton =
    !summaryMode &&
    workspaceFocus === 'detail' &&
    activeDetailReportId === 'your_moneys_magic';

  const detailWorkflowVisible = !summaryMode && workspaceFocus === 'detail';

  return (
    <SmartEditActivationContext.Provider value={activationContextValue}>
    <div
      className={`fw-shell ${
        summaryMode
          ? 'fw-shell--summary-mode'
          : workspaceFocus === 'summary'
            ? 'fw-shell--summary-focus'
            : 'fw-shell--detail-focus'
      }`}
    >
      <div className="fw-chrome">
        <StickyTopAppBar
          activePrimaryId={activePrimaryId}
          onPrimarySelect={selectPrimary}
          onOpenDrawer={() => setDrawerOpen(true)}
          userInitials={userInitials}
          registerPrimaryTabRef={registerPrimaryTabRef}
        />
        <SecondaryNavigation
          open={Boolean(activePrimaryId)}
          activePrimaryId={activePrimaryId}
          activeSecondaryId={activeSecondaryId}
          onSecondarySelect={openCalculator}
          calculatorsLocked={calculatorsLocked}
          onLockedSelect={openUnlockDialog}
          anchorCenterPx={toolbarCenterPx}
          trackRef={toolbarTrackRef}
        />
        <SummaryReportNavigation
          activeSummaryReportId={activeSummaryReportId}
          onSummaryReportSelect={handleSummaryReportSelect}
          workspaceFocus={summaryMode ? 'summary' : workspaceFocus}
        />
        <DetailReportTabs
          activeDetailTabId={activeDetailReportId}
          onDetailTabSelect={handleDetailTabSelect}
          workspaceFocus={workspaceFocus}
          locked={detailReportsLocked}
          onLockedSelect={openUnlockDialog}
        />
        <ReportContextBar fields={contextFields} />
      </div>

      <main className="fw-main">
        <ActiveWorkspace>
          {editingSection ? (
            <WorkspaceSectionEditor sectionId={editSectionId} />
          ) : (
            <WorkspaceContent />
          )}
        </ActiveWorkspace>
        <ReservedQuickActions />
        <ReservedWidgets />

        {showLegacyDevButton ? (
          // TEMP DEV ACCESS
          // Remove after legacy migration is complete.
          <div className="fw-legacy-dev-access">
            <button
              type="button"
              className="btn btn-secondary fw-legacy-dev-btn"
              onClick={() => navigate(LEGACY_EXISTING_APP_PATH)}
            >
              Open Legacy Experience
            </button>
          </div>
        ) : null}
      </main>

      {summaryMode ? (
        <WorkflowNavigationBar
          variant="summary"
          onBackToSummary={handleBackToSummaryReports}
          onContinueDetailed={goToDetailedPlanning}
        />
      ) : (
        <WorkflowNavigationBar
          onPrevious={() => {
            workflowPrevious();
            exitEditingToReports();
          }}
          onNext={() => {
            workflowNext();
            exitEditingToReports();
          }}
          previousDisabled={!canWorkflowPrevious}
          nextDisabled={!canWorkflowNext}
          visible={detailWorkflowVisible}
        />
      )}

      <SmartEditDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        capability={summaryMode ? 'summary' : 'full'}
        onLaunchExperience={handleLaunchExperience}
      />

      {!summaryMode ? <CalculatorModal /> : null}

      <UnlockPlanningDialog
        open={unlockOpen}
        onClose={closeUnlockDialog}
        onContinue={goToDetailedPlanning}
      />
    </div>
    </SmartEditActivationContext.Provider>
  );
}
