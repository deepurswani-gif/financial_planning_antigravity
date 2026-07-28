import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useNavigateToDetailReport } from './reportNavigation';
import {
    Target,
    Sparkles,
    Calendar,
    Info,
    CheckCircle2,
    AlertCircle,
    ArrowRight,
    MapPin,
    Flag,
    Map,
    ChevronDown,
    ChevronUp,
    Pencil,
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import { resolveEmploymentType } from '../DetailedFlow/employmentTypeSync';
import { calculateRetirementYear } from '../ProfileModule/ProfileLogic';
import { buildYourMoneyFlowReport } from './moneyFlowLedgerLogic';
import {
    buildApplyPayload,
    buildTrackSurplusAllocationReport,
    clampAvenueAmount,
    FUTURE_SURPLUS_AVENUE_ID,
    mergeGoalMapping,
    sanitizePlanningMappings,
    SCENARIO_WEALTH,
} from './trackSurplusAllocationLogic';
import ReportReveal from './ReportReveal';

/** Winding route across a 640×220 map canvas. */
const ROUTE_PATH = 'M 48 168 C 110 40, 170 200, 240 112 S 340 36, 400 128 S 470 210, 592 72';
const MAP_VIEWBOX = { w: 640, h: 220 };

const mappingsEqual = (a = {}, b = {}) => {
    const keys = [FUTURE_SURPLUS_AVENUE_ID, 'sip', 'equity', 'lumpsum'];
    return keys.every((key) => Math.round(a[key] || 0) === Math.round(b[key] || 0));
};

const CUSTOMIZED_STORAGE_KEY = 'ymm_customized_goal_ids';

const loadCustomizedGoalIds = () => {
    try {
        const raw = sessionStorage.getItem(CUSTOMIZED_STORAGE_KEY);
        const list = raw ? JSON.parse(raw) : [];
        return new Set(Array.isArray(list) ? list : []);
    } catch {
        return new Set();
    }
};

const persistCustomizedGoalIds = (ids) => {
    try {
        sessionStorage.setItem(CUSTOMIZED_STORAGE_KEY, JSON.stringify([...ids]));
    } catch {
        /* ignore quota / private mode */
    }
};

const pointAlongPath = (pathEl, pct) => {
    if (!pathEl) return { x: 0, y: 0 };
    const length = pathEl.getTotalLength();
    const point = pathEl.getPointAtLength(length * Math.min(1, Math.max(0, pct)));
    return { x: point.x, y: point.y };
};

const yearProgress = (year, startYear, endYear) => {
    if (endYear <= startYear) return year <= startYear ? 0 : 1;
    return Math.min(1, Math.max(0, (year - startYear) / (endYear - startYear)));
};

const JourneyMilestone = ({ tone, label, sublabel, x, y, icon: Icon }) => (
    <button
        type="button"
        className={`ymm-map-pin ymm-map-pin-${tone}`}
        style={{
            left: `${(x / MAP_VIEWBOX.w) * 100}%`,
            top: `${(y / MAP_VIEWBOX.h) * 100}%`,
        }}
        aria-label={sublabel ? `${label}: ${sublabel}` : label}
    >
        <span className="ymm-map-pin-dot" aria-hidden="true">
            <Icon size={14} />
        </span>
        <span className="ymm-map-pin-tooltip" role="tooltip">
            <strong>{label}</strong>
            {sublabel ? <span>{sublabel}</span> : null}
        </span>
    </button>
);

const GoalTimeline = ({ currentYear, endYear, retirementYear, goals = [] }) => {
    const span = Math.max(1, endYear - currentYear);
    return (
        <div className="ymm-goal-timeline" aria-label="Goals timeline">
            <div className="ymm-goal-timeline-bar" />
            <div
                className="ymm-goal-timeline-marker ymm-goal-timeline-start"
                style={{ left: '0%' }}
            >
                <span className="ymm-goal-timeline-dot" />
                <span className="ymm-goal-timeline-label">{currentYear}</span>
            </div>
            {retirementYear >= currentYear && retirementYear <= endYear && (
                <div
                    className="ymm-goal-timeline-marker ymm-goal-timeline-retire"
                    style={{ left: `${((retirementYear - currentYear) / span) * 100}%` }}
                >
                    <span className="ymm-goal-timeline-dot" />
                    <span className="ymm-goal-timeline-label">Retire {retirementYear}</span>
                </div>
            )}
            {goals.map((goal) => {
                const pct = ((goal.targetYear - currentYear) / span) * 100;
                return (
                    <div
                        key={goal.goalId}
                        className="ymm-goal-timeline-marker"
                        style={{ left: `${Math.min(100, Math.max(0, pct))}%` }}
                        title={`${goal.name} · ${goal.targetYear}`}
                    >
                        <span className="ymm-goal-timeline-dot" style={{ background: goal.accent?.hex }} />
                        <span className="ymm-goal-timeline-label">
                            {goal.name}
                            <em>{goal.targetYear}</em>
                        </span>
                    </div>
                );
            })}
            <div
                className="ymm-goal-timeline-marker ymm-goal-timeline-end"
                style={{ left: '100%' }}
            >
                <span className="ymm-goal-timeline-dot" />
                <span className="ymm-goal-timeline-label">{endYear}</span>
            </div>
        </div>
    );
};

const JourneyMap = ({
    currentYear,
    retirementYear,
    farthestGoalYear,
    goals = [],
}) => {
    const pathRef = useRef(null);
    const [pinPoints, setPinPoints] = useState(null);

    const endYear = Math.max(retirementYear || currentYear, farthestGoalYear || currentYear, currentYear);

    const milestones = useMemo(() => {
        const items = [
            {
                id: 'here',
                tone: 'start',
                label: `You are here (${currentYear})`,
                sublabel: null,
                year: currentYear,
                icon: MapPin,
            },
            ...goals.map((goal) => ({
                id: `goal-${goal.goalId}`,
                tone: 'travelled',
                label: goal.name,
                sublabel: String(goal.targetYear),
                year: goal.targetYear,
                icon: Target,
            })),
            {
                id: 'retire',
                tone: 'dest',
                label: `Retirement Year (${retirementYear})`,
                sublabel: null,
                year: retirementYear,
                icon: Flag,
            },
        ];
        return items;
    }, [currentYear, retirementYear, goals]);

    useLayoutEffect(() => {
        const pathEl = pathRef.current;
        if (!pathEl) return;
        const next = {};
        milestones.forEach((item) => {
            next[item.id] = pointAlongPath(pathEl, yearProgress(item.year, currentYear, endYear));
        });
        setPinPoints(next);
    }, [milestones, currentYear, endYear]);

    return (
        <div className="card ymm-route-card">
            <div className="ymm-route-header">
                <Map size={18} className="ymm-route-header-icon" />
                <div>
                    <div className="ymm-route-title">Where the money comes from</div>
                    <p className="ymm-route-sub">
                        Your journey from today to retirement. Goals appear as milestones along the way.
                    </p>
                </div>
            </div>

            <div
                className="ymm-map-canvas"
                role="img"
                aria-label={`Journey from ${currentYear} to retirement ${retirementYear}`}
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
                        </defs>
                        <rect width={MAP_VIEWBOX.w} height={MAP_VIEWBOX.h} fill="url(#ymm-map-grid)" />
                        <path
                            ref={pathRef}
                            d={ROUTE_PATH}
                            pathLength="100"
                            fill="none"
                            stroke="#2563eb"
                            strokeWidth="7"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    </svg>
                </div>

                {pinPoints && (
                    <div className="ymm-map-pins">
                        {milestones.map((item) => {
                            const pt = pinPoints[item.id];
                            if (!pt) return null;
                            return (
                                <JourneyMilestone
                                    key={item.id}
                                    tone={item.tone}
                                    label={item.label}
                                    sublabel={item.sublabel}
                                    x={pt.x}
                                    y={pt.y}
                                    icon={item.icon}
                                />
                            );
                        })}
                    </div>
                )}
            </div>

            <GoalTimeline
                currentYear={currentYear}
                endYear={endYear}
                retirementYear={retirementYear}
                goals={goals}
            />
        </div>
    );
};

const CompositionBar = ({ composition, accent }) => {
    const total = composition.reduce((sum, item) => sum + item.amount, 0);
    if (total <= 0) {
        return (
            <div className="ymm-composition-empty">
                <AlertCircle size={14} />
                Nothing is funding this goal yet.
            </div>
        );
    }

    return (
        <div className="ymm-composition">
            <div className="ymm-composition-title">Suggested allocation for this Goal</div>
            <div className="ymm-composition-bar" aria-hidden="true">
                {composition.map((item, index) => {
                    const pct = (item.amount / total) * 100;
                    const opacity = 1 - index * 0.12;
                    return (
                        <span
                            key={item.id}
                            className="ymm-composition-seg"
                            style={{
                                width: `${pct}%`,
                                background: item.id === FUTURE_SURPLUS_AVENUE_ID
                                    ? '#7c3aed'
                                    : accent.hex,
                                opacity: Math.max(0.45, opacity),
                            }}
                            title={`${item.label}: ${formatCurrency(item.amount)}`}
                        />
                    );
                })}
            </div>
            <ul className="ymm-composition-legend">
                {composition.map((item) => (
                    <li key={item.id}>
                        <span
                            className="ymm-composition-dot"
                            style={{
                                background: item.id === FUTURE_SURPLUS_AVENUE_ID
                                    ? '#7c3aed'
                                    : accent.hex,
                            }}
                        />
                        <span>{item.label}</span>
                        <strong>{formatCurrency(item.amount)}</strong>
                    </li>
                ))}
            </ul>
        </div>
    );
};

const WealthMilestone = ({ scenario, accent }) => {
    const covered = scenario.remainingGap <= 0;
    return (
        <div className="ymm-milestone">
            <div className="ymm-milestone-rail">
                <span
                    className="ymm-milestone-dot"
                    style={{ background: accent.hex, boxShadow: `0 0 0 4px ${accent.soft}` }}
                />
            </div>
            <div className="ymm-milestone-body">
                <div className="ymm-milestone-label">{scenario.label}</div>
                <div className="ymm-milestone-figures">
                    <div>
                        <span>Projected wealth</span>
                        <strong style={{ color: accent.ink }}>{formatCurrency(scenario.projectedWealth)}</strong>
                    </div>
                    <div>
                        <span>Shortfall</span>
                        <strong className={covered ? 'ymm-gap-clear' : 'ymm-gap-open'}>
                            {covered ? 'Nothing more needed' : formatCurrency(scenario.remainingGap)}
                        </strong>
                    </div>
                </div>
            </div>
        </div>
    );
};

const CalculationDetails = ({ audit, accent }) => {
    const [open, setOpen] = useState(false);
    if (!audit?.length) return null;

    return (
        <div className="ymm-calc-details">
            <button
                type="button"
                className="ymm-calc-toggle"
                onClick={() => setOpen((value) => !value)}
                style={{ color: accent.ink }}
            >
                How this was calculated
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {open && (
                <div className="ymm-calc-table">
                    <div className="ymm-calc-row ymm-calc-head">
                        <span>Avenue</span>
                        <span>Available</span>
                        <span>Allocated</span>
                        <span>Remaining</span>
                    </div>
                    {audit.map((row) => (
                        <div key={row.id} className="ymm-calc-row">
                            <span>{row.label}</span>
                            <span>{formatCurrency(row.availableBefore)}</span>
                            <span>{formatCurrency(row.allocated)}</span>
                            <span>{formatCurrency(row.remainingAfter)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const ResidualExpandable = ({ breakdown }) => {
    const [open, setOpen] = useState(false);
    if (!breakdown) return null;

    return (
        <div className="ymm-customize-readonly">
            <button
                type="button"
                className="ymm-calc-toggle"
                onClick={() => setOpen((value) => !value)}
            >
                Accumulated surplus calculation
                {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
            {open && (
                <div className="ymm-calc-table">
                    {(breakdown.lines || []).map((line) => (
                        <div
                            key={line.id}
                            className={`ymm-calc-row${line.id === 'total' ? ' ymm-calc-total' : ''}`}
                        >
                            <span>{line.label}</span>
                            <span />
                            <span />
                            <span>{formatCurrency(line.amount)}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

const CustomizePanel = ({
    goal,
    draft,
    onChange,
    onReset,
    onCancel,
    onSave,
}) => {
    const accent = goal.accent;
    const nonEditableComposition = (goal.scenario?.composition || [])
        .filter((item) => ![
            FUTURE_SURPLUS_AVENUE_ID,
            'sip',
            'equity',
            'lumpsum',
        ].includes(item.id));
    const draftTotal = Object.values(draft).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
    const liveGap = Math.max(
        0,
        goal.goalAmount
            - draftTotal
            - nonEditableComposition.reduce((sum, item) => sum + item.amount, 0),
    );

    return (
        <div className="ymm-customize" style={{ borderColor: accent.hex, background: accent.soft }}>
            <div className="ymm-customize-head">
                <div>
                    <div className="ymm-customize-title" style={{ color: accent.ink }}>
                        Customize allocation
                    </div>
                    <p className="ymm-customize-sub">
                        Edit accumulated surplus, SIP, Equity and Lumpsum for this goal. FD / RD
                        maturities stay automatic.
                    </p>
                </div>
            </div>

            <div className="ymm-customize-rows">
                {goal.editableAvenues.map((avenue) => (
                    <label key={avenue.id} className="ymm-customize-row">
                        <div>
                            <div className="ymm-customize-avenue">{avenue.label}</div>
                            <div className="ymm-customize-meta">
                                Recommended {formatCurrency(avenue.recommended)}
                                {' · '}
                                Max {formatCurrency(avenue.availableMax)}
                            </div>
                        </div>
                        <input
                            type="number"
                            min={0}
                            max={avenue.availableMax}
                            step={1000}
                            value={draft[avenue.id] ?? 0}
                            onChange={(event) => onChange(avenue.id, event.target.value, avenue.availableMax)}
                        />
                    </label>
                ))}
            </div>

            <ResidualExpandable breakdown={goal.residualBreakdown} />

            {(goal.maturityAtGoalYear || []).map((row) => (
                <div key={row.id} className="ymm-customize-readonly-row">
                    <div>
                        <div className="ymm-customize-avenue">{row.label}</div>
                        <div className="ymm-customize-meta">
                            Display only · matures in {goal.targetYear}
                        </div>
                    </div>
                    <strong>{formatCurrency(row.amount)}</strong>
                </div>
            ))}

            <div className="ymm-customize-gap">
                <span>Remaining gap after your edit</span>
                <strong style={{ color: liveGap > 0 ? '#dc2626' : '#059669' }}>
                    {liveGap > 0 ? formatCurrency(liveGap) : 'Nothing more needed'}
                </strong>
            </div>

            <div className="ymm-customize-actions">
                <button type="button" className="btn" onClick={onReset}>
                    Reset to recommendation
                </button>
                <button type="button" className="btn" onClick={onCancel}>
                    Cancel
                </button>
                <button
                    type="button"
                    className="btn btn-primary"
                    style={{ background: accent.hex, borderColor: accent.hex }}
                    onClick={onSave}
                >
                    Save
                </button>
            </div>
        </div>
    );
};

const GoalCard = ({
    goal,
    editing,
    draft,
    onStartEdit,
    onDraftChange,
    onReset,
    onCancel,
    onSave,
    cardRef,
    isCustomized,
}) => {
    const accent = goal.accent;
    const scenario = goal.scenario || goal.scenarios?.[SCENARIO_WEALTH];
    const status = scenario.remainingGap <= 0
        ? { label: 'Fully Funded', tone: 'success' }
        : scenario.projectedWealth > 0
            ? { label: 'Partially Funded', tone: 'partial' }
            : { label: 'Shortfall', tone: 'danger' };

    return (
        <div
            ref={cardRef}
            className="card ymm-goal-card"
            style={{
                borderTop: `4px solid ${accent.hex}`,
                background: `linear-gradient(180deg, ${accent.soft} 0%, var(--bg-card) 88px)`,
            }}
            data-goal-id={goal.goalId}
        >
            <div className="ymm-goal-head">
                <div>
                    <div className="ymm-goal-title-row">
                        <span
                            className="ymm-goal-icon"
                            style={{ background: accent.hex }}
                            aria-hidden="true"
                        >
                            <Target size={16} color="#fff" />
                        </span>
                        <h3>{goal.name}</h3>
                        <span
                            className="ymm-goal-badge"
                            style={{ background: accent.soft, color: accent.ink }}
                        >
                            {status.tone === 'success' ? <CheckCircle2 size={13} /> : null}
                            {status.label}
                        </span>
                        {isCustomized && (
                            <span className="ymm-goal-chip" style={{ background: accent.soft, color: accent.ink }}>
                                Customized
                            </span>
                        )}
                        {goal.isRetirement && (
                            <span className="ymm-goal-chip" style={{ background: accent.soft, color: accent.ink }}>
                                Retirement
                            </span>
                        )}
                    </div>
                    <div className="ymm-goal-sub">Needed by {goal.targetYear}</div>
                </div>
                <div className="ymm-goal-amount">
                    <div className="ymm-goal-amount-label">Goal amount</div>
                    <div className="ymm-goal-amount-value" style={{ color: accent.ink }}>
                        {formatCurrency(goal.goalAmount)}
                    </div>
                </div>
            </div>

            <div className="ymm-milestone-list">
                <WealthMilestone scenario={scenario} accent={accent} />
            </div>

            <CompositionBar
                composition={scenario.composition}
                accent={accent}
            />

            <CalculationDetails audit={goal.calculationAudit} accent={accent} />

            {editing ? (
                <CustomizePanel
                    goal={goal}
                    draft={draft}
                    onChange={onDraftChange}
                    onReset={onReset}
                    onCancel={onCancel}
                    onSave={onSave}
                />
            ) : (
                <div className="ymm-goal-actions">
                    <button
                        type="button"
                        className="btn"
                        style={{ borderColor: accent.hex, color: accent.ink }}
                        onClick={onStartEdit}
                        disabled={!goal.editableAvenues.length
                            && !(goal.futureSurplusUsed > 0)
                            && !(goal.maturityAtGoalYear || []).length}
                    >
                        <Pencil size={14} style={{ marginRight: 6 }} />
                        Customize Allocation
                    </button>
                    {!goal.editableAvenues.length
                        && !(goal.futureSurplusUsed > 0)
                        && !(goal.maturityAtGoalYear || []).length && (
                        <span className="ymm-goal-actions-note">
                            No SIP, Equity, Lumpsum, surplus or maturities to review for this goal.
                        </span>
                    )}
                </div>
            )}
        </div>
    );
};

const TrackSurplusAllocationSection = () => {
    const navigateToDetailReport = useNavigateToDetailReport();
    const {
        goals = [],
        expenseCategories = {},
        assetCategories = {},
        calculatorInputs = {},
        investmentAllocations = [],
        familyMembers = [],
        policies = [],
        journeyProjections = [],
        currentYearLedger,
        planStartMonth = 0,
        income,
        hasSpouseIncome,
        goalMappings = {},
        setGoalMappings,
    } = useFinancialPlan();

    const [editingGoalId, setEditingGoalId] = useState(null);
    const [draftByGoalId, setDraftByGoalId] = useState({});
    const [customizedGoalIds, setCustomizedGoalIds] = useState(() => loadCustomizedGoalIds());
    const cardRefs = useRef({});
    const syncingRef = useRef(false);

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

    const overridesByGoalId = useMemo(() => {
        if (!editingGoalId || !draftByGoalId[editingGoalId]) return {};
        return { [editingGoalId]: draftByGoalId[editingGoalId] };
    }, [editingGoalId, draftByGoalId]);

    const report = useMemo(
        () => buildTrackSurplusAllocationReport({
            goals,
            expenseCategories,
            assetCategories,
            calculatorInputs,
            investmentAllocations,
            familyMembers,
            policies,
            journeyProjections,
            monthlyUnallocatedSurplus: moneyFlowReport.ledger.unallocatedSurplus,
            planStartMonth: moneyFlowReport.meta.planStartMonth,
            asOfDate: new Date(),
            goalMappings,
            overridesByGoalId,
            customizedGoalIds: [...customizedGoalIds],
        }),
        [
            goals,
            expenseCategories,
            assetCategories,
            calculatorInputs,
            investmentAllocations,
            familyMembers,
            policies,
            journeyProjections,
            moneyFlowReport,
            goalMappings,
            overridesByGoalId,
            customizedGoalIds,
        ],
    );

    const { meta, goalCards, plannedMonths } = report;

    const retirementYear = useMemo(() => {
        const retirementGoal = (goalCards || []).find((card) => card.isRetirement);
        if (retirementGoal?.targetYear) return retirementGoal.targetYear;

        const selfMember = (familyMembers || []).find((m) => m.relation?.toLowerCase() === 'self');
        const age = parseInt(selfMember?.retirementAge, 10) || 60;
        const year = calculateRetirementYear(selfMember?.dob, age);
        const parsed = parseInt(year, 10);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
        return meta.asOfYear + Math.max(1, age - 40);
    }, [goalCards, familyMembers, meta.asOfYear]);

    // Auto-write YMM recommendations into goalMappings for non-customized goals.
    useEffect(() => {
        if (syncingRef.current) return;
        const recommended = sanitizePlanningMappings(report.assignments?.currentPlan || {});
        const current = sanitizePlanningMappings(goalMappings);
        const next = { ...current };
        let changed = false;

        Object.entries(recommended).forEach(([goalId, mapping]) => {
            if (customizedGoalIds.has(goalId)) return;
            if (!mappingsEqual(next[goalId], mapping)) {
                next[goalId] = mapping;
                changed = true;
            }
        });

        Object.keys(next).forEach((goalId) => {
            if (customizedGoalIds.has(goalId)) return;
            if (!recommended[goalId]) {
                delete next[goalId];
                changed = true;
            }
        });

        if (!changed) return;
        syncingRef.current = true;
        setGoalMappings(next);
        // Allow the next render cycle to clear the guard after state settles.
        queueMicrotask(() => { syncingRef.current = false; });
    }, [report.assignments?.currentPlan, customizedGoalIds, goalMappings, setGoalMappings]);

    const startEdit = (goal) => {
        const initial = {};
        goal.editableAvenues.forEach((avenue) => {
            initial[avenue.id] = Object.prototype.hasOwnProperty.call(
                goal.appliedMapping || {},
                avenue.id,
            )
                ? avenue.applied
                : avenue.recommended;
        });
        setDraftByGoalId((prev) => ({ ...prev, [goal.goalId]: initial }));
        setEditingGoalId(goal.goalId);
    };

    const resetDraft = (goal) => {
        const initial = {};
        goal.editableAvenues.forEach((avenue) => {
            initial[avenue.id] = avenue.recommended;
        });
        setDraftByGoalId((prev) => ({ ...prev, [goal.goalId]: initial }));
    };

    const handleDraftChange = (goalId, avenueId, value, availableMax) => {
        setDraftByGoalId((prev) => ({
            ...prev,
            [goalId]: {
                ...(prev[goalId] || {}),
                [avenueId]: clampAvenueAmount(value, availableMax),
            },
        }));
    };

    const handleSave = (goal) => {
        // Persist the engine-clamped live result, not a draft that may exceed the
        // remaining need after the user increases accumulated surplus.
        const effectiveAmounts = Object.fromEntries(
            (goal.editableAvenues || []).map((avenue) => [avenue.id, avenue.amount]),
        );
        const { mapping } = buildApplyPayload(goal.goalId, effectiveAmounts);
        setGoalMappings(mergeGoalMapping(goalMappings, goal.goalId, mapping));
        setCustomizedGoalIds((prev) => {
            const next = new Set(prev);
            next.add(goal.goalId);
            persistCustomizedGoalIds(next);
            return next;
        });
        setEditingGoalId(null);
        setDraftByGoalId((prev) => {
            const next = { ...prev };
            delete next[goal.goalId];
            return next;
        });
    };

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
                            <p style={{ margin: 0, color: 'rgba(255,255,255,0.88)', fontSize: '0.98rem', lineHeight: 1.55, maxWidth: 620 }}>
                                This report suggests the most suitable allocation for funding each goal.
                                You can customize it if you wish to make changes.
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
                <JourneyMap
                    currentYear={meta.asOfYear}
                    retirementYear={retirementYear}
                    farthestGoalYear={meta.farthestGoalYear || meta.horizonYear}
                    goals={goalCards}
                />
            </ReportReveal>

            {!meta.hasPymtwPlans && (
                <ReportReveal delay={160}>
                    <div className="card" style={{ padding: '1.6rem', textAlign: 'center', border: 'none', borderRadius: 14 }}>
                        <p style={{ margin: '0 0 1rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            You haven&apos;t planned surplus investments yet. Put your money to work first, then come back to see how each goal improves.
                        </p>
                        <button
                            type="button"
                            className="btn btn-primary"
                            onClick={() => navigateToDetailReport('put_your_money_to_work')}
                        >
                            Go to Put Your Money to Work
                            <ArrowRight size={16} style={{ marginLeft: 8 }} />
                        </button>
                    </div>
                </ReportReveal>
            )}

            {!meta.hasGoals ? (
                <ReportReveal delay={180}>
                    <div className="card" style={{ padding: '2rem', textAlign: 'center', border: 'none', borderRadius: 14 }}>
                        <Target size={32} style={{ color: 'var(--text-muted)', marginBottom: '0.75rem' }} />
                        <h3 style={{ margin: '0 0 0.5rem' }}>No goals to track yet</h3>
                        <p style={{ margin: 0, color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Add goals with a target amount to see how your money helps you get there.
                        </p>
                    </div>
                </ReportReveal>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                    {goalCards.map((goal, index) => (
                        <ReportReveal key={goal.goalId || `${goal.name}-${goal.targetYear}`} delay={180 + index * 40}>
                            <GoalCard
                                goal={goal}
                                editing={editingGoalId === goal.goalId}
                                draft={draftByGoalId[goal.goalId] || {}}
                                isCustomized={customizedGoalIds.has(goal.goalId)}
                                cardRef={(node) => { cardRefs.current[goal.goalId] = node; }}
                                onStartEdit={() => startEdit(goal)}
                                onDraftChange={(avenueId, value, max) => handleDraftChange(goal.goalId, avenueId, value, max)}
                                onReset={() => resetDraft(goal)}
                                onCancel={() => {
                                    setEditingGoalId(null);
                                    setDraftByGoalId((prev) => {
                                        const next = { ...prev };
                                        delete next[goal.goalId];
                                        return next;
                                    });
                                }}
                                onSave={() => handleSave(goal)}
                            />
                        </ReportReveal>
                    ))}
                </div>
            )}
        </div>
    );
};

export default TrackSurplusAllocationSection;
