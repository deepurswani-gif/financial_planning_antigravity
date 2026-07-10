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
    getActiveGoals,
    groupPredefinedGoals,
    hasEducationFamilyDetails,
    getEducationFamilyDetails,
    reconcileGoalAmounts,
} from './goalsDetailSync';
import ReconciliationStatus from './ReconciliationStatus';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const CurrencyField = ({ label, value, onChange, placeholder = '0', readOnly, helperText }) => (
    <div>
        {label && (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                {label}
            </label>
        )}
        <div className="currency-input-wrapper">
            <span className="currency-symbol">₹</span>
            <input
                type="number"
                className="conversational-input"
                placeholder={placeholder}
                value={value || ''}
                onChange={readOnly ? undefined : (e) => onChange(e.target.value)}
                readOnly={readOnly}
                style={readOnly ? { background: 'var(--bg-main)', cursor: 'default' } : undefined}
            />
        </div>
        {helperText && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                {helperText}
            </p>
        )}
    </div>
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
        const configuredIds = goals.filter(isConfiguredGoal).map((g) => g.id);
        setPlannedGoalIds((prev) => {
            const merged = new Set([...prev, ...configuredIds]);
            return [...merged];
        });
    }, [goals]);

    const predefinedGoals = useMemo(
        () => goals.filter((g) => g.isPredefined),
        [goals],
    );
    const customGoals = useMemo(
        () => goals.filter((g) => !g.isPredefined),
        [goals],
    );
    const activeGoals = useMemo(() => getActiveGoals(goals), [goals]);
    const catalogGroups = useMemo(() => groupPredefinedGoals(predefinedGoals), [predefinedGoals]);

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
            if (target?.isPredefined) {
                return prev.map((g) => (
                    g.id === goalId
                        ? { ...g, yearsToGoal: '', presentValue: '', inflationRate: g.id.startsWith('edu_') ? 8 : 6 }
                        : g
                ));
            }
            return prev.filter((g) => g.id !== goalId);
        });
        setPlannedGoalIds((prev) => prev.filter((id) => id !== goalId));
    }, [setGoals]);

    const addCustomGoal = useCallback(({ navigateToConfig = false } = {}) => {
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
        if (navigateToConfig) {
            setNavigateToQuestionId(`goal-config-${id}`);
        }
    }, [customGoalName, setGoals]);

    const goalsToConfigure = useMemo(() => {
        const ids = new Set(plannedGoalIds);
        return goals.filter((g) => ids.has(g.id));
    }, [goals, plannedGoalIds]);

    const questions = useMemo(() => {
        const list = [];

        list.push({
            id: 'goals-intro',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Every financial decision becomes meaningful when connected to a life goal.
                        Let&apos;s map the dreams and milestones you want your money to support — with the same detail as your full financial plan.
                    </p>
                    <h2 className="question-title">My Dreams &amp; Goals</h2>
                    {activeGoals.length > 0 && (
                        <p className="question-helper" style={{ marginTop: '1rem' }}>
                            You already have {activeGoals.length} goal{activeGoals.length > 1 ? 's' : ''} captured. You can review, refine, or add more.
                        </p>
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
                        Select all that apply. You&apos;ll enter timing and cost for each selected goal next.
                    </p>

                    <div style={{ maxWidth: '520px', margin: '0 auto', textAlign: 'left' }}>
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

        goalsToConfigure.forEach((goal) => {
            const Icon = getGoalIcon(goal);
            const familyEducation = goal.id.startsWith('edu_') ? getEducationFamilyDetails(goal, familyMembers) : null;
            const useFamilyCost = hasEducationFamilyDetails(goal, familyMembers);
            const futureCost = calculateFutureCost(goal.presentValue, goal.yearsToGoal, goal.inflationRate);
            const goalReconciliation = reconcileGoalAmounts(goal);

            list.push({
                id: `goal-config-${goal.id}`,
                content: (
                    <div className="question-container">
                        <p className="question-narrative" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                            <Icon size={20} />
                            {goal.name}
                        </p>
                        <h2 className="question-title">Plan this goal</h2>

                        <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto', gap: '1.1rem' }}>
                            {familyEducation && (
                                <div style={{
                                    padding: '0.85rem 1rem',
                                    background: 'rgba(37, 99, 235, 0.05)',
                                    borderRadius: '8px',
                                    borderLeft: '4px solid var(--primary)',
                                    fontSize: '0.82rem',
                                    lineHeight: 1.5,
                                }}>
                                    <div style={{ fontWeight: 600, color: 'var(--primary)', marginBottom: '0.35rem' }}>
                                        From family profile
                                    </div>
                                    {familyEducation.courseName && <div>Course: {familyEducation.courseName}</div>}
                                    {familyEducation.courseDuration && <div>Duration: {familyEducation.courseDuration} years</div>}
                                    {familyEducation.remainingTime && <div>Years remaining: {familyEducation.remainingTime}</div>}
                                    {familyEducation.costOfCompleteCourse && (
                                        <div>Total course cost: {formatInr(familyEducation.costOfCompleteCourse)}</div>
                                    )}
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                                    Years remaining to goal
                                </label>
                                <input
                                    type="number"
                                    className="conversational-input"
                                    placeholder="e.g. 10"
                                    value={goal.yearsToGoal || ''}
                                    onChange={(e) => updateGoal(goal.id, 'yearsToGoal', e.target.value)}
                                    readOnly={Boolean(familyEducation?.remainingTime && useFamilyCost)}
                                    style={familyEducation?.remainingTime && useFamilyCost ? { background: 'var(--bg-main)' } : undefined}
                                />
                            </div>

                            <CurrencyField
                                label="Present value of goal (today's cost)"
                                value={goal.presentValue}
                                onChange={(v) => updateGoal(goal.id, 'presentValue', v)}
                                readOnly={useFamilyCost}
                                helperText={useFamilyCost ? 'Pulled from child details in Family Information.' : undefined}
                            />

                            {goal.summaryPresentValue && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    <div>From summary: <strong>{formatInr(goal.summaryPresentValue)}</strong></div>
                                    {goalReconciliation.presentValue && (
                                        <div style={{ marginTop: '0.35rem' }}>
                                            <ReconciliationStatus
                                                reconciliation={goalReconciliation.presentValue}
                                                matchLabel="Matches summary amount"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {goal.summaryYearsToGoal && goalReconciliation.yearsToGoal && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                    <div>Summary timeline: <strong>{goal.summaryYearsToGoal} years</strong> · Detailed: <strong>{goal.yearsToGoal || '—'} years</strong></div>
                                    <div style={{ marginTop: '0.35rem' }}>
                                        <ReconciliationStatus
                                            reconciliation={goalReconciliation.yearsToGoal}
                                            matchLabel="Matches summary timeline"
                                            underPrefix="Fewer years than summary by"
                                            overPrefix="More years than summary by"
                                        />
                                    </div>
                                </div>
                            )}

                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                                    Expected inflation rate (% per year)
                                </label>
                                <input
                                    type="number"
                                    className="conversational-input"
                                    placeholder="6"
                                    value={goal.inflationRate ?? ''}
                                    onChange={(e) => updateGoal(goal.id, 'inflationRate', e.target.value)}
                                    style={{ textAlign: 'center', fontWeight: 600 }}
                                />
                            </div>

                            {goal.presentValue && goal.yearsToGoal && (
                                <div style={{
                                    padding: '0.85rem 1rem',
                                    background: '#ffffff',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                }}>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Estimated future cost</span>
                                    <strong style={{ color: 'var(--positive)' }}>{formatInr(futureCost)}</strong>
                                </div>
                            )}
                        </div>
                    </div>
                ),
            });
        });

        list.push({
            id: 'goals-review',
            content: (
                <div className="question-container">
                    <h2 className="question-title">Your financial goals</h2>
                    <p className="question-helper" style={{ marginBottom: '1.25rem' }}>
                        Review your planned goals. You can go back to adjust any goal or add another.
                    </p>

                    {activeGoals.length === 0 ? (
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
                            No goals configured yet. Go back to select goals and enter their details.
                        </p>
                    ) : (
                        <div style={{ maxWidth: '500px', margin: '0 auto 1.25rem', textAlign: 'left' }}>
                            {activeGoals.map((goal) => {
                                const Icon = getGoalIcon(goal);
                                const futureCost = calculateFutureCost(goal.presentValue, goal.yearsToGoal, goal.inflationRate);
                                return (
                                    <div key={goal.id} className="goal-summary-card">
                                        <div className="goal-summary-info">
                                            <div className="goal-summary-icon"><Icon size={18} /></div>
                                            <div>
                                                <div className="goal-summary-name">{goal.name}</div>
                                                <div className="goal-summary-meta">
                                                    {goal.yearsToGoal} years • {formatInr(goal.presentValue)} today
                                                    {' • '}{goal.inflationRate || 6}% inflation
                                                    {' → '}{formatInr(futureCost)} future
                                                </div>
                                            </div>
                                        </div>
                                        <button type="button" className="goal-remove-btn" onClick={() => removeGoal(goal.id)} title="Remove goal">
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    <button
                        type="button"
                        className="add-goal-btn"
                        onClick={() => setShowCustomInput(true)}
                        style={{ marginBottom: showCustomInput ? '1rem' : 0 }}
                    >
                        <Plus size={18} /> Add another goal
                    </button>

                    {showCustomInput && (
                        <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', gap: '0.65rem' }}>
                            <input
                                type="text"
                                className="conversational-input"
                                placeholder="Enter your goal name..."
                                value={customGoalName}
                                onChange={(e) => setCustomGoalName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && addCustomGoal({ navigateToConfig: true })}
                                autoFocus
                            />
                            <button
                                type="button"
                                className="step-nav-btn primary"
                                onClick={() => addCustomGoal({ navigateToConfig: true })}
                                disabled={!customGoalName.trim()}
                                style={{ whiteSpace: 'nowrap', opacity: customGoalName.trim() ? 1 : 0.5 }}
                            >
                                Add <Plus size={16} />
                            </button>
                        </div>
                    )}
                </div>
            ),
        });

        return list;
    }, [
        activeGoals,
        addCustomGoal,
        catalogGroups,
        customGoalName,
        customGoals,
        familyMembers,
        goalsToConfigure,
        plannedGoalIds,
        removeGoal,
        showCustomInput,
        togglePlannedGoal,
        updateGoal,
    ]);

    return {
        dreamsGoalsQuestions: questions,
        navigateToQuestionId,
        clearNavigateToQuestion: () => setNavigateToQuestionId(null),
    };
}
