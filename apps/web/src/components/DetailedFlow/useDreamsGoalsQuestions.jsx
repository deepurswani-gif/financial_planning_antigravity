import { useMemo, useState, useCallback, useEffect } from 'react';
import {
    Plus, Trash2, PenLine, Check, Target,
} from 'lucide-react';
import { getGoalIcon } from './goalIcons';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateFutureCost } from '../GoalModule/GoalLogic';
import {
    initializeGoalsFromFamily,
    isConfiguredGoal,
    getSummaryFlowGoals,
    getDetailedFlowGoals,
    getAvailableCatalogGroups,
    isSummaryOriginGoal,
} from './goalsDetailSync';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const CategoryHeading = ({ children }) => (
    <div style={{
        fontSize: '0.78rem',
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        marginBottom: '0.85rem',
        marginTop: '0.25rem',
    }}>
        {children}
    </div>
);

const GoalSummaryCard = ({ goal, onRemove, showFutureCost = true }) => {
    const Icon = getGoalIcon(goal);
    const futureCost = calculateFutureCost(goal.presentValue, goal.yearsToGoal, goal.inflationRate);
    return (
        <div className="goal-summary-card">
            <div className="goal-summary-info">
                <div className="goal-summary-icon"><Icon size={18} /></div>
                <div>
                    <div className="goal-summary-name">{goal.name}</div>
                    <div className="goal-summary-meta">
                        {goal.yearsToGoal ? `${goal.yearsToGoal} years` : ''}
                        {goal.presentValue ? ` • ${formatInr(goal.presentValue)}` : ''}
                    </div>
                    {showFutureCost && futureCost > 0 && (
                        <div style={{ fontSize: '0.8rem', color: 'var(--positive)', marginTop: '0.2rem' }}>
                            Estimated Future Cost: {formatInr(futureCost)}
                        </div>
                    )}
                </div>
            </div>
            {onRemove && (
                <button type="button" className="goal-remove-btn" onClick={() => onRemove(goal.id)} title="Remove goal">
                    <Trash2 size={16} />
                </button>
            )}
        </div>
    );
};

const YearsFields = ({ goals, updateGoal }) => (
    goals.map((goal) => {
        const Icon = getGoalIcon(goal);
        return (
            <div key={goal.id} style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <Icon size={18} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{goal.name}</span>
                </div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Years Remaining
                </label>
                <input
                    type="number"
                    className="conversational-input"
                    placeholder="e.g. 10"
                    value={goal.yearsToGoal || ''}
                    onChange={(e) => updateGoal(goal.id, 'yearsToGoal', e.target.value)}
                    style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 600 }}
                />
            </div>
        );
    })
);

const ValueFields = ({ goals, updateGoal }) => (
    goals.map((goal) => {
        const Icon = getGoalIcon(goal);
        return (
            <div key={goal.id} style={{ marginBottom: '1.5rem', paddingBottom: '1.25rem', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                    <Icon size={18} style={{ color: 'var(--primary)' }} />
                    <span style={{ fontSize: '0.9rem', fontWeight: 600 }}>{goal.name}</span>
                </div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Present Value of Goal
                </label>
                <div className="currency-input-wrapper">
                    <span className="currency-symbol">₹</span>
                    <input
                        type="number"
                        className="conversational-input"
                        placeholder="e.g. 500000"
                        value={goal.presentValue || ''}
                        onChange={(e) => updateGoal(goal.id, 'presentValue', e.target.value)}
                    />
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                    Assumed Inflation Rate: <strong style={{ color: 'var(--primary)' }}>{goal.inflationRate || 6}%</strong>
                </div>
            </div>
        );
    })
);

export function useDreamsGoalsQuestions() {
    const { familyMembers, goals, setGoals, loading } = useFinancialPlan();
    const [plannedGoalIds, setPlannedGoalIds] = useState([]);
    const [showCustomInput, setShowCustomInput] = useState(false);
    const [customGoalName, setCustomGoalName] = useState('');
    const [navigateToQuestionId, setNavigateToQuestionId] = useState(null);

    useEffect(() => {
        if (loading) return;
        setGoals((prev) => initializeGoalsFromFamily(familyMembers, prev));
    }, [loading, familyMembers, setGoals]);

    useEffect(() => {
        const configuredDetailedIds = goals
            .filter((g) => isConfiguredGoal(g) && !isSummaryOriginGoal(g))
            .map((g) => g.id);
        setPlannedGoalIds((prev) => {
            const merged = new Set([...prev, ...configuredDetailedIds]);
            return [...merged];
        });
    }, [goals]);

    const predefinedGoals = useMemo(
        () => goals.filter((g) => g.isPredefined),
        [goals],
    );
    const customGoals = useMemo(
        () => goals.filter((g) => !g.isPredefined && !isSummaryOriginGoal(g)),
        [goals],
    );
    const summaryGoals = useMemo(() => getSummaryFlowGoals(goals), [goals]);
    const detailedGoals = useMemo(
        () => getDetailedFlowGoals(goals, plannedGoalIds),
        [goals, plannedGoalIds],
    );
    const catalogGroups = useMemo(
        () => getAvailableCatalogGroups(predefinedGoals, goals),
        [predefinedGoals, goals],
    );

    const updateGoal = useCallback((goalId, field, value) => {
        setGoals((prev) => prev.map((g) => {
            if (g.id !== goalId) return g;
            const next = { ...g, [field]: value };
            if (field === 'presentValue' && g.id.startsWith('edu_')) {
                next.totalCourseCost = value;
            }
            return next;
        }));
    }, [setGoals]);

    const togglePlannedGoal = useCallback((goalId) => {
        setPlannedGoalIds((prev) => (
            prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId]
        ));
    }, []);

    const removeGoal = useCallback((goalId) => {
        setGoals((prev) => {
            const target = prev.find((g) => g.id === goalId);
            if (target?.isPredefined && !isSummaryOriginGoal(target)) {
                return prev.map((g) => (
                    g.id === goalId
                        ? {
                            ...g,
                            yearsToGoal: '',
                            presentValue: '',
                            inflationRate: g.id.startsWith('edu_') ? 8 : 6,
                            summaryPresentValue: undefined,
                            summaryYearsToGoal: undefined,
                            fromSummary: undefined,
                        }
                        : g
                ));
            }
            if (target?.isPredefined && isSummaryOriginGoal(target)) {
                // Legacy migrated slot: clear values so it returns to catalog availability
                return prev.map((g) => (
                    g.id === goalId
                        ? {
                            ...g,
                            yearsToGoal: '',
                            presentValue: '',
                            inflationRate: g.id.startsWith('edu_') ? 8 : 6,
                            summaryPresentValue: undefined,
                            summaryYearsToGoal: undefined,
                            fromSummary: undefined,
                        }
                        : g
                ));
            }
            return prev.filter((g) => g.id !== goalId);
        });
        setPlannedGoalIds((prev) => prev.filter((id) => id !== goalId));
    }, [setGoals]);

    const addCustomGoal = useCallback(() => {
        if (!customGoalName.trim()) return;
        const id = `custom_${Date.now()}`;
        const newGoal = {
            id,
            name: customGoalName.trim(),
            isPredefined: false,
            yearsToGoal: '',
            presentValue: '',
            inflationRate: 6,
            courseDuration: 1,
        };
        setGoals((prev) => [...prev, newGoal]);
        setPlannedGoalIds((prev) => [...prev, id]);
        setCustomGoalName('');
        setShowCustomInput(false);
    }, [customGoalName, setGoals]);

    const questions = useMemo(() => {
        const list = [];
        const configuredSummary = summaryGoals.filter(isConfiguredGoal);

        list.push({
            id: 'goals-intro',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Every financial decision becomes meaningful when connected to a life goal.
                        Let&apos;s map the dreams and milestones you want your money to support — with the same detail as your full financial plan.
                    </p>
                    <h2 className="question-title">My Dreams &amp; Goals</h2>
                    {configuredSummary.length > 0 && (
                        <>
                            <p className="question-helper" style={{ marginTop: '1rem', marginBottom: '1.25rem' }}>
                                You already have {configuredSummary.length} goal{configuredSummary.length > 1 ? 's' : ''} captured. You can review, refine, or add more.
                            </p>
                            <h2 className="question-title" style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>
                                Your Financial Goals
                            </h2>
                            <div className="goals-review-panel">
                                {configuredSummary.map((goal) => (
                                    <GoalSummaryCard key={goal.id} goal={goal} onRemove={removeGoal} />
                                ))}
                            </div>
                        </>
                    )}
                </div>
            ),
        });

        list.push({
            id: 'goals-catalog',
            content: (
                <div className="question-container">
                    <h2 className="question-title">Which goals would you like to plan?</h2>
                    <p className="question-helper" style={{ marginBottom: '1.5rem' }}>
                        Select additional goals beyond those already captured in your summary. You&apos;ll enter timing and cost next.
                    </p>

                    <div className="goals-catalog-panel">
                        {catalogGroups.length === 0 && customGoals.length === 0 && (
                            <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.9rem' }}>
                                All standard goals from your summary are already covered. You can still add a custom goal below.
                            </p>
                        )}

                        {catalogGroups.map((group) => (
                            <div key={group.key} style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                                    {group.label}
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.65rem' }}>
                                    {group.goals.map((goal) => {
                                        const Icon = getGoalIcon(goal);
                                        const isSelected = plannedGoalIds.includes(goal.id);
                                        const isDone = isConfiguredGoal(goal);
                                        return (
                                            <div
                                                key={goal.id}
                                                className={`option-card ${isSelected ? 'selected' : ''}`}
                                                style={{ padding: '0.85rem 0.65rem', minWidth: 'auto', maxWidth: 'none', position: 'relative', cursor: 'pointer' }}
                                                onClick={() => togglePlannedGoal(goal.id)}
                                            >
                                                {isSelected && (
                                                    <div style={{
                                                        position: 'absolute', top: 8, right: 8,
                                                        width: 20, height: 20, borderRadius: '50%',
                                                        background: isDone ? 'var(--positive)' : 'var(--primary)',
                                                        color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Check size={12} />
                                                    </div>
                                                )}
                                                <div style={{ color: isSelected ? 'var(--positive)' : 'var(--primary)' }}>
                                                    <Icon size={20} />
                                                </div>
                                                <div className="option-card-title" style={{ fontSize: '0.78rem' }}>
                                                    {goal.name}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))}

                        {customGoals.length > 0 && (
                            <div style={{ marginBottom: '1rem' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                                    Your custom goals
                                </div>
                                {customGoals.map((goal) => {
                                    const isSelected = plannedGoalIds.includes(goal.id);
                                    return (
                                        <div
                                            key={goal.id}
                                            className={`option-card ${isSelected ? 'selected' : ''}`}
                                            style={{ padding: '0.75rem 1rem', marginBottom: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                            onClick={() => togglePlannedGoal(goal.id)}
                                        >
                                            <Target size={18} />
                                            <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{goal.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {!showCustomInput ? (
                            <button
                                type="button"
                                className="add-goal-btn"
                                style={{ width: '100%', marginTop: '0.5rem' }}
                                onClick={() => setShowCustomInput(true)}
                            >
                                <PenLine size={16} /> Add custom goal
                            </button>
                        ) : (
                            <div style={{ display: 'flex', gap: '0.65rem', marginTop: '0.75rem' }}>
                                <input
                                    type="text"
                                    className="conversational-input"
                                    placeholder="Enter your goal name..."
                                    value={customGoalName}
                                    onChange={(e) => setCustomGoalName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && addCustomGoal()}
                                    autoFocus
                                />
                                <button
                                    type="button"
                                    className="step-nav-btn primary"
                                    onClick={addCustomGoal}
                                    disabled={!customGoalName.trim()}
                                    style={{ whiteSpace: 'nowrap', opacity: customGoalName.trim() ? 1 : 0.5 }}
                                >
                                    Add <Plus size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            ),
        });

        list.push({
            id: 'goals-years',
            content: (
                <div className="question-container">
                    <h2 className="question-title">
                        After how many years would you like to achieve this goal?
                    </h2>

                    <div className="question-fields" style={{ maxWidth: '520px', margin: '0 auto' }}>
                        {detailedGoals.length === 0 && summaryGoals.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>
                                No goals selected yet. Go back to add goals, or continue if you only want to review later.
                            </p>
                        ) : (
                            <>
                                {detailedGoals.length > 0 && (
                                    <div style={{ marginBottom: summaryGoals.length > 0 ? '1.75rem' : 0 }}>
                                        <CategoryHeading>Goals selected in detailed flow</CategoryHeading>
                                        <YearsFields goals={detailedGoals} updateGoal={updateGoal} />
                                    </div>
                                )}
                                {summaryGoals.length > 0 && (
                                    <div>
                                        <CategoryHeading>Goals already selected in summary flow</CategoryHeading>
                                        <YearsFields goals={summaryGoals} updateGoal={updateGoal} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ),
        });

        list.push({
            id: 'goals-value',
            content: (
                <div className="question-container">
                    <h2 className="question-title">
                        If you were to achieve this goal today, how much would it cost approximately?
                    </h2>

                    <div className="question-fields" style={{ maxWidth: '520px', margin: '0 auto' }}>
                        {detailedGoals.length === 0 && summaryGoals.length === 0 ? (
                            <p style={{ color: 'var(--text-muted)' }}>
                                No goals selected yet. Go back to add goals, or continue to the summary.
                            </p>
                        ) : (
                            <>
                                {detailedGoals.length > 0 && (
                                    <div style={{ marginBottom: summaryGoals.length > 0 ? '1.75rem' : 0 }}>
                                        <CategoryHeading>Goals selected in detailed flow</CategoryHeading>
                                        <ValueFields goals={detailedGoals} updateGoal={updateGoal} />
                                    </div>
                                )}
                                {summaryGoals.length > 0 && (
                                    <div>
                                        <CategoryHeading>Goals already selected in summary flow</CategoryHeading>
                                        <ValueFields goals={summaryGoals} updateGoal={updateGoal} />
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            ),
        });

        const reviewDetailed = detailedGoals.filter(isConfiguredGoal);
        const reviewSummary = summaryGoals.filter(isConfiguredGoal);

        list.push({
            id: 'goals-review',
            content: (
                <div className="question-container">
                    <h2 className="question-title">Your financial goals</h2>
                    <p className="question-helper" style={{ marginBottom: '1.25rem' }}>
                        Review your planned goals. You can go back to adjust any goal or add another.
                    </p>

                    {reviewDetailed.length === 0 && reviewSummary.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                            No goals configured yet. Go back to select goals and enter their details.
                        </p>
                    ) : (
                        <div className="goals-review-panel" style={{ marginBottom: '1.25rem' }}>
                            {reviewDetailed.length > 0 && (
                                <div style={{ marginBottom: reviewSummary.length > 0 ? '1.5rem' : 0 }}>
                                    <CategoryHeading>Goals selected in detailed flow</CategoryHeading>
                                    {reviewDetailed.map((goal) => (
                                        <GoalSummaryCard key={goal.id} goal={goal} onRemove={removeGoal} />
                                    ))}
                                </div>
                            )}
                            {reviewSummary.length > 0 && (
                                <div>
                                    <CategoryHeading>Goals already selected in summary flow</CategoryHeading>
                                    {reviewSummary.map((goal) => (
                                        <GoalSummaryCard key={goal.id} goal={goal} onRemove={removeGoal} />
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <button
                        type="button"
                        className="add-goal-btn"
                        onClick={() => {
                            setShowCustomInput(false);
                            setNavigateToQuestionId('goals-catalog');
                        }}
                        style={{ marginBottom: 0 }}
                    >
                        <Plus size={18} /> Add another goal
                    </button>
                </div>
            ),
        });

        return list;
    }, [
        addCustomGoal,
        catalogGroups,
        customGoalName,
        customGoals,
        detailedGoals,
        plannedGoalIds,
        removeGoal,
        showCustomInput,
        summaryGoals,
        togglePlannedGoal,
        updateGoal,
    ]);

    return {
        dreamsGoalsQuestions: questions,
        navigateToQuestionId,
        clearNavigateToQuestion: () => setNavigateToQuestionId(null),
    };
}
