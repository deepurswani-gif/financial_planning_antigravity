import React from 'react';
import { useNavigate, useParams, Navigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import YourMoneyFlowSection from './YourMoneyFlowSection';
import PutYourMoneyToWorkSection from './PutYourMoneyToWorkSection';
import TrackSurplusAllocationSection from './TrackSurplusAllocationSection';
import {
    DEFAULT_DETAILED_REPORT_PATH,
    detailedReportSlugs,
    detailedReportSteps,
    YOUR_MONEYS_MAGIC_PATH,
} from './detailedReportSteps';

const SECTION_BY_SLUG = {
    your_money_flow: YourMoneyFlowSection,
    put_your_money_to_work: PutYourMoneyToWorkSection,
    your_moneys_magic: TrackSurplusAllocationSection,
};

/** Old slug → keep bookmarks working. */
const LEGACY_SECTION_REDIRECTS = {
    track_surplus_allocation: YOUR_MONEYS_MAGIC_PATH,
};

const DetailedReportView = () => {
    const navigate = useNavigate();
    const { section } = useParams();

    if (section && LEGACY_SECTION_REDIRECTS[section]) {
        return <Navigate to={LEGACY_SECTION_REDIRECTS[section]} replace />;
    }

    if (!section || !detailedReportSlugs.has(section)) {
        return <Navigate to={DEFAULT_DETAILED_REPORT_PATH} replace />;
    }

    const activeIndex = detailedReportSteps.findIndex((step) => step.slug === section);
    const activeStep = detailedReportSteps[activeIndex];
    const ActiveSection = SECTION_BY_SLUG[section];
    const isFirstTab = activeIndex === 0;
    const isLastTab = activeIndex === detailedReportSteps.length - 1;

    const goToStep = (index) => {
        const step = detailedReportSteps[index];
        if (!step) return;
        navigate(step.path);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    return (
        <div
            className="detailed-report-view fade-in"
            style={{
                padding: '0',
                maxWidth: '100%',
                margin: '0 auto',
                paddingBottom: '6rem',
            }}
        >
            <h1 style={{ textAlign: 'center', marginBottom: '2rem' }}>Detailed Report</h1>

            <div className="tabs-container">
                {detailedReportSteps.map((step) => (
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
                <div className="card" style={{ minHeight: '400px', padding: '2rem', textAlign: 'center' }}>
                    <h2>{activeStep?.label || 'Put Your Money to Work'}</h2>
                    <p className="text-muted">This module is coming soon.</p>
                    <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ marginTop: '1.5rem' }}
                        onClick={() => navigate(DEFAULT_DETAILED_REPORT_PATH)}
                    >
                        Back to Your Money Flow
                    </button>
                </div>
            )}

            <footer className="summary-report-action-bar" role="navigation" aria-label="Detailed report navigation">
                <div className="summary-report-action-bar-inner">
                    <div className="summary-report-action-bar-left">
                        <button
                            type="button"
                            className="btn btn-secondary summary-report-action-btn"
                            onClick={() => navigate('/detailed-flow/dreams_goals')}
                        >
                            &larr; Back to Goals
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
                </div>
            </footer>
        </div>
    );
};

export default DetailedReportView;
