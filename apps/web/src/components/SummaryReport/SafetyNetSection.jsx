import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon, Umbrella, Wallet, Clock, TrendingDown, CheckCircle2, ArrowRight, Info, Target, Heart } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import {
    calculateProtectionData,
    calculateContingencyData,
    calculateHealthInsuranceData,
    buildCrisisTimeline,
    formatCompactSN
} from './SafetyNetLogic';
import { getEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';
import { buildSafetyNetSignals } from '../../recommendationRegistry/adapters/safetyNetAdapter';
import { useRecommendationStore } from '../../recommendationOrchestration';
import { RecommendationList } from '../../recommendationPresentation';
import { useLaunchRecommendationAction } from '../FinancialWorkspace/FinancialWorkspaceContext';
import { getInsuranceMonthlyTotal } from '../DetailedFlow/insuranceDetailSync';
import DetailedHubCTA from '../DetailedHub/DetailedHubCTA';

// Scope the orchestration store to this report so incomplete (safety-net-only)
// signals never surface unrelated recommendations. Module-level constant keeps a
// stable reference across renders.
const SAFETY_NET_REPORTS = ['safety_net'];

/* ─────────────── Animated Counter ─────────────── */
const AnimatedCounter = ({ value, prefix = '', suffix = '', duration = 1500, decimals = 0 }) => {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);
    const isVisible = useRef(false);
    const displayRef = useRef(0);
    const rafRef = useRef(null);
    const valueRef = useRef(value);
    const durationRef = useRef(duration);
    const decimalsRef = useRef(decimals);

    valueRef.current = value;
    durationRef.current = duration;
    decimalsRef.current = decimals;

    const animateTo = (end) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const start = displayRef.current;
        const animDuration = durationRef.current;
        const animDecimals = decimalsRef.current;
        const startTime = performance.now();

        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / animDuration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const current = start + (end - start) * eased;
            const next = animDecimals > 0
                ? Math.round(current * Math.pow(10, animDecimals)) / Math.pow(10, animDecimals)
                : Math.round(current);
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
    }, [value, duration, decimals]);

    const formatted = decimals > 0 ? display.toFixed(decimals) : new Intl.NumberFormat('en-IN').format(display);
    return (
        <span ref={ref} className="sn-animated-counter">
            {prefix}{formatted}{suffix}
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
        <div ref={ref} className={`sn-reveal ${visible ? 'sn-visible' : ''} ${className}`}>
            {children}
        </div>
    );
};

/* ─────────────── Animated SVG Gauge ─────────────── */
const CircularGauge = ({ percent, size = 220, strokeWidth = 18 }) => {
    const [animatedPercent, setAnimatedPercent] = useState(0);
    const ref = useRef(null);
    const isVisible = useRef(false);
    const percentDisplayRef = useRef(0);
    const rafRef = useRef(null);
    const percentRef = useRef(percent);

    percentRef.current = percent;

    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (animatedPercent / 100) * circumference;

    // Determine color based on coverage
    const getColor = (p) => {
        if (p >= 80) return '#10B981';
        if (p >= 40) return '#F59E0B';
        return '#EF4444';
    };

    const getGlow = (p) => {
        if (p >= 80) return 'rgba(16, 185, 129, 0.3)';
        if (p >= 40) return 'rgba(245, 158, 11, 0.3)';
        return 'rgba(239, 68, 68, 0.3)';
    };

    const animateTo = (end) => {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        const start = percentDisplayRef.current;
        const startTime = performance.now();
        const animate = (currentTime) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / 1500, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            const next = start + (end - start) * eased;
            percentDisplayRef.current = next;
            setAnimatedPercent(next);
            if (progress < 1) rafRef.current = requestAnimationFrame(animate);
        };
        rafRef.current = requestAnimationFrame(animate);
    };

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !isVisible.current) {
                    isVisible.current = true;
                    animateTo(percentRef.current);
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
            animateTo(percent);
        }
    }, [percent]);

    const color = getColor(percent);
    const glow = getGlow(percent);

    return (
        <div ref={ref} className="sn-gauge-wrapper" style={{ width: size, height: size }}>
            <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
                <defs>
                    <filter id="gaugeGlow">
                        <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                        <feMerge>
                            <feMergeNode in="coloredBlur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>
                {/* Background track */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke="#f1f5f9"
                    strokeWidth={strokeWidth}
                />
                {/* Animated fill arc */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth={strokeWidth}
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    transform={`rotate(-90 ${size / 2} ${size / 2})`}
                    style={{
                        transition: 'stroke-dashoffset 0.05s linear',
                        filter: `drop-shadow(0 0 8px ${glow})`
                    }}
                />
            </svg>
            <div className="sn-gauge-center">
                <span className="sn-gauge-pct" style={{ color }}>{Math.round(animatedPercent)}%</span>
                <span className="sn-gauge-sub">COVERED</span>
            </div>
        </div>
    );
};

/* ─────────────── Timeline Stage Icon ─────────────── */
const StageIcon = ({ icon, color }) => {
    const iconMap = {
        'shield-check': <ShieldCheck size={20} />,
        'alert-triangle': <AlertTriangle size={20} />,
        'umbrella': <Umbrella size={20} />,
        'alert-octagon': <AlertOctagon size={20} />
    };
    return (
        <div className="sn-timeline-icon" style={{ background: color, boxShadow: `0 0 20px ${color}40` }}>
            {iconMap[icon] || <Shield size={20} />}
        </div>
    );
};

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════════ */
const SafetyNetSection = () => {
    const { user } = useAuth();
    const {
        familyMembers,
        expenseCategories,
        summaryLifeCover,
        summaryHealthCover,
        hasHealthInsurance,
        contingencyFund,
        assetCategories,
        policies,
    } = useFinancialPlan();

    // ── Derived Calculations ──
    const protectionData = useMemo(
        () => calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers, policies),
        [expenseCategories, summaryLifeCover, familyMembers, policies]
    );

    const contingencyData = useMemo(() => {
        const emergencyCash = getEmergencyFundAmount(assetCategories, contingencyFund);
        return calculateContingencyData(expenseCategories, emergencyCash, familyMembers);
    }, [expenseCategories, contingencyFund, assetCategories, familyMembers]);

    const healthData = useMemo(
        () => calculateHealthInsuranceData(summaryHealthCover, hasHealthInsurance, familyMembers, policies),
        [summaryHealthCover, hasHealthInsurance, familyMembers, policies]
    );

    const crisisTimeline = useMemo(
        () => buildCrisisTimeline(contingencyData, protectionData),
        [contingencyData, protectionData]
    );

    // The Orchestration Engine owns trigger evaluation, deduplication, ordering,
    // lifecycle and CTA resolution. This report only requests active instances
    // and renders them through the Recommendation Presentation System.
    const recommendationSignals = useMemo(
        () => buildSafetyNetSignals({ protectionData, contingencyData, healthData }),
        [protectionData, contingencyData, healthData]
    );
    const recommendationStore = useRecommendationStore(recommendationSignals, {
        reports: SAFETY_NET_REPORTS,
    });
    const recoveryRecommendations = recommendationStore.getByReport('safety_net');
    const launchRecommendationAction = useLaunchRecommendationAction();

    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self');
    const userName = selfMember?.name?.split(' ')[0] || 'there';

    const hasAnyGap = protectionData.hasGap || contingencyData.gap > 0 || healthData.hasGap;

    // ── No data guard ──
    if (!protectionData.hasData) {
        return (
            <div className="sn-container">
                <div className="sn-empty-state">
                    <ShieldAlert size={56} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <h2>Complete Your Expense Details First</h2>
                    <p>We need your monthly household expenses and EMI details to calculate your family's safety net. Please go back and fill in the Cash Flow section.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="sn-container">

            {/* ══════════════════════════════════════════════
                EMOTIONAL HOOK HEADER
               ══════════════════════════════════════════════ */}
            <RevealSection className="sn-hook-section">
                <p className="sn-hook-eyebrow">THE SAFETY NET</p>
                {hasAnyGap ? (
                    <>
                        <h1 className="sn-hook-headline">
                            {userName}, Your Family's Safety Net Has Some Gaps
                        </h1>
                        <p className="sn-hook-sub">
                            Wealth creation alone does not define financial security. Right now, your protection and emergency reserves need attention. Life cover pays out only on the insured member's death — if any earning member is underinsured, the household faces that crisis alone. Addressing these gaps proactively will give you something money can't buy — <span className="sn-hook-emphasis">genuine peace of mind</span>.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="sn-hook-headline">
                            {userName}, Your Family's Safety Net is Strong
                        </h1>
                        <p className="sn-hook-sub">
                            You've built a solid foundation of protection and emergency reserves. Your family is well-positioned to handle life's uncertainties. That's the kind of security that lets you focus on growth.
                        </p>
                    </>
                )}
            </RevealSection>

            {!getInsuranceMonthlyTotal(expenseCategories?.insurance || {}) && (
                <div style={{ padding: '0 2rem', maxWidth: '800px', margin: '0 auto' }}>
                    <DetailedHubCTA 
                        message="Want a more accurate Safety Net? Update your insurance details in your Financial Profile."
                        buttonText="Update Now"
                    />
                </div>
            )}

            {/* ══════════════════════════════════════════════
                SECTION 1 — LONG-TERM SECURITY (PROTECTION)
               ══════════════════════════════════════════════ */}
            <div className="sn-section-divider">
                <div className="sn-divider-line" />
                <span className="sn-divider-label">LONG-TERM SECURITY — Protection</span>
                <div className="sn-divider-line" />
            </div>

            {/* Hero: Coverage Gauge — weakest earning member */}
            <RevealSection className="sn-hero-block">
                <CircularGauge percent={protectionData.coveredPercent} />
                <p className="sn-gauge-caption">
                    {protectionData.spouse
                        ? `Based on ${protectionData.weakestName}'s cover — the household is only as protected as the least-covered earning member`
                        : 'Your life cover vs household protection need'}
                </p>
                <div className="sn-hero-gradient-bar" />
            </RevealSection>

            {/* Shared household HLV target */}
            <RevealSection className="sn-stat-strip-3" delay={200}>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                        <Target size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Coverage Required</span>
                    <span className="sn-stat-glass-value">{formatCurrency(protectionData.coverageRequired)}</span>
                    <span className="sn-stat-glass-note">Per earning member · {protectionData.multiplier}× monthly expenses</span>
                </div>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <ShieldCheck size={22} />
                    </div>
                    <span className="sn-stat-glass-label">
                        {protectionData.spouse ? `${protectionData.weakestName}'s Cover` : 'Coverage You Have'}
                    </span>
                    <span className="sn-stat-glass-value">{formatCurrency(protectionData.coverageHave)}</span>
                    <span className="sn-stat-glass-note">
                        {protectionData.spouse
                            ? 'Payout if this member dies (weakest link)'
                            : 'Life cover on you'}
                    </span>
                </div>
                <div className="sn-stat-card-glass" style={{ borderColor: protectionData.hasGap ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }}>
                    <div className="sn-stat-glass-icon" style={{ background: protectionData.hasGap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: protectionData.hasGap ? '#EF4444' : '#10B981' }}>
                        {protectionData.hasGap ? <TrendingDown size={22} /> : <CheckCircle2 size={22} />}
                    </div>
                    <span className="sn-stat-glass-label">Total Term to Buy</span>
                    <span className="sn-stat-glass-value" style={{ color: protectionData.hasGap ? '#EF4444' : '#10B981' }}>
                        {protectionData.hasGap ? formatCurrency(protectionData.protectionGap) : 'Nil ✓'}
                    </span>
                    <span className="sn-stat-glass-note">
                        {protectionData.hasGap
                            ? (protectionData.spouse ? 'Sum of self + spouse gaps' : 'Needs immediate attention')
                            : 'Fully covered'}
                    </span>
                </div>
            </RevealSection>

            {/* Per earning member breakdown */}
            <RevealSection
                className={`sn-member-gap-grid${protectionData.spouse ? '' : ' sn-member-gap-grid--single'}`}
                delay={250}
            >
                {[protectionData.self, protectionData.spouse].filter(Boolean).map((member) => (
                    <div
                        key={member.role}
                        className="sn-member-gap-card"
                        style={{
                            borderColor: member.isGap ? 'rgba(239, 68, 68, 0.25)' : 'rgba(16, 185, 129, 0.25)',
                        }}
                    >
                        <div className="sn-member-gap-header">
                            <div>
                                <h3 className="sn-member-gap-title" style={{ color: member.isGap ? '#EF4444' : '#10B981' }}>
                                    {member.isGap ? <ShieldAlert size={20} /> : <ShieldCheck size={20} />}
                                    {member.role === 'self' ? 'Self' : 'Spouse'} Protection
                                </h3>
                                <p className="sn-member-gap-name">{member.name}</p>
                            </div>
                            <span
                                className="sn-member-gap-badge"
                                style={{
                                    background: member.isGap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                                    color: member.isGap ? '#EF4444' : '#10B981',
                                }}
                            >
                                {member.isGap ? 'Gap Detected' : 'Covered'}
                            </span>
                        </div>
                        <div className="sn-member-gap-stats">
                            <div>
                                <span className="sn-member-gap-stat-label">Life Cover</span>
                                <span className="sn-member-gap-stat-value">{formatCurrency(member.coverage)}</span>
                            </div>
                            <div>
                                <span className="sn-member-gap-stat-label">Need (HLV)</span>
                                <span className="sn-member-gap-stat-value">{formatCurrency(member.need)}</span>
                            </div>
                            <div>
                                <span className="sn-member-gap-stat-label">Gap</span>
                                <span
                                    className="sn-member-gap-stat-value"
                                    style={{ color: member.isGap ? '#EF4444' : '#10B981' }}
                                >
                                    {member.isGap ? formatCurrency(member.gap) : 'Nil ✓'}
                                </span>
                            </div>
                        </div>
                        <div className="sn-member-gap-bar-track">
                            <div
                                className="sn-member-gap-bar-fill"
                                style={{
                                    width: `${member.coveredPercent}%`,
                                    background: member.isGap
                                        ? 'linear-gradient(90deg, #fb7185, #f43f5e)'
                                        : 'linear-gradient(90deg, #34d399, #10b981)',
                                }}
                            />
                        </div>
                        <p className="sn-member-gap-note">
                            {member.isGap
                                ? `Buy term of ${formatCompactSN(member.gap)} on ${member.name} — only this cover pays if they die.`
                                : `${member.name}'s cover meets the household protection need.`}
                        </p>
                    </div>
                ))}
            </RevealSection>

            {/* Coverage Duration Insight */}
            <RevealSection className="sn-insight-card" delay={300}>
                <div className="sn-insight-icon-wrapper">
                    <Clock size={24} />
                </div>
                <div className="sn-insight-content">
                    <p className="sn-insight-text">
                        Life insurance pays the household only when the <em>insured</em> member dies.
                        {protectionData.spouse ? (
                            <>
                                {' '}Cover on you does not help if your spouse dies, and vice versa — each earning member needs the full household target of{' '}
                                <span className="sn-insight-highlight">{formatCurrency(protectionData.coverageRequired)}</span>.
                            </>
                        ) : (
                            <>
                                {' '}Your current sum insured will cover{' '}
                                <span className="sn-insight-highlight">
                                    {formatCompactSN(protectionData.annualNeed)}{' '}
                                    ({new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(protectionData.monthlyNeed)} X 12)
                                </span>{' '}
                                annual need for{' '}
                                <span className="sn-insight-highlight">{protectionData.yearsCovered} years</span>{' '}
                                <span className="sn-insight-months">({protectionData.monthsCovered} Months)</span>.
                            </>
                        )}
                    </p>
                    {protectionData.spouse && (
                        <p className="sn-insight-text" style={{ marginTop: '0.75rem' }}>
                            If <span className="sn-insight-highlight">{protectionData.weakestName}</span> passed away tomorrow,
                            their cover of {formatCurrency(protectionData.coverageHave)} would support annual needs for about{' '}
                            <span className="sn-insight-highlight">{protectionData.yearsCovered} years</span>{' '}
                            <span className="sn-insight-months">({protectionData.monthsCovered} Months)</span>.
                        </p>
                    )}
                </div>
            </RevealSection>

            {/* Year Coverage Bar */}
            <RevealSection className="sn-year-bar-section" delay={400}>
                <h4 className="sn-year-bar-title">Coverage Duration Timeline</h4>
                <div className="sn-year-bar-container">
                    {(() => {
                        const maxYears = Math.max(Math.ceil(protectionData.yearsCovered) + 2, 10);
                        const coveredWidth = Math.min(100, (protectionData.yearsCovered / maxYears) * 100);
                        const markers = [];
                        for (let i = 0; i <= maxYears; i += Math.max(1, Math.floor(maxYears / 10))) {
                            markers.push(i);
                        }
                        return (
                            <>
                                <div className="sn-year-bar-track">
                                    <div
                                        className="sn-year-bar-fill"
                                        style={{
                                            width: `${coveredWidth}%`,
                                            background: protectionData.yearsCovered >= 15
                                                ? 'linear-gradient(90deg, #10B981, #059669)'
                                                : protectionData.yearsCovered >= 5
                                                ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                                                : 'linear-gradient(90deg, #EF4444, #DC2626)'
                                        }}
                                    >
                                        <span className="sn-year-bar-label">{protectionData.yearsCovered} yrs</span>
                                    </div>
                                </div>
                                <div className="sn-year-bar-markers">
                                    {markers.map(yr => (
                                        <span key={yr} className="sn-year-marker">{yr}y</span>
                                    ))}
                                </div>
                            </>
                        );
                    })()}
                </div>
            </RevealSection>

            {/* ══════════════════════════════════════════════
                SECTION 2 — SHORT-TERM SURVIVAL (CONTINGENCY)
               ══════════════════════════════════════════════ */}
            <div className="sn-section-divider" style={{ marginTop: '4rem' }}>
                <div className="sn-divider-line" />
                <span className="sn-divider-label">SHORT-TERM SURVIVAL — Contingency</span>
                <div className="sn-divider-line" />
            </div>

            <RevealSection className="sn-hero-block">
                <p className="sn-contingency-question">
                    For how many months can your family comfortably manage its expenses using the money available today?
                </p>
                <div className="sn-hero-number" style={{
                    color: contingencyData.monthsCoveredByFund >= 6 ? '#10B981'
                        : contingencyData.monthsCoveredByFund >= 3 ? '#F59E0B' : '#EF4444'
                }}>
                    <AnimatedCounter
                        value={contingencyData.monthsCoveredByFund}
                        decimals={1}
                    />
                    <span className="sn-hero-unit">MONTHS</span>
                </div>
                <div className="sn-hero-gradient-bar" />
            </RevealSection>

            {/* Narrative */}
            <RevealSection className="sn-narrative-block" delay={200}>
                <p className="sn-narrative-text">
                    With monthly expenses and EMIs totalling{' '}
                    <strong>{formatCurrency(contingencyData.monthlyNeed)}</strong>
                    {' '}and emergency reserves of{' '}
                    <strong>{formatCurrency(contingencyData.emergencyFundHave)}</strong>, your current reserves may provide
                    financial support for about{' '}
                    <span className="sn-narrative-accent">{contingencyData.daysCovered} days</span>.
                    {contingencyData.daysCovered < 180 && (
                        <> Beyond this period, maintaining the same lifestyle could become challenging for your family.</>
                    )}
                </p>
                <p className="sn-narrative-note">
                    <Info size={14} />
                    <span>
                        Runway = emergency fund ({formatCurrency(contingencyData.emergencyFundHave)})
                        {' ÷ '}
                        monthly expenses + EMIs ({formatCurrency(contingencyData.monthlyNeed)}).
                    </span>
                </p>
            </RevealSection>

            {/* Contingency Stat Cards */}
            <RevealSection className="sn-stat-strip-3" delay={300}>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(0, 169, 242, 0.1)', color: '#00A9F2' }}>
                        <Target size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Emergency Fund Needed</span>
                    <span className="sn-stat-glass-value">{formatCurrency(contingencyData.emergencyFundNeeded)}</span>
                    <span className="sn-stat-glass-note">6 months × {formatCurrency(contingencyData.monthlyNeed)}</span>
                </div>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <Wallet size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Emergency Fund Available</span>
                    <span className="sn-stat-glass-value">{formatCurrency(contingencyData.emergencyFundHave)}</span>
                    <span className="sn-stat-glass-note">Currently set aside</span>
                </div>
                <div className="sn-stat-card-glass" style={{ borderColor: contingencyData.gap > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }}>
                    <div className="sn-stat-glass-icon" style={{ background: contingencyData.gap > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: contingencyData.gap > 0 ? '#EF4444' : '#10B981' }}>
                        {contingencyData.gap > 0 ? <TrendingDown size={22} /> : <CheckCircle2 size={22} />}
                    </div>
                    <span className="sn-stat-glass-label">Gap</span>
                    <span className="sn-stat-glass-value" style={{ color: contingencyData.gap > 0 ? '#EF4444' : '#10B981' }}>
                        {contingencyData.gap > 0 ? formatCurrency(contingencyData.gap) : 'Nil ✓'}
                    </span>
                    <span className="sn-stat-glass-note">{contingencyData.gap > 0 ? 'Needs to be built' : 'Well maintained'}</span>
                </div>
            </RevealSection>

            {/* Runway Meter */}
            <RevealSection className="sn-runway-section" delay={400}>
                <h4 className="sn-runway-title">Emergency Runway — 6 Month Target</h4>
                <div className="sn-runway-bar">
                    {[1, 2, 3, 4, 5, 6].map(month => {
                        const isCovered = contingencyData.monthsCoveredByFund >= month;
                        const isPartial = !isCovered && contingencyData.monthsCoveredByFund > month - 1;
                        const partialWidth = isPartial ? ((contingencyData.monthsCoveredByFund - (month - 1)) * 100) : 0;

                        return (
                            <div key={month} className="sn-runway-segment">
                                <div className={`sn-runway-cell ${isCovered ? 'sn-runway-filled' : ''}`}>
                                    {isPartial && (
                                        <div className="sn-runway-partial" style={{ width: `${partialWidth}%` }} />
                                    )}
                                </div>
                                <span className="sn-runway-label">M{month}</span>
                            </div>
                        );
                    })}
                </div>
                <div className="sn-runway-legend">
                    <span className="sn-runway-legend-item">
                        <span className="sn-runway-dot sn-runway-dot-filled" />
                        Covered
                    </span>
                    <span className="sn-runway-legend-item">
                        <span className="sn-runway-dot sn-runway-dot-empty" />
                        Not Covered
                    </span>
                </div>
            </RevealSection>

            {/* ══════════════════════════════════════════════
                SECTION 3 — COMBINED CRISIS SCENARIO
               ══════════════════════════════════════════════ */}
            <div className="sn-section-divider" style={{ marginTop: '4rem' }}>
                <div className="sn-divider-line" />
                <span className="sn-divider-label">CRISIS SCENARIO — What If?</span>
                <div className="sn-divider-line" />
            </div>

            <RevealSection className="sn-timeline-section" delay={100}>
                <p className="sn-timeline-intro">
                    If your income stopped today, here's how your family's financial security would unfold over time:
                </p>
                <div className="sn-timeline">
                    {crisisTimeline.map((stage, idx) => (
                        <div key={stage.id} className="sn-timeline-stage">
                            <div className="sn-timeline-left">
                                <StageIcon icon={stage.icon} color={stage.statusColor} />
                                {idx < crisisTimeline.length - 1 && (
                                    <div className="sn-timeline-connector" style={{
                                        background: `linear-gradient(${stage.statusColor}, ${crisisTimeline[idx + 1].statusColor})`
                                    }} />
                                )}
                            </div>
                            <div className="sn-timeline-right" style={{
                                background: stage.bgColor,
                                borderLeft: `3px solid ${stage.statusColor}`
                            }}>
                                <div className="sn-timeline-header">
                                    <span className="sn-timeline-duration">{stage.duration}</span>
                                    <span className="sn-timeline-badge" style={{
                                        background: `${stage.statusColor}18`,
                                        color: stage.statusColor,
                                        border: `1px solid ${stage.borderColor}`
                                    }}>
                                        Stage {stage.stage}
                                    </span>
                                </div>
                                <h4 className="sn-timeline-title">{stage.title}</h4>
                                <div className="sn-timeline-status">
                                    <ArrowRight size={14} style={{ color: stage.statusColor, flexShrink: 0 }} />
                                    <span style={{ color: stage.statusColor, fontWeight: 600 }}>{stage.status}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </RevealSection>

            {/* ══════════════════════════════════════════════
                SECTION 4 — HEALTH PROTECTION
               ══════════════════════════════════════════════ */}
            <div className="sn-section-divider" style={{ marginTop: '4rem' }}>
                <div className="sn-divider-line" />
                <span className="sn-divider-label">HEALTH PROTECTION — Medical Security</span>
                <div className="sn-divider-line" />
            </div>

            <RevealSection className="sn-hero-block">
                <p className="sn-contingency-question">
                    If a major hospitalization happened tomorrow, would your family's health cover handle it without touching savings?
                </p>
                <CircularGauge percent={healthData.coveredPercent} />
                <div className="sn-hero-gradient-bar" />
            </RevealSection>

            <RevealSection className="sn-stat-strip-3" delay={200}>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(0, 169, 242, 0.1)', color: '#00A9F2' }}>
                        <Target size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Recommended Cover</span>
                    <span className="sn-stat-glass-value">{formatCurrency(healthData.minimumRequired)}</span>
                    <span className="sn-stat-glass-note">Minimum for family health protection</span>
                </div>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <Heart size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Cover You Have</span>
                    <span className="sn-stat-glass-value">
                        {healthData.coverageHave > 0 ? formatCurrency(healthData.coverageHave) : 'None'}
                    </span>
                    <span className="sn-stat-glass-note">Personal, floater & employer cover</span>
                </div>
                <div className="sn-stat-card-glass" style={{ borderColor: healthData.hasGap ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }}>
                    <div className="sn-stat-glass-icon" style={{ background: healthData.hasGap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: healthData.hasGap ? '#EF4444' : '#10B981' }}>
                        {healthData.hasGap ? <TrendingDown size={22} /> : <CheckCircle2 size={22} />}
                    </div>
                    <span className="sn-stat-glass-label">Health Cover Gap</span>
                    <span className="sn-stat-glass-value" style={{ color: healthData.hasGap ? '#EF4444' : '#10B981' }}>
                        {healthData.hasGap ? formatCurrency(healthData.healthGap) : 'Nil ✓'}
                    </span>
                    <span className="sn-stat-glass-note">{healthData.hasGap ? 'Needs attention' : 'Meets minimum'}</span>
                </div>
            </RevealSection>

            <RevealSection className="sn-insight-card" delay={300}>
                <div className="sn-insight-icon-wrapper">
                    <Heart size={24} />
                </div>
                <div className="sn-insight-content">
                    <p className="sn-insight-text">
                        {healthData.status === 'none' && (
                            <>
                                A single major hospitalization can cost ₹3–8 Lakh or more. Without health insurance, your emergency fund and long-term goals become the first line of defence — and they get depleted fast. We recommend a minimum sum insured of{' '}
                                <span className="sn-insight-highlight">{formatCurrency(healthData.minimumRequired)}</span> for family health protection.
                            </>
                        )}
                        {healthData.status === 'partial' && (
                            <>
                                Your current cover of{' '}
                                <span className="sn-insight-highlight">{formatCurrency(healthData.coverageHave)}</span>{' '}
                                is about{' '}
                                <span className="sn-insight-highlight">{healthData.coveredPercent}%</span>{' '}
                                of the recommended minimum. A serious illness could still force you to dip into savings or take loans. Consider increasing cover by{' '}
                                <span className="sn-insight-highlight">{formatCurrency(healthData.healthGap)}</span>.
                            </>
                        )}
                        {healthData.status === 'adequate' && (
                            <>
                                Your family's health cover of{' '}
                                <span className="sn-insight-highlight">{formatCurrency(healthData.coverageHave)}</span>{' '}
                                meets the minimum of{' '}
                                <span className="sn-insight-highlight">{formatCurrency(healthData.minimumRequired)}</span>{' '}
                                we recommend. Keep policies renewed and review cover every few years as medical costs rise.
                            </>
                        )}
                    </p>
                </div>
            </RevealSection>

            <RevealSection className="sn-year-bar-section" delay={400}>
                <h4 className="sn-year-bar-title">Health Cover vs Recommended Minimum</h4>
                <div className="sn-year-bar-container">
                    <div className="sn-year-bar-track">
                        <div
                            className="sn-year-bar-fill"
                            style={{
                                width: `${Math.max(healthData.coveredPercent, healthData.coverageHave > 0 ? 8 : 0)}%`,
                                background: healthData.coveredPercent >= 100
                                    ? 'linear-gradient(90deg, #10B981, #059669)'
                                    : healthData.coveredPercent >= 40
                                    ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                                    : 'linear-gradient(90deg, #EF4444, #DC2626)'
                            }}
                        >
                            {healthData.coverageHave > 0 && (
                                <span className="sn-year-bar-label">{formatCompactSN(healthData.coverageHave)}</span>
                            )}
                        </div>
                    </div>
                    <div className="sn-year-bar-markers">
                        <span className="sn-year-marker">₹0</span>
                        <span className="sn-year-marker">{formatCompactSN(healthData.minimumRequired)}</span>
                    </div>
                </div>
            </RevealSection>

            <RevealSection className="sn-narrative-block" delay={500}>
                <p className="sn-narrative-note">
                    <Info size={14} />
                    <span>Include personal policies, family floater plans, and employer-provided cover when assessing your total health cover.</span>
                </p>
            </RevealSection>

            {/* ══════════════════════════════════════════════
                SECTION 5 — RECOVERY PLAN
               ══════════════════════════════════════════════ */}
            <div className="sn-section-divider" style={{ marginTop: '4rem' }}>
                <div className="sn-divider-line" />
                <span className="sn-divider-label">RECOVERY PLAN — Next Steps</span>
                <div className="sn-divider-line" />
            </div>

            <RevealSection className="sn-recovery-section" delay={100}>
                <RecommendationList
                    recommendations={recoveryRecommendations}
                    onPrimaryAction={launchRecommendationAction}
                    ctaContext={{
                        familyMembers,
                        user,
                        moduleName: 'Your Safety Net',
                    }}
                    density="summary"
                    emptySurface="safety_net"
                    className="sn-rec-list"
                />
            </RevealSection>

            {/* ─── SCOPED STYLES ─── */}
            <style>{`
                .sn-container {
                    width: 100%;
                    max-width: 100%;
                    background: #ffffff;
                    padding: 0;
                    margin: 0;
                }

                /* ── Empty State ── */
                .sn-empty-state {
                    text-align: center;
                    padding: 6rem 2rem;
                    max-width: 500px;
                    margin: 0 auto;
                }
                .sn-empty-state h2 {
                    font-size: 1.5rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin-bottom: 0.75rem;
                }
                .sn-empty-state p {
                    color: var(--text-muted);
                    line-height: 1.7;
                }

                /* ── Reveal Animation ── */
                .sn-reveal {
                    opacity: 0;
                    transform: translateY(32px);
                    transition: opacity 0.7s cubic-bezier(0.16, 1, 0.3, 1), transform 0.7s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .sn-reveal.sn-visible {
                    opacity: 1;
                    transform: translateY(0);
                }

                /* ── Emotional Hook ── */
                .sn-hook-section {
                    text-align: center;
                    padding: 4rem 2rem 3rem;
                    max-width: 800px;
                    margin: 0 auto;
                }
                .sn-hook-eyebrow {
                    font-size: 0.82rem;
                    font-weight: 700;
                    letter-spacing: 0.2em;
                    color: var(--color-2);
                    text-transform: uppercase;
                    margin-bottom: 1.5rem;
                }
                .sn-hook-headline {
                    font-size: clamp(1.5rem, 3vw, 2.2rem);
                    font-weight: 700;
                    color: var(--text-main);
                    line-height: 1.4;
                    margin-bottom: 1.25rem;
                }
                .sn-hook-sub {
                    font-size: 1.08rem;
                    color: var(--text-muted);
                    line-height: 1.8;
                    max-width: 680px;
                    margin: 0 auto;
                }
                .sn-hook-emphasis {
                    color: var(--color-1);
                    font-weight: 700;
                    font-style: italic;
                }

                /* ── Section Divider ── */
                .sn-section-divider {
                    display: flex;
                    align-items: center;
                    gap: 1.5rem;
                    padding: 2rem 3rem;
                    margin: 1rem 0;
                }
                .sn-divider-line {
                    flex: 1;
                    height: 1px;
                    background: var(--border);
                }
                .sn-divider-label {
                    font-size: 0.78rem;
                    font-weight: 700;
                    letter-spacing: 0.15em;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    white-space: nowrap;
                }

                /* ── Hero Block ── */
                .sn-hero-block {
                    text-align: center;
                    padding: 2rem 2rem 3rem;
                    max-width: 900px;
                    margin: 0 auto;
                }
                .sn-hero-number {
                    font-size: clamp(3rem, 8vw, 6rem);
                    font-weight: 800;
                    line-height: 1.1;
                    letter-spacing: -0.02em;
                    display: flex;
                    align-items: baseline;
                    justify-content: center;
                    gap: 0.5rem;
                }
                .sn-hero-unit {
                    font-size: clamp(1rem, 2vw, 1.5rem);
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    opacity: 0.7;
                }
                .sn-animated-counter {
                    display: inline-block;
                }
                .sn-hero-gradient-bar {
                    width: 200px;
                    height: 4px;
                    margin: 1.5rem auto 0;
                    border-radius: 2px;
                    background: linear-gradient(90deg, var(--color-2), var(--color-5), var(--color-3));
                }

                /* ── Circular Gauge ── */
                .sn-gauge-wrapper {
                    position: relative;
                    margin: 0 auto;
                }
                .sn-gauge-center {
                    position: absolute;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    text-align: center;
                    display: flex;
                    flex-direction: column;
                    gap: 0.1rem;
                }
                .sn-gauge-pct {
                    font-size: 2.8rem;
                    font-weight: 800;
                    line-height: 1;
                }
                .sn-gauge-sub {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.15em;
                }

                /* ── Stat Strip (3-col glass cards) ── */
                .sn-stat-strip-3 {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 1.5rem;
                    max-width: 900px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .sn-stat-card-glass {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    text-align: center;
                    padding: 2rem 1.25rem;
                    border: 1px solid #f1f5f9;
                    border-radius: 16px;
                    background: #ffffff;
                    transition: all 0.3s ease;
                }
                .sn-stat-card-glass:hover {
                    box-shadow: 0 8px 30px rgba(0,0,0,0.06);
                    transform: translateY(-4px);
                }
                .sn-stat-glass-icon {
                    width: 52px;
                    height: 52px;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 1rem;
                }
                .sn-stat-glass-label {
                    font-size: 0.78rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.4rem;
                }
                .sn-stat-glass-value {
                    font-size: 1.35rem;
                    font-weight: 800;
                    color: var(--text-main);
                    margin-bottom: 0.4rem;
                }
                .sn-stat-glass-note {
                    font-size: 0.75rem;
                    color: var(--text-muted);
                    line-height: 1.4;
                }

                .sn-gauge-caption {
                    max-width: 520px;
                    margin: 1rem auto 0;
                    text-align: center;
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    line-height: 1.5;
                    padding: 0 1.5rem;
                }

                .sn-member-gap-grid {
                    display: grid;
                    grid-template-columns: repeat(2, 1fr);
                    gap: 1.5rem;
                    max-width: 900px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .sn-member-gap-grid--single {
                    grid-template-columns: 1fr;
                    max-width: 480px;
                }
                .sn-member-gap-card {
                    background: #ffffff;
                    border: 1px solid #f1f5f9;
                    border-radius: 16px;
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }
                .sn-member-gap-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    gap: 0.75rem;
                }
                .sn-member-gap-title {
                    margin: 0;
                    font-size: 1.05rem;
                    font-weight: 700;
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                }
                .sn-member-gap-name {
                    margin: 0.35rem 0 0;
                    font-size: 0.85rem;
                    color: var(--text-muted);
                    font-weight: 500;
                }
                .sn-member-gap-badge {
                    padding: 0.35rem 0.75rem;
                    border-radius: 999px;
                    font-size: 0.7rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    white-space: nowrap;
                }
                .sn-member-gap-stats {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr);
                    gap: 0.75rem;
                }
                .sn-member-gap-stat-label {
                    display: block;
                    font-size: 0.7rem;
                    font-weight: 600;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    margin-bottom: 0.25rem;
                }
                .sn-member-gap-stat-value {
                    display: block;
                    font-size: 0.95rem;
                    font-weight: 700;
                    color: var(--text-main);
                }
                .sn-member-gap-bar-track {
                    height: 10px;
                    border-radius: 8px;
                    background: var(--muted, #f1f5f9);
                    overflow: hidden;
                }
                .sn-member-gap-bar-fill {
                    height: 100%;
                    border-radius: 8px;
                    transition: width 0.8s ease;
                }
                .sn-member-gap-note {
                    margin: 0;
                    font-size: 0.8rem;
                    color: var(--text-muted);
                    line-height: 1.45;
                }

                /* ── Insight Card ── */
                .sn-insight-card {
                    display: flex;
                    gap: 1.5rem;
                    max-width: 800px;
                    margin: 0 auto 2rem;
                    padding: 1.75rem 2rem;
                    border-left: 4px solid var(--color-2);
                    background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
                    border-radius: 0 14px 14px 0;
                    align-items: flex-start;
                }
                .sn-insight-icon-wrapper {
                    width: 48px;
                    height: 48px;
                    border-radius: 12px;
                    background: rgba(0, 169, 242, 0.1);
                    color: var(--color-2);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }
                .sn-insight-content {
                    flex: 1;
                }
                .sn-insight-text {
                    font-size: 1.05rem;
                    color: var(--text-main);
                    line-height: 1.7;
                    margin: 0;
                    font-weight: 500;
                }
                .sn-insight-highlight {
                    color: var(--color-1);
                    font-weight: 800;
                }
                .sn-insight-months {
                    color: var(--text-muted);
                    font-weight: 600;
                }

                /* ── Year Coverage Bar ── */
                .sn-year-bar-section {
                    max-width: 800px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .sn-year-bar-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    margin-bottom: 1rem;
                    text-align: center;
                }
                .sn-year-bar-container {
                    position: relative;
                }
                .sn-year-bar-track {
                    width: 100%;
                    height: 32px;
                    border-radius: 16px;
                    background: #f1f5f9;
                    overflow: hidden;
                    position: relative;
                }
                .sn-year-bar-fill {
                    height: 100%;
                    border-radius: 16px;
                    position: relative;
                    display: flex;
                    align-items: center;
                    justify-content: flex-end;
                    padding-right: 1rem;
                    min-width: 60px;
                    transition: width 1.5s cubic-bezier(0.16, 1, 0.3, 1);
                }
                .sn-year-bar-label {
                    font-size: 0.78rem;
                    font-weight: 700;
                    color: white;
                    text-shadow: 0 1px 2px rgba(0,0,0,0.2);
                }
                .sn-year-bar-markers {
                    display: flex;
                    justify-content: space-between;
                    padding: 0.5rem 0.25rem 0;
                }
                .sn-year-marker {
                    font-size: 0.7rem;
                    color: var(--text-muted);
                    font-weight: 600;
                }

                /* ── Contingency Question ── */
                .sn-contingency-question {
                    font-size: 1.15rem;
                    color: var(--text-muted);
                    font-style: italic;
                    line-height: 1.7;
                    margin-bottom: 1.5rem;
                    max-width: 600px;
                    margin-left: auto;
                    margin-right: auto;
                }

                /* ── Narrative Block ── */
                .sn-narrative-block {
                    max-width: 700px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                    text-align: center;
                }
                .sn-narrative-text {
                    font-size: 1.05rem;
                    color: var(--text-main);
                    line-height: 1.8;
                    margin-bottom: 1rem;
                }
                .sn-narrative-accent {
                    color: #EF4444;
                    font-size: 1.4rem;
                    font-weight: 800;
                }
                .sn-narrative-note {
                    display: flex;
                    align-items: flex-start;
                    gap: 0.5rem;
                    font-size: 0.82rem;
                    color: var(--text-muted);
                    padding: 0.75rem 1rem;
                    background: #f8fafc;
                    border-radius: 10px;
                    line-height: 1.5;
                    text-align: left;
                    max-width: 500px;
                    margin: 0 auto;
                }
                .sn-narrative-note svg {
                    flex-shrink: 0;
                    margin-top: 2px;
                }

                /* ── Runway Meter ── */
                .sn-runway-section {
                    max-width: 700px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .sn-runway-title {
                    font-size: 0.85rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                    margin-bottom: 1.25rem;
                    text-align: center;
                }
                .sn-runway-bar {
                    display: grid;
                    grid-template-columns: repeat(6, 1fr);
                    gap: 0.5rem;
                }
                .sn-runway-segment {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    gap: 0.4rem;
                }
                .sn-runway-cell {
                    width: 100%;
                    height: 40px;
                    border-radius: 10px;
                    background: #f1f5f9;
                    border: 2px solid #e2e8f0;
                    position: relative;
                    overflow: hidden;
                    transition: all 0.5s ease;
                }
                .sn-runway-filled {
                    background: linear-gradient(135deg, #10B981, #059669);
                    border-color: #059669;
                    box-shadow: 0 2px 8px rgba(16, 185, 129, 0.3);
                }
                .sn-runway-partial {
                    position: absolute;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, #F59E0B, #D97706);
                    border-radius: 8px;
                }
                .sn-runway-label {
                    font-size: 0.75rem;
                    font-weight: 700;
                    color: var(--text-muted);
                }
                .sn-runway-legend {
                    display: flex;
                    justify-content: center;
                    gap: 1.5rem;
                    margin-top: 1rem;
                }
                .sn-runway-legend-item {
                    display: flex;
                    align-items: center;
                    gap: 0.4rem;
                    font-size: 0.78rem;
                    color: var(--text-muted);
                    font-weight: 500;
                }
                .sn-runway-dot {
                    width: 12px;
                    height: 12px;
                    border-radius: 4px;
                }
                .sn-runway-dot-filled {
                    background: linear-gradient(135deg, #10B981, #059669);
                }
                .sn-runway-dot-empty {
                    background: #f1f5f9;
                    border: 2px solid #e2e8f0;
                }

                /* ── Crisis Timeline ── */
                .sn-timeline-section {
                    max-width: 750px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .sn-timeline-intro {
                    font-size: 1.05rem;
                    color: var(--text-muted);
                    text-align: center;
                    margin-bottom: 2.5rem;
                    font-style: italic;
                    line-height: 1.7;
                }
                .sn-timeline {
                    position: relative;
                }
                .sn-timeline-stage {
                    display: flex;
                    gap: 1.5rem;
                    margin-bottom: 0;
                    min-height: 120px;
                }
                .sn-timeline-left {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 44px;
                    flex-shrink: 0;
                }
                .sn-timeline-icon {
                    width: 44px;
                    height: 44px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    flex-shrink: 0;
                    z-index: 1;
                }
                .sn-timeline-connector {
                    width: 3px;
                    flex: 1;
                    border-radius: 2px;
                    margin: 4px 0;
                }
                .sn-timeline-right {
                    flex: 1;
                    padding: 1.25rem 1.5rem;
                    border-radius: 0 12px 12px 0;
                    margin-bottom: 1rem;
                }
                .sn-timeline-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 0.5rem;
                }
                .sn-timeline-duration {
                    font-size: 0.82rem;
                    font-weight: 700;
                    color: var(--text-muted);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .sn-timeline-badge {
                    font-size: 0.7rem;
                    font-weight: 700;
                    padding: 0.25rem 0.75rem;
                    border-radius: 20px;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }
                .sn-timeline-title {
                    font-size: 1.05rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin: 0 0 0.5rem 0;
                }
                .sn-timeline-status {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.88rem;
                }

                /* ── Recovery Plan ── */
                .sn-recovery-section {
                    max-width: 900px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .sn-rec-list {
                    max-width: 900px;
                    margin: 0 auto;
                }

                /* ── Responsive ── */
                @media (max-width: 768px) {
                    .sn-stat-strip-3 {
                        grid-template-columns: 1fr;
                    }
                    .sn-member-gap-grid {
                        grid-template-columns: 1fr;
                        padding: 0 1rem;
                    }
                    .sn-member-gap-stats {
                        grid-template-columns: 1fr;
                        gap: 0.5rem;
                    }
                    .sn-timeline-stage {
                        gap: 1rem;
                    }
                    .sn-timeline-right {
                        padding: 1rem;
                    }
                    .sn-insight-card {
                        flex-direction: column;
                        padding: 1.5rem;
                        margin: 0 1rem 2rem;
                    }
                    .sn-hook-section {
                        padding: 3rem 1.5rem 2rem;
                    }
                    .sn-section-divider {
                        padding: 2rem 1.5rem;
                    }
                    .sn-hero-number {
                        flex-direction: column;
                        gap: 0.25rem;
                    }
                    .sn-runway-bar {
                        gap: 0.3rem;
                    }
                }
            `}</style>
        </div>
    );
};

export default SafetyNetSection;
