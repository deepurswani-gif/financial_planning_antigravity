import React, { useMemo, useEffect, useState, useRef } from 'react';
import { Shield, ShieldAlert, ShieldCheck, AlertTriangle, AlertOctagon, Umbrella, Wallet, Clock, TrendingDown, CheckCircle2, ArrowRight, Info, Zap, Target, Send, Check, Heart } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import {
    submitSupportRequestViaWeb3forms,
    buildSupportEmailContextFromUser,
    getSupportWeb3StorageKey,
    isSupportWeb3CooldownActive,
    markSupportWeb3Sent,
} from '../../services/supportRequestEmailService';
import {
    calculateProtectionData,
    calculateContingencyData,
    calculateHealthInsuranceData,
    buildCrisisTimeline,
    buildRecoverySteps,
    formatCompactSN
} from './SafetyNetLogic';
import { getEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';

/* ─────────────── Animated Counter ─────────────── */
const AnimatedCounter = ({ value, prefix = '', suffix = '', duration = 1500, decimals = 0 }) => {
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
                        const eased = 1 - Math.pow(1 - progress, 3);
                        const current = start + (end - start) * eased;
                        setDisplay(decimals > 0 ? Math.round(current * Math.pow(10, decimals)) / Math.pow(10, decimals) : Math.round(current));
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
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
    const hasAnimated = useRef(false);

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

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const startTime = performance.now();
                    const animate = (currentTime) => {
                        const elapsed = currentTime - startTime;
                        const progress = Math.min(elapsed / 1500, 1);
                        const eased = 1 - Math.pow(1 - progress, 3);
                        setAnimatedPercent(percent * eased);
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.3 }
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
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

const SUPPORT_CTA_ERROR_COOLDOWN_SEC = 60;

/* ─────────────── Recovery Step CTA ─────────────── */
const RecoverySupportCta = ({ familyMembers, user, moduleName, color }) => {
    const [sendState, setSendState] = useState('idle');
    const [retrySeconds, setRetrySeconds] = useState(null);

    const supportEmailContext = useMemo(
        () => buildSupportEmailContextFromUser(familyMembers, user, moduleName),
        [familyMembers, user, moduleName]
    );

    const storageKey = useMemo(() => {
        const email = supportEmailContext?.userEmail;
        if (!email || !moduleName) return null;
        return getSupportWeb3StorageKey(email, moduleName);
    }, [supportEmailContext?.userEmail, moduleName]);

    useEffect(() => {
        if (!storageKey) return;
        if (isSupportWeb3CooldownActive(storageKey)) {
            setSendState('success');
        } else {
            setSendState('idle');
        }
        setRetrySeconds(null);
    }, [storageKey]);

    useEffect(() => {
        if (retrySeconds === null || retrySeconds <= 0) return undefined;
        const t = setTimeout(() => {
            setRetrySeconds((prev) => {
                if (prev === null || prev <= 1) {
                    setSendState('idle');
                    return null;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearTimeout(t);
    }, [retrySeconds]);

    const handleClick = async () => {
        if (!storageKey || sendState === 'loading' || sendState === 'success') return;
        if (isSupportWeb3CooldownActive(storageKey)) {
            setSendState('success');
            return;
        }

        setSendState('loading');
        try {
            const { ok } = await submitSupportRequestViaWeb3forms(supportEmailContext);
            if (ok) {
                markSupportWeb3Sent(storageKey);
                setSendState('success');
                setRetrySeconds(null);
            } else {
                setSendState('error');
                setRetrySeconds(SUPPORT_CTA_ERROR_COOLDOWN_SEC);
            }
        } catch {
            setSendState('error');
            setRetrySeconds(SUPPORT_CTA_ERROR_COOLDOWN_SEC);
        }
    };

    const disabled =
        sendState === 'loading' ||
        sendState === 'success' ||
        (sendState === 'error' && retrySeconds !== null && retrySeconds > 0);

    return (
        <button
            type="button"
            className="sn-recovery-cta"
            onClick={handleClick}
            disabled={disabled}
            style={{
                '--cta-color': color,
                background: sendState === 'success' ? '#16a34a' : sendState === 'error' ? '#dc2626' : color,
            }}
        >
            {sendState === 'loading' && (
                <>
                    <Send size={16} />
                    Sending…
                </>
            )}
            {sendState === 'success' && (
                <>
                    <Check size={16} strokeWidth={2.5} />
                    Request sent
                </>
            )}
            {sendState === 'error' && (
                <span>Try again in <strong>{retrySeconds ?? 0}s</strong></span>
            )}
            {sendState === 'idle' && (
                <>
                    <Send size={16} />
                    Contact Finbrella for help
                </>
            )}
        </button>
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
        assetCategories
    } = useFinancialPlan();

    // ── Derived Calculations ──
    const protectionData = useMemo(
        () => calculateProtectionData(expenseCategories, summaryLifeCover, familyMembers),
        [expenseCategories, summaryLifeCover, familyMembers]
    );

    const contingencyData = useMemo(() => {
        const emergencyCash = getEmergencyFundAmount(assetCategories, contingencyFund);
        return calculateContingencyData(expenseCategories, emergencyCash, familyMembers);
    }, [expenseCategories, contingencyFund, assetCategories, familyMembers]);

    const healthData = useMemo(
        () => calculateHealthInsuranceData(summaryHealthCover, hasHealthInsurance, familyMembers),
        [summaryHealthCover, hasHealthInsurance, familyMembers]
    );

    const crisisTimeline = useMemo(
        () => buildCrisisTimeline(contingencyData, protectionData),
        [contingencyData, protectionData]
    );

    const recoverySteps = useMemo(
        () => buildRecoverySteps(protectionData, healthData, contingencyData),
        [protectionData, healthData, contingencyData]
    );

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
                            Wealth creation alone does not define financial security. Right now, your protection and emergency reserves need attention. If something happened to your income tomorrow, your family would feel the stress quickly. Addressing these gaps proactively will give you something money can't buy — <span className="sn-hook-emphasis">genuine peace of mind</span>.
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

            {/* ══════════════════════════════════════════════
                SECTION 1 — LONG-TERM SECURITY (PROTECTION)
               ══════════════════════════════════════════════ */}
            <div className="sn-section-divider">
                <div className="sn-divider-line" />
                <span className="sn-divider-label">LONG-TERM SECURITY — Protection</span>
                <div className="sn-divider-line" />
            </div>

            {/* Hero: Coverage Gauge */}
            <RevealSection className="sn-hero-block">
                <CircularGauge percent={protectionData.coveredPercent} />
                <div className="sn-hero-gradient-bar" />
            </RevealSection>

            {/* Protection Stat Cards */}
            <RevealSection className="sn-stat-strip-3" delay={200}>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                        <Target size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Coverage Required</span>
                    <span className="sn-stat-glass-value">{formatCurrency(protectionData.coverageRequired)}</span>
                    <span className="sn-stat-glass-note">Based on {protectionData.multiplier}× monthly expenses</span>
                </div>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <ShieldCheck size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Coverage You Have</span>
                    <span className="sn-stat-glass-value">{formatCurrency(protectionData.coverageHave)}</span>
                    <span className="sn-stat-glass-note">Total life cover across policies</span>
                </div>
                <div className="sn-stat-card-glass" style={{ borderColor: protectionData.hasGap ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }}>
                    <div className="sn-stat-glass-icon" style={{ background: protectionData.hasGap ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: protectionData.hasGap ? '#EF4444' : '#10B981' }}>
                        {protectionData.hasGap ? <TrendingDown size={22} /> : <CheckCircle2 size={22} />}
                    </div>
                    <span className="sn-stat-glass-label">Protection Gap</span>
                    <span className="sn-stat-glass-value" style={{ color: protectionData.hasGap ? '#EF4444' : '#10B981' }}>
                        {protectionData.hasGap ? formatCurrency(protectionData.protectionGap) : 'Nil ✓'}
                    </span>
                    <span className="sn-stat-glass-note">{protectionData.hasGap ? 'Needs immediate attention' : 'Fully covered'}</span>
                </div>
            </RevealSection>

            {/* Coverage Duration Insight */}
            <RevealSection className="sn-insight-card" delay={300}>
                <div className="sn-insight-icon-wrapper">
                    <Clock size={24} />
                </div>
                <div className="sn-insight-content">
                    <p className="sn-insight-text">
                        Your current sum insured will cover{' '}
                        <span className="sn-insight-highlight">
                            {formatCompactSN(protectionData.annualNeed)}{' '}
                            ({new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(protectionData.monthlyNeed)} X 12)
                        </span>{' '}
                        annual need for{' '}
                        <span className="sn-insight-highlight">{protectionData.yearsCovered} years</span>{' '}
                        <span className="sn-insight-months">({protectionData.monthsCovered} Months)</span>
                    </p>
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
                    <strong>{formatCurrency(contingencyData.monthlyNeed)}</strong>, your current reserves may provide
                    financial support for about{' '}
                    <span className="sn-narrative-accent">{contingencyData.daysCovered} days</span>.
                    {contingencyData.daysCovered < 180 && (
                        <> Beyond this period, maintaining the same lifestyle could become challenging for your family.</>
                    )}
                </p>
                <p className="sn-narrative-note">
                    <Info size={14} />
                    <span>This calculation is based on the availability of {formatCurrency(contingencyData.emergencyFundHave)} as emergency fund.</span>
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
            {recoverySteps.length > 0 && (
                <>
                    <div className="sn-section-divider" style={{ marginTop: '4rem' }}>
                        <div className="sn-divider-line" />
                        <span className="sn-divider-label">RECOVERY PLAN — Next Steps</span>
                        <div className="sn-divider-line" />
                    </div>

                    <RevealSection className="sn-recovery-section" delay={100}>
                        {recoverySteps.map((step) => (
                            <div key={step.id} className="sn-recovery-card">
                                <div className="sn-recovery-step-badge" style={{ background: step.color }}>
                                    Step {step.step}
                                </div>
                                <div className="sn-recovery-icon" style={{ background: `${step.color}15`, color: step.color }}>
                                    {step.icon === 'shield' ? <Shield size={28} /> : step.icon === 'heart' ? <Heart size={28} /> : <Wallet size={28} />}
                                </div>
                                <div className="sn-recovery-urgency">
                                    <Zap size={14} />
                                    <span>{step.urgency}</span>
                                </div>
                                <h4 className="sn-recovery-title">{step.title}</h4>
                                <p className="sn-recovery-desc">{step.description}</p>
                                <div className="sn-recovery-amount">
                                    {formatCurrency(step.amount)}
                                </div>
                                <RecoverySupportCta
                                    familyMembers={familyMembers}
                                    user={user}
                                    moduleName={`Your Safety Net — ${step.title}`}
                                    color={step.color}
                                />
                            </div>
                        ))}
                    </RevealSection>
                </>
            )}

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
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                    max-width: 750px;
                    margin: 0 auto 2rem;
                    padding: 0 2rem;
                }
                .sn-recovery-card {
                    position: relative;
                    padding: 2rem 1.5rem;
                    border: 1px solid #f1f5f9;
                    border-radius: 16px;
                    text-align: center;
                    transition: all 0.3s ease;
                    background: #ffffff;
                }
                .sn-recovery-card:hover {
                    box-shadow: 0 8px 30px rgba(0,0,0,0.06);
                    transform: translateY(-4px);
                }
                .sn-recovery-step-badge {
                    position: absolute;
                    top: -10px;
                    left: 50%;
                    transform: translateX(-50%);
                    padding: 0.25rem 1rem;
                    border-radius: 20px;
                    color: white;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.08em;
                }
                .sn-recovery-icon {
                    width: 60px;
                    height: 60px;
                    border-radius: 16px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin: 0.5rem auto 1rem;
                }
                .sn-recovery-urgency {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.35rem;
                    padding: 0.3rem 0.75rem;
                    border-radius: 20px;
                    background: rgba(239, 68, 68, 0.08);
                    color: #EF4444;
                    font-size: 0.72rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 0.75rem;
                }
                .sn-recovery-title {
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: var(--text-main);
                    margin: 0 0 0.5rem 0;
                }
                .sn-recovery-desc {
                    font-size: 0.88rem;
                    color: var(--text-muted);
                    line-height: 1.6;
                    margin-bottom: 1rem;
                }
                .sn-recovery-amount {
                    font-size: 1.5rem;
                    font-weight: 800;
                    color: var(--color-1);
                    margin-bottom: 1.25rem;
                }
                .sn-recovery-cta {
                    display: inline-flex;
                    align-items: center;
                    justify-content: center;
                    gap: 0.5rem;
                    width: 100%;
                    padding: 0.75rem 1.25rem;
                    border: none;
                    border-radius: 10px;
                    color: #fff;
                    font-size: 0.88rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: opacity 0.2s, transform 0.2s;
                }
                .sn-recovery-cta:hover:not(:disabled) {
                    opacity: 0.9;
                    transform: translateY(-1px);
                }
                .sn-recovery-cta:disabled {
                    cursor: not-allowed;
                    opacity: 0.85;
                }

                /* ── Responsive ── */
                @media (max-width: 768px) {
                    .sn-stat-strip-3 {
                        grid-template-columns: 1fr;
                    }
                    .sn-recovery-section {
                        grid-template-columns: 1fr;
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
