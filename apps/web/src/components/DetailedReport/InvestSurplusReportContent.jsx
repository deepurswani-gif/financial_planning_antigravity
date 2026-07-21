import React, { useMemo } from 'react';
import {
    ArrowRight,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { buildYourMoneyFlowReport } from './moneyFlowLedgerLogic';
import {
    buildInvestSurplusReport,
    computeInvestSurplusInsights,
} from './investSurplusLogic';
import { useNavigateToDetailReport } from './reportNavigation';

const InsightIcon = ({ tone }) => {
    if (tone === 'warning') return <AlertTriangle size={16} className="ius-insight-icon ius-insight-warning" />;
    if (tone === 'positive') return <CheckCircle2 size={16} className="ius-insight-icon ius-insight-positive" />;
    if (tone === 'accent') return <ArrowRight size={16} className="ius-insight-icon ius-insight-accent" />;
    return <Lightbulb size={16} className="ius-insight-icon" />;
};

const InvestSurplusReportContent = () => {
    const navigateToDetailReport = useNavigateToDetailReport();
    const {
        currentYearLedger,
        planStartMonth,
        familyMembers,
        income,
        expenseCategories,
        hasSpouseIncome,
        journeyProjections,
        assetCategories,
        contingencyFund,
        summaryLifeCover,
        investmentAllocations,
    } = useFinancialPlan();

    const moneyFlowReport = useMemo(
        () => buildYourMoneyFlowReport({
            currentYearLedger,
            planStartMonth,
            familyMembers,
            income,
            expenseCategories,
            hasSpouseIncome,
            resolveEmploymentType,
            journeyProjections,
        }),
        [
            currentYearLedger,
            planStartMonth,
            familyMembers,
            income,
            expenseCategories,
            hasSpouseIncome,
            journeyProjections,
        ],
    );

    const report = useMemo(
        () => buildInvestSurplusReport({
            moneyFlowReport,
            familyMembers,
            expenseCategories,
            assetCategories,
            contingencyFund,
            summaryLifeCover,
            investmentAllocations,
        }),
        [
            moneyFlowReport,
            familyMembers,
            expenseCategories,
            assetCategories,
            contingencyFund,
            summaryLifeCover,
            investmentAllocations,
        ],
    );

    const insights = useMemo(() => computeInvestSurplusInsights(report), [report]);

    if (!report.meta?.hasData) {
        return null;
    }

    return (
        <div className="ius-section">
            {insights.length > 0 && (
                <div className="card ius-insights-card">
                    <h4 className="ius-insights-title">
                        <Lightbulb size={18} />
                        Deployment Insights
                    </h4>
                    <ul className="ius-insights-list">
                        {insights.map((item) => (
                            <li key={item.id} className={`ius-insight ius-insight-${item.tone}`}>
                                <InsightIcon tone={item.tone} />
                                <span>{item.text}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            <div className="ius-planner-cta">
                <button
                    type="button"
                    className="btn btn-primary ius-full-planner-btn"
                    onClick={() => navigateToDetailReport('put_your_money_to_work')}
                >
                    Full allocation planner
                    <ArrowRight size={18} />
                </button>
            </div>

            <style>{`
                .ius-section { display: flex; flex-direction: column; gap: 1.5rem; padding: 0 1rem; margin-top: 2.5rem; }

                .ius-insights-card { padding: 1.25rem; }
                .ius-insights-title { margin: 0 0 0.85rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }
                .ius-insights-list { margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 0.65rem; }
                .ius-insight { display: flex; align-items: flex-start; gap: 0.6rem; font-size: 0.9rem; line-height: 1.5; }
                .ius-insight-icon { flex-shrink: 0; margin-top: 2px; color: var(--text-muted); }
                .ius-insight-warning .ius-insight-icon { color: #d97706; }
                .ius-insight-positive .ius-insight-icon { color: #059669; }
                .ius-insight-accent .ius-insight-icon { color: var(--primary); }
                .ius-insight-accent { color: var(--primary); font-weight: 500; }

                .ius-planner-cta { display: flex; justify-content: center; padding: 0.5rem 0 1rem; }
                .ius-full-planner-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1.5rem; font-size: 1rem; font-weight: 600; }
            `}</style>
        </div>
    );
};

export default InvestSurplusReportContent;
