import React, { useMemo, useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { RecommendationList, toPresentationModels } from '../../recommendationPresentation';
import { useLaunchRecommendationAction, useFinancialWorkspace } from '../FinancialWorkspace/FinancialWorkspaceContext';
import { getInsuranceMonthlyTotal } from '../DetailedFlow/insuranceDetailSync';
import DetailedHubCTA from '../DetailedHub/DetailedHubCTA';
import { useNavigate } from 'react-router-dom';
import CommercialCtaButton from '../CommercialCta/CommercialCtaButton';
import { ChevronDown as ChevronDownIcon, ChevronUp as ChevronUpIcon } from 'lucide-react';

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
        income,
        inflationRates,
        calculatorInputs,
        goals,
        liabilityCategories,
    } = useFinancialPlan();

    // ── Derived Calculations ──
    const protectionData = useMemo(
        () => calculateProtectionData(
            expenseCategories, 
            summaryLifeCover, 
            familyMembers, 
            policies,
            income,
            inflationRates,
            calculatorInputs,
            goals,
            assetCategories,
            liabilityCategories
        ),
        [expenseCategories, summaryLifeCover, familyMembers, policies, income, inflationRates, calculatorInputs, goals, assetCategories, liabilityCategories]
    );

    const contingencyData = useMemo(() => {
        const emergencyCash = getEmergencyFundAmount(assetCategories, contingencyFund);
        return calculateContingencyData(expenseCategories, emergencyCash, familyMembers);
    }, [expenseCategories, contingencyFund, assetCategories, familyMembers]);

    const healthData = useMemo(
        () => calculateHealthInsuranceData(summaryHealthCover, hasHealthInsurance, familyMembers, policies),
        [summaryHealthCover, hasHealthInsurance, familyMembers, policies]
    );

    const navigate = useNavigate();
    const [timelineFocus, setTimelineFocus] = useState('self');
    const [selectedProtectionMember, setSelectedProtectionMember] = useState('self');
    const [expandedCards, setExpandedCards] = useState({});
    const [activeSection, setActiveSection] = useState('protection');
    const containerRef = useRef(null);
    const [mobileNavBounds, setMobileNavBounds] = useState({ left: 0, width: 0 });
    const { state: workspaceState } = useFinancialWorkspace();
    const { workspaceFocus, activeSummaryReportId } = workspaceState || {};
    const isActiveReport = workspaceFocus === 'summary' && activeSummaryReportId === 'safety_net';

    useEffect(() => {
        const sections = [
            { id: 'sec-protection', key: 'protection' },
            { id: 'sec-contingency', key: 'contingency' },
            { id: 'sec-whatif', key: 'whatif' },
            { id: 'sec-medical', key: 'medical' },
            { id: 'sec-nextsteps', key: 'nextsteps' },
        ];

        const handleScroll = () => {
            let currentSection = 'protection';
            let closestTop = -Infinity;

            for (const section of sections) {
                const el = document.getElementById(section.id);
                if (el) {
                    const rect = el.getBoundingClientRect();
                    if (rect.top <= 220 && rect.top > closestTop) {
                        closestTop = rect.top;
                        currentSection = section.key;
                    }
                }
            }
            setActiveSection(currentSection);
        };

        window.addEventListener('scroll', handleScroll, true);
        return () => window.removeEventListener('scroll', handleScroll, true);
    }, []);

    // Track the container's screen position for mobile portal centering
    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => {
            const rect = el.getBoundingClientRect();
            setMobileNavBounds(prev => {
                if (Math.abs(prev.left - rect.left) < 1 && Math.abs(prev.width - rect.width) < 1) return prev;
                return { left: rect.left, width: rect.width };
            });
        };
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        window.addEventListener('scroll', update, true);
        window.addEventListener('resize', update);
        return () => { ro.disconnect(); window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update); };
    }, []);

    const scrollToSection = (id) => {
        const el = document.getElementById(id);
        if (!el) return;

        const offset = 150;

        // 1. Scroll window to target position
        const y = el.getBoundingClientRect().top + window.pageYOffset - offset;
        window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });

        // 2. Scroll any potentially scrolling layout containers
        const containers = [
            el.closest('.fw-workspace-content'),
            document.querySelector('.fw-workspace-content'),
            el.closest('.fw-workspace-pane'),
            document.querySelector('.fw-workspace-pane'),
            el.closest('.fw-main'),
            document.querySelector('.fw-main')
        ];

        for (const container of containers) {
            if (container) {
                const containerRect = container.getBoundingClientRect();
                const elRect = el.getBoundingClientRect();
                const targetScrollTop = container.scrollTop + (elRect.top - containerRect.top) - offset;
                container.scrollTo({ top: Math.max(0, targetScrollTop), behavior: 'smooth' });
            }
        }
    };
    
    const activeProtection = useMemo(() => {
        return (selectedProtectionMember === 'spouse' && protectionData.spouse) 
            ? protectionData.spouse 
            : protectionData.self;
    }, [selectedProtectionMember, protectionData]);


    const crisisTimeline = useMemo(
        () => buildCrisisTimeline(contingencyData, protectionData, timelineFocus),
        [contingencyData, protectionData, timelineFocus]
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
    const resolvedModels = useMemo(() => {
        const mapped = toPresentationModels(recoveryRecommendations);
        return mapped.map(m => {
            const contactAction = m.secondaryActions?.find(a => a.kind === 'commercial_cta');
            return {
                ...m,
                contactAction,
                secondaryActions: [] // remove from individual cards
            };
        });
    }, [recoveryRecommendations]);
    const launchRecommendationAction = useLaunchRecommendationAction();

    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self');
    const spouseMember = familyMembers.find(m => m.relation?.toLowerCase() === 'spouse');
    const selfMemberName = selfMember?.name || 'Self';
    const spouseMemberName = spouseMember?.name || 'Spouse';
    const userName = selfMember?.name?.split(' ')[0] || 'there';

    const hasAnyGap = protectionData.hasGap || contingencyData.gap > 0 || healthData.hasGap;

    const lifeModels = useMemo(() => resolvedModels.filter(m => m.id === 'protection.lifeGap' || m.id === 'protection.lifeGapSpouse'), [resolvedModels]);
    const contingencyModels = useMemo(() => resolvedModels.filter(m => m.id.startsWith('contingency.')), [resolvedModels]);
    const otherModels = useMemo(() => resolvedModels.filter(m => m.id !== 'protection.lifeGap' && m.id !== 'protection.lifeGapSpouse' && !m.id.startsWith('contingency.')), [resolvedModels]);

    const getProgress = (id) => {
        if (id === 'protection.lifeGap') {
            const need = protectionData.self?.need || 0;
            const coverage = protectionData.self?.coverage || 0;
            return need > 0 ? (coverage / need) * 100 : 0;
        }
        if (id === 'protection.lifeGapSpouse') {
            const need = protectionData.spouse?.need || 0;
            const coverage = protectionData.spouse?.coverage || 0;
            return need > 0 ? (coverage / need) * 100 : 0;
        }
        if (id === 'contingency.runwayShortfall') {
            const need = contingencyData.emergencyFundNeeded || 0;
            const coverage = contingencyData.emergencyFundHave || 0;
            return need > 0 ? (coverage / need) * 100 : 0;
        }
        if (id === 'protection.healthGap') {
            const need = healthData.minimumRequired || 0;
            const coverage = healthData.coverageHave || 0;
            return need > 0 ? (coverage / need) * 100 : 0;
        }
        return 0;
    };

    const handleCardActionClick = (model, action) => {
        if (model.id === 'protection.lifeGap' || model.id === 'protection.lifeGapSpouse') {
            navigate('/financial-workspace/full_profile?openSub=insurance');
        } else if (model.id.startsWith('contingency.')) {
            navigate('/financial-workspace/full_profile?openSub=assets');
        } else if (action && launchRecommendationAction) {
            launchRecommendationAction({
                id: action.id,
                kind: action.kind,
                label: action.label,
                cta: action.cta
            });
        }
    };

    const renderCustomRecCard = (model, accentColor, bgOverlay) => {
        const progress = Math.min(100, Math.max(0, getProgress(model.id)));
        const isExpanded = expandedCards[model.id] || false;
        
        return (
            <article 
                key={model.id}
                className="rec-card"
                style={{ 
                    '--rec-accent': accentColor, 
                    background: '#ffffff',
                    border: `1px solid ${accentColor}30`, 
                    borderRadius: '12px',
                    padding: '1.25rem',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    position: 'relative'
                }}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h5 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)' }}>{model.title}</h5>
                    <span style={{ 
                        fontSize: '0.75rem', 
                        fontWeight: 600, 
                        color: accentColor, 
                        background: bgOverlay, 
                        padding: '2px 8px', 
                        borderRadius: '12px' 
                    }}>
                        {model.severityStyle?.label || 'Action Required'}
                    </span>
                </div>
                
                <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    {model.summary}
                </p>

                {/* Progress bar */}
                <div style={{ marginTop: '0.5rem', marginBottom: '0.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                        <span>Coverage Met</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{Math.round(progress)}%</span>
                    </div>
                    <div style={{ height: '6px', background: 'rgba(0,0,0,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: accentColor, borderRadius: '3px', transition: 'width 1s' }} />
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
                    {model.primaryActions?.map((act, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => handleCardActionClick(model, act)}
                            style={{
                                padding: '8px 16px',
                                borderRadius: '6px',
                                background: accentColor,
                                color: '#ffffff',
                                border: 'none',
                                fontWeight: 600,
                                fontSize: '0.8rem',
                                cursor: 'pointer',
                                transition: 'opacity 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.opacity = 0.9}
                            onMouseOut={e => e.currentTarget.style.opacity = 1}
                        >
                            {act.label}
                        </button>
                    ))}
                    
                    {Boolean(model.description || model.businessMeaning) && (
                        <button
                            type="button"
                            onClick={() => setExpandedCards(prev => ({ ...prev, [model.id]: !isExpanded }))}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: 'var(--text-muted)',
                                fontSize: '0.8rem',
                                fontWeight: 500,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            {isExpanded ? (
                                <>Hide Details <ChevronUpIcon size={14} /></>
                            ) : (
                                <>View Details <ChevronDownIcon size={14} /></>
                            )}
                        </button>
                    )}
                </div>

                {isExpanded && (
                    <div style={{ 
                        marginTop: '0.5rem', 
                        padding: '1rem', 
                        background: 'var(--background-light, #f8fafc)', 
                        borderRadius: '8px', 
                        fontSize: '0.8rem', 
                        color: 'var(--text-muted)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.5rem',
                        lineHeight: 1.5
                    }}>
                        {model.businessMeaning && (
                            <div>
                                <strong style={{ color: 'var(--text-main)', display: 'block', marginBottom: '2px' }}>Why this matters:</strong>
                                {model.businessMeaning}
                            </div>
                        )}
                        {model.description && (
                            <div>
                                {model.description}
                            </div>
                        )}
                    </div>
                )}
            </article>
        );
    };

    // ── No data guard ──
    if (!protectionData.hasData) {
        return (
            <div className="sn-container" data-render-complete={true}>
                <div className="sn-empty-state">
                    <ShieldAlert size={56} style={{ color: 'var(--text-muted)', marginBottom: '1rem' }} />
                    <h2>Complete Your Expense Details First</h2>
                    <p>We need your monthly household expenses and EMI details to calculate your family's safety net. Please go back and fill in the Cash Flow section.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="sn-container" ref={containerRef} data-render-complete={true}>

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
                            Wealth creation alone does not define financial security. Addressing these gaps proactively will give you something money can't buy — <span className="sn-hook-emphasis">genuine peace of mind</span>.
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

            {/* ── Nav Capsules: Portal to body ── */}
            {isActiveReport && createPortal(
                <>
                    <div className="sn-sticky-nav-container sn-nav--desktop-only">
                        <div className="sn-sticky-nav-bar">
                            <button onClick={() => scrollToSection('sec-protection')} className={`sn-nav-item ${activeSection === 'protection' ? 'sn-nav-item--active' : ''}`}>Protection</button>
                            <button onClick={() => scrollToSection('sec-contingency')} className={`sn-nav-item ${activeSection === 'contingency' ? 'sn-nav-item--active' : ''}`}>Contingency</button>
                            <button onClick={() => scrollToSection('sec-whatif')} className={`sn-nav-item ${activeSection === 'whatif' ? 'sn-nav-item--active' : ''}`}>What If?</button>
                            <button onClick={() => scrollToSection('sec-medical')} className={`sn-nav-item ${activeSection === 'medical' ? 'sn-nav-item--active' : ''}`}>Health</button>
                            <button onClick={() => scrollToSection('sec-nextsteps')} className={`sn-nav-item ${activeSection === 'nextsteps' ? 'sn-nav-item--active' : ''}`}>Recovery Plan</button>
                        </div>
                    </div>
                    <div className="sn-sticky-nav-container sn-nav--mobile-only">
                        <div className="sn-sticky-nav-bar">
                            <button onClick={() => scrollToSection('sec-protection')} className={`sn-nav-item ${activeSection === 'protection' ? 'sn-nav-item--active' : ''}`}>Protection</button>
                            <button onClick={() => scrollToSection('sec-contingency')} className={`sn-nav-item ${activeSection === 'contingency' ? 'sn-nav-item--active' : ''}`}>Contingency</button>
                            <button onClick={() => scrollToSection('sec-whatif')} className={`sn-nav-item ${activeSection === 'whatif' ? 'sn-nav-item--active' : ''}`}>What If?</button>
                            <button onClick={() => scrollToSection('sec-medical')} className={`sn-nav-item ${activeSection === 'medical' ? 'sn-nav-item--active' : ''}`}>Health</button>
                            <button onClick={() => scrollToSection('sec-nextsteps')} className={`sn-nav-item ${activeSection === 'nextsteps' ? 'sn-nav-item--active' : ''}`}>Recovery Plan</button>
                        </div>
                    </div>
                </>,
                document.body
            )}

            {/* ══════════════════════════════════════════════
                SECTION 1 — LONG-TERM SECURITY (PROTECTION)
               ══════════════════════════════════════════════ */}
            <div id="sec-protection" className="sn-section-divider">
                <div className="sn-divider-line" />
                <span className="sn-divider-label">LONG-TERM SECURITY — Protection</span>
                <div className="sn-divider-line" />
            </div>

            {/* Hero: Coverage Gauge — weakest earning member */}
            <RevealSection className="sn-hero-block">
                {protectionData.spouse && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '24px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                onClick={() => setSelectedProtectionMember('self')}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: selectedProtectionMember === 'self' ? '#fff' : 'var(--text-main, #334155)',
                                    background: selectedProtectionMember === 'self' ? 'var(--primary, #6366F1)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {selfMemberName}
                            </button>
                            <button
                                onClick={() => setSelectedProtectionMember('spouse')}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: selectedProtectionMember === 'spouse' ? '#fff' : 'var(--text-main, #334155)',
                                    background: selectedProtectionMember === 'spouse' ? 'var(--primary, #6366F1)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {spouseMemberName}
                            </button>
                        </div>
                    </div>
                )}
                <CircularGauge percent={activeProtection.coveredPercent} />
                <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Based on</span>
                    <span className="sn-member-gap-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                        {activeProtection.name}'s Cover
                    </span>
                </div>
                <div className="sn-hero-gradient-bar" />
            </RevealSection>

            {activeProtection.isCapped && (
                <div style={{ display: 'flex', justifyContent: 'center', margin: '0 auto 1.5rem auto', maxWidth: '600px', padding: '0 2rem' }}>
                    <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '8px', 
                        padding: '0.5rem 1rem', 
                        background: 'rgba(245, 158, 11, 0.1)', 
                        border: '1px solid rgba(245, 158, 11, 0.3)', 
                        borderRadius: '20px', 
                        fontSize: '0.85rem', 
                        color: '#b45309',
                        fontWeight: 600
                    }}>
                        <ShieldAlert size={16} />
                        <span>Capped at {formatCurrency(activeProtection.insurabilityCap)} by income eligibility (need: {formatCurrency(activeProtection.idealCover)}).</span>
                    </div>
                </div>
            )}

            {/* Shared household HLV target */}
            <RevealSection className="sn-stat-strip-3" delay={200}>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#6366F1' }}>
                        <Target size={22} />
                    </div>
                    <span className="sn-stat-glass-label">Coverage Required</span>
                    <span className="sn-stat-glass-value">{formatCurrency(activeProtection.need)}</span>
                    <span className="sn-stat-glass-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', position: 'relative' }}>
                        For {activeProtection.name} · Based on income replacement & liabilities
                        <span className="sn-calc-tooltip-trigger" style={{ cursor: 'pointer', display: 'inline-flex', color: 'var(--text-muted)' }}>
                            <Info size={14} />
                            <span className="sn-calc-tooltip-content" style={{ minWidth: '320px', padding: '12px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                                <strong>In case {activeProtection.name} is not with us / family:</strong>
                                <span className="sn-calc-line">Household expenses + EMI: {formatCurrency(activeProtection.needsBreakdown?.continuingExpenses || 0)}/month</span>
                                <span className="sn-calc-line">{activeProtection.needsBreakdown?.survivingSpouseName} continuing income: {formatCurrency(activeProtection.needsBreakdown?.survivingIncomeMonthly || 0)}/month</span>
                                <span className="sn-calc-line">Monthly shortfall: {formatCurrency(activeProtection.needsBreakdown?.monthlyShortfall || 0)} ({formatCurrency(activeProtection.needsBreakdown?.continuingExpenses || 0)} – {formatCurrency(activeProtection.needsBreakdown?.survivingIncomeMonthly || 0)})</span>
                                <span className="sn-calc-line">Estimated HLV Need: {formatCurrency(activeProtection.hlv || 0)} ({formatCurrency(activeProtection.needsBreakdown?.monthlyShortfall || 0)} × 12 × {activeProtection.needsBreakdown?.multiplier}x Multiplier)</span>
                                <span className="sn-calc-line">Financial liabilities (+): {formatCurrency(activeProtection.needsBreakdown?.liabilities || 0)}</span>
                                <span className="sn-calc-line" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '6px', marginTop: '6px', fontWeight: 'bold' }}>
                                    Gross Protection Need: {formatCurrency(activeProtection.need || 0)}
                                </span>
                                <span className="sn-calc-line" style={{ fontSize: '0.75rem', color: '#cbd5e1', fontStyle: 'italic', marginTop: '6px' }}>
                                    Indicative Eligibility Cap: {formatCurrency(activeProtection.insurabilityCap || 0)}
                                </span>
                            </span>
                        </span>
                    </span>
                </div>
                <div className="sn-stat-card-glass">
                    <div className="sn-stat-glass-icon" style={{ background: 'rgba(16, 185, 129, 0.1)', color: '#10B981' }}>
                        <ShieldCheck size={22} />
                    </div>
                    <span className="sn-stat-glass-label">
                        {activeProtection.name === selfMemberName ? 'Coverage You Have' : `${activeProtection.name}'s Cover`}
                    </span>
                    <span className="sn-stat-glass-value">{formatCurrency(activeProtection.coverage)}</span>
                    <span className="sn-stat-glass-note">
                        {activeProtection.name === selfMemberName
                            ? 'Life cover on you'
                            : `Payout if ${activeProtection.name} passes away`}
                    </span>
                </div>
                <div className="sn-stat-card-glass" style={{ borderColor: activeProtection.gap > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)' }}>
                    <div className="sn-stat-glass-icon" style={{ background: activeProtection.gap > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)', color: activeProtection.gap > 0 ? '#EF4444' : '#10B981' }}>
                        {activeProtection.gap > 0 ? <TrendingDown size={22} /> : <CheckCircle2 size={22} />}
                    </div>
                    <span className="sn-stat-glass-label">Total Term to Buy</span>
                    <span className="sn-stat-glass-value" style={{ color: activeProtection.gap > 0 ? '#EF4444' : '#10B981' }}>
                        {activeProtection.gap > 0 ? formatCurrency(activeProtection.gap) : 'Nil ✓'}
                    </span>
                    <span className="sn-stat-glass-note" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', position: 'relative' }}>
                        {activeProtection.gap > 0
                            ? 'Needs immediate attention'
                            : 'Fully covered'}
                        <span className="sn-calc-tooltip-trigger" style={{ cursor: 'pointer', display: 'inline-flex', color: 'var(--text-muted)' }}>
                            <Info size={14} />
                            <span className="sn-calc-tooltip-content" style={{ minWidth: '320px', padding: '12px', fontSize: '0.8rem', lineHeight: '1.5' }}>
                                <strong>In case {activeProtection.name} is not with us / family:</strong>
                                <span className="sn-calc-line">Gross Protection Need: {formatCurrency(activeProtection.need || 0)}</span>
                                <span className="sn-calc-line">Existing protection (–): {formatCurrency(activeProtection.needsBreakdown?.coverage || 0)}</span>
                                <span className="sn-calc-line">Financial assets (–): {formatCurrency(activeProtection.needsBreakdown?.liquidAssets || 0)}</span>
                                <span className="sn-calc-line" style={{ borderTop: '1px solid rgba(255,255,255,0.3)', paddingTop: '6px', marginTop: '6px', fontWeight: 'bold' }}>
                                    Protection Gap: {formatCurrency(activeProtection.gap || 0)}
                                </span>
                            </span>
                        </span>
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
                                <span className="sn-member-gap-stat-label">Protection Need</span>
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

                        {(() => {
                            if (member.need === 0) {
                                return (
                                    <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', fontSize: '0.8rem', color: '#64748b', fontStyle: 'italic', border: '1px solid #e2e8f0' }}>
                                        No income-replacement gap identified (non-income contributions like childcare are not quantified).
                                    </div>
                                );
                            }

                            const bd = member.needsBreakdown || { expenses: 0, liabilities: 0 };
                            const gross = bd.expenses + bd.liabilities;
                            const expPct = gross > 0 ? (bd.expenses / gross) * 100 : 0;
                            const liabPct = gross > 0 ? (bd.liabilities / gross) * 100 : 0;
                            const covLine = gross > 0 ? Math.min(100, (member.coverage / gross) * 100) : 0;
                            
                            return (
                                <div style={{ marginTop: '0.5rem' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.4rem', fontWeight: 600 }}>
                                        <span>Gross Need Breakdown</span>
                                        <span>Cover Line</span>
                                    </div>
                                    <div className="sn-member-gap-bar-track" style={{ height: '24px', position: 'relative', background: '#f1f5f9', display: 'flex', borderRadius: '4px', overflow: 'hidden' }}>
                                        {expPct > 0 && <div style={{ width: `${expPct}%`, background: '#3b82f6', transition: 'width 1s' }} title={`Income Replacement: ${formatCompactSN(bd.expenses)}`} />}
                                        {liabPct > 0 && <div style={{ width: `${liabPct}%`, background: '#8b5cf6', transition: 'width 1s' }} title={`Loans: ${formatCompactSN(bd.liabilities)}`} />}
                                        
                                        <div style={{ 
                                            position: 'absolute', 
                                            left: `${covLine}%`, 
                                            top: -2, bottom: -2, 
                                            width: '3px', 
                                            background: '#10B981',
                                            boxShadow: '0 0 4px rgba(0,0,0,0.3)',
                                            zIndex: 10,
                                            transition: 'left 1s'
                                        }} />
                                    </div>
                                    <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 8, height: 8, borderRadius: 2, background: '#3b82f6'}}></div>Income</span>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><div style={{width: 8, height: 8, borderRadius: 2, background: '#8b5cf6'}}></div>Loans</span>
                                    </div>
                                </div>
                            );
                        })()}

                        {member.isCapped && (
                            <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '8px', fontSize: '0.8rem', color: '#b45309' }}>
                                Capped at {formatCurrency(member.insurabilityCap)} by income eligibility (need: {formatCurrency(member.idealCover)}).
                            </div>
                        )}
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
                        Each of you needs your own cover — {selfMemberName}'s policy protects your family only if something happens to {selfMemberName}, and {spouseMemberName}'s only if something happens to {spouseMemberName}. That's why both gaps matter.
                    </p>
                </div>
            </RevealSection>

            {/* Year Coverage Bar */}
            <RevealSection className="sn-year-bar-section" delay={400}>
                <h4 className="sn-year-bar-title">Coverage Duration Timeline</h4>
                <div className="sn-year-bar-container">
                    {(() => {
                        const selfYrs = protectionData.self?.yearsCovered || 0;
                        const spouseYrs = protectionData.spouse?.yearsCovered || 0;
                        const maxYears = Math.max(Math.ceil(Math.max(selfYrs, spouseYrs)) + 2, 10);
                        const markers = [];
                        for (let i = 0; i <= maxYears; i += Math.max(1, Math.floor(maxYears / 10))) {
                            markers.push(i);
                        }

                        const renderBar = (memberData) => {
                            if (!memberData) return null;
                            const coveredWidth = Math.min(100, (memberData.yearsCovered / maxYears) * 100);
                            return (
                                <div style={{ marginBottom: '1rem' }}>
                                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                                        {memberData.name}'s Cover
                                    </div>
                                    <div className="sn-year-bar-track">
                                        <div
                                            className="sn-year-bar-fill"
                                            style={{
                                                width: `${coveredWidth}%`,
                                                background: memberData.yearsCovered >= 15
                                                    ? 'linear-gradient(90deg, #10B981, #059669)'
                                                    : memberData.yearsCovered >= 5
                                                    ? 'linear-gradient(90deg, #F59E0B, #D97706)'
                                                    : 'linear-gradient(90deg, #EF4444, #DC2626)'
                                            }}
                                        >
                                            <span className="sn-year-bar-label">{memberData.yearsCovered} yrs</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        };

                        return (
                            <>
                                {renderBar(protectionData.self)}
                                {renderBar(protectionData.spouse)}
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
            <div id="sec-contingency" className="sn-section-divider" style={{ marginTop: '4rem' }}>
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
                        : contingencyData.monthsCoveredByFund >= 3 ? '#F59E0B' : '#EF4444',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '8px'
                }}>
                    <AnimatedCounter
                        value={contingencyData.monthsCoveredByFund}
                        decimals={1}
                    />
                    <span className="sn-hero-unit" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        MONTHS
                        <span className="tooltip-wrapper" data-tooltip={`Runway = emergency fund (${formatCurrency(contingencyData.emergencyFundHave)}) ÷ monthly expenses + EMIs (${formatCurrency(contingencyData.monthlyNeed)})`} style={{ cursor: 'help', fontSize: '0.85rem' }}>ⓘ</span>
                    </span>
                </div>
                <div className="sn-hero-gradient-bar" />
            </RevealSection>

            {/* Narrative */}
            <RevealSection className="sn-narrative-block" delay={200}>
                <p className="sn-narrative-text">
                    Your {formatCurrency(contingencyData.emergencyFundHave)} in reserves covers about {contingencyData.daysCovered} days — beyond that you may need to dip into savings.
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
            <div id="sec-whatif" className="sn-section-divider" style={{ marginTop: '4rem' }}>
                <div className="sn-divider-line" />
                <span className="sn-divider-label">CRISIS SCENARIO — What If?</span>
                <div className="sn-divider-line" />
            </div>

            <RevealSection className="sn-timeline-section" delay={100}>
                {protectionData.spouse && (
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                        <div style={{ display: 'inline-flex', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '24px', padding: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                            <button
                                onClick={() => setTimelineFocus('self')}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: timelineFocus === 'self' ? '#fff' : 'var(--text-main, #334155)',
                                    background: timelineFocus === 'self' ? 'var(--primary)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {selfMemberName}
                            </button>
                            <button
                                onClick={() => setTimelineFocus('spouse')}
                                style={{
                                    padding: '6px 16px',
                                    borderRadius: '20px',
                                    fontSize: '0.85rem',
                                    fontWeight: 600,
                                    color: timelineFocus === 'spouse' ? '#fff' : 'var(--text-main, #334155)',
                                    background: timelineFocus === 'spouse' ? 'var(--primary)' : 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s'
                                }}
                            >
                                {spouseMemberName}
                            </button>
                        </div>
                    </div>
                )}
                <p className="sn-timeline-intro">
                    If <span style={{ color: 'var(--text-main, #1e293b)', background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: '12px', fontWeight: 700 }}>{timelineFocus === 'self' ? selfMemberName : spouseMemberName}</span> is not with us tomorrow, here's how the family's financial security would unfold:
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
            <div id="sec-medical" className="sn-section-divider" style={{ marginTop: '4rem' }}>
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
                    <span className="sn-stat-glass-label" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Cover You Have
                        <span className="tooltip-wrapper" data-tooltip="Include personal policies, family floater plans, and employer-provided cover when assessing your total health cover." style={{ cursor: 'help', fontSize: '0.85rem' }}>ⓘ</span>
                    </span>
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
                        {healthData.status === 'adequate'
                            ? "You're fully covered for now — review every few years as medical costs rise."
                            : "Your family's health cover has gaps — consider getting family health insurance or increasing your cover."
                        }
                    </p>
                </div>
            </RevealSection>

            {/* ══════════════════════════════════════════════
                SECTION 5 — RECOVERY PLAN
               ══════════════════════════════════════════════ */}
            <div id="sec-nextsteps" className="sn-section-divider" style={{ marginTop: '4rem' }}>
                <div className="sn-divider-line" />
                <span className="sn-divider-label">RECOVERY PLAN — Next Steps</span>
                <div className="sn-divider-line" />
            </div>

            <RevealSection className="sn-recovery-section" delay={100}>
                {resolvedModels.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                        All safety net items are in order. No action required!
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '800px', margin: '0 auto' }}>
                        {/* Protection Gaps Group */}
                        {lifeModels.length > 0 && (
                            <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: '16px', padding: '1.5rem' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ef4444', margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
                                    <ShieldAlert size={20} /> Life Cover Protection Gaps
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {lifeModels.map(model => renderCustomRecCard(model, '#ef4444', 'rgba(239, 68, 68, 0.1)'))}
                                </div>
                            </div>
                        )}

                        {/* Emergency Fund Group */}
                        {contingencyModels.length > 0 && (
                            <div style={{ background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: '16px', padding: '1.5rem' }}>
                                <h4 style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#0284c7', margin: '0 0 1rem 0', fontSize: '1.1rem', fontWeight: 700 }}>
                                    <Umbrella size={20} /> Emergency Reserves Runway
                                </h4>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {contingencyModels.map(model => renderCustomRecCard(model, '#0284c7', 'rgba(2, 132, 199, 0.1)'))}
                                </div>
                            </div>
                        )}

                        {/* Other Gaps Group (e.g. Health) */}
                        {otherModels.length > 0 && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                {otherModels.map(model => renderCustomRecCard(model, '#10b981', 'rgba(16, 185, 129, 0.1)'))}
                            </div>
                        )}
                    </div>
                )}
                
                {resolvedModels.some(m => m.contactAction) && (
                    <div style={{ marginTop: '4rem', textAlign: 'center', padding: '1.5rem', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #e2e8f0', maxWidth: '600px', margin: '4rem auto 8rem' }}>
                        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem', fontWeight: 500 }}>
                            Need help setting up your covers or resolving these gaps?
                        </p>
                        <CommercialCtaButton
                            cta={resolvedModels.find(m => m.contactAction).contactAction}
                            context={{
                                familyMembers,
                                user,
                                moduleName: 'Your Safety Net',
                            }}
                            accentColor="#6366F1"
                            className="sn-contact-btn"
                        />
                    </div>
                )}
            </RevealSection>

            {/* ─── SCOPED STYLES ─── */}
            <style>{`
                /* Desktop: portal copy — fixed at bottom of viewport */
                .sn-nav--desktop-only {
                    position: fixed;
                    bottom: 11px;
                    left: 50%;
                    transform: translateX(-50%);
                    z-index: 9999;
                    display: flex;
                    justify-content: center;
                    margin: 0;
                    padding: 0;
                    width: max-content;
                }

                /* Mobile: fixed copy — top of viewport */
                .sn-nav--mobile-only {
                    position: fixed;
                    top: calc(var(--fw-top-bar-height, 52px) + 8px);
                    left: 0;
                    right: 0;
                    z-index: 9999;
                    display: none;
                    justify-content: center;
                    margin: 0;
                    padding: 0 0.5rem;
                    width: 100%;
                    pointer-events: none;
                }
                .sn-nav--mobile-only .sn-sticky-nav-bar {
                    pointer-events: auto;
                }

                /* Show/hide based on viewport */
                @media (max-width: 767px) {
                    .sn-nav--desktop-only { display: none !important; }
                    .sn-nav--mobile-only  { display: flex !important; }
                }
                @media (min-width: 768px) {
                    .sn-nav--desktop-only { display: flex; }
                    .sn-nav--mobile-only  { display: none; }
                }

                .sn-sticky-nav-bar {
                    display: flex;
                    align-items: center;
                    gap: 0.15rem;
                    background: rgba(18, 18, 24, 0.92);
                    backdrop-filter: blur(16px);
                    -webkit-backdrop-filter: blur(16px);
                    border: 1px solid rgba(255, 255, 255, 0.10);
                    border-radius: 30px;
                    padding: 4px 5px;
                    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
                    overflow-x: auto;
                    white-space: nowrap;
                    scrollbar-width: none;
                    max-width: 100%;
                }
                .sn-sticky-nav-bar::-webkit-scrollbar {
                    display: none;
                }
                .sn-nav-item {
                    background: transparent;
                    border: none;
                    outline: none;
                    color: rgba(255, 255, 255, 0.55);
                    font-size: 0.72rem;
                    font-weight: 600;
                    padding: 6px 10px;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    flex-shrink: 0;
                }
                .sn-nav-item:hover {
                    color: rgba(255, 255, 255, 0.85);
                }
                .sn-nav-item--active {
                    background: rgba(255, 255, 255, 0.14);
                    color: #fff !important;
                }

                .sn-calc-tooltip-trigger {
                    position: relative;
                }
                .sn-calc-tooltip-content {
                    visibility: hidden;
                    width: 320px;
                    background-color: #1e293b;
                    color: #fff;
                    text-align: left;
                    border-radius: 8px;
                    padding: 12px;
                    position: absolute;
                    z-index: 1000;
                    bottom: 125%;
                    left: 50%;
                    transform: translateX(-50%);
                    opacity: 0;
                    transition: opacity 0.2s;
                    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.3), 0 4px 6px -2px rgba(0, 0, 0, 0.1);
                    font-size: 0.75rem;
                    line-height: 1.4;
                    display: flex;
                    flex-direction: column;
                    gap: 3px;
                    text-transform: none;
                    white-space: normal;
                }
                .sn-calc-tooltip-trigger:hover .sn-calc-tooltip-content {
                    visibility: visible;
                    opacity: 1;
                }
                .sn-calc-tooltip-content strong {
                    color: #38bdf8;
                    margin-bottom: 6px;
                    font-size: 0.8rem;
                    display: block;
                }
                .sn-calc-line {
                    display: block;
                }
                .sn-calc-subline {
                    display: block;
                    padding-left: 8px;
                    color: #cbd5e1;
                }

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
                    scroll-margin-top: 150px;
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
                    font-size: 0.9rem;
                    font-weight: 800;
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

                .sn-contact-btn {
                    padding: 10px 24px;
                    border-radius: 8px;
                    background: var(--primary, #6366F1);
                    color: #fff;
                    font-weight: 600;
                    border: none;
                    cursor: pointer;
                    font-size: 0.9rem;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    justify-content: center;
                }
                .sn-contact-btn:hover {
                    opacity: 0.9;
                }
            `}</style>
        </div>
    );
};

export default SafetyNetSection;
