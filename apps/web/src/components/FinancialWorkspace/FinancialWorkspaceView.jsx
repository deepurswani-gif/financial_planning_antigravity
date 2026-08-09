import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { signOut } from '../../services/authService';
import useBreakpoints from '../../hooks/use-breakpoints';
import { useFinancialWorkspace } from './FinancialWorkspaceContext';
import DesktopChrome from './DesktopChrome';
import MobileChrome from './MobileChrome';
import ActiveWorkspace from './ActiveWorkspace';
import WorkspaceContent from './WorkspaceContent';
import ReservedQuickActions from './ReservedQuickActions';
import ReservedWidgets from './ReservedWidgets';
import WorkflowNavigationBar from './WorkflowNavigationBar';
import SmartEditDrawer from './SmartEditDrawer';
import WorkspaceHubDrawer from './WorkspaceHubDrawer';
import CalculatorModal from './CalculatorModal';
import UnlockPlanningDialog from './UnlockPlanningDialog';
import ScrollToTopButton from './ScrollToTopButton';
import WorkspaceProductTour from './WorkspaceProductTour';
import NotificationSettingsPanel from './NotificationSettingsPanel';
import {
  DETAILED_FLOW_ENTRY_PATH,
  DEFAULT_DETAIL_TAB_ID,
  DEFAULT_SUMMARY_REPORT_ID,
  FINANCIAL_WORKSPACE_PATH,
  LEGACY_EXISTING_APP_PATH,
  getDetailReportLabel,
  getDetailReportStage,
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
import { AnalyticsEventName, trackAnalyticsEvent } from '../../lib/analytics';
import { useAnalyticsScreenTracking } from '../../hooks/useAnalyticsScreenTracking';
import { useReportDwellTracking } from '../../hooks/useReportDwellTracking';
import { resolveSectionId } from './sectionIds';
import { loadWorkspaceCapability } from './workspaceCapabilityStorage';
import {
  loadWorkspaceTourState,
  markTourCompleted,
  resolveAutoTourTrigger,
  saveWorkspaceTourState,
} from './workspaceTourStorage';
import { useEditing } from '../../editing/EditingProvider';
import { getExperienceById, resolveLaunch, buildActivationRequest } from '../../experienceRegistry';
import { SmartEditActivationContext } from './smartEdit/activationChannel';
import { resolveExperienceIdForRecommendation } from './recommendationActionLaunch';
import {
  isPushOptedIn,
} from '../../lib/pushNotifications';
import { flushPendingNotifications, dispatchMonthlyWealthSummary } from '../../notificationDelivery';
import { ensurePushTokenForUser } from '../../services/ensurePushTokenForUser';

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
  const { lg } = useBreakpoints();
  const { user } = useAuth();
  const {
    familyMembers,
    savePlanData,
    handleLogoutCleanup,
    planStartMonth,
    lastSaved,
    workspaceCapability,
    planId,
    summaryReportGeneratedAt,
    currentYearLedger,
    income,
    expenseCategories,
    hasSpouseIncome,
    journeyProjections,
  } = useFinancialPlan();
  useAnalyticsScreenTracking({ planId: planId || null });
  const effectiveWorkspaceCapability = workspaceCapability ?? loadWorkspaceCapability(user?.id);
  const {
    state,
    setMode,
    openCalculator,
    selectSummaryReport,
    selectDetailReport,
    workflowPrevious,
    workflowNext,
    setDrawerOpen,
    registerRecommendationActionLauncher,
    getDrawerAction,
    canWorkflowPrevious,
    canWorkflowNext,
    workflowPreviousLabel,
    workflowNextLabel,
    workflowStepItems,
    workflowActiveId,
    workflowIndex,
    isSummaryWorkflow,
    setWorkspaceScroll,
  } = useFinancialWorkspace();

  const { startEditSession } = useEditing();
  const [hubTab, setHubTab] = useState('edit');
  const [tourOpen, setTourOpen] = useState(false);
  const [tourTrigger, setTourTrigger] = useState('intro');

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
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Bind FCM token to the signed-in account (handles account switch on same browser).
  useEffect(() => {
    if (!user?.id || !isPushOptedIn(user.id)) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const ensured = await ensurePushTokenForUser(user.id);
        if (cancelled || !ensured.ok) return;
        await flushPendingNotifications({ userId: user.id, planId });
        if (summaryReportGeneratedAt) {
          await dispatchMonthlyWealthSummary(
            {
              summaryReportGeneratedAt,
              currentYearLedger,
              planStartMonth,
              familyMembers,
              income,
              expenseCategories,
              hasSpouseIncome,
              journeyProjections,
            },
            { userId: user.id, planId },
          );
        }
      } catch (err) {
        if (import.meta.env.DEV) {
          console.warn('[FCM] Token refresh skipped:', err?.message || err);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    user?.id,
    planId,
    summaryReportGeneratedAt,
    currentYearLedger,
    planStartMonth,
    familyMembers,
    income,
    expenseCategories,
    hasSpouseIncome,
    journeyProjections,
  ]);

  const startTour = useCallback((trigger = 'manual') => {
    setDrawerOpen(false);
    setUnlockOpen(false);
    setTourTrigger(trigger);
    setTourOpen(true);
  }, [setDrawerOpen]);

  const finishTour = useCallback(() => {
    setTourOpen(false);
    setDrawerOpen(false);
    const next = markTourCompleted(
      loadWorkspaceTourState(user?.id),
      tourTrigger,
      effectiveWorkspaceCapability,
    );
    saveWorkspaceTourState(user?.id, next);
  }, [tourTrigger, user?.id, effectiveWorkspaceCapability, setDrawerOpen]);

  const prepareTourStep = useCallback((step) => {
    if (step?.openHub) {
      setHubTab(step.openHub);
      setDrawerOpen(true);
      return;
    }
    setDrawerOpen(false);
  }, [setDrawerOpen]);

  // Mobile coach marks: first dashboard visit, and again after Detailed unlock.
  useEffect(() => {
    if (lg || tourOpen) return undefined;
    if (!effectiveWorkspaceCapability) return undefined;

    const trigger = resolveAutoTourTrigger(
      loadWorkspaceTourState(user?.id),
      effectiveWorkspaceCapability,
    );
    if (!trigger) return undefined;

    const timer = window.setTimeout(() => {
      startTour(trigger);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [lg, tourOpen, effectiveWorkspaceCapability, user?.id, startTour]);

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
  const handleLaunchExperience = useCallback((arg) => {
    // `arg` is either an experience id (footer utilities) or a full result
    // descriptor from the drawer. Dynamic-entity descriptors additionally carry
    // instance identity + an activation override so we open that exact object.
    const item = typeof arg === 'string' ? { experienceId: arg } : arg || {};
    const experienceId = item.experienceId;
    const entityLaunch = item.kind === 'entity' ? item : null;

    if (experienceId && !String(experienceId).startsWith('__')) {
      trackAnalyticsEvent({
        eventName: AnalyticsEventName.FEATURE_CLICK,
        eventCategory: 'feature',
        component: 'SmartEditDrawer',
        feature: 'experience_launch',
        properties: { experienceId, kind: item.kind || 'experience' },
      });
    }

    if (experienceId === '__settings__') {
      setDrawerOpen(false);
      setSettingsOpen(true);
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
  }, [
    activeDetailReportId,
    activeSummaryReportId,
    calculatorsLocked,
    navigate,
    openCalculator,
    openUnlockDialog,
    requestActivation,
    setDrawerOpen,
    startEditSession,
    summaryMode,
  ]);

  // Register the workspace intent API used by Recommendation Presentation.
  // Cards call launchRecommendationAction(recommendation) only — they never see
  // Experience IDs, Question IDs, or Smart Edit internals.
  useEffect(() => {
    return registerRecommendationActionLauncher((recommendation) => {
      const experienceId = resolveExperienceIdForRecommendation(recommendation);
      if (experienceId) {
        return handleLaunchExperience({ experienceId });
      }
      setDrawerOpen(true);
      return true;
    });
  }, [handleLaunchExperience, registerRecommendationActionLauncher, setDrawerOpen]);

  const workspaceReportSection = editingSection
    ? null
    : isSummaryMode(mode)
      ? activeSummaryReportId
      : activeDetailReportId;

  useReportDwellTracking({
    section: workspaceReportSection,
    surface: 'workspace',
    feature: isSummaryMode(mode) ? 'summary_report' : 'detailed_report',
    enabled: Boolean(workspaceReportSection),
  });

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

  const showLegacyDevButton =
    import.meta.env.DEV &&
    !summaryMode &&
    workspaceFocus === 'detail' &&
    activeDetailReportId === 'your_moneys_magic';

  const workflowVisible = true;
  const reportTitle = isSummaryWorkflow
    ? getSummaryReportLabel(activeSummaryReportId)
    : getDetailReportLabel(activeDetailReportId);
  const detailStage = !isSummaryWorkflow ? getDetailReportStage(activeDetailReportId) : null;
  const stepCount = workflowStepItems.length;
  const stepLabel =
    workflowIndex >= 0 && stepCount > 0
      ? `Step ${workflowIndex + 1} of ${stepCount}`
      : null;
  const stageLabel = detailStage
    ? detailStage.toUpperCase()
    : isSummaryWorkflow
      ? 'SUMMARY'
      : null;

  const openHub = (tab = 'edit') => {
    setHubTab(tab);
    setDrawerOpen(true);
  };

  const handleWorkflowStepSelect = (reportId) => {
    if (isSummaryWorkflow) {
      handleSummaryReportSelect(reportId);
    } else {
      handleDetailTabSelect(reportId);
    }
    exitEditingToReports();
  };

  return (
    <SmartEditActivationContext.Provider value={activationContextValue}>
    <div
      className={`fw-shell ${
        summaryMode
          ? 'fw-shell--summary-mode'
          : workspaceFocus === 'summary'
            ? 'fw-shell--summary-focus'
            : 'fw-shell--detail-focus'
      } ${lg ? 'fw-shell--desktop' : 'fw-shell--mobile'}`}
    >
      {lg ? (
        <DesktopChrome
          onOpenDrawer={() => setDrawerOpen(true)}
          userInitials={userInitials}
          userEmail={user?.email || ''}
          onLogout={() => handleDrawerItem('logout')}
          onOpenSettings={() => setSettingsOpen(true)}
          calculatorsLocked={calculatorsLocked}
          onOpenCalculator={openCalculator}
          onLockedSelect={openUnlockDialog}
          workspaceFocus={workspaceFocus}
          summaryMode={summaryMode}
          activeSummaryReportId={activeSummaryReportId}
          activeDetailReportId={activeDetailReportId}
          onFocusSummary={() =>
            handleSummaryReportSelect(activeSummaryReportId || DEFAULT_SUMMARY_REPORT_ID)
          }
          onFocusDetail={() =>
            handleDetailTabSelect(activeDetailReportId || DEFAULT_DETAIL_TAB_ID)
          }
          onSelectSummaryReport={handleSummaryReportSelect}
          onSelectDetailReport={handleDetailTabSelect}
          detailLocked={detailReportsLocked}
          contextFields={contextFields}
        />
      ) : (
        <MobileChrome
          onOpenHub={() => openHub('edit')}
          onOpenTools={() => openHub('tools')}
          userInitials={userInitials}
          userEmail={user?.email || ''}
          onLogout={() => handleDrawerItem('logout')}
          onTakeTour={() => startTour('manual')}
          onOpenSettings={() => setSettingsOpen(true)}
          reportTitle={reportTitle}
          stageLabel={stageLabel}
          stepLabel={stepLabel}
          contextFields={contextFields}
          workspaceFocus={summaryMode ? 'summary' : workspaceFocus}
          summaryMode={summaryMode}
          onFocusSummary={() =>
            handleSummaryReportSelect(activeSummaryReportId || DEFAULT_SUMMARY_REPORT_ID)
          }
          onFocusDetail={() =>
            handleDetailTabSelect(activeDetailReportId || DEFAULT_DETAIL_TAB_ID)
          }
          detailLocked={detailReportsLocked}
          onLockedSelect={openUnlockDialog}
        />
      )}

      <div style={{ display: 'block', position: 'relative', width: '100%', minHeight: '100vh' }}>
        <main className="fw-main" style={{ minHeight: 'calc(100vh - 6.75rem)' }}>
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

      {!lg ? <ScrollToTopButton enabled /> : null}

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
        previousLabel={workflowPreviousLabel}
        nextLabel={workflowNextLabel}
        visible={workflowVisible}
        showSteps={!lg}
        stepItems={workflowStepItems}
        activeStepId={workflowActiveId}
        onStepSelect={handleWorkflowStepSelect}
        showContinueDetailed={summaryMode}
        onContinueDetailed={goToDetailedPlanning}
      />
      </div>

      {lg ? (
        <SmartEditDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          capability={summaryMode ? 'summary' : 'full'}
          onLaunchExperience={handleLaunchExperience}
          onLockedExperience={openUnlockDialog}
        />
      ) : (
        <WorkspaceHubDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          activeTab={hubTab}
          onTabChange={setHubTab}
          capability={summaryMode ? 'summary' : 'full'}
          activeSummaryReportId={activeSummaryReportId}
          activeDetailReportId={activeDetailReportId}
          workspaceFocus={summaryMode ? 'summary' : workspaceFocus}
          detailReportsLocked={detailReportsLocked}
          calculatorsLocked={calculatorsLocked}
          onSelectSummaryReport={handleSummaryReportSelect}
          onSelectDetailReport={handleDetailTabSelect}
          onOpenCalculator={openCalculator}
          onLockedSelect={openUnlockDialog}
          onLaunchExperience={handleLaunchExperience}
          onLockedExperience={openUnlockDialog}
        />
      )}

      {!summaryMode ? <CalculatorModal /> : null}

      <UnlockPlanningDialog
        open={unlockOpen}
        onClose={closeUnlockDialog}
        onContinue={goToDetailedPlanning}
      />

      <NotificationSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        userId={user?.id}
      />

      {!lg ? (
        <WorkspaceProductTour
          open={tourOpen}
          trigger={tourTrigger}
          onClose={finishTour}
          onPrepareStep={prepareTourStep}
        />
      ) : null}
    </div>
    </SmartEditActivationContext.Provider>
  );
}
