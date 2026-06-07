import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import MoneyStorySection from './MoneyStorySection';
import SafetyNetSection from './SafetyNetSection';
import FutureSelfSection from './FutureSelfSection';
import ExecutiveSummarySection from './ExecutiveSummarySection';

const TABS = [
    { id: 'money-story', label: 'Your Money Story' },
    { id: 'safety-net', label: 'The Safety Net' },
    { id: 'future-self', label: 'Your Future Self' },
    { id: 'executive', label: 'Useful Insights' },
];

const FULL_WIDTH_TABS = new Set(TABS.map((t) => t.id));

const SummaryReportView = () => {
    const navigate = useNavigate();
    const { summaryReportGeneratedAt, markReportGenerated } = useFinancialPlan();
    const [activeTab, setActiveTab] = useState('money-story');

    useEffect(() => {
        if (!summaryReportGeneratedAt) {
            markReportGenerated();
        }
    }, [summaryReportGeneratedAt, markReportGenerated]);

    const activeIndex = TABS.findIndex((t) => t.id === activeTab);
    const isFirstTab = activeIndex === 0;
    const isLastTab = activeIndex === TABS.length - 1;

    const goToTab = (index) => {
        if (index >= 0 && index < TABS.length) {
            setActiveTab(TABS[index].id);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    const isFullWidth = FULL_WIDTH_TABS.has(activeTab);

    return (
        <div
            className="summary-report-view fade-in"
            style={{
                padding: isFullWidth ? '0' : '2rem',
                maxWidth: isFullWidth ? '100%' : '1200px',
                margin: '0 auto',
                paddingBottom: '6rem',
            }}
        >
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Summary Report</h1>

            <div
                className="tabs-container"
                style={{
                    display: 'flex',
                    gap: '1rem',
                    borderBottom: '2px solid var(--border)',
                    marginBottom: '2rem',
                    flexWrap: 'wrap',
                    justifyContent: 'center',
                }}
            >
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        className={`tab-btn ${activeTab === tab.id ? 'active' : ''}`}
                        onClick={() => {
                            setActiveTab(tab.id);
                            window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        style={{
                            padding: '1rem 2rem',
                            border: 'none',
                            background: 'transparent',
                            color: activeTab === tab.id ? 'var(--primary)' : 'var(--text-muted)',
                            fontWeight: activeTab === tab.id ? 'bold' : 'normal',
                            borderBottom:
                                activeTab === tab.id
                                    ? '3px solid var(--primary)'
                                    : '3px solid transparent',
                            cursor: 'pointer',
                            fontSize: '1rem',
                        }}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {activeTab === 'money-story' ? (
                <MoneyStorySection />
            ) : activeTab === 'safety-net' ? (
                <SafetyNetSection />
            ) : activeTab === 'future-self' ? (
                <FutureSelfSection />
            ) : activeTab === 'executive' ? (
                <ExecutiveSummarySection />
            ) : (
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
                        {TABS.find((t) => t.id === activeTab)?.label}
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
                                onClick={() => goToTab(activeIndex - 1)}
                            >
                                <ChevronLeft size={18} />
                                Previous Section
                            </button>
                        )}
                        {!isLastTab && (
                            <button
                                type="button"
                                className="btn btn-primary summary-report-action-btn"
                                onClick={() => goToTab(activeIndex + 1)}
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
                            <button
                                type="button"
                                className="btn btn-secondary summary-report-action-btn summary-report-cta-secondary"
                                onClick={() => navigate('/detailed-flow/existing-app')}
                            >
                                Legacy Existing App Flow (Temporary)
                            </button>
                        </div>
                    )}
                </div>
            </footer>
        </div>
    );
};

export default SummaryReportView;
