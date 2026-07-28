import React, { useMemo } from 'react';
import { ArrowRight, Lightbulb } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { buildYourMoneyFlowReport } from './moneyFlowLedgerLogic';
import { buildInvestSurplusReport } from './investSurplusLogic';
import { buildInvestSurplusSignals } from '../../recommendationRegistry/adapters/investSurplusAdapter';
import { useRecommendationStore } from '../../recommendationOrchestration';
import { RecommendationList } from '../../recommendationPresentation';
import { useLaunchRecommendationAction } from '../FinancialWorkspace/FinancialWorkspaceContext';
import { useNavigateToDetailReport } from './reportNavigation';

const INVEST_SURPLUS_REPORTS = ['invest_surplus'];

const InvestSurplusReportContent = () => {
    const navigateToDetailReport = useNavigateToDetailReport();
    const { user } = useAuth();
    const launchRecommendationAction = useLaunchRecommendationAction();
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

    const recommendationSignals = useMemo(
        () => buildInvestSurplusSignals(report),
        [report],
    );
    const recommendationStore = useRecommendationStore(recommendationSignals, {
        reports: INVEST_SURPLUS_REPORTS,
    });
    const insights = recommendationStore.getByReport('invest_surplus');

    if (!report.meta?.hasData) {
        return null;
    }

    return (
        <div className="ius-section">
            <div className="card ius-insights-card">
                <h4 className="ius-insights-title">
                    <Lightbulb size={18} />
                    Deployment Insights
                </h4>
                <RecommendationList
                    recommendations={insights}
                    onPrimaryAction={launchRecommendationAction}
                    ctaContext={{
                        familyMembers,
                        user,
                        moduleName: 'Invest Surplus — Deployment Insights',
                    }}
                    density="detailed"
                    emptySurface="invest_surplus"
                />
            </div>

            <div className="ius-planner-cta">
                <button
                    type="button"
                    className="btn btn-primary ius-full-planner-btn"
                    onClick={() => navigateToDetailReport('fix_your_financial_gaps')}
                >
                    Full allocation planner
                    <ArrowRight size={18} />
                </button>
            </div>

            <style>{`
                .ius-section { display: flex; flex-direction: column; gap: 1.5rem; padding: 0 1rem; margin-top: 2.5rem; }

                .ius-insights-card { padding: 1.25rem; }
                .ius-insights-title { margin: 0 0 0.85rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; }

                .ius-planner-cta { display: flex; justify-content: center; padding: 0.5rem 0 1rem; }
                .ius-full-planner-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1.5rem; font-size: 1rem; font-weight: 600; }
            `}</style>
        </div>
    );
};

export default InvestSurplusReportContent;
