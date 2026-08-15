import React, { useMemo, useEffect, useState, useRef } from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Wallet, CreditCard, PiggyBank, BarChart3, Shield, AlertTriangle, Landmark, ArrowRight, Gem, Building2, Banknote, Layers, Info } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateCashFlow, formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { calculateNetWorth } from '../AssetModule/AssetLogic';
import {
    classifyAssets,
    calculateUnallocatedSurplus,
    calculateOwnedVsFinanced,
    computeSIPProjection,
    buildAssetBreakdownData,
    buildLiabilityBreakdownData,
    formatCompact
} from './MoneyStoryLogic';
import { calculateProtectionData, calculateContingencyData } from './SafetyNetLogic';
import { getEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';
import { getHouseholdBreakdownTotal } from '../DetailedFlow/expenseDetailSync';
import DetailedHubCTA from '../DetailedHub/DetailedHubCTA';

/* ─────────────── Animated Counter ─────────────── */
const AnimatedCounter = ({ value, prefix = '₹', duration = 1500 }) => {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);
    const isVisible = useRef(false);
    const displayRef = useRef(0);
    const rafRef = useRef(null);
    const valueRef = useRef(value);
    const durationRef = useRef(duration);

    valueRef.current = value;
    durationRef.current = duration;

    const animateTo = (end) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const start = displayRef.current;
        const animDuration = durationRef.current;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / animDuration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            const next = Math.round(start + (end - start) * eased);
            displayRef.current = next;
            setDisplay(next);
            if (progress < 1) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !isVisible.current) {
                    isVisible.current = true;
                    animateTo(Math.abs(valueRef.current));
                }
            },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => {
            observer.disconnect();
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
        };
    }, []);

    useEffect(() => {
        if (isVisible.current) {
            animateTo(Math.abs(value));
        }
    }, [value, duration]);

    const formatted = new Intl.NumberFormat('en-IN').format(display);
    return (
        <span ref={ref} className="ms-animated-counter">
            {value < 0 && '−'}{prefix}{formatted}
        </span>
    );
};

/* ─────────────── Section Reveal ─────────────── */
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
        <div ref={ref} className={`ms-reveal ${visible ? 'ms-visible' : ''} ${className}`}>
            {children}
        </div>
    );
};



/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */
const MoneyStorySection = () => {
    const {
        familyMembers,
        income,
        expenseCategories,
        assetCategories,
        liabilityCategories,
        contingencyFund,
        summaryLifeCover,
        hasSpouseIncome,
        policies,
    } = useFinancialPlan();

    // ── Derived Calculations ──
    const cashFlowResults = useMemo(
        () => calculateCashFlow(income, expenseCategories, familyMembers, hasSpouseIncome),
        [income, expenseCategories, familyMembers, hasSpouseIncome],
    );
    const assetResults = useMemo(() => calculateNetWorth(assetCategories, liabilityCategories), [assetCategories, liabilityCategories]);

    const surplusData = useMemo(() => calculateUnallocatedSurplus(cashFlowResults), [cashFlowResults]);
    const assetClassification = useMemo(() => classifyAssets(assetCategories), [assetCategories]);
    const ownedFinanced = useMemo(() => calculateOwnedVsFinanced(assetResults.totalAssets, assetResults.totalLiabilities), [assetResults]);

    const assetBreakdown = useMemo(() => buildAssetBreakdownData(assetCategories, assetResults.totalAssets), [assetCategories, assetResults.totalAssets]);
    const liabilityBreakdown = useMemo(() => buildLiabilityBreakdownData(liabilityCategories, assetResults.totalLiabilities), [liabilityCategories, assetResults.totalLiabilities]);

    // ── SIP Projection ──
    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self');
    const yearsToRetirement = useMemo(() => {
        if (!selfMember) return 20;
        const age = selfMember.age || (selfMember.dob ? Math.floor((new Date() - new Date(selfMember.dob)) / 31557600000) : 30);
        const retAge = selfMember.retirementAge || 60;
        return Math.max(1, retAge - age);
    }, [selfMember]);

    const sipProjection = useMemo(() => {
        return computeSIPProjection(Math.max(0, surplusData.unallocated), 12, yearsToRetirement);
    }, [surplusData.unallocated, yearsToRetirement]);

    const protectionData = useMemo(
        () => calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers, policies),
        [expenseCategories, summaryLifeCover, familyMembers, policies]
    );

    const contingencyData = useMemo(
        () => calculateContingencyData(
            expenseCategories,
            getEmergencyFundAmount(assetCategories, contingencyFund),
            familyMembers,
        ),
        [expenseCategories, assetCategories, contingencyFund, familyMembers]
    );

    const userName = selfMember?.name?.split(' ')[0] || 'there';

    // ── Donut chart data for Income vs Legacy ──
    const incomeVsLegacyData = useMemo(() => {
        const data = [];
        if (assetClassification.incomeTotal > 0) data.push({ name: 'Income Assets', value: assetClassification.incomeTotal });
        if (assetClassification.legacyTotal > 0) data.push({ name: 'Legacy Assets', value: assetClassification.legacyTotal });
        if (data.length === 0) data.push({ name: 'No Assets', value: 1 });
        return data;
    }, [assetClassification]);

    // ── Money Flow Strip Data ──
    const flowSegments = useMemo(() => {
        if (!cashFlowResults.totalIncome) return [];
        const total = cashFlowResults.totalIncome;
        return [
            { name: 'Household Expenses', value: cashFlowResults.categorySums?.household || 0, color: '#EF4444' },
            { name: 'EMI Payments', value: cashFlowResults.categorySums?.emi || 0, color: '#F59E0B' },
            { name: 'Insurance Premium', value: cashFlowResults.categorySums?.insurance || 0, color: '#8B5CF6' },
            { name: 'Total Savings', value: cashFlowResults.totalSavings || 0, color: '#6366F1' },
            { name: 'Surplus', value: surplusData.unallocated || 0, color: '#10B981' }
        ].map(s => ({
            ...s,
            percent: (s.value / total) * 100
        })).filter(s => s.value > 0);
    }, [cashFlowResults, surplusData]);

    const fractionalPhrase = useMemo(() => {
        if (!assetClassification || assetClassification.grandTotal === 0) return "your money";
        const incomePct = assetClassification.incomePercent;
        if (incomePct <= 0) return "none";
        if (incomePct >= 100) return "all";
        
        const fraction = Math.round(100 / incomePct);
        return `1 in every ${fraction} rupees`;
    }, [assetClassification]);

    const INCOME_COLOR = '#00A9F2';
    const LEGACY_COLOR = '#94A3B8';

    return (
        <div className="ms-container">

            {/* ══════════════════════════════════════════════
                EMOTIONAL HOOK HEADER
               ══════════════════════════════════════════════ */}
            <RevealSection className="ms-hook-section">
                <p className="ms-hook-eyebrow">YOUR MONEY STORY</p>
                <h1 className="ms-hook-headline">
                    {userName}, your monthly household income is{' '}
                    <span className="ms-hook-amount">{formatCurrency(cashFlowResults.totalIncome)}</span>.
                </h1>
                <p className="ms-hook-sub">
                    Here's how your money flows — and where it settles.
                </p>
            </RevealSection>



            {/* ══════════════════════════════════════════════
                THE RIVER — MONTHLY CASH FLOW
               ══════════════════════════════════════════════ */}
            <div className="ms-section-divider">
                <div className="ms-divider-line" />
                <span className="ms-divider-label">THE RIVER — Monthly Cash Flow</span>
                <div className="ms-divider-line" />
            </div>

            {/* Hero: Unallocated Surplus */}
            <RevealSection className="ms-hero-block ms-hero-surplus-block">
                <div className="ms-hero-number">
                    <AnimatedCounter value={surplusData.unallocated} />
                </div>
                <p className="ms-hero-label">Unallocated Surplus / Month</p>
                <p className="ms-hero-yearly-projection">
                    = {formatCurrency(surplusData.yearlyUnallocated)} saved a year — enough to fund your wealth building, protection goals and emergency reserves.
                </p>
                <div className="ms-hero-gradient-bar" />
            </RevealSection>

            {/* Stat Cards */}
            <RevealSection className="ms-stat-strip" delay={200}>
                <div className="ms-stat-card">
                    <div className="ms-stat-accent" style={{ background: '#10B981' }} />
                    <div className="ms-stat-icon" style={{ color: '#10B981' }}><Wallet size={22} /></div>
                    <div className="ms-stat-info">
                        <span className="ms-stat-label">Total Monthly Income</span>
                        <span className="ms-stat-value">{formatCurrency(cashFlowResults.totalIncome)}</span>
                    </div>
                </div>
                <div className="ms-stat-card">
                    <div className="ms-stat-accent" style={{ background: '#EF4444' }} />
                    <div className="ms-stat-icon" style={{ color: '#EF4444' }}><CreditCard size={22} /></div>
                    <div className="ms-stat-info">
                        <span className="ms-stat-label">Monthly Household Expenses</span>
                        <span className="ms-stat-value">{formatCurrency(cashFlowResults.categorySums?.household || 0)}</span>
                    </div>
                </div>
                <div className="ms-stat-card">
                    <div className="ms-stat-accent" style={{ background: '#F59E0B' }} />
                    <div className="ms-stat-icon" style={{ color: '#F59E0B' }}><Landmark size={22} /></div>
                    <div className="ms-stat-info">
                        <span className="ms-stat-label">Total Monthly EMIs</span>
                        <span className="ms-stat-value">{formatCurrency(cashFlowResults.categorySums?.emi || 0)}</span>
                    </div>
                </div>
                <div className="ms-stat-card">
                    <div className="ms-stat-accent" style={{ background: '#8B5CF6' }} />
                    <div className="ms-stat-icon" style={{ color: '#8B5CF6' }}><Shield size={22} /></div>
                    <div className="ms-stat-info">
                        <span className="ms-stat-label">Monthly Insurance Premiums</span>
                        <span className="ms-stat-value">{formatCurrency(cashFlowResults.categorySums?.insurance || 0)}</span>
                    </div>
                </div>
                <div className="ms-stat-card">
                    <div className="ms-stat-accent" style={{ background: '#6366F1' }} />
                    <div className="ms-stat-icon" style={{ color: '#6366F1' }}><PiggyBank size={22} /></div>
                    <div className="ms-stat-info">
                        <span className="ms-stat-label">Total Monthly Savings</span>
                        <span className="ms-stat-value">{formatCurrency(cashFlowResults.totalSavings)}</span>
                    </div>
                </div>
            </RevealSection>

            {/* Money Flow Strip */}
            {flowSegments.length > 0 && (
                <RevealSection className="ms-flow-strip-section" delay={300}>
                    <div className="ms-flow-strip-wrapper">
                        <div className="ms-flow-strip-bar">
                            {flowSegments.map((seg, idx) => (
                                <div 
                                    key={idx} 
                                    className="ms-flow-strip-segment" 
                                    style={{ width: `${seg.percent}%`, backgroundColor: seg.color }}
                                    title={`${seg.name}: ${formatCurrency(seg.value)}`}
                                >
                                    {seg.percent > 5 && (
                                        <span className="ms-flow-strip-label">{Math.round(seg.percent)}%</span>
                                    )}
                                </div>
                            ))}
                        </div>
                        <div className="ms-flow-strip-legend">
                            {flowSegments.map((seg, idx) => (
                                <div key={idx} className="ms-flow-strip-legend-item">
                                    <span className="ms-flow-strip-dot" style={{ backgroundColor: seg.color }} />
                                    <span className="ms-flow-strip-name">{seg.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </RevealSection>
            )}

            {/* ══════════════════════════════════════════════
                THE LAKE — WHERE WEALTH ACCUMULATES
               ══════════════════════════════════════════════ */}
            <div className="ms-section-divider" style={{ marginTop: '4rem' }}>
                <div className="ms-divider-line" />
                <span className="ms-divider-label">THE LAKE — Where Wealth Accumulates</span>
                <div className="ms-divider-line" />
            </div>

            {/* Hero: Net Worth */}
            <RevealSection className="ms-hero-block">
                <div className="ms-hero-number" style={{ color: 'var(--color-1)' }}>
                    <AnimatedCounter value={assetResults.netWorth} />
                </div>
                <p className="ms-hero-label">Total Net Worth</p>

                {/* Owned vs Financed bar */}
                {assetResults.totalAssets > 0 && (
                    <div className="ms-owned-bar-wrapper">
                        <div className="ms-owned-bar-labels">
                            <span className="ms-owned-label">
                                <span className="ms-dot" style={{ background: '#10B981' }} />
                                Owned {Math.round(ownedFinanced.ownedPercent)}%
                            </span>
                            <span className="ms-owned-label">
                                <span className="ms-dot" style={{ background: '#EF4444' }} />
                                Financed {Math.round(ownedFinanced.financedPercent)}%
                            </span>
                        </div>
                        <div className="ms-owned-bar-track">
                            <div
                                className="ms-owned-bar-fill"
                                style={{ width: `${ownedFinanced.ownedPercent}%`, background: '#10B981' }}
                            />
                            <div
                                className="ms-owned-bar-fill"
                                style={{ width: `${ownedFinanced.financedPercent}%`, background: '#EF4444' }}
                            />
                        </div>
                    </div>
                )}
            </RevealSection>

            {/* Income vs Legacy Assets — Hero Stat */}
            <RevealSection className="ms-hero-block" delay={200}>
                <div className="ms-hero-number" style={{ color: INCOME_COLOR, fontSize: 'clamp(3rem, 6vw, 4.5rem)' }}>
                    {Math.round(assetClassification.incomePercent)}%
                </div>
                <p className="ms-hero-label">of your wealth consists of Income Assets</p>

                {/* Unified Donut */}
                {assetClassification.grandTotal > 0 && (
                    <div className="ms-donut-unified">
                        <div className="ms-donut-chart-large">
                            <ResponsiveContainer width={220} height={220}>
                                <PieChart>
                                    <Pie
                                        data={incomeVsLegacyData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={75}
                                        outerRadius={105}
                                        paddingAngle={2}
                                        dataKey="value"
                                        stroke="none"
                                        startAngle={90}
                                        endAngle={-270}
                                    >
                                        {incomeVsLegacyData.map((entry, i) => (
                                            <Cell key={i} fill={entry.name === 'Income Assets' ? INCOME_COLOR : LEGACY_COLOR} />
                                        ))}
                                    </Pie>
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="ms-donut-center">
                                <span className="ms-donut-pct" style={{ fontSize: '1.2rem' }}>{formatCompact(assetClassification.grandTotal)}</span>
                                <span className="ms-donut-sub">Total</span>
                            </div>
                        </div>

                        <div className="ms-donut-legend-unified">
                            <div className="ms-donut-legend-card">
                                <div className="ms-donut-legend-header">
                                    <span className="ms-donut-legend-dot" style={{ background: INCOME_COLOR }} />
                                    <h4>Income Assets</h4>
                                    <span className="ms-donut-legend-pct" style={{ color: INCOME_COLOR }}>{Math.round(assetClassification.incomePercent)}%</span>
                                </div>
                                <p className="ms-donut-desc">Assets delivering predictable cash — Mutual Funds, Equity, FDs, Retirement Accounts, Bank Savings</p>
                            </div>
                            <div className="ms-donut-legend-card">
                                <div className="ms-donut-legend-header">
                                    <span className="ms-donut-legend-dot" style={{ background: LEGACY_COLOR }} />
                                    <h4>Legacy Assets</h4>
                                    <span className="ms-donut-legend-pct" style={{ color: LEGACY_COLOR }}>{Math.round(assetClassification.legacyPercent)}%</span>
                                </div>
                                <p className="ms-donut-desc">Assets that pass to next generations — Residential Property, Land, Gold, Vehicles</p>
                            </div>
                        </div>
                    </div>
                )}
            </RevealSection>

            {/* THE PROBLEM — Insight Callout (Moved Up) */}
            {assetClassification.grandTotal > 0 && assetClassification.legacyPercent > 50 && (
                <RevealSection className="ms-problem-callout" delay={300}>
                    <div className="ms-problem-icon">
                        <AlertTriangle size={28} />
                    </div>
                    <div className="ms-problem-content">
                        <h3 className="ms-problem-title">Your lake is frozen.</h3>
                        <p className="ms-problem-text">
                            Most of what you own — your home, gold, land — can't be sold or reinvested without disrupting your life. Only about <strong>{fractionalPhrase}</strong> of your net worth is actually working for you, growing and generating income. To build long-term financial freedom, focus new savings toward income-generating assets like mutual funds, equity, and retirement accounts.
                        </p>
                    </div>
                </RevealSection>
            )}

            {assetClassification.grandTotal > 0 && assetClassification.legacyPercent <= 50 && (
                <RevealSection className="ms-problem-callout ms-healthy-callout" delay={300}>
                    <div className="ms-problem-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <TrendingUp size={28} />
                    </div>
                    <div className="ms-problem-content">
                        <h3 className="ms-problem-title" style={{ color: '#10B981' }}>Your wealth is working for you.</h3>
                        <p className="ms-problem-text">
                            <strong>{Math.round(assetClassification.incomePercent)}%</strong> of your wealth is in <strong>Income Assets</strong> — 
                            investments that actively grow and compound. This is a healthy portfolio balance. Continue building 
                            wealth through systematic investments to maintain this momentum.
                        </p>
                    </div>
                </RevealSection>
            )}

            {/* Assets & Liabilities Breakdown — Two-column */}
            <RevealSection className="ms-balance-sheet" delay={300}>
                <div className="ms-balance-col">
                    <div className="ms-balance-header">
                        <Layers size={20} style={{ color: '#10B981' }} />
                        <h3>Assets</h3>
                        <span className="ms-balance-total">{formatCurrency(assetResults.totalAssets)}</span>
                    </div>
                    <div className="ms-balance-items">
                        {assetBreakdown.map((item, idx) => (
                            <div className="ms-balance-row" key={idx}>
                                <div className="ms-balance-row-top">
                                    <span className="ms-balance-name">
                                        <span className="ms-dot" style={{ background: item.color }} />
                                        {item.name}
                                    </span>
                                    <span className="ms-balance-pct">{item.percentage}%</span>
                                </div>
                                <div className="ms-balance-bar-track">
                                    <div className="ms-balance-bar-fill" style={{ width: `${item.percentage}%`, background: item.color }} />
                                </div>
                                <span className="ms-balance-amount">{formatCurrency(item.value)}</span>
                            </div>
                        ))}
                        {assetBreakdown.length === 0 && (
                            <p className="ms-empty">No assets recorded yet.</p>
                        )}
                    </div>
                </div>

                <div className="ms-balance-col">
                    <div className="ms-balance-header">
                        <Banknote size={20} style={{ color: '#EF4444' }} />
                        <h3>Liabilities</h3>
                        <span className="ms-balance-total" style={{ color: '#EF4444' }}>{formatCurrency(assetResults.totalLiabilities)}</span>
                    </div>
                    <div className="ms-balance-items">
                        {liabilityBreakdown.map((item, idx) => (
                            <div className="ms-balance-row" key={idx}>
                                <div className="ms-balance-row-top">
                                    <span className="ms-balance-name">
                                        <span className="ms-dot" style={{ background: '#EF4444' }} />
                                        {item.name}
                                    </span>
                                    <span className="ms-balance-pct">{item.percentage}%</span>
                                </div>
                                <div className="ms-balance-bar-track">
                                    <div className="ms-balance-bar-fill" style={{ width: `${item.percentage}%`, background: '#EF4444' }} />
                                </div>
                                <span className="ms-balance-amount">{formatCurrency(item.value)}</span>
                            </div>
                        ))}
                        {liabilityBreakdown.length === 0 && (
                            <p className="ms-empty">No liabilities — debt-free! 🎉</p>
                        )}
                    </div>
                </div>
            </RevealSection>



            {/* ─── SCOPED STYLES ─── */}
            <style>{`
                .ms-container {
                    width: 100%;
                    max-width: 100%;
                    background: #ffffff;
                    padding: 0;
                    margin: 0;
                }

                /* ── Reveal Animation ── */
                .ms-reveal {
                    opacity: 0;
                    transform: translateY(32px);
                    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .ms-reveal.ms-visible {
                    opacity: 1;
                    transform: translateY(0);
                }

                /* ── Emotional Hook ── */
                .ms-hook-section {
                    text-align: center;
                    padding: 4rem 2rem 3rem;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .ms-hook-eyebrow {
                    font-size: 0.82rem;
                    font-weight: 700;
                    letter-spacing: 0.2em;
                    color: var(--color-2);
                    text-transform: uppercase;
                    margin-bottom: 1.5rem;
                }
                .ms-hook-headline {
                    font-size: clamp(1.5rem, 3vw, 2.2rem);
                    font-weight: 700;
                    color: var(--text-main);
                    line-height: 1.4;
                    margin-bottom: 1rem;
                }
                .ms-hook-amount {
                    color: var(--color-1);
                    white-space: nowrap;
                }
                .ms-hook-sub {
                    font-size: 1.15rem;
                    color: var(--text-muted);
                    font-style: italic;
                }

                /* ── Section Divider ── */
                .ms-section-divider {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    padding: 2rem 3rem;
                    margin: 1rem 0;
                }
                .ms-divider-line {
                    flex: 1;
                    height: 1px;
                    background: var(--border);
                }
                .ms-divider-label {
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                /* ── Hero Block ── */
                .ms-hero-block {
                    text-align: center;
                    padding: 2rem 2rem 3rem;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .ms-hero-number {
                    font-size: clamp(3rem, 7vw, 5.5rem);
                    font-weight: 800;
                    color: var(--color-2);
                    line-height: 1.1;
                    letter-spacing: -0.02em;
                }
                .ms-animated-counter {
                    display: inline-block;
                }
                .ms-hero-label {
                    font-size: 1.05rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    margin-top: 0.5rem;
                }
                .ms-hero-gradient-bar {
                    width: 200px;
                    height: 4px;
                    margin: 1.5rem auto 0;
                    border-radius: 2px;
                    background: linear-gradient(90deg, var(--color-2), var(--color-5), var(--color-3));
                }

                /* ── Stat Strip ── */
                .ms-stat-strip {
                    display: grid;
                    grid-template-columns: repeat(5, 1fr);
                    gap: 0;
                    max-width: 1200px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .ms-stat-card {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                    padding: 1.5rem 1.25rem;
                    position: relative;
                    border-right: 1px solid #f1f5f9;
                }
                .ms-stat-card:last-child {
                    border-right: none;
                }
                .ms-stat-accent {
                    position: absolute;
                    left: 0;
                    top: 20%;
                    bottom: 20%;
                    width: 3px;
                    border-radius: 0 3px 3px 0;
                }
                .ms-stat-icon {
                    flex-shrink: 0;
                    width: 44px;
                    height: 44px;
                    border-radius: 12px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #f8fafc;
                }
                .ms-stat-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.2rem;
                }
                .ms-stat-label {
                    font-size: 0.78rem;
                    color: var(--text-muted);
                    font-weight: 500;
                }
                .ms-stat-value {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--text-main);
                }

                /* ── Hero Yearly Projection ── */
                .ms-hero-yearly-projection {
                    font-size: 1.1rem;
                    color: var(--text-muted);
                    margin-top: 0.75rem;
                    max-width: 600px;
                    margin-left: auto;
                    margin-right: auto;
                    line-height: 1.5;
                }

                /* ── Money Flow Strip ── */
                .ms-flow-strip-section {
                    max-width: 1000px;
                    margin: 0 auto 3rem;
                    padding: 0 2rem;
                }
                .ms-section-title {
                    display: flex;
                    align-items: center;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin-bottom: 1.5rem;
                }
                .ms-flow-strip-wrapper {
                    background: #fff;
                    border: 1px solid #f1f5f9;
                    border-radius: 16px;
                    padding: 2rem;
                }
                .ms-flow-strip-bar {
                    display: flex;
                    height: 48px;
                    width: 100%;
                    border-radius: 12px;
                    overflow: hidden;
                    margin-bottom: 1.5rem;
                    background: #f1f5f9;
                }
                .ms-flow-strip-segment {
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .ms-flow-strip-label {
                    color: #fff;
                    font-weight: 700;
                    font-size: 0.9rem;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .ms-flow-strip-legend {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                    justify-content: center;
                }
                .ms-flow-strip-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    color: var(--text-main);
                    font-weight: 500;
                }
                .ms-flow-strip-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 4px;
                }

                /* ── Owned vs Financed Bar ── */
                .ms-owned-bar-wrapper {
                    max-width: 500px;
                    margin: 2rem auto 0;
                }
                .ms-owned-bar-labels {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                }
                .ms-owned-label {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-main);
                }
                .ms-dot {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    flex-shrink: 0;
                }
                .ms-owned-bar-track {
                    width: 100%;
                    height: 14px;
                    border-radius: 7px;
                    background: #f1f5f9;
                    display: flex;
                    overflow: hidden;
                }
                .ms-owned-bar-fill {
                    height: 100%;
                    transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
                }

                /* ── Unified Donut ── */
                .ms-donut-unified {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 3rem;
                    margin-top: 2.5rem;
                    flex-wrap: wrap;
                }
                .ms-donut-chart-large {
                    position: relative;
                    width: 220px;
                    height: 220px;
                    flex-shrink: 0;
                }
                .ms-donut-center {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 0.1rem;
                }
                .ms-donut-pct {
                    font-weight: 800;
                    color: var(--text-main);
                }
                .ms-donut-sub {
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .ms-donut-legend-unified {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                    max-width: 320px;
                }
                .ms-donut-legend-card {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }
                .ms-donut-legend-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }
                .ms-donut-legend-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 4px;
                }
                .ms-donut-legend-header h4 {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin: 0;
                    flex: 1;
                }
                .ms-donut-legend-pct {
                    font-size: 1.1rem;
                    font-weight: 800;
                }
                .ms-donut-desc {
                    font-size: 0.82rem;
                    color: var(--text-muted);
                    line-height: 1.5;
                    margin: 0;
                }

                /* ── Balance Sheet Two-Column ── */
                .ms-balance-sheet {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 3rem;
                    max-width: 1000px;
                    margin: 1rem auto 2rem;
                    padding: 2rem;
                }
                .ms-balance-col {
                    display: flex;
                    flex-direction: column;
                }
                .ms-balance-header {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 2px solid #f1f5f9;
                }
                .ms-balance-header h3 {
                    font-size: 1.15rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin: 0;
                    flex: 1;
                }
                .ms-balance-total {
                    font-size: 1.1rem;
                    font-weight: 800;
                    color: var(--text-main);
                }
                .ms-balance-items {
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }
                .ms-balance-row {
                    display: flex;
                    flex-direction: column;
                    gap: 0.3rem;
                }
                .ms-balance-row-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }
                .ms-balance-name {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    font-weight: 500;
                    color: var(--text-main);
                }
                .ms-balance-pct {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--text-muted);
                }
                .ms-balance-bar-track {
                    width: 100%;
                    height: 6px;
                    border-radius: 3px;
                    background: #f1f5f9;
                    overflow: hidden;
                }
                .ms-balance-bar-fill {
                    height: 100%;
                    border-radius: 3px;
                    transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .ms-balance-amount {
                    font-size: 0.82rem;
                    font-weight: 600;
                    color: var(--text-muted);
                }
                .ms-empty {
                    font-size: 0.9rem;
                    color: var(--text-muted);
                    font-style: italic;
                    padding: 1rem 0;
                }

                /* ── Problem Callout ── */
                .ms-problem-callout {
                    display: flex;
                    gap: 1.5rem;
                    max-width: 900px;
                    margin: 2rem auto 3rem;
                    padding: 2rem;
                    border-left: 4px solid #F59E0B;
                    background: linear-gradient(135deg, #FFFBEB 0%, #ffffff 100%);
                    border-radius: 0 12px 12px 0;
                }
                .ms-healthy-callout {
                    border-left-color: #10B981;
                    background: linear-gradient(135deg, #ECFDF5 0%, #ffffff 100%);
                }
                .ms-problem-icon {
                    width: 56px;
                    height: 56px;
                    border-radius: 14px;
                    background: rgba(245, 158, 11, 0.1);
                    color: #F59E0B;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .ms-problem-content {
                    flex: 1;
                }
                .ms-problem-title {
                    font-size: 1.3rem;
                    font-weight: 800;
                    color: #92400E;
                    margin: 0 0 0.75rem 0;
                }
                .ms-problem-text {
                    font-size: 0.95rem;
                    color: #78350F;
                    line-height: 1.7;
                    margin: 0;
                }
                .ms-problem-text strong {
                    color: #92400E;
                }
                .ms-healthy-callout .ms-problem-text {
                    color: #064E3B;
                }
                .ms-healthy-callout .ms-problem-text strong {
                    color: #065F46;
                }

                /* ── Responsive ── */
                @media (max-width: 768px) {
                    .ms-stat-strip {
                        grid-template-columns: repeat(2, 1fr);
                    }
                    .ms-stat-card {
                        border-right: none;
                        border-bottom: 1px solid #f1f5f9;
                    }
                    .ms-balance-sheet {
                        grid-template-columns: 1fr;
                        gap: 2rem;
                    }
                    .ms-donut-unified {
                        flex-direction: column;
                        gap: 2rem;
                    }
                    .ms-donut-legend-unified {
                        max-width: 100%;
                        align-items: center;
                        text-align: center;
                    }
                    .ms-donut-legend-header {
                        justify-content: center;
                    }
                    .ms-problem-callout {
                        flex-direction: column;
                        margin: 2rem 1rem;
                    }
                    .ms-section-divider {
                        padding: 2rem 1.5rem;
                    }
                    .ms-hook-section {
                        padding: 3rem 1.5rem 2rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default MoneyStorySection;
