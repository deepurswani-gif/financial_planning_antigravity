import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useProgressiveShellWidth } from './useProgressiveShellWidth';
import {
    DEFAULT_SUMMARY_REPORT_ID,
    financialWorkspacePath,
} from '../FinancialWorkspace/workspaceNavConfig';
import { scrollProgressiveFlowToTop } from './scrollProgressiveFlowToTop';
import GoalsDashboard from '../DetailedHub/GoalsDashboard';
import QuestionProgressBar from './QuestionProgressBar';

const SummaryGoals = () => {
    const { savePlanData, summaryReportGeneratedAt, markReportGenerated } = useFinancialPlan();
    const navigate = useNavigate();
    const shellClassName = useProgressiveShellWidth('wide');

    const hasGeneratedReport = Boolean(summaryReportGeneratedAt);

    const handleOpenReport = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        if (!hasGeneratedReport) {
            await markReportGenerated();
        }
        navigate(financialWorkspacePath('summary', { report: DEFAULT_SUMMARY_REPORT_ID }));
    };

    const handlePrevious = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        scrollProgressiveFlowToTop();
        navigate('/summary-flow/liabilities');
    };

    return (
        <>
            <QuestionProgressBar />
            <div className="progressive-shell fade-in" style={{ maxWidth: '1200px', width: '100%', padding: '0 1rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                    <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                        What are you saving for?
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '1.05rem', margin: 0 }}>
                        Select your top goals to get a quick estimate. You can always add more later.
                    </p>
                </div>

                <div style={{ marginBottom: '3rem' }}>
                    <GoalsDashboard hideTitle={true} />
                </div>

                <div className="step-nav-bar" style={{ maxWidth: '600px', margin: '0 auto' }}>
                    <div>
                        <button className="step-nav-btn" onClick={handlePrevious}>
                            <ArrowLeft size={16} /> Previous Section
                        </button>
                    </div>
                    <div>
                        <button className="step-nav-btn primary" onClick={handleOpenReport}>
                            {hasGeneratedReport ? 'View Summary Report' : 'See My Plan'}
                            <ArrowRight size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </>
    );
};

export default SummaryGoals;
