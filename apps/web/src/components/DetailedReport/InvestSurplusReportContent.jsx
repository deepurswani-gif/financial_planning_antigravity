import React, { useMemo, useState, useEffect } from 'react';
import { ArrowRight, Lightbulb, MessageSquare, Check, Loader2 } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { buildYourMoneyFlowReport } from './moneyFlowLedgerLogic';
import { buildInvestSurplusReport } from './investSurplusLogic';
import { buildInvestSurplusSignals } from '../../recommendationRegistry/adapters/investSurplusAdapter';
import { useRecommendationStore } from '../../recommendationOrchestration';
import { toPresentationModels } from '../../recommendationPresentation';
import { useNavigateToDetailReport } from './reportNavigation';
import {
    submitSupportRequestViaWeb3forms,
    buildSupportEmailContextFromUser,
    getSupportWeb3StorageKey,
    isSupportWeb3CooldownActive,
    markSupportWeb3Sent,
    openSupportRequestEmail,
} from '../../services/supportRequestEmailService';

const INVEST_SURPLUS_REPORTS = ['invest_surplus'];

const ContactFinbrellaHelpButton = ({ familyMembers, user }) => {
    const [sendState, setSendState] = useState('idle');
    const moduleName = 'Invest Surplus — Deployment Insights';

    const emailContext = useMemo(
        () => buildSupportEmailContextFromUser(familyMembers, user, moduleName),
        [familyMembers, user, moduleName],
    );

    const storageKey = useMemo(() => {
        const email = emailContext?.userEmail;
        if (!email) return null;
        return getSupportWeb3StorageKey(email, moduleName);
    }, [emailContext?.userEmail]);

    useEffect(() => {
        if (!storageKey) return;
        setSendState(isSupportWeb3CooldownActive(storageKey) ? 'success' : 'idle');
    }, [storageKey]);

    const handleContactClick = async (e) => {
        e.preventDefault();
        if (sendState === 'loading' || sendState === 'success') return;

        setSendState('loading');
        try {
            const { ok } = await submitSupportRequestViaWeb3forms(emailContext);
            if (ok) {
                if (storageKey) markSupportWeb3Sent(storageKey);
                setSendState('success');
            } else {
                openSupportRequestEmail(emailContext);
                setSendState('idle');
            }
        } catch {
            openSupportRequestEmail(emailContext);
            setSendState('idle');
        }
    };

    return (
        <button
            type="button"
            className="ius-help-btn"
            onClick={handleContactClick}
            disabled={sendState === 'loading' || sendState === 'success'}
        >
            {sendState === 'loading' ? (
                <>
                    <Loader2 size={14} className="spin" />
                    Sending inquiry...
                </>
            ) : sendState === 'success' ? (
                <>
                    <Check size={14} style={{ color: '#10B981' }} />
                    Inquiry sent to Finbrella support!
                </>
            ) : (
                <>
                    <MessageSquare size={14} />
                    Need help deciding? Contact Finbrella
                </>
            )}
        </button>
    );
};

const InvestSurplusReportContent = () => {
    const navigateToDetailReport = useNavigateToDetailReport();
    const { user } = useAuth();
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
        policies,
        liabilityCategories,
        inflationRates,
        calculatorInputs,
        goals,
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
            policies,
            liabilityCategories,
            income,
            inflationRates,
            calculatorInputs,
            goals,
        }),
        [
            moneyFlowReport,
            familyMembers,
            expenseCategories,
            assetCategories,
            contingencyFund,
            summaryLifeCover,
            investmentAllocations,
            policies,
            liabilityCategories,
            income,
            inflationRates,
            calculatorInputs,
            goals,
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
    const presentationModels = useMemo(() => toPresentationModels(insights), [insights]);

    if (!report.meta?.hasData) {
        return null;
    }

    return (
        <div className="ius-section" id="ius-section">
            <div className="card ius-insights-card">
                <h4 className="ius-insights-title">
                    <Lightbulb size={18} />
                    Deployment Insights
                </h4>

                {presentationModels.length > 0 ? (
                    <div className="ius-flat-rows">
                        {presentationModels.map((model) => {
                            const isActionNeeded = model.severity === 'high' || model.severity === 'critical';
                            return (
                                <div key={model.id} className="ius-flat-row">
                                    <div className="ius-row-left">
                                        <span
                                            className={`ius-status-dot ${isActionNeeded ? 'is-action' : 'is-info'}`}
                                            title={isActionNeeded ? 'Action Needed' : 'Informational'}
                                        />
                                        <div className="ius-row-content">
                                            <strong className="ius-row-title">{model.title}</strong>
                                            <p className="ius-row-summary">{model.summary || model.description}</p>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                        No pending deployment insights. Your surplus is optimally allocated.
                    </p>
                )}

                <div className="ius-footer-help">
                    <ContactFinbrellaHelpButton familyMembers={familyMembers} user={user} />
                </div>
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
                .ius-insights-title { margin: 0 0 1rem; font-size: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-main); }

                .ius-flat-rows { display: flex; flex-direction: column; gap: 0.85rem; }
                .ius-flat-row {
                    display: flex; justify-content: space-between; align-items: center; gap: 1rem;
                    padding: 0.85rem 1rem; border-radius: 8px; border: 1px solid var(--border);
                    background: var(--bg-card); transition: border-color 0.15s;
                }
                .ius-flat-row:hover { border-color: var(--primary); }
                .ius-row-left { display: flex; align-items: flex-start; gap: 0.75rem; min-width: 0; flex: 1; }
                .ius-status-dot {
                    width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; margin-top: 5px;
                }
                .ius-status-dot.is-info { background: #64748b; }
                .ius-status-dot.is-action { background: #d97706; box-shadow: 0 0 0 3px rgba(217, 119, 6, 0.15); }
                .ius-row-content { display: flex; flex-direction: column; gap: 0.2rem; min-width: 0; }
                .ius-row-title { font-size: 0.92rem; font-weight: 700; color: var(--text-main); line-height: 1.35; }
                .ius-row-summary { margin: 0; font-size: 0.84rem; color: var(--text-muted); line-height: 1.45; }

                .ius-footer-help { margin-top: 1.25rem; padding-top: 0.85rem; border-top: 1px solid var(--border); text-align: center; }
                .ius-help-btn {
                    display: inline-flex; align-items: center; gap: 0.45rem; font-size: 0.85rem;
                    color: var(--primary); background: transparent; border: 1px solid var(--border);
                    padding: 0.5rem 1rem; border-radius: 8px; font-weight: 600; cursor: pointer;
                    transition: all 0.15s;
                }
                .ius-help-btn:hover:not(:disabled) { border-color: var(--primary); background: rgba(37,99,235,0.04); }
                .ius-help-btn:disabled { opacity: 0.8; cursor: default; }

                .spin { animation: ius-spin 1s linear infinite; }
                @keyframes ius-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                .ius-planner-cta { display: flex; justify-content: center; padding: 0.5rem 0 1rem; }
                .ius-full-planner-btn { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.85rem 1.5rem; font-size: 1rem; font-weight: 600; }
            `}</style>
        </div>
    );
};

export default InvestSurplusReportContent;
