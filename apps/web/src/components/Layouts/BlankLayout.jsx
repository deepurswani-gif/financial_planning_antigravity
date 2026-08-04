import React, { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { User, Users, ArrowRightLeft, PiggyBank, Wallet, TrendingDown, Target, ArrowRight, Save, Check, ChevronRight, FileText } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { signOut } from '../../services/authService';
import finbrellaLogo from '../../assets/finbrella_logo.png';
import { detailedFlowSteps } from '../DetailedFlow/detailedFlowSteps';
import { RECONCILIATION_STACK_ID } from '../DetailedFlow/reconciliationStackId';
import {
    DEFAULT_DETAIL_TAB_ID,
    DEFAULT_SUMMARY_REPORT_ID,
    financialWorkspacePath,
} from '../FinancialWorkspace/workspaceNavConfig';
import { useBreakpoints } from '../../hooks';
import { useAnalyticsScreenTracking } from '../../hooks/useAnalyticsScreenTracking';

const steps = [
    { id: 'profile', label: 'Profile', path: '/summary-flow/profile', icon: Users },
    { id: 'cashflow', label: 'Cash Flow', path: '/summary-flow/cashflow', icon: ArrowRightLeft },
    { id: 'savings', label: 'Savings', path: '/summary-flow/savings', icon: PiggyBank },
    { id: 'assets', label: 'Assets', path: '/summary-flow/assets', icon: Wallet },
    { id: 'liabilities', label: 'Liabilities', path: '/summary-flow/liabilities', icon: TrendingDown },
    { id: 'goals', label: 'Goals', path: '/summary-flow/goals', icon: Target },
];

const BlankLayout = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const { lg } = useBreakpoints();
    const { saving, lastSaved, familyMembers, summaryReportGeneratedAt, savePlanData, handleLogoutCleanup, planId } = useFinancialPlan();
    const { user } = useAuth();
    const [profileOpen, setProfileOpen] = useState(false);
    const profileRef = useRef(null);

    useAnalyticsScreenTracking({ planId: planId || null });

    const currentPath = location.pathname;
    const isSummaryFlow = currentPath.startsWith('/summary-flow');
    const isSummaryReport = currentPath.startsWith('/summary-report');
    const isDetailedReport = currentPath.startsWith('/detailed-report');
    const isDetailedFlow = currentPath.startsWith('/detailed-flow') && !currentPath.startsWith('/detailed-flow/existing-app');
    const isDreamsGoals = currentPath.includes('dreams_goals');
    const isGrowthExpectations = currentPath.includes('growth_expectations');
    const isSummaryExperience = isSummaryFlow || isSummaryReport;
    const isDetailedExperience = isDetailedFlow || isDetailedReport;

    const currentStepIndex = steps.findIndex(s => currentPath.includes(s.id));
    const detailedStepIndex = isGrowthExpectations
        ? detailedFlowSteps.length
        : detailedFlowSteps.findIndex(s => currentPath.includes(s.id));
    const isStepCompleted = (stepIndex) => stepIndex < currentStepIndex;

    const selfMember = familyMembers?.find(m => m.relation === 'Self');
    const userInitials = selfMember?.name
        ? selfMember.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : (user?.email?.[0]?.toUpperCase() || 'U');

    useEffect(() => {
        setProfileOpen(false);
    }, [location.pathname]);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (profileRef.current && !profileRef.current.contains(e.target)) {
                setProfileOpen(false);
            }
        };
        if (profileOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [profileOpen]);

    const handleLogout = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on logout', e); }
        }
        await signOut();
        handleLogoutCleanup?.();
        navigate('/', { replace: true });
    };

    const handleViewSummaryReport = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        navigate(financialWorkspacePath('summary', { report: DEFAULT_SUMMARY_REPORT_ID }));
    };

    const handleViewDetailedReport = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        navigate(financialWorkspacePath('full', { report: DEFAULT_DETAIL_TAB_ID }));
    };

    const useFixedFlowChrome = isSummaryFlow || isDetailedFlow;
    const [flowChromeEl, setFlowChromeEl] = useState(null);

    useEffect(() => {
        if (!useFixedFlowChrome || !flowChromeEl) return undefined;

        const syncChromeOffset = () => {
            const height = Math.ceil(flowChromeEl.getBoundingClientRect().height);
            document.documentElement.style.setProperty('--flow-chrome-offset', `${height}px`);
        };

        syncChromeOffset();

        const observer = new ResizeObserver(syncChromeOffset);
        observer.observe(flowChromeEl);

        const stackHost = document.getElementById(RECONCILIATION_STACK_ID);
        const onStackChange = () => syncChromeOffset();
        stackHost?.addEventListener('reconciliation-stack-change', onStackChange);

        return () => {
            observer.disconnect();
            stackHost?.removeEventListener('reconciliation-stack-change', onStackChange);
            document.documentElement.style.removeProperty('--flow-chrome-offset');
        };
    }, [useFixedFlowChrome, flowChromeEl, location.pathname]);

    if (!isSummaryExperience && !isDetailedExperience) {
        return (
            <div style={{ minHeight: '100vh', padding: '2rem', background: 'var(--bg-main)' }}>
                <Outlet />
            </div>
        );
    }

    const shellClass = [
        isSummaryReport || isDetailedReport
            ? 'summary-shell summary-shell-report'
            : isDetailedExperience
                ? 'summary-shell summary-shell-detailed'
                : 'summary-shell',
        (isSummaryFlow || isDetailedFlow) ? 'summary-shell-flow' : '',
        (isSummaryFlow || isDetailedFlow) ? 'summary-shell-with-nav' : '',
    ].filter(Boolean).join(' ');

    const headerBlock = (
        <header className="summary-header">
            <div className="summary-header-logo">
                <img src={finbrellaLogo} alt="Finbrella" />
            </div>
            <div className="summary-header-right">
                {(isDreamsGoals || isGrowthExpectations) && (
                    <button
                        type="button"
                        className="summary-view-report-btn"
                        onClick={handleViewDetailedReport}
                    >
                        <FileText size={16} />
                        {lg ? 'View Detailed Report' : 'Report'}
                    </button>
                )}
                {(isSummaryFlow || (isDetailedFlow && !isDreamsGoals)) && summaryReportGeneratedAt && (
                    <button
                        type="button"
                        className="summary-view-report-btn"
                        onClick={handleViewSummaryReport}
                    >
                        <FileText size={16} />
                        {lg ? 'View Summary Report' : 'Report'}
                    </button>
                )}
                {saving && (
                    <div className="summary-save-indicator">
                        <Save size={13} /> Saving...
                    </div>
                )}
                {!saving && lastSaved && (
                    <div className="summary-save-indicator">
                        <Check size={13} /> Saved
                    </div>
                )}
                <div className="summary-profile-wrap" ref={profileRef}>
                    <button
                        type="button"
                        className="summary-profile-btn"
                        title="Profile"
                        aria-expanded={profileOpen}
                        aria-haspopup="true"
                        onClick={() => setProfileOpen((open) => !open)}
                    >
                        {userInitials || <User size={18} />}
                    </button>
                    {profileOpen && (
                        <div className="summary-profile-dropdown" role="menu">
                            <div className="summary-profile-dropdown-email" title={user?.email || ''}>
                                {user?.email || 'Signed in'}
                            </div>
                            <button
                                type="button"
                                className="summary-profile-dropdown-logout"
                                role="menuitem"
                                onClick={handleLogout}
                            >
                                Logout
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );

    const summaryNav = isSummaryFlow && (
        <nav className="summary-horizontal-nav">
            {currentStepIndex >= 0 && (
                <span className="summary-step-counter" aria-live="polite">
                    Step {currentStepIndex + 1} of {steps.length}
                </span>
            )}
            {steps.map((step, idx) => {
                const isActive = idx === currentStepIndex;
                const isCompleted = isStepCompleted(idx);
                const StepIcon = step.icon;

                return (
                    <React.Fragment key={step.id}>
                        {idx > 0 && (
                            <span className="summary-step-separator">
                                <ChevronRight size={14} />
                            </span>
                        )}
                        <div
                            className={`summary-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                            onClick={() => navigate(step.path)}
                        >
                            <div className="summary-step-icon">
                                <StepIcon size={14} />
                            </div>
                            <span>{step.label}</span>
                            {isCompleted && (
                                <div className="summary-step-complete-arrow">
                                    <ArrowRight size={14} />
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </nav>
    );

    const detailedNav = isDetailedFlow && (
        <nav className="summary-horizontal-nav">
            {detailedFlowSteps.map((step, idx) => {
                const isActive = idx === detailedStepIndex;
                const isCompleted = idx < detailedStepIndex;
                const StepIcon = step.icon;

                return (
                    <React.Fragment key={step.id}>
                        {idx > 0 && (
                            <span className="summary-step-separator">
                                <ChevronRight size={14} />
                            </span>
                        )}
                        <div
                            className={`summary-step-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                            onClick={() => navigate(step.path)}
                        >
                            <div className="summary-step-icon">
                                <StepIcon size={14} />
                            </div>
                            <span>{step.label}</span>
                            {isCompleted && (
                                <div className="summary-step-complete-arrow">
                                    <ArrowRight size={14} />
                                </div>
                            )}
                        </div>
                    </React.Fragment>
                );
            })}
        </nav>
    );

    return (
        <div className={shellClass}>
            {useFixedFlowChrome ? (
                <div className="summary-flow-chrome" ref={setFlowChromeEl}>
                    {headerBlock}
                    {summaryNav}
                    {detailedNav}
                    <div
                        id={RECONCILIATION_STACK_ID}
                        className="reconciliation-panel-stack"
                        aria-label="Reconciliation summaries"
                    />
                </div>
            ) : (
                headerBlock
            )}

            <div className="summary-body">
                <main className={`summary-content-area ${(isSummaryReport || isDetailedReport) ? 'summary-content-area-report' : ''}`}>
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default BlankLayout;
