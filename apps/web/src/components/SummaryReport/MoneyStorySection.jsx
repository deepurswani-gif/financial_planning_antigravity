import React, { useMemo, useEffect, useState, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import { TrendingUp, Wallet, CreditCard, PiggyBank, BarChart3, Shield, AlertTriangle, Landmark, ArrowRight, Gem, Building2, Banknote, Layers, Info } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateCashFlow, formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { calculateNetWorth } from '../AssetModule/AssetLogic';
import {
    classifyAssets,
    calculateUnallocatedSurplus,
    calculateOwnedVsFinanced,
    computeSIPProjection,
    buildWaterfallData,
    buildAssetBreakdownData,
    buildLiabilityBreakdownData,
    formatCompact
} from './MoneyStoryLogic';
import { calculateProtectionData, calculateContingencyData } from './SafetyNetLogic';
import { getEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';

/* ─────────────── Animated Counter ─────────────── */
const AnimatedCounter = ({ value, prefix = '₹', duration = 1500 }) => {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const start = 0;
                    const end = Math.abs(value);
                    const startTime = performance.now();

                    const animate = (currentTime) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / duration, 1);
                        const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
                        setDisplay(Math.round(start + (end - start) * eased));
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
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

/* ─────────────── Custom Waterfall Tooltip ─────────────── */
const WaterfallTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const data = payload[0]?.payload;
    if (!data) return null;
    return (
        <div className="ms-tooltip">
            <div className="ms-tooltip-label">{data.name}</div>
            <div className="ms-tooltip-value">{formatCurrency(data.value)}</div>
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
    } = useFinancialPlan();

    // ── Derived Calculations ──
    const cashFlowResults = useMemo(
        () => calculateCashFlow(income, expenseCategories, familyMembers),
        [income, expenseCategories, familyMembers],
    );
    const assetResults = useMemo(() => calculateNetWorth(assetCategories, liabilityCategories), [assetCategories, liabilityCategories]);

    const surplusData = useMemo(() => calculateUnallocatedSurplus(cashFlowResults), [cashFlowResults]);
    const assetClassification = useMemo(() => classifyAssets(assetCategories), [assetCategories]);
    const ownedFinanced = useMemo(() => calculateOwnedVsFinanced(assetResults.totalAssets, assetResults.totalLiabilities), [assetResults]);
    const waterfallData = useMemo(() => buildWaterfallData(cashFlowResults), [cashFlowResults]);
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
        () => calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers),
        [expenseCategories, summaryLifeCover, familyMembers]
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
            <RevealSection className="ms-hero-block">
                <div className="ms-hero-number">
                    <AnimatedCounter value={surplusData.unallocated} />
                </div>
                <p className="ms-hero-label">Unallocated Surplus / Month</p>
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
                        <span className="ms-stat-label">Total Monthly Expenses</span>
                        <span className="ms-stat-value">{formatCurrency(cashFlowResults.totalExpenses)}</span>
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
                    <div className="ms-stat-accent" style={{ background: '#6366F1' }} />
                    <div className="ms-stat-icon" style={{ color: '#6366F1' }}><PiggyBank size={22} /></div>
                    <div className="ms-stat-info">
                        <span className="ms-stat-label">Total Monthly Savings</span>
                        <span className="ms-stat-value">{formatCurrency(cashFlowResults.totalSavings)}</span>
                    </div>
                </div>
            </RevealSection>

            {/* Waterfall Chart */}
            <RevealSection className="ms-waterfall-section" delay={300}>
                <h3 className="ms-section-title">
                    <BarChart3 size={20} style={{ marginRight: '0.5rem', color: 'var(--color-2)' }} />
                    How Your Income Flows
                </h3>
                <div className="ms-waterfall-chart">
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={waterfallData} margin={{ top: 20, right: 30, left: 20, bottom: 10 }} barCategoryGap="25%">
                            <XAxis
                                dataKey="name"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#64748b', fontSize: 13, fontWeight: 600 }}
                            />
                            <YAxis
                                tickFormatter={(val) => formatCompact(val)}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: '#94a3b8', fontSize: 12 }}
                            />
                            <Tooltip content={<WaterfallTooltip />} cursor={false} />
                            {/* Invisible base bar */}
                            <Bar dataKey="base" stackId="waterfall" fill="transparent" radius={0} />
                            {/* Visible value bar */}
                            <Bar dataKey="value" stackId="waterfall" radius={[6, 6, 0, 0]}>
                                {waterfallData.map((entry, index) => (
                                    <Cell key={index} fill={entry.fill} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </RevealSection>

            {/* Surplus Distribution Suggestions */}
            {surplusData.unallocated > 0 && (
                <RevealSection className="ms-suggestions-section" delay={400}>
                    <div className="ms-suggestions-intro">
                        <p className="ms-suggestions-headline">
                            <span className="ms-suggestions-amount">{formatCurrency(surplusData.unallocated)}</span> unallocated every month.
                        </p>
                        <p className="ms-suggestions-sub">
                            That's <strong>{formatCurrency(surplusData.yearlyUnallocated)}</strong> yearly — enough to fund your wealth building, protection gap and emergency reserves.
                        </p>
                    </div>

                    <div className="ms-suggestions-grid">
                        {/* SIP / Wealth Building */}
                        <div className="ms-suggestion-card">
                            <div className="ms-suggestion-icon" style={{ background: 'rgba(0, 169, 242, 0.1)', color: '#00A9F2' }}>
                                <TrendingUp size={28} />
                            </div>
                            <h4 className="ms-suggestion-title">Wealth Building via SIP</h4>
                            <p className="ms-suggestion-desc">
                                A monthly SIP of your unallocated surplus <strong>{formatCurrency(surplusData.unallocated)}</strong> at
                                12% expected returns could grow to
                            </p>
                            <div className="ms-suggestion-highlight">
                                {formatCompact(sipProjection.futureValue)}
                            </div>
                            <p className="ms-suggestion-tenure">in {yearsToRetirement} years (till retirement)</p>
                            <div className="ms-suggestion-note">
                                <Info size={14} />
                                <span>Assumed at 12% p.a. CAGR. Actual returns may vary based on market conditions.</span>
                            </div>
                        </div>

                        {/* Family Protection */}
                        <div className="ms-suggestion-card">
                            <div className="ms-suggestion-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                                <Shield size={28} />
                            </div>
                            <h4 className="ms-suggestion-title">Family Protection Needs</h4>
                            <p className="ms-suggestion-desc">
                                A term insurance plan can secure your family's financial future against life's uncertainties. Adequate life cover protects household expenses, EMIs, and children's education.
                            </p>
                            <div className="ms-suggestion-highlight" style={{ color: protectionData.hasGap ? '#EF4444' : '#10B981' }}>
                                {protectionData.hasGap ? formatCurrency(protectionData.protectionGap) : 'Fully Covered'}
                            </div>
                            <p className="ms-suggestion-tenure">
                                {protectionData.hasGap ? 'Protection gap to close' : 'No protection gap'}
                            </p>
                            <div className="ms-suggestion-note">
                                <Info size={14} />
                                <span>Based on {protectionData.multiplier}× monthly expenses vs your current life cover of {formatCurrency(protectionData.coverageHave)}.</span>
                            </div>
                        </div>

                        {/* Contingency / Emergency */}
                        <div className="ms-suggestion-card">
                            <div className="ms-suggestion-icon" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#F59E0B' }}>
                                <AlertTriangle size={28} />
                            </div>
                            <h4 className="ms-suggestion-title">Contingency Planning</h4>
                            <p className="ms-suggestion-desc">
                                An emergency fund of 3–6 months of expenses ensures you can handle medical emergencies, job transitions, or unexpected events without breaking your investment portfolio.
                            </p>
                            <div className="ms-suggestion-highlight" style={{ color: contingencyData.gap > 0 ? '#EF4444' : '#10B981' }}>
                                {contingencyData.gap > 0 ? formatCurrency(contingencyData.gap) : 'Fully Funded'}
                            </div>
                            <p className="ms-suggestion-tenure">
                                {contingencyData.gap > 0 ? 'Emergency fund gap to build' : 'Emergency fund on target'}
                            </p>
                            <div className="ms-suggestion-note">
                                <Info size={14} />
                                <span>Target: 6 months of household expenses + EMIs ({formatCurrency(contingencyData.emergencyFundNeeded)}). Currently available: {formatCurrency(contingencyData.emergencyFundHave)}.</span>
                            </div>
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

                {/* Donut pair */}
                {assetClassification.grandTotal > 0 && (
                    <div className="ms-donut-pair">
                        <div className="ms-donut-item">
                            <div className="ms-donut-chart">
                                <ResponsiveContainer width={160} height={160}>
                                    <PieChart>
                                        <Pie
                                            data={incomeVsLegacyData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={75}
                                            paddingAngle={3}
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
                                    <span className="ms-donut-pct">{Math.round(assetClassification.incomePercent)}%</span>
                                    <span className="ms-donut-sub">Income</span>
                                </div>
                            </div>
                            <div className="ms-donut-meta">
                                <h4 style={{ color: INCOME_COLOR }}>Income Assets</h4>
                                <p className="ms-donut-amount">{formatCurrency(assetClassification.incomeTotal)}</p>
                                <p className="ms-donut-desc">Assets delivering predictable cash — Mutual Funds, Equity, FDs, Retirement Accounts, Bank Savings</p>
                            </div>
                        </div>
                        <div className="ms-donut-separator" />
                        <div className="ms-donut-item">
                            <div className="ms-donut-chart">
                                <ResponsiveContainer width={160} height={160}>
                                    <PieChart>
                                        <Pie
                                            data={incomeVsLegacyData}
                                            cx="50%"
                                            cy="50%"
                                            innerRadius={55}
                                            outerRadius={75}
                                            paddingAngle={3}
                                            dataKey="value"
                                            stroke="none"
                                            startAngle={90}
                                            endAngle={-270}
                                        >
                                            {incomeVsLegacyData.map((entry, i) => (
                                                <Cell key={i} fill={entry.name === 'Legacy Assets' ? '#64748B' : '#E2E8F0'} />
                                            ))}
                                        </Pie>
                                    </PieChart>
                                </ResponsiveContainer>
                                <div className="ms-donut-center">
                                    <span className="ms-donut-pct">{Math.round(assetClassification.legacyPercent)}%</span>
                                    <span className="ms-donut-sub">Legacy</span>
                                </div>
                            </div>
                            <div className="ms-donut-meta">
                                <h4 style={{ color: '#64748B' }}>Legacy Assets</h4>
                                <p className="ms-donut-amount">{formatCurrency(assetClassification.legacyTotal)}</p>
                                <p className="ms-donut-desc">Assets that pass to next generations — Residential Property, Land, Gold, Vehicles</p>
                            </div>
                        </div>
                    </div>
                )}
            </RevealSection>

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

            {/* THE PROBLEM — Insight Callout */}
            {assetClassification.grandTotal > 0 && assetClassification.legacyPercent > 50 && (
                <RevealSection className="ms-problem-callout" delay={400}>
                    <div className="ms-problem-icon">
                        <AlertTriangle size={28} />
                    </div>
                    <div className="ms-problem-content">
                        <h3 className="ms-problem-title">Your lake is frozen.</h3>
                        <p className="ms-problem-text">
                            <strong>{Math.round(assetClassification.legacyPercent)}%</strong> of your wealth consists of <strong>Legacy Assets</strong> — 
                            these are assets like your residential property, gold, and land that are typically never sold. They are emotionally
                            important and pass to the next generation, but they <em>don't generate regular income</em> or compound your wealth.
                        </p>
                        <p className="ms-problem-text" style={{ marginTop: '0.75rem' }}>
                            Only <strong>{Math.round(assetClassification.incomePercent)}%</strong> is in <strong>Income Assets</strong> — 
                            investments like Mutual Funds, Equity, Fixed Deposits, and Retirement Accounts that <em>actively grow</em> and 
                            deliver returns. To build long-term financial freedom, aim to increase the proportion of income-generating assets.
                        </p>
                    </div>
                </RevealSection>
            )}

            {assetClassification.grandTotal > 0 && assetClassification.legacyPercent <= 50 && (
                <RevealSection className="ms-problem-callout ms-healthy-callout" delay={400}>
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
                    grid-template-columns: repeat(4, 1fr);
                    gap: 0;
                    max-width: 1000px;
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

                /* ── Waterfall Chart ── */
                .ms-waterfall-section {
                    max-width: 900px;
                    margin: 0 auto 2rem;
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
                .ms-waterfall-chart {
                    width: 100%;
                }
                .ms-tooltip {
                    background: var(--text-main);
                    color: white;
                    padding: 0.6rem 1rem;
                    border-radius: 8px;
                    font-size: 0.85rem;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                }
                .ms-tooltip-label {
                    font-weight: 600;
                    margin-bottom: 0.2rem;
                }
                .ms-tooltip-value {
                    font-weight: 700;
                    font-size: 1rem;
                }

                /* ── Suggestions Section ── */
                .ms-suggestions-section {
                    max-width: 1000px;
                    margin: 1rem auto 2rem;
                    padding: 0 2rem;
                }
                .ms-suggestions-intro {
                    text-align: center;
                    margin-bottom: 2.5rem;
                    padding: 2rem;
                    background: linear-gradient(135deg, #f0f9ff 0%, #f8fafc 100%);
                    border-radius: 16px;
                }
                .ms-suggestions-headline {
                    font-size: 1.3rem;
                    color: var(--text-main);
                    font-weight: 600;
                    margin-bottom: 0.5rem;
                }
                .ms-suggestions-amount {
                    color: var(--color-2);
                    font-weight: 800;
                }
                .ms-suggestions-sub {
                    font-size: 1rem;
                    color: var(--text-muted);
                    line-height: 1.6;
                }
                .ms-suggestions-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                }
                .ms-suggestion-card {
                    padding: 2rem 1.5rem;
                    border: 1px solid #f1f5f9;
                    border-radius: 16px;
                    text-align: center;
                    transition: all 0.3s ease;
                    background: #ffffff;
                }
                .ms-suggestion-card:hover {
                    box-shadow: 0 8px 30px rgba(0,0,0,0.06);
                    transform: translateY(-4px);
                }
                .ms-suggestion-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0 auto 1rem;
                }
                .ms-suggestion-title {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin-bottom: 0.75rem;
                }
                .ms-suggestion-desc {
                    font-size: 0.88rem;
                    color: var(--text-muted);
                    line-height: 1.6;
                    margin-bottom: 0.75rem;
                }
                .ms-suggestion-highlight {
                    font-size: 1.6rem;
                    font-weight: 800;
                    color: var(--color-1);
                    margin: 0.75rem 0 0.25rem;
                }
                .ms-suggestion-tenure {
                    font-size: 0.82rem;
                    color: var(--text-muted);
                    margin-bottom: 0.75rem;
                }
                .ms-suggestion-note {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    text-align: left;
                    padding: 0.75rem;
                    background: #f8fafc;
                    border-radius: 8px;
                    line-height: 1.5;
                    margin-top: 0.75rem;
                }
                .ms-suggestion-note svg {
                    flex-shrink: 0;
                    margin-top: 1px;
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

                /* ── Donut Pair ── */
                .ms-donut-pair {
                    display: flex;
                    align-items: flex-start;
                    justify-content: center;
                    gap: 2rem;
                    margin-top: 2.5rem;
                    flex-wrap: wrap;
                }
                .ms-donut-separator {
                    width: 1px;
                    height: 200px;
                    background: #f1f5f9;
                    align-self: center;
                }
                .ms-donut-item {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    min-width: 300px;
                }
                .ms-donut-chart {
                    position: relative;
                    width: 160px;
                    height: 160px;
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
                    font-size: 1.4rem;
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
                .ms-donut-meta h4 {
                    font-size: 1rem;
                    font-weight: 700;
                    margin-bottom: 0.25rem;
                }
                .ms-donut-amount {
                    font-size: 1.2rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin-bottom: 0.5rem;
                }
                .ms-donut-desc {
                    font-size: 0.82rem;
                    color: var(--text-muted);
                    line-height: 1.5;
                    max-width: 220px;
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
                    .ms-suggestions-grid {
                        grid-template-columns: 1fr;
                    }
                    .ms-balance-sheet {
                        grid-template-columns: 1fr;
                        gap: 2rem;
                    }
                    .ms-donut-pair {
                        flex-direction: column;
                        align-items: center;
                    }
                    .ms-donut-separator {
                        width: 60%;
                        height: 1px;
                    }
                    .ms-donut-item {
                        flex-direction: column;
                        text-align: center;
                        min-width: unset;
                    }
                    .ms-donut-meta {
                        text-align: center;
                    }
                    .ms-donut-desc {
                        max-width: 100%;
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
