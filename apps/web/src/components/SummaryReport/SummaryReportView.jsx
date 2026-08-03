import React, { useEffect } from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { patchSummaryUiDraft } from '../../lib/summaryFlowStorage';
import MoneyStorySection from './MoneyStorySection';
import SafetyNetSection from './SafetyNetSection';
import FutureSelfSection from './FutureSelfSection';
import ExecutiveSummarySection from './ExecutiveSummarySection';
import {
    DEFAULT_SUMMARY_REPORT_PATH,
    summaryReportSlugs,
    summaryReportSteps,
} from './summaryReportSteps';

const SECTION_BY_SLUG = {
    money_story: MoneyStorySection,
    safety_net: SafetyNetSection,
    your_future_self: FutureSelfSection,
    useful_insights: ExecutiveSummarySection,
};

const SummaryReportView = () => {
    const navigate = useNavigate();
    const { section } = useParams();
    const { user } = useAuth();
    const { summaryReportGeneratedAt, markReportGenerated } = useFinancialPlan();
    const userId = user?.id ?? null;

    useEffect(() => {
        if (!summaryReportGeneratedAt) {
            markReportGenerated();
        }
    }, [summaryReportGeneratedAt, markReportGenerated]);

    useEffect(() => {
        if (!section) return;
        patchSummaryUiDraft(userId, {
            lastSummaryReportSection: section,
            lastSummaryReportPath: `/summary-report/${section}`,
        });
    }, [section, userId]);

    if (!section || !summaryReportSlugs.has(section)) {
        return <Navigate to={DEFAULT_SUMMARY_REPORT_PATH} replace />;
    }

    const activeIndex = summaryReportSteps.findIndex((step) => step.slug === section);
    const activeStep = summaryReportSteps[activeIndex];
    const ActiveSection = SECTION_BY_SLUG[section];
    const isFirstTab = activeIndex === 0;
    const isLastTab = activeIndex === summaryReportSteps.length - 1;

    const goToStep = (index) => {
        const step = summaryReportSteps[index];
        if (!step) return;
        navigate(step.path);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div
            className="summary-report-view fade-in"
            style={{
                padding: '0',
                maxWidth: '100%',
                margin: '0 auto',
                paddingBottom: '6rem',
            }}
        >
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Summary Report</h1>

            <div className="tabs-container">
                {summaryReportSteps.map((step) => (
                    <button
                        key={step.slug}
                        type="button"
                        className={`tab-btn ${section === step.slug ? 'active' : ''}`}
                        onClick={() => {
                            navigate(step.path);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                    >
                        {step.label}
                    </button>
                ))}
            </div>

            {ActiveSection ? <ActiveSection /> : (
                <div
                    className="card"
                    style={{
                        minHeight: '400px',
                        padding: '2rem',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                        alignItems: 'center',
                    }}
                >
                    <h2 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>
                        {activeStep?.label}
                    </h2>
                    <p className="text-muted">Report content coming soon...</p>
                </div>
            )}

            <footer className="summary-report-action-bar" role="navigation" aria-label="Report section navigation">
                <div className="summary-report-action-bar-inner">
                    <div className="summary-report-action-bar-left">
                        <button
                            type="button"
                            className="btn btn-secondary summary-report-action-btn"
                            onClick={() => navigate('/summary-flow/goals')}
                        >
                            &larr; Back to Summary Flow
                        </button>
                    </div>

                    <div className="summary-report-action-bar-center">
                        {!isFirstTab && (
                            <button
                                type="button"
                                className="btn btn-secondary summary-report-action-btn"
                                onClick={() => goToStep(activeIndex - 1)}
                            >
                                <ChevronLeft size={18} />
                                Previous Section
                            </button>
                        )}
                        {!isLastTab && (
                            <button
                                type="button"
                                className="btn btn-primary summary-report-action-btn"
                                onClick={() => goToStep(activeIndex + 1)}
                            >
                                Next Section
                                <ChevronRight size={18} />
                            </button>
                        )}
                    </div>

                    {isLastTab && (
                        <div className="summary-report-action-bar-right">
                            <button
                                type="button"
                                className="btn btn-primary summary-report-action-btn summary-report-cta-primary"
                                onClick={() => navigate('/detailed-flow/familyinfo')}
                            >
                                Take me to Detailed Report
                            </button>
                        </div>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default SummaryReportView;
