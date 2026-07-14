import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    ArrowRight,
    Lightbulb,
    AlertTriangle,
    CheckCircle2,
    Wallet,
    TrendingUp,
    Shield,
    PiggyBank,
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { buildYourMoneyFlowReport } from './moneyFlowLedgerLogic';
import {
    buildInvestSurplusReport,
    computeInvestSurplusInsights,
} from './investSurplusLogic';
import {
    clearStudioMonthPlan,
    pruneAllocationPlansForAllocations,
    removeInvestmentAllocationById,
} from './instrumentAnalysisLogic';
import { PUT_YOUR_MONEY_TO_WORK_PATH } from './detailedReportSteps';
import ReportAnimatedCounter from './ReportAnimatedCounter';
import ReportReveal from './ReportReveal';
import InvestSurplusVisuals from './InvestSurplusVisuals';
import PlannedInvestmentAllocationsPanel from './PlannedInvestmentAllocationsPanel';

const InsightIcon = ({ tone }) => {
    if (tone === 'warning') return <AlertTriangle size={16} className="ius-insight-icon ius-insight-warning" />;
    if (tone === 'positive') return <CheckCircle2 size={16} className="ius-insight-icon ius-insight-positive" />;
    if (tone === 'accent') return <ArrowRight size={16} className="ius-insight-icon ius-insight-accent" />;
    return <Lightbulb size={16} className="ius-insight-icon" />;
};

const SuggestionIcon = ({ id }) => {
    if (id === 'wealth-sip') return <TrendingUp size={22} />;
    if (id === 'emergency-fund') return <PiggyBank size={22} />;
    if (id === 'protection') return <Shield size={22} />;
    return <Wallet size={22} />;
};

const HeroKpi = ({ label, value, tone = 'primary' }) => (
    <div className="ius-kpi-pill">
        <div>
            <span className="ius-kpi-label">{label}</span>
            <strong className={`ius-kpi-value ius-tone-${tone}`}>
                <ReportAnimatedCounter value={value} />
            </strong>
        </div>
    </div>
);

const InvestSurplusReportContent = () => {
    const navigate = useNavigate();
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
        setInvestmentAllocations,
        allocationPlans,
        setAllocationPlans,
    } = useFinancialPlan();

    const handleRemoveAllocation = (id) => {
        const nextAllocations = removeInvestmentAllocationById(investmentAllocations, id);
        setInvestmentAllocations(nextAllocations);
        setAllocationPlans(pruneAllocationPlansForAllocations(allocationPlans, nextAllocations));
    };

    const handleClearMonthPlan = (planKey) => {
        if (!planKey) return;
        const [yearStr, monthStr] = String(planKey).split('-');
        const calendarYear = parseInt(yearStr, 10);
        const monthIndex = parseInt(monthStr, 10);
        if (!Number.isFinite(calendarYear) || !Number.isFinite(monthIndex)) return;

        const nextAllocations = clearStudioMonthPlan({
            investmentAllocations,
            calendarYear,
            monthIndex,
        });
        setInvestmentAllocations(nextAllocations);
        const nextPlans = { ...allocationPlans };
        delete nextPlans[planKey];
        setAllocationPlans(pruneAllocationPlansForAllocations(nextPlans, nextAllocations));
    };

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

    const { meta, hero, suggestions, allocationsSummary } = report;

    return (
        <div className="ius-section">
            <div className="ius-hero card">
                <div className="ius-hero-top">
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.75rem' }}>Invest Unallocated Surplus</h2>
                        <p style={{ margin: '0.5rem 0 0', color: 'var(--text-muted)', lineHeight: 1.55 }}>
                            {meta.userName}, your free cash flow is the fuel for tomorrow — let&apos;s put it to purposeful work.
                        </p>
                    </div>
                </div>

                <div className="ius-kpi-grid">
                    <HeroKpi label="Free Cash Flow (Monthly)" value={hero.monthlyFreeCash} tone="accent" />
                    <HeroKpi label="Deployable After Plans" value={hero.deployableMonthly} tone="primary" />
                    <HeroKpi label="Unallocated YTD" value={hero.ytdUnallocated} />
                    <HeroKpi label="Through Year-End (Proj.)" value={hero.proratedUnallocated} />
                </div>
            </div>

            <InvestSurplusVisuals report={report} />

            {suggestions.length > 0 && (
                <ReportReveal className="ius-suggestions" delay={120}>
                    <h3 className="ius-section-title">Where your surplus can go</h3>
                    <div className="ius-suggestion-grid">
                        {suggestions.map((item) => (
                            <div key={item.id} className={`ius-suggestion-card ius-suggestion-${item.tone}`}>
                                <div className="ius-suggestion-icon">
                                    <SuggestionIcon id={item.id} />
                                </div>
                                <h4>{item.title}</h4>
                                <p>{item.description}</p>
                                <div className="ius-suggestion-highlight">{item.highlight}</div>
                                <p className="ius-suggestion-foot">{item.highlightLabel}</p>
                            </div>
                        ))}
                    </div>
                </ReportReveal>
            )}

            <PlannedInvestmentAllocationsPanel
                allocationsSummary={allocationsSummary}
                onRemove={handleRemoveAllocation}
                onClearMonthPlan={handleClearMonthPlan}
            />

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
                    onClick={() => navigate(PUT_YOUR_MONEY_TO_WORK_PATH)}
                >
                    Full allocation planner
                    <ArrowRight size={18} />
                </button>
            </div>

            <style>{`
                .ius-section { display: flex; flex-direction: column; gap: 1.5rem; padding: 0 1rem; margin-top: 2.5rem; }
                .ius-hero { padding: 1.5rem; background: linear-gradient(135deg, rgba(16,185,129,0.07), rgba(37,99,235,0.04)); }
                .ius-hero-top { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; align-items: flex-start; }
                .ius-kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 1rem; }
                .ius-kpi-pill { padding: 1rem; background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; }
                .ius-kpi-label { display: block; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 0.2rem; }
                .ius-kpi-value { font-size: 1.15rem; }
                .ius-tone-primary { color: var(--primary); }
                .ius-tone-accent { color: #7C3AED; }

                .ius-visuals { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; }
                .ius-visual-card { padding: 1.25rem; }
                .ius-pie-row { display: flex; flex-wrap: wrap; gap: 1.5rem; align-items: center; }
                .ius-pie-chart { flex: 1; min-width: 200px; max-width: 260px; }
                .ius-pie-legend { list-style: none; margin: 0; padding: 0; flex: 1; min-width: 180px; }
                .ius-pie-legend li { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.65rem; font-size: 0.88rem; }
                .ius-pie-legend strong { margin-left: auto; }
                .ius-legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }

                .ius-section-title { margin: 0 0 1rem; font-size: 1.05rem; font-weight: 700; display: flex; align-items: center; gap: 0.45rem; }
                .ius-suggestion-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1.25rem; }
                .ius-suggestion-card { padding: 1.5rem; border-radius: 12px; border: 1px solid var(--border); background: var(--bg-card); border-left-width: 4px; }
                .ius-suggestion-primary { border-left-color: #10B981; }
                .ius-suggestion-warning { border-left-color: #F59E0B; }
                .ius-suggestion-accent { border-left-color: #6366F1; }
                .ius-suggestion-icon { width: 44px; height: 44px; border-radius: 10px; background: rgba(37,99,235,0.08); color: var(--primary); display: flex; align-items: center; justify-content: center; margin-bottom: 0.85rem; }
                .ius-suggestion-card h4 { margin: 0 0 0.5rem; font-size: 1rem; }
                .ius-suggestion-card p { margin: 0; font-size: 0.88rem; color: var(--text-muted); line-height: 1.55; }
                .ius-suggestion-highlight { margin-top: 1rem; font-size: 1.35rem; font-weight: 800; color: var(--primary); }
                .ius-suggestion-foot { margin-top: 0.25rem !important; font-size: 0.78rem !important; }

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
