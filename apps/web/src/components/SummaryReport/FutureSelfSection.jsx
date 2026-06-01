import React, { useMemo, useEffect, useState, useRef } from 'react';
import {
    LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid
} from 'recharts';
import {
    Target, TrendingUp, Calendar, Wallet, CheckCircle2, AlertTriangle,
    Info, Car, Home, Plane, GraduationCap, Heart, Award, Sparkles, ArrowRight
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateCashFlow, formatCurrency } from '../CashFlowModule/CashFlowLogic';
import {
    buildFutureSelfReport,
    formatCompactFS,
    HORIZON_YEARS,
    DEFAULT_INVESTMENT_CAGR
} from './FutureSelfLogic';

const getGoalIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('educat')) return GraduationCap;
    if (lower.includes('retire')) return Award;
    if (lower.includes('car') || lower.includes('vehic') || lower.includes('bike')) return Car;
    if (lower.includes('vacat') || lower.includes('tour') || lower.includes('trip')) return Plane;
    if (lower.includes('home') || lower.includes('flat') || lower.includes('house')) return Home;
    if (lower.includes('marriage') || lower.includes('wed')) return Heart;
    return Target;
};

const RevealSection = ({ children, className = '', delay = 0 }) => {
    const [visible, setVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setVisible(true), delay);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [delay]);

    return (
        <div ref={ref} className={`fs-reveal ${visible ? 'fs-visible' : ''} ${className}`}>
            {children}
        </div>
    );
};

const IncomeTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    return (
        <div className="fs-tooltip">
            <div className="fs-tooltip-label">{data?.label}</div>
            <div className="fs-tooltip-value">{formatCurrency(data?.monthlyIncome)}</div>
        </div>
    );
};

const FutureSelfSection = () => {
    const { goals, income, expenseCategories, inflationRates } = useFinancialPlan();

    const cashFlowResults = useMemo(
        () => calculateCashFlow(income, expenseCategories),
        [income, expenseCategories]
    );

    const report = useMemo(
        () => buildFutureSelfReport({ goals, cashFlowResults, expenseCategories, inflationRates }),
        [goals, cashFlowResults, expenseCategories, inflationRates]
    );

    const timelineMaxYear = useMemo(() => {
        if (!report.enrichedGoals.length) return new Date().getFullYear() + 10;
        return Math.max(...report.enrichedGoals.map((g) => g.targetYear));
    }, [report.enrichedGoals]);

    if (!report.hasGoals) {
        return (
            <div className="fs-container">
                <div className="fs-empty-state">
                    <Target size={56} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <h2>Add Your Goals First</h2>
                    <p>
                        Your Future Self report needs at least one goal with a target amount and timeline.
                        Complete the Goals step in the summary flow to see your personalized outlook.
                    </p>
                </div>
            </div>
        );
    }

    if (!report.hasIncomeData) {
        return (
            <div className="fs-container">
                <div className="fs-empty-state">
                    <Wallet size={56} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <h2>Complete Your Cash Flow First</h2>
                    <p>
                        We need your monthly income and expenses to project your income journey and goal readiness.
                        Please fill in the Cash Flow section before viewing this report.
                    </p>
                </div>
            </div>
        );
    }

    const { dreamsHeadline, enrichedGoals, incomeJourney, nearTermGoals, longTermGoals, cashSnapshot } = report;
    const currentYear = new Date().getFullYear();

    return (
        <div className="fs-container">
            {/* Hook */}
            <RevealSection className="fs-hook-section">
                <p className="fs-hook-eyebrow">YOUR FUTURE SELF</p>
                {dreamsHeadline && (
                    <p className="fs-dreams-sentence">{dreamsHeadline}</p>
                )}
                <p className="fs-hook-sub">
                    Time changes the cost of every goal. The question is whether your money is growing alongside them.
                    Let&apos;s understand what these goals may cost when the time comes—and how prepared you are to achieve them with confidence.
                </p>
            </RevealSection>

            {/* Section 1 — Dreams */}
            <div className="fs-section-divider">
                <div className="fs-divider-line" />
                <span className="fs-divider-label">YOUR DREAMS — Goals</span>
                <div className="fs-divider-line" />
            </div>

            <RevealSection className="fs-timeline-strip-wrap" delay={100}>
                <div className="fs-timeline-strip">
                    <div className="fs-timeline-track">
                        {enrichedGoals
                            .slice()
                            .sort((a, b) => a.targetYear - b.targetYear)
                            .map((goal) => {
                                const pct = timelineMaxYear > currentYear
                                    ? ((goal.targetYear - currentYear) / (timelineMaxYear - currentYear)) * 100
                                    : 50;
                                const Icon = getGoalIcon(goal.name);
                                return (
                                    <div
                                        key={goal.id}
                                        className={`fs-timeline-node ${goal.isNearTerm ? 'fs-near' : 'fs-far'}`}
                                        style={{ left: `${Math.min(96, Math.max(2, pct))}%` }}
                                        title={`${goal.name} (${goal.targetYear})`}
                                    >
                                        <div className="fs-timeline-dot"><Icon size={14} /></div>
                                        <span className="fs-timeline-year">{goal.targetYear}</span>
                                    </div>
                                );
                            })}
                    </div>
                    <div className="fs-timeline-axis">
                        <span>{currentYear}</span>
                        <span>{timelineMaxYear}</span>
                    </div>
                </div>
            </RevealSection>

            <RevealSection className="fs-goals-grid" delay={200}>
                {enrichedGoals
                    .slice()
                    .sort((a, b) => a.targetYear - b.targetYear)
                    .map((goal) => {
                        const Icon = getGoalIcon(goal.name);
                        return (
                            <div key={goal.id} className={`fs-goal-card ${goal.isNearTerm ? '' : 'fs-goal-card-muted'}`}>
                                <div className="fs-goal-card-header">
                                    <div className="fs-goal-icon"><Icon size={22} /></div>
                                    <div>
                                        <h3 className="fs-goal-name">{goal.name}</h3>
                                        <p className="fs-goal-meta">
                                            {goal.targetYear} — {goal.yearsDisplay}
                                        </p>
                                    </div>
                                </div>
                                <div className="fs-goal-flow">
                                    <span>Today: {formatCompactFS(goal.presentValueNum)}</span>
                                    <ArrowRight size={16} className="fs-goal-arrow" />
                                    <span className="fs-goal-future">
                                        Future cost: {formatCompactFS(goal.futureCost)}
                                    </span>
                                </div>
                                <p className="fs-goal-inflation-note">
                                    (inflation: +{formatCompactFS(goal.inflationDelta)})
                                </p>
                                <p className="fs-goal-footnote">
                                    <Info size={13} />
                                    Inflation assumed at {goal.inflationRate}%
                                </p>
                                <div className="fs-goal-sip-block">
                                    <span className="fs-goal-sip-label">Monthly SIP needed</span>
                                    <span className="fs-goal-sip-value">{formatCurrency(goal.monthlySipNeeded)}</span>
                                </div>
                                <p className="fs-goal-footnote">
                                    <Info size={13} />
                                    Expected CAGR {DEFAULT_INVESTMENT_CAGR}%, Tenure {goal.yearsDisplay}
                                </p>
                            </div>
                        );
                    })}
            </RevealSection>

            {/* Section 2 — Income Journey */}
            <div className="fs-section-divider" style={{ marginTop: '4rem' }}>
                <div className="fs-divider-line" />
                <span className="fs-divider-label">YOUR INCOME JOURNEY AHEAD — Future Earnings</span>
                <div className="fs-divider-line" />
            </div>

            <RevealSection className="fs-stat-strip-4" delay={100}>
                <div className="fs-stat-card-glass">
                    <Wallet size={20} style={{ color: '#10B981' }} />
                    <span className="fs-stat-label">Today</span>
                    <span className="fs-stat-value">{formatCurrency(cashSnapshot.monthlyIncome)}/mo</span>
                </div>
                <div className="fs-stat-card-glass">
                    <TrendingUp size={20} style={{ color: '#00A9F2' }} />
                    <span className="fs-stat-label">Annual income growth</span>
                    <span className="fs-stat-value">{incomeJourney.incomeGrowthPct}%</span>
                </div>
                <div className="fs-stat-card-glass">
                    <Calendar size={20} style={{ color: '#6366F1' }} />
                    <span className="fs-stat-label">Committed outflow</span>
                    <span className="fs-stat-value">{formatCurrency(cashSnapshot.monthlyCommitted)}/mo</span>
                </div>
                <div className="fs-stat-card-glass">
                    <Sparkles size={20} style={{ color: '#F59E0B' }} />
                    <span className="fs-stat-label">Unallocated surplus</span>
                    <span className="fs-stat-value">{formatCurrency(cashSnapshot.monthlySurplus)}/mo</span>
                </div>
            </RevealSection>

            <RevealSection className="fs-income-chart-section" delay={200}>
                <h3 className="fs-chart-title">
                    <TrendingUp size={20} style={{ marginRight: '0.5rem', color: 'var(--color-2)' }} />
                    Monthly Income Projection — Next {HORIZON_YEARS} Years
                </h3>
                <div className="fs-income-chart">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={incomeJourney.points} margin={{ top: 16, right: 24, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} axisLine={false} tickLine={false} />
                            <YAxis
                                tickFormatter={(v) => formatCompactFS(v)}
                                tick={{ fill: '#94a3b8', fontSize: 11 }}
                                axisLine={false}
                                tickLine={false}
                            />
                            <Tooltip content={<IncomeTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="monthlyIncome"
                                stroke="#00A9F2"
                                strokeWidth={3}
                                dot={{ fill: '#00A9F2', r: 5, strokeWidth: 2, stroke: '#fff' }}
                                activeDot={{ r: 7 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
                <div className="fs-income-ladder">
                    {incomeJourney.points.map((pt) => (
                        <div key={pt.label} className="fs-income-step">
                            <span className="fs-income-step-year">{pt.label}</span>
                            <span className="fs-income-step-amt">{formatCurrency(pt.monthlyIncome)}/month</span>
                        </div>
                    ))}
                </div>
            </RevealSection>

            <RevealSection className="fs-narrative-block" delay={300}>
                <p className="fs-narrative-text">
                    Your future income has the potential to be much higher than it is today. But every year,
                    inflation quietly increases the cost of the life you want to maintain. By{' '}
                    <strong>{incomeJourney.horizonYear}</strong>, your household expenses may reach approximately{' '}
                    <span className="fs-narrative-accent">{formatCurrency(incomeJourney.householdAtHorizon)}</span> per month
                    (household expenses inflated at {incomeJourney.householdInflationPct}%; EMIs and savings held flat).
                    The key is ensuring that your wealth grows faster than your expenses.
                </p>
            </RevealSection>

            {/* Section 3 — Readiness */}
            <div className="fs-section-divider" style={{ marginTop: '4rem' }}>
                <div className="fs-divider-line" />
                <span className="fs-divider-label">HOW CLOSE ARE YOU TO YOUR GOALS?</span>
                <div className="fs-divider-line" />
            </div>

            {nearTermGoals.length === 0 ? (
                <RevealSection className="fs-no-near-msg">
                    <p>
                        None of your goals fall within the next {HORIZON_YEARS} years. See your long-term goals below,
                        or add nearer-term goals in the summary flow for a detailed readiness check.
                    </p>
                </RevealSection>
            ) : (
                nearTermGoals.map((goal, idx) => (
                    <RevealSection key={goal.id} className="fs-readiness-card-wrap" delay={100 + idx * 80}>
                        <div className="fs-readiness-card">
                            <div className="fs-readiness-header">
                                {(() => {
                                    const Icon = getGoalIcon(goal.name);
                                    return <div className="fs-goal-icon"><Icon size={24} /></div>;
                                })()}
                                <div>
                                    <h3 className="fs-readiness-title">{goal.name}</h3>
                                    <p className="fs-readiness-meta">
                                        Target Year: <strong>{goal.targetYear}</strong> ({goal.yearsRounded} Years Away)
                                    </p>
                                </div>
                            </div>

                            <div className="fs-readiness-bar-wrap">
                                <div className="fs-readiness-bar-labels">
                                    <span>Projected resources</span>
                                    <span>{goal.coveragePercent}% of target</span>
                                </div>
                                <div className="fs-readiness-bar-track">
                                    <div
                                        className={`fs-readiness-bar-fill ${goal.isAchievable ? 'fs-bar-ok' : 'fs-bar-gap'}`}
                                        style={{ width: `${goal.coveragePercent}%` }}
                                    />
                                </div>
                                <div className="fs-readiness-target-line">
                                    Target: {formatCompactFS(goal.futureCost)}
                                </div>
                            </div>

                            <div className="fs-readiness-metrics">
                                <div className="fs-readiness-metric">
                                    <span className="fs-metric-label">Estimated Future Cost</span>
                                    <span className="fs-metric-value">{formatCurrency(goal.futureCost)}</span>
                                </div>
                                <div className="fs-readiness-metric">
                                    <span className="fs-metric-label">Projected Value of Current SIPs by {goal.targetYear}</span>
                                    <span className="fs-metric-value">{formatCurrency(goal.projectedCurrentSips)}</span>
                                </div>
                                <div className="fs-readiness-metric">
                                    <span className="fs-metric-label">Projected Future Surplus by {goal.targetYear}</span>
                                    <span className="fs-metric-value">{formatCurrency(goal.projectedFutureSurplus)}</span>
                                </div>
                            </div>

                            <p className="fs-readiness-note">
                                <Info size={14} />
                                <span>
                                    As your income grows over time, the amount available for future savings and investments is also expected to increase.
                                    Thoughtful allocation of this growing surplus can significantly improve your ability to achieve important life goals.
                                    Projections assume income growth at {goal.incomeGrowthPct}% p.a., household inflation at {goal.householdInflationPct}%,
                                    and investment returns at {DEFAULT_INVESTMENT_CAGR}% on monthly SIP and surplus allocations.
                                </span>
                            </p>

                            <div className={`fs-verdict ${goal.isAchievable ? 'fs-verdict-ok' : 'fs-verdict-gap'}`}>
                                {goal.isAchievable ? (
                                    <CheckCircle2 size={22} />
                                ) : (
                                    <AlertTriangle size={22} />
                                )}
                                <p>{goal.isAchievable ? goal.comfortableMessage : goal.gapMessage}</p>
                            </div>
                        </div>
                    </RevealSection>
                ))
            )}

            {longTermGoals.length > 0 && (
                <>
                    <div className="fs-section-divider" style={{ marginTop: '3rem' }}>
                        <div className="fs-divider-line" />
                        <span className="fs-divider-label">LOOKING BEYOND THE NEXT FIVE YEARS</span>
                        <div className="fs-divider-line" />
                    </div>

                    <RevealSection className="fs-longterm-intro" delay={100}>
                        <p>
                            Some of your goals have a longer time horizon and require a more detailed planning approach
                            involving inflation, investment returns, income growth, and competing priorities.
                        </p>
                    </RevealSection>

                    <RevealSection className="fs-longterm-list" delay={200}>
                        {longTermGoals.map((goal) => {
                            const Icon = getGoalIcon(goal.name);
                            return (
                                <div key={goal.id} className="fs-longterm-item">
                                    <div className="fs-longterm-icon"><Icon size={20} /></div>
                                    <span className="fs-longterm-name">{goal.name}</span>
                                    <span className="fs-longterm-year">{goal.targetYear}</span>
                                </div>
                            );
                        })}
                    </RevealSection>
                </>
            )}

            <style>{`
                .fs-container { width: 100%; max-width: 100%; background: #fff; padding: 0; margin: 0; }
                .fs-empty-state { text-align: center; padding: 6rem 2rem; max-width: 520px; margin: 0 auto; }
                .fs-empty-state h2 { font-size: 1.5rem; font-weight: 700; margin-bottom: 0.75rem; }
                .fs-empty-state p { color: var(--text-muted); line-height: 1.7; }

                .fs-reveal { opacity: 0; transform: translateY(32px); transition: opacity 0.7s cubic-bezier(0.16,1,0.3,1), transform 0.7s cubic-bezier(0.16,1,0.3,1); }
                .fs-reveal.fs-visible { opacity: 1; transform: translateY(0); }

                .fs-hook-section { text-align: center; padding: 4rem 2rem 3rem; max-width: 820px; margin: 0 auto; }
                .fs-hook-eyebrow { font-size: 0.82rem; font-weight: 700; letter-spacing: 0.2em; color: var(--color-2); text-transform: uppercase; margin-bottom: 1.25rem; }
                .fs-dreams-sentence { font-size: clamp(1.2rem, 2.5vw, 1.65rem); font-weight: 700; color: var(--text-main); line-height: 1.5; margin-bottom: 1.5rem; }
                .fs-hook-sub { font-size: 1.08rem; color: var(--text-muted); line-height: 1.8; font-style: italic; }

                .fs-section-divider { display: flex; align-items: center; gap: 1.5rem; padding: 2rem 3rem; margin: 1rem 0; }
                .fs-divider-line { flex: 1; height: 1px; background: var(--border); }
                .fs-divider-label { font-size: 0.78rem; font-weight: 700; letter-spacing: 0.15em; color: var(--text-muted); text-transform: uppercase; white-space: nowrap; }

                .fs-timeline-strip-wrap { max-width: 1000px; margin: 0 auto 2rem; padding: 0 2rem; }
                .fs-timeline-strip { position: relative; padding: 2.5rem 0 1rem; }
                .fs-timeline-track { position: relative; height: 4px; background: linear-gradient(90deg, var(--color-2), #e2e8f0); border-radius: 2px; margin: 0 1rem; }
                .fs-timeline-node { position: absolute; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
                .fs-timeline-dot { width: 36px; height: 36px; border-radius: 50%; background: #fff; border: 2px solid var(--color-2); display: flex; align-items: center; justify-content: center; color: var(--color-2); box-shadow: 0 4px 12px rgba(0,169,242,0.2); }
                .fs-timeline-node.fs-far .fs-timeline-dot { border-color: #94a3b8; color: #64748b; box-shadow: none; }
                .fs-timeline-year { font-size: 0.72rem; font-weight: 700; color: var(--text-muted); }
                .fs-timeline-axis { display: flex; justify-content: space-between; margin-top: 1.25rem; padding: 0 1rem; font-size: 0.75rem; color: var(--text-muted); font-weight: 600; }

                .fs-goals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem; max-width: 1100px; margin: 0 auto 2rem; padding: 0 2rem; }
                .fs-goal-card { padding: 1.75rem; border: 1px solid #f1f5f9; border-radius: 16px; background: #fff; transition: box-shadow 0.3s, transform 0.3s; border-left: 4px solid var(--color-2); }
                .fs-goal-card:hover { box-shadow: 0 8px 30px rgba(0,0,0,0.06); transform: translateY(-3px); }
                .fs-goal-card-muted { border-left-color: #94a3b8; opacity: 0.92; }
                .fs-goal-card-header { display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1rem; }
                .fs-goal-icon { width: 44px; height: 44px; border-radius: 12px; background: rgba(0,169,242,0.1); color: var(--color-2); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
                .fs-goal-name { font-size: 1.1rem; font-weight: 700; margin: 0 0 0.25rem; }
                .fs-goal-meta { font-size: 0.85rem; color: var(--text-muted); margin: 0; }
                .fs-goal-flow { display: flex; flex-wrap: wrap; align-items: center; gap: 0.5rem; font-size: 0.95rem; font-weight: 600; margin-bottom: 0.35rem; }
                .fs-goal-arrow { color: var(--text-muted); flex-shrink: 0; }
                .fs-goal-future { color: var(--color-1); }
                .fs-goal-inflation-note { font-size: 0.82rem; color: var(--text-muted); margin: 0 0 0.75rem; }
                .fs-goal-footnote { display: flex; align-items: flex-start; gap: 0.4rem; font-size: 0.75rem; color: var(--text-muted); margin: 0.5rem 0 0; line-height: 1.4; }
                .fs-goal-footnote svg { flex-shrink: 0; margin-top: 2px; }
                .fs-goal-sip-block { margin-top: 1rem; padding: 1rem; background: linear-gradient(135deg, #f0f9ff, #f8fafc); border-radius: 12px; text-align: center; }
                .fs-goal-sip-label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 0.35rem; }
                .fs-goal-sip-value { font-size: 1.5rem; font-weight: 800; color: var(--color-1); }

                .fs-stat-strip-4 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; max-width: 1000px; margin: 0 auto 2rem; padding: 0 2rem; }
                .fs-stat-card-glass { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 0.5rem; padding: 1.5rem 1rem; border: 1px solid #f1f5f9; border-radius: 14px; }
                .fs-stat-label { font-size: 0.75rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.04em; }
                .fs-stat-value { font-size: 1.1rem; font-weight: 800; color: var(--text-main); }

                .fs-income-chart-section { max-width: 900px; margin: 0 auto 2rem; padding: 0 2rem; }
                .fs-chart-title { display: flex; align-items: center; font-size: 1.05rem; font-weight: 700; margin-bottom: 1.25rem; }
                .fs-tooltip { background: var(--text-main); color: #fff; padding: 0.6rem 1rem; border-radius: 8px; font-size: 0.85rem; }
                .fs-tooltip-label { font-weight: 600; margin-bottom: 0.2rem; }
                .fs-tooltip-value { font-weight: 700; }
                .fs-income-ladder { display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-top: 1.5rem; }
                .fs-income-step { padding: 0.75rem; background: #f8fafc; border-radius: 10px; text-align: center; }
                .fs-income-step-year { display: block; font-size: 0.72rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 0.25rem; }
                .fs-income-step-amt { font-size: 0.88rem; font-weight: 700; color: var(--text-main); }

                .fs-narrative-block { max-width: 760px; margin: 0 auto 2rem; padding: 0 2rem; text-align: center; }
                .fs-narrative-text { font-size: 1.05rem; color: var(--text-main); line-height: 1.8; }
                .fs-narrative-accent { color: var(--color-1); font-weight: 800; }

                .fs-no-near-msg { max-width: 640px; margin: 0 auto 2rem; padding: 1.5rem 2rem; text-align: center; color: var(--text-muted); line-height: 1.7; background: #f8fafc; border-radius: 12px; }

                .fs-readiness-card-wrap { max-width: 820px; margin: 0 auto 1.5rem; padding: 0 2rem; }
                .fs-readiness-card { padding: 2rem; border: 1px solid #f1f5f9; border-radius: 16px; background: #fff; }
                .fs-readiness-header { display: flex; gap: 1rem; align-items: flex-start; margin-bottom: 1.5rem; }
                .fs-readiness-title { font-size: 1.2rem; font-weight: 700; margin: 0 0 0.35rem; }
                .fs-readiness-meta { font-size: 0.9rem; color: var(--text-muted); margin: 0; }
                .fs-readiness-bar-wrap { margin-bottom: 1.5rem; }
                .fs-readiness-bar-labels { display: flex; justify-content: space-between; font-size: 0.78rem; font-weight: 600; color: var(--text-muted); margin-bottom: 0.5rem; }
                .fs-readiness-bar-track { height: 12px; background: #f1f5f9; border-radius: 6px; overflow: hidden; }
                .fs-readiness-bar-fill { height: 100%; border-radius: 6px; transition: width 1.2s cubic-bezier(0.16,1,0.3,1); }
                .fs-bar-ok { background: linear-gradient(90deg, #10B981, #059669); }
                .fs-bar-gap { background: linear-gradient(90deg, #F59E0B, #D97706); }
                .fs-readiness-target-line { font-size: 0.78rem; color: var(--text-muted); margin-top: 0.4rem; text-align: right; }
                .fs-readiness-metrics { display: grid; grid-template-columns: 1fr; gap: 0.75rem; margin-bottom: 1rem; }
                .fs-readiness-metric { display: flex; justify-content: space-between; align-items: baseline; gap: 1rem; padding: 0.75rem 1rem; background: #f8fafc; border-radius: 10px; flex-wrap: wrap; }
                .fs-metric-label { font-size: 0.85rem; color: var(--text-muted); flex: 1; min-width: 180px; }
                .fs-metric-value { font-size: 1rem; font-weight: 700; color: var(--text-main); }
                .fs-readiness-note { display: flex; gap: 0.5rem; font-size: 0.8rem; color: var(--text-muted); line-height: 1.6; padding: 1rem; background: #f8fafc; border-radius: 10px; margin-bottom: 1rem; }
                .fs-readiness-note svg { flex-shrink: 0; margin-top: 2px; }
                .fs-verdict { display: flex; gap: 0.75rem; align-items: flex-start; padding: 1.25rem; border-radius: 12px; }
                .fs-verdict p { margin: 0; font-size: 0.95rem; line-height: 1.65; font-weight: 500; }
                .fs-verdict-ok { background: linear-gradient(135deg, #ecfdf5, #fff); border-left: 4px solid #10B981; color: #065f46; }
                .fs-verdict-ok svg { color: #10B981; flex-shrink: 0; }
                .fs-verdict-gap { background: linear-gradient(135deg, #fffbeb, #fff); border-left: 4px solid #F59E0B; color: #92400e; }
                .fs-verdict-gap svg { color: #F59E0B; flex-shrink: 0; }

                .fs-longterm-intro { max-width: 700px; margin: 0 auto 1.5rem; padding: 0 2rem; text-align: center; color: var(--text-muted); line-height: 1.7; font-style: italic; }
                .fs-longterm-list { max-width: 560px; margin: 0 auto 3rem; padding: 0 2rem; display: flex; flex-direction: column; gap: 0.75rem; }
                .fs-longterm-item { display: flex; align-items: center; gap: 1rem; padding: 1rem 1.25rem; border: 1px solid #f1f5f9; border-radius: 12px; background: #fff; }
                .fs-longterm-icon { width: 40px; height: 40px; border-radius: 10px; background: #f1f5f9; color: #64748b; display: flex; align-items: center; justify-content: center; }
                .fs-longterm-name { flex: 1; font-weight: 600; color: var(--text-main); }
                .fs-longterm-year { font-weight: 800; color: var(--color-2); font-size: 0.95rem; }

                @media (max-width: 768px) {
                    .fs-stat-strip-4 { grid-template-columns: repeat(2, 1fr); }
                    .fs-income-ladder { grid-template-columns: repeat(2, 1fr); }
                    .fs-goals-grid { grid-template-columns: 1fr; }
                    .fs-hook-section { padding: 3rem 1.5rem 2rem; }
                    .fs-section-divider { padding: 2rem 1.5rem; }
                    .fs-timeline-node .fs-timeline-year { display: none; }
                }
            `}</style>
        </div>
    );
};

export default FutureSelfSection;
