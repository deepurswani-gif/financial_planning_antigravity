import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Target,
    Sparkles,
    Calendar,
    Info,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    ArrowDown,
    MapPin,
    Flag,
    Map,
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { PUT_YOUR_MONEY_TO_WORK_PATH } from './detailedReportSteps';
import { buildTrackSurplusAllocationReport } from './trackSurplusAllocationLogic';
import ReportReveal from './ReportReveal';

const coveragePct = (amount, goalAmount) => {
    if (!goalAmount || goalAmount <= 0) return 0;
    return Math.min(100, Math.round((Math.max(0, amount) / goalAmount) * 100));
};

/** Winding route across a 640×220 map canvas (Google Maps–style). */
const ROUTE_PATH = 'M 48 168 C 110 40, 170 200, 240 112 S 340 36, 400 128 S 470 210, 592 72';
const MAP_VIEWBOX = { w: 640, h: 220 };

const pointAlongPath = (pathEl, pct) => {
    if (!pathEl) return { x: 0, y: 0 };
    const length = pathEl.getTotalLength();
    const point = pathEl.getPointAtLength(length * Math.min(1, Math.max(0, pct)));
    return { x: point.x, y: point.y };
};

const RoutePin = ({ tone, label, amount, x, y, icon: Icon }) => (
    <button
        type="button"
        className={`ymm-map-pin ymm-map-pin-${tone}`}
        style={{
            left: `${(x / MAP_VIEWBOX.w) * 100}%`,
            top: `${(y / MAP_VIEWBOX.h) * 100}%`,
        }}
        aria-label={`${label}: ${formatCurrency(amount)}`}
    >
        <span className="ymm-map-pin-dot" aria-hidden="true">
            <Icon size={14} />
        </span>
        <span className="ymm-map-pin-tooltip" role="tooltip">
            <strong>{label}</strong>
            <span>{formatCurrency(amount)}</span>
        </span>
    </button>
);

const FundingRouteMap = ({ asOfCorpus, totals }) => {
    const pathRef = useRef(null);
    const [pinPoints, setPinPoints] = useState({
        start: { x: 48, y: 168 },
        mid: { x: 320, y: 110 },
        busy: { x: 460, y: 140 },
        end: { x: 592, y: 72 },
    });

    const futureValue = Math.max(0, totals.futureValue || 0);
    const afterAllocation = Math.max(0, totals.afterAllocation || 0);
    const shortfall = Math.max(0, totals.shortfall || 0);
    const fullyFunded = futureValue > 0 && shortfall <= 0;

    const travelledPct = futureValue > 0
        ? Math.min(100, (afterAllocation / futureValue) * 100)
        : 0;

    useLayoutEffect(() => {
        const pathEl = pathRef.current;
        if (!pathEl || futureValue <= 0) return;
        const midPct = travelledPct / 100;
        const busyPct = midPct + (1 - midPct) / 2;
        setPinPoints({
            start: pointAlongPath(pathEl, 0),
            mid: pointAlongPath(pathEl, midPct <= 0 ? 0.08 : Math.min(0.92, Math.max(0.08, midPct))),
            busy: pointAlongPath(pathEl, Math.min(0.96, Math.max(midPct + 0.06, busyPct))),
            end: pointAlongPath(pathEl, 1),
        });
    }, [travelledPct, futureValue]);

    if (futureValue <= 0) {
        return (
            <div className="card ymm-route-card">
                <div className="ymm-route-header">
                    <Map size={18} className="ymm-route-header-icon" />
                    <div>
                        <div className="ymm-route-title">Your funding route</div>
                        <p className="ymm-route-sub">
                            From today&apos;s position to the total value of your goals.
                        </p>
                    </div>
                </div>
                <p className="ymm-route-empty">No goals to route toward yet.</p>
            </div>
        );
    }

    const clearDash = `${travelledPct} ${Math.max(0, 100 - travelledPct)}`;

    return (
        <div className={`card ymm-route-card${fullyFunded ? ' ymm-route-arrived' : ''}`}>
            <div className="ymm-route-header">
                <Map size={18} className="ymm-route-header-icon" />
                <div>
                    <div className="ymm-route-title">Your funding route</div>
                    <p className="ymm-route-sub">
                        From today&apos;s position to the total value of your goals.
                    </p>
                </div>
            </div>

            <div
                className="ymm-map-canvas"
                role="img"
                aria-label={`Funding route: ${formatCurrency(afterAllocation)} of ${formatCurrency(futureValue)} covered`}
            >
                <div className="ymm-map-surface">
                    <svg
                        className="ymm-map-svg"
                        viewBox={`0 0 ${MAP_VIEWBOX.w} ${MAP_VIEWBOX.h}`}
                        preserveAspectRatio="xMidYMid meet"
                        aria-hidden="true"
                    >
                        <defs>
                            <pattern id="ymm-map-grid" width="32" height="32" patternUnits="userSpaceOnUse">
                                <path
                                    d="M 32 0 L 0 0 0 32"
                                    fill="none"
                                    stroke="rgba(100, 116, 139, 0.12)"
                                    strokeWidth="1"
                                />
                            </pattern>
                            <filter id="ymm-route-glow" x="-20%" y="-20%" width="140%" height="140%">
                                <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.25" />
                            </filter>
                        </defs>
                        <rect width={MAP_VIEWBOX.w} height={MAP_VIEWBOX.h} fill="url(#ymm-map-grid)" />
                        <rect x="70" y="30" width="70" height="48" rx="6" fill="rgba(148, 163, 184, 0.12)" />
                        <rect x="200" y="150" width="90" height="40" rx="6" fill="rgba(148, 163, 184, 0.1)" />
                        <rect x="420" y="24" width="80" height="55" rx="6" fill="rgba(148, 163, 184, 0.11)" />
                        <rect x="500" y="140" width="70" height="45" rx="6" fill="rgba(148, 163, 184, 0.1)" />

                        {/* Road casing */}
                        <path
                            d={ROUTE_PATH}
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.95)"
                            strokeWidth="14"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Busy roads — dashed full route; clear stroke covers the travelled portion */}
                        {!fullyFunded && (
                            <path
                                d={ROUTE_PATH}
                                fill="none"
                                stroke="#dc2626"
                                strokeWidth="7"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeDasharray="5 5"
                                filter="url(#ymm-route-glow)"
                            />
                        )}

                        {/* Easy-travel road */}
                        <path
                            ref={pathRef}
                            d={ROUTE_PATH}
                            pathLength="100"
                            fill="none"
                            stroke={fullyFunded ? '#059669' : '#2563eb'}
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray={clearDash}
                            filter="url(#ymm-route-glow)"
                        />
                    </svg>
                </div>

                <div className="ymm-map-pins">
                    <RoutePin
                        tone="start"
                        label="Current Position"
                        amount={asOfCorpus.total}
                        x={pinPoints.start.x}
                        y={pinPoints.start.y}
                        icon={MapPin}
                    />
                    {travelledPct > 0 && travelledPct < 100 && (
                        <RoutePin
                            tone="travelled"
                            label="Distance you can easily travel"
                            amount={afterAllocation}
                            x={pinPoints.mid.x}
                            y={pinPoints.mid.y}
                            icon={MapPin}
                        />
                    )}
                    {shortfall > 0 && (
                        <RoutePin
                            tone="busy"
                            label="Busy roads in your journey"
                            amount={shortfall}
                            x={pinPoints.busy.x}
                            y={pinPoints.busy.y}
                            icon={AlertCircle}
                        />
                    )}
                    <RoutePin
                        tone={fullyFunded ? 'arrived' : 'dest'}
                        label={fullyFunded ? 'Arrived — All goals' : 'All goals'}
                        amount={futureValue}
                        x={pinPoints.end.x}
                        y={pinPoints.end.y}
                        icon={fullyFunded ? CheckCircle2 : Flag}
                    />
                </div>
            </div>

            <div className="ymm-map-legend">
                <div className="ymm-map-legend-item ymm-map-legend-start">
                    <span className="ymm-map-legend-swatch" aria-hidden="true" />
                    <div>
                        <div className="ymm-map-legend-label">Current Position</div>
                        <strong>{formatCurrency(asOfCorpus.total)}</strong>
                    </div>
                </div>
                <div className="ymm-map-legend-item ymm-map-legend-travelled">
                    <span className="ymm-map-legend-swatch" aria-hidden="true" />
                    <div>
                        <div className="ymm-map-legend-label">Distance you can easily travel</div>
                        <strong>{formatCurrency(afterAllocation)}</strong>
                        <em>Funds you can manage</em>
                    </div>
                </div>
                {shortfall > 0 ? (
                    <div className="ymm-map-legend-item ymm-map-legend-busy">
                        <span className="ymm-map-legend-swatch" aria-hidden="true" />
                        <div>
                            <div className="ymm-map-legend-label">Busy roads in your journey</div>
                            <strong>{formatCurrency(shortfall)}</strong>
                            <em>Funds still needed</em>
                        </div>
                    </div>
                ) : (
                    <div className="ymm-map-legend-item ymm-map-legend-arrived">
                        <span className="ymm-map-legend-swatch" aria-hidden="true" />
                        <div>
                            <div className="ymm-map-legend-label">Route clear</div>
                            <strong>Nothing more needed</strong>
                        </div>
                    </div>
                )}
                <div className={`ymm-map-legend-item ${fullyFunded ? 'ymm-map-legend-arrived' : 'ymm-map-legend-dest'}`}>
                    <span className="ymm-map-legend-swatch" aria-hidden="true" />
                    <div>
                        <div className="ymm-map-legend-label">{fullyFunded ? 'Arrived' : 'All goals'}</div>
                        <strong>{formatCurrency(futureValue)}</strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

const goalStatus = (goal) => {
    if (goal.shortfall <= 0) {
        return { label: 'Fully Funded', tone: 'success' };
    }
    if (goal.afterAllocation > 0) {
        return { label: 'Partially Funded', tone: 'partial' };
    }
    return { label: 'Shortfall', tone: 'danger' };
};

const ProgressBar = ({ percent, tone = 'muted' }) => {
    const clamped = Math.max(0, Math.min(100, percent));
    const fill = tone === 'primary'
        ? 'var(--primary)'
        : tone === 'success'
            ? '#059669'
            : 'rgba(100, 116, 139, 0.45)';
    return (
        <div style={{ marginTop: 8 }}>
            <div
                className="ymm-progress-track"
                style={{
                    height: 8,
                    borderRadius: 999,
                    background: 'rgba(148, 163, 184, 0.25)',
                    overflow: 'hidden',
                }}
            >
                <div
                    style={{
                        width: `${clamped}%`,
                        height: '100%',
                        borderRadius: 999,
                        background: fill,
                        transition: 'width 0.4s ease',
                    }}
                />
            </div>
            <div
                style={{
                    marginTop: 6,
                    fontSize: '0.72rem',
                    fontWeight: 650,
                    color: tone === 'primary' ? 'var(--primary)' : 'var(--text-muted)',
                }}
            >
                Funded: {clamped}%
            </div>
        </div>
    );
};

const StatusBadge = ({ status }) => {
    const styles = {
        success: { bg: 'rgba(16, 185, 129, 0.12)', color: '#059669' },
        partial: { bg: 'rgba(37, 99, 235, 0.1)', color: 'var(--primary)' },
        danger: { bg: 'rgba(239, 68, 68, 0.1)', color: '#dc2626' },
    }[status.tone] || { bg: 'var(--bg-main)', color: 'var(--text-muted)' };

    return (
        <span
            style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: '0.75rem',
                fontWeight: 700,
                padding: '4px 10px',
                borderRadius: 999,
                background: styles.bg,
                color: styles.color,
            }}
        >
            {status.tone === 'success' ? <CheckCircle2 size={13} /> : null}
            {status.label}
        </span>
    );
};

const TrackSurplusAllocationSection = () => {
    const navigate = useNavigate();
    const {
        goals = [],
        expenseCategories = {},
        assetCategories = {},
        calculatorInputs = {},
        investmentAllocations = [],
        familyMembers = [],
        policies = [],
    } = useFinancialPlan();

    const report = useMemo(
        () => buildTrackSurplusAllocationReport({
            goals,
            expenseCategories,
            assetCategories,
            calculatorInputs,
            investmentAllocations,
            familyMembers,
            policies,
            asOfDate: new Date(),
        }),
        [
            goals,
            expenseCategories,
            assetCategories,
            calculatorInputs,
            investmentAllocations,
            familyMembers,
            policies,
        ],
    );

    const { meta, asOfCorpus, totals, goalCards, plannedMonths } = report;

    return (
        <div
            className="track-surplus-allocation money-magic fade-in"
            style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}
        >
            <ReportReveal>
                <div
                    className="card"
                    style={{
                        background: 'linear-gradient(135deg, var(--primary) 0%, #1e3a8a 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '16px',
                        padding: '1.75rem 1.5rem',
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '14px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.12)', padding: '10px', borderRadius: '12px' }}>
                            <Sparkles size={26} color="#fde68a" />
                        </div>
                        <div>
                            <h2 style={{ margin: '0 0 0.4rem', color: '#fff', fontSize: '1.45rem', fontWeight: 700 }}>
                                ✨ Your Money&apos;s Magic
                            </h2>
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.88)', fontSize: '0.98rem', lineHeight: 1.55, maxWidth: 560 }}>
                                Here&apos;s where you stand as of {meta.asOfLabel}, and how much stronger your goals get when you put your surplus to work.
                            </p>
                        </div>
                    </div>
                </div>
            </ReportReveal>

            <ReportReveal delay={80}>
                <div
                    className="card"
                    style={{
                        display: 'flex',
                        gap: '14px',
                        alignItems: 'flex-start',
                        padding: '1.15rem 1.35rem',
                        background: meta.hasPymtwPlans ? 'rgba(37, 99, 235, 0.05)' : 'rgba(245, 158, 11, 0.07)',
                        border: 'none',
                        boxShadow: 'none',
                        borderRadius: 14,
                    }}
                >
                    <Info size={20} style={{ flexShrink: 0, marginTop: 3, color: 'var(--primary)' }} />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 650, marginBottom: '0.3rem', fontSize: '0.95rem' }}>
                            Planning window included
                        </div>
                        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem', lineHeight: 1.55 }}>
                            {meta.plannedMonthsNotice}
                        </p>
                        {plannedMonths.length > 0 && (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '0.85rem' }}>
                                {plannedMonths.map((m) => (
                                    <span
                                        key={m.key}
                                        style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            fontSize: '0.8rem',
                                            padding: '5px 11px',
                                            borderRadius: '999px',
                                            background: 'var(--bg-card)',
                                            color: 'var(--text-main)',
                                        }}
                                    >
                                        <Calendar size={12} />
                                        {m.label}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </ReportReveal>

            <ReportReveal delay={120}>
                <FundingRouteMap asOfCorpus={asOfCorpus} totals={totals} />
            </ReportReveal>

            {!meta.hasPymtwPlans && (
                <ReportReveal delay={160}>
                    <div
                        className="card"
                        style={{
                            padding: '1.6rem',
                            textAlign: 'center',
                            border: 'none',
                            borderRadius: 14,
                        }}
                    >
                        <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            You haven&apos;t planned surplus investments yet. Put your money to work first, then come back to see how each goal improves.
                        </p>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => navigate(PUT_YOUR_MONEY_TO_WORK_PATH)}
                        >
                            Go to Put Your Money to Work
                            <ArrowRight size={16} style={{ marginLeft: 8 }} />
                        </button>
                    </div>
                </ReportReveal>
            )}

            {!meta.hasGoals ? (
                <ReportReveal delay={180}>
                    <div
                        className="card"
                        style={{
                            padding: '2rem',
                            textAlign: 'center',
                            border: 'none',
                            borderRadius: 14,
                        }}
                    >
                        <Target size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem' }}>No goals to track yet</h3>
                        <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Add goals with a target amount to see how your money helps you get there.
                        </p>
                    </div>
                </ReportReveal>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {goalCards.map((goal, index) => {
                        const status = goalStatus(goal);
                        const currentPct = coveragePct(goal.todayCorpus, goal.futureValue);
                        const afterPct = goal.fundedPct ?? coveragePct(goal.afterAllocation, goal.futureValue);
                        const improvement = Math.max(0, Math.round(goal.afterAllocation - goal.todayCorpus));
                        const contributingAvenues = (goal.avenues || []).filter(
                            (avenue) => (avenue.todayValue || 0) > 0 || (avenue.afterValue || 0) > 0,
                        );

                        return (
                            <ReportReveal key={goal.goalId || `${goal.name}-${goal.targetYear}`} delay={160 + index * 40}>
                                <div
                                    className="card"
                                    style={{
                                        padding: '1.5rem 1.5rem 1.35rem',
                                        border: 'none',
                                        borderRadius: 16,
                                        boxShadow: '0 2px 12px rgba(15, 23, 42, 0.05)',
                                        background: 'var(--bg-card)',
                                    }}
                                >
                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            gap: '1rem',
                                            flexWrap: 'wrap',
                                            marginBottom: '1.35rem',
                                        }}
                                    >
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
                                                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
                                                    {goal.name}
                                                </h3>
                                                <StatusBadge status={status} />
                                                {goal.isRetirement && (
                                                    <span
                                                        style={{
                                                            fontSize: '0.72rem',
                                                            padding: '3px 9px',
                                                            borderRadius: '999px',
                                                            background: 'rgba(37, 99, 235, 0.1)',
                                                            color: 'var(--primary)',
                                                            fontWeight: 600,
                                                        }}
                                                    >
                                                        Retirement
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                                                Need by {goal.targetYear}
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-muted)' }}>
                                                Goal amount
                                            </div>
                                            <div style={{ fontWeight: 800, fontSize: '1.45rem', marginTop: 2 }}>
                                                {formatCurrency(goal.futureValue)}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="ymm-coverage-compare">
                                        <div style={{ padding: '0.9rem 1rem', borderRadius: 12, background: 'var(--bg-main)' }}>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--text-main)' }}>
                                                Current Position
                                            </div>
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                                                Without investing your extra surplus
                                            </p>
                                            <strong style={{ display: 'block', marginTop: '0.7rem', fontSize: '1.15rem' }}>
                                                {formatCurrency(goal.todayCorpus)}
                                            </strong>
                                            <ProgressBar percent={currentPct} tone="muted" />
                                        </div>

                                        <div className="ymm-coverage-bridge">
                                            <ArrowDown size={18} color="var(--text-muted)" />
                                            {improvement > 0 && (
                                                <div style={{ textAlign: 'center' }}>
                                                    <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                                                        ✨ Improvement
                                                    </div>
                                                    <div style={{ fontWeight: 800, fontSize: '0.92rem', color: '#059669' }}>
                                                        +{formatCurrency(improvement)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div
                                            style={{
                                                padding: '0.9rem 1rem',
                                                borderRadius: 12,
                                                background: 'rgba(37, 99, 235, 0.06)',
                                            }}
                                        >
                                            <div style={{ fontSize: '0.8rem', fontWeight: 650, color: 'var(--primary)' }}>
                                                After Putting Your Money to Work
                                            </div>
                                            <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: 1.35 }}>
                                                After following planned investments
                                            </p>
                                            <strong style={{ display: 'block', marginTop: '0.7rem', fontSize: '1.3rem', color: 'var(--primary)' }}>
                                                {formatCurrency(goal.afterAllocation)}
                                            </strong>
                                            <ProgressBar percent={afterPct} tone="primary" />
                                        </div>
                                    </div>

                                    <div
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            gap: '1rem',
                                            flexWrap: 'wrap',
                                            padding: '0.85rem 1rem',
                                            borderRadius: 12,
                                            marginBottom: '1.25rem',
                                            background: goal.shortfall > 0 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.06)',
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontSize: '0.8rem', fontWeight: 650 }}>Still Needed</div>
                                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                To fully reach this goal
                                            </div>
                                        </div>
                                        <strong
                                            style={{
                                                fontSize: '1.2rem',
                                                color: goal.shortfall > 0 ? '#dc2626' : '#059669',
                                            }}
                                        >
                                            {goal.shortfall <= 0 ? 'Nothing more needed' : formatCurrency(goal.shortfall)}
                                        </strong>
                                    </div>

                                    {contributingAvenues.length === 0 ? (
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                color: 'var(--text-muted)',
                                                fontSize: '0.9rem',
                                            }}
                                        >
                                            <AlertCircle size={16} />
                                            No investments are contributing to this goal yet.
                                        </div>
                                    ) : (
                                        <div>
                                            <div
                                                style={{
                                                    fontSize: '0.92rem',
                                                    fontWeight: 700,
                                                    marginBottom: '0.75rem',
                                                }}
                                            >
                                                Your investments helping this goal
                                            </div>
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
                                                {contributingAvenues.map((avenue) => (
                                                    <div
                                                        key={avenue.id}
                                                        style={{
                                                            display: 'grid',
                                                            gridTemplateColumns: '1.3fr 1fr 1fr',
                                                            gap: '0.75rem',
                                                            alignItems: 'center',
                                                            padding: '0.75rem 0.9rem',
                                                            borderRadius: 10,
                                                            background: 'var(--bg-main)',
                                                        }}
                                                    >
                                                        <div>
                                                            <div style={{ fontWeight: 650, fontSize: '0.92rem' }}>
                                                                {avenue.type}
                                                            </div>
                                                            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                                                {avenue.kind === 'maturity'
                                                                    ? 'Matures this year'
                                                                    : 'Available for this goal'}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                                                                Current Value
                                                            </div>
                                                            <div style={{ fontSize: '0.9rem' }}>
                                                                {formatCurrency(avenue.currentValue ?? avenue.todayValue)}
                                                            </div>
                                                        </div>
                                                        <div style={{ textAlign: 'right' }}>
                                                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginBottom: 2 }}>
                                                                Funds Allocated for this goal
                                                            </div>
                                                            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                                {formatCurrency(avenue.afterValue)}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </ReportReveal>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TrackSurplusAllocationSection;
