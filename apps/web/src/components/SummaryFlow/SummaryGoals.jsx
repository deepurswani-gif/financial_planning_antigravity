import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Sparkles,
    Plus, Trash2, Home, Car, Plane, GraduationCap, Heart,
    Award, PenLine, Target, Check
} from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import { loadSummaryUiDraft, patchSummaryUiDraft } from '../../lib/summaryFlowStorage';
import { calculateFutureCost } from '../GoalModule/GoalLogic';
import QuestionProgressBar from './QuestionProgressBar';

/* ─── Screen constants ─── */
const INTRO   = 0;
const SELECT  = 1;
const YEARS   = 2;
const VALUE   = 3;
const SUMMARY = 4;
const SCREEN_COUNT = 5;

/* ─── Goal templates ─── */
const goalTemplates = [
    { id: 'education', label: 'Child Education', icon: GraduationCap, defaultInflation: 8 },
    { id: 'retirement', label: 'Retirement', icon: Award, defaultInflation: 6 },
    { id: 'car', label: 'Car Purchase', icon: Car, defaultInflation: 6 },
    { id: 'vacation', label: 'Vacation', icon: Plane, defaultInflation: 6 },
    { id: 'home', label: 'Buying a Home', icon: Home, defaultInflation: 6 },
    { id: 'marriage', label: 'Marriage Planning', icon: Heart, defaultInflation: 8 },
];

const getGoalIcon = (name) => {
    const lower = (name || '').toLowerCase();
    if (lower.includes('educat')) return GraduationCap;
    if (lower.includes('retire')) return Award;
    if (lower.includes('car') || lower.includes('vehic')) return Car;
    if (lower.includes('vacat') || lower.includes('tour') || lower.includes('trip')) return Plane;
    if (lower.includes('home') || lower.includes('flat') || lower.includes('house')) return Home;
    if (lower.includes('marriage') || lower.includes('wed')) return Heart;
    return Target;
};

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
};

const isValidGoal = (g) => g.presentValue && g.yearsToGoal;

const migrateSelectedTemplateIds = (saved) => {
    if (Array.isArray(saved?.selectedTemplateIds)) return saved.selectedTemplateIds;
    if (saved?.selectedTemplateId) return [saved.selectedTemplateId];
    return [];
};

/* ─── PAN transition variants ─── */
const panVariants = {
    enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 }),
};
const panTransition = { duration: 0.5, ease: [0.45, 0, 0.15, 1] };

/* ─── Typewriter hook ─── */
const useTypewriter = (text, speed = 25) => {
    const [displayed, setDisplayed] = useState('');
    const [isComplete, setIsComplete] = useState(false);
    useEffect(() => {
        setDisplayed(''); setIsComplete(false);
        if (!text) return;
        let i = 0;
        const t = setInterval(() => { setDisplayed(text.slice(0, ++i)); if (i >= text.length) { clearInterval(t); setIsComplete(true); } }, speed);
        return () => clearInterval(t);
    }, [text, speed]);
    return { displayed, isComplete };
};

/* ─── Narrative overlay ─── */
const NarrativeOverlay = ({ text, onContinue }) => {
    const { displayed, isComplete } = useTypewriter(text);
    return (
        <div className="narrative-overlay">
            <div className="narrative-card">
                <div className="narrative-icon"><Sparkles size={28} /></div>
                <p className="narrative-text">
                    "{displayed}"
                    {!isComplete && <span className="typewriter-cursor" />}
                </p>
                {isComplete && (
                    <motion.button className="narrative-continue-btn" onClick={onContinue}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
                        Continue <ArrowRight size={18} />
                    </motion.button>
                )}
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════ */
const SummaryGoals = () => {
    const { goals, setGoals, savePlanData, summaryReportGeneratedAt, markReportGenerated } = useFinancialPlan();
    const { user } = useAuth();
    const navigate = useNavigate();
    const userId = user?.id ?? null;

    const validGoals = goals.filter(isValidGoal);
    const savedGoalsUi = loadSummaryUiDraft(userId)?.goalsWizard;

    const [screen, setScreen] = useState(() => {
        if (typeof savedGoalsUi?.screen === 'number') return savedGoalsUi.screen;
        return validGoals.length > 0 ? SUMMARY : INTRO;
    });
    const [direction, setDirection] = useState(1);
    const [selectedTemplateIds, setSelectedTemplateIds] = useState(() => migrateSelectedTemplateIds(savedGoalsUi));
    const [selectedCustomGoalIds, setSelectedCustomGoalIds] = useState(
        () => (Array.isArray(savedGoalsUi?.selectedCustomGoalIds) ? savedGoalsUi.selectedCustomGoalIds : []),
    );
    const [pendingGoalIds, setPendingGoalIds] = useState(
        () => (Array.isArray(savedGoalsUi?.pendingGoalIds) ? savedGoalsUi.pendingGoalIds : []),
    );
    const [customGoalName, setCustomGoalName] = useState(savedGoalsUi?.customGoalName ?? '');
    const [showCustomInput, setShowCustomInput] = useState(Boolean(savedGoalsUi?.showCustomInput));
    const [showNarrative, setShowNarrative] = useState(false);

    useEffect(() => {
        patchSummaryUiDraft(userId, {
            goalsWizard: {
                screen,
                selectedTemplateIds,
                selectedCustomGoalIds,
                pendingGoalIds,
                customGoalName,
                showCustomInput,
            },
            lastSummaryPath: '/summary-flow/goals',
        });
    }, [userId, screen, selectedTemplateIds, selectedCustomGoalIds, pendingGoalIds, customGoalName, showCustomInput]);

    const pendingGoals = useMemo(
        () => pendingGoalIds.map((id) => goals.find((g) => g.id === id)).filter(Boolean),
        [pendingGoalIds, goals],
    );

    const customGoals = useMemo(
        () => goals.filter((g) => !g.templateId),
        [goals],
    );

    /* ── Navigation helpers ── */
    const goTo = useCallback((target, dir = 1) => {
        setDirection(dir);
        setScreen(target);
    }, []);

    /* ── Goal CRUD ── */
    const toggleTemplateSelection = (tmplId) => {
        setSelectedTemplateIds((prev) =>
            prev.includes(tmplId) ? prev.filter((id) => id !== tmplId) : [...prev, tmplId],
        );
    };

    const addCustomGoal = () => {
        if (!customGoalName.trim()) return;
        const id = `goal_${Date.now()}`;
        const newGoal = {
            id,
            name: customGoalName.trim(),
            presentValue: '',
            yearsToGoal: '',
            inflationRate: 6,
            courseDuration: 1,
        };
        setGoals([...goals, newGoal]);
        setSelectedCustomGoalIds((prev) => [...prev, id]);
        setShowCustomInput(false);
        setCustomGoalName('');
    };

    const toggleCustomGoalSelection = (goalId) => {
        setSelectedCustomGoalIds((prev) =>
            prev.includes(goalId) ? prev.filter((id) => id !== goalId) : [...prev, goalId],
        );
    };

    const materializeSelectedGoals = () => {
        const updated = [...goals];
        const newPendingIds = [];

        selectedTemplateIds.forEach((tmplId) => {
            const tmpl = goalTemplates.find((t) => t.id === tmplId);
            if (!tmpl) return;

            let existing = updated.find((g) => g.templateId === tmplId);
            if (!existing) {
                existing = {
                    id: `goal_${Date.now()}_${tmplId}`,
                    name: tmpl.label,
                    templateId: tmpl.id,
                    presentValue: '',
                    yearsToGoal: '',
                    inflationRate: tmpl.defaultInflation,
                    courseDuration: 1,
                };
                updated.push(existing);
            }
            newPendingIds.push(existing.id);
        });

        selectedCustomGoalIds.forEach((goalId) => {
            if (updated.find((g) => g.id === goalId)) {
                newPendingIds.push(goalId);
            }
        });

        setGoals(updated);
        setPendingGoalIds(newPendingIds);
    };

    const updateGoal = (goalId, field, value) => {
        setGoals(goals.map((g) => (g.id === goalId ? { ...g, [field]: value } : g)));
    };

    const removeGoal = (goalId) => {
        setGoals(goals.filter((g) => g.id !== goalId));
        setSelectedCustomGoalIds((prev) => prev.filter((id) => id !== goalId));
        setPendingGoalIds((prev) => prev.filter((id) => id !== goalId));
        const removed = goals.find((g) => g.id === goalId);
        if (removed?.templateId) {
            setSelectedTemplateIds((prev) => prev.filter((id) => id !== removed.templateId));
        }
    };

    const handleAddAnother = () => {
        setSelectedTemplateIds([]);
        setSelectedCustomGoalIds([]);
        setPendingGoalIds([]);
        setShowCustomInput(false);
        setCustomGoalName('');
        goTo(SELECT);
    };

    const hasGeneratedReport = Boolean(summaryReportGeneratedAt);

    const handleViewSummary = () => {
        if (hasGeneratedReport) {
            handleOpenReport(false);
            return;
        }
        setShowNarrative(true);
    };

    const handleOpenReport = async (markGenerated = true) => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        if (markGenerated) {
            await markReportGenerated();
        }
        setShowNarrative(false);
        navigate('/summary-report/money_story');
    };

    const handleNarrativeDone = () => handleOpenReport(true);

    /* ── Chevron logic ── */
    const hasSelection = selectedTemplateIds.length > 0 || selectedCustomGoalIds.length > 0;
    const allYearsFilled = pendingGoals.length > 0 && pendingGoals.every((g) => g.yearsToGoal);
    const allValuesFilled = pendingGoals.length > 0 && pendingGoals.every((g) => g.presentValue);

    const canGoLeft = screen > INTRO;
    const canGoRight = (() => {
        if (screen >= SUMMARY) return false;
        if (screen === SELECT) return hasSelection;
        if (screen === YEARS) return allYearsFilled;
        if (screen === VALUE) return allValuesFilled;
        return true;
    })();

    const handleLeft = () => {
        if (!canGoLeft) return;
        if (screen === SUMMARY) {
            if (pendingGoalIds.length > 0) {
                goTo(VALUE, -1);
            } else {
                setSelectedTemplateIds(
                    validGoals.map((g) => g.templateId).filter(Boolean),
                );
                setSelectedCustomGoalIds(
                    validGoals.filter((g) => !g.templateId).map((g) => g.id),
                );
                goTo(SELECT, -1);
            }
        } else if (screen === VALUE) {
            goTo(YEARS, -1);
        } else if (screen === YEARS) {
            goTo(SELECT, -1);
        } else {
            goTo(screen - 1, -1);
        }
    };

    const handleRight = () => {
        if (!canGoRight) return;
        if (screen === INTRO) {
            goTo(SELECT);
        } else if (screen === SELECT) {
            materializeSelectedGoals();
            goTo(YEARS);
        } else if (screen === YEARS) {
            goTo(VALUE);
        } else if (screen === VALUE) {
            setPendingGoalIds([]);
            goTo(SUMMARY);
        }
    };

    /* ── Keyboard nav ── */
    useEffect(() => {
        const onKey = (e) => {
            if (showNarrative) return;
            if (e.key === 'ArrowRight' && canGoRight) handleRight();
            if (e.key === 'ArrowLeft' && canGoLeft) handleLeft();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    });

    const narrativeText = "Perfect. I now have enough clarity to build your complete financial reality map and identify opportunities to improve your future financial outcomes.";

    /* ═══════════ RENDER ═══════════ */
    return (
        <>
            <AnimatePresence>
                {showNarrative && <NarrativeOverlay text={narrativeText} onContinue={handleNarrativeDone} />}
            </AnimatePresence>

            <button
                className={`nav-chevron nav-chevron-left ${!canGoLeft ? 'hidden' : ''}`}
                onClick={handleLeft}
                aria-label="Previous"
            >
                <ChevronLeft size={24} />
            </button>
            <button
                className={`nav-chevron nav-chevron-right ${!canGoRight ? 'hidden' : ''}`}
                onClick={handleRight}
                aria-label="Next"
            >
                <ChevronRight size={24} />
            </button>

            <div className="progressive-question-shell">
                <QuestionProgressBar totalQuestions={SCREEN_COUNT} currentIndex={screen} />

                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={screen}
                        custom={direction}
                        variants={panVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={panTransition}
                        style={{ width: '100%' }}
                    >
                        {screen === INTRO && (
                            <div className="question-container">
                                <p className="question-narrative">
                                    Every financial decision becomes meaningful when connected to a life goal.
                                    Now let&apos;s map the dreams and milestones you want your money to support.
                                </p>
                            </div>
                        )}

                        {screen === SELECT && (
                            <div className="question-container">
                                <h2 className="question-title">
                                    Which goals would you like to plan?
                                </h2>
                                <p className="question-helper" style={{ marginBottom: '1.5rem' }}>
                                    Select all that apply. You&apos;ll enter timing and cost for each selected goal next.
                                </p>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', maxWidth: '520px', margin: '0 auto 1.5rem' }}>
                                    {goalTemplates.map((tmpl) => {
                                        const Icon = tmpl.icon;
                                        const isSelected = selectedTemplateIds.includes(tmpl.id);
                                        const existingGoal = goals.find((g) => g.templateId === tmpl.id);
                                        const isConfigured = existingGoal && isValidGoal(existingGoal);
                                        return (
                                            <div
                                                key={tmpl.id}
                                                className={`option-card ${isSelected ? 'selected' : ''}`}
                                                style={{ padding: '1.15rem 0.75rem', minWidth: 'auto', maxWidth: 'none', position: 'relative', cursor: 'pointer' }}
                                                onClick={() => toggleTemplateSelection(tmpl.id)}
                                            >
                                                {isSelected && (
                                                    <div style={{
                                                        position: 'absolute', top: 8, right: 8,
                                                        width: 22, height: 22, borderRadius: '50%',
                                                        background: isConfigured ? 'var(--positive)' : 'var(--primary)',
                                                        color: 'white',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                    }}>
                                                        <Check size={14} />
                                                    </div>
                                                )}
                                                <div style={{ color: isSelected ? 'var(--positive)' : 'var(--primary)' }}>
                                                    <Icon size={22} />
                                                </div>
                                                <div className="option-card-title" style={{ fontSize: '0.82rem' }}>
                                                    {tmpl.label}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div
                                        className={`option-card ${showCustomInput ? 'selected' : ''}`}
                                        style={{ padding: '1.15rem 0.75rem', minWidth: 'auto', maxWidth: 'none', cursor: 'pointer' }}
                                        onClick={() => setShowCustomInput(true)}
                                    >
                                        <div style={{ color: 'var(--color-3, #787CFE)' }}><PenLine size={22} /></div>
                                        <div className="option-card-title" style={{ fontSize: '0.82rem' }}>Any Other Goal</div>
                                    </div>
                                </div>

                                {customGoals.length > 0 && (
                                    <div style={{ maxWidth: '520px', margin: '0 auto 1rem', textAlign: 'left' }}>
                                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.65rem' }}>
                                            Your custom goals
                                        </div>
                                        {customGoals.map((goal) => {
                                            const isSelected = selectedCustomGoalIds.includes(goal.id);
                                            return (
                                                <div
                                                    key={goal.id}
                                                    className={`option-card ${isSelected ? 'selected' : ''}`}
                                                    style={{ padding: '0.75rem 1rem', marginBottom: '0.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                                                    onClick={() => toggleCustomGoalSelection(goal.id)}
                                                >
                                                    <Target size={18} />
                                                    <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>{goal.name}</span>
                                                    {isSelected && <Check size={14} style={{ marginLeft: 'auto', color: 'var(--positive)' }} />}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                {showCustomInput && (
                                    <div style={{ maxWidth: '420px', margin: '0 auto', display: 'flex', gap: '0.75rem' }}>
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
                        )}

                        {screen === YEARS && pendingGoals.length > 0 && (
                            <div className="question-container">
                                <h2 className="question-title">
                                    After how many years would you like to achieve this goal?
                                </h2>

                                <div className="question-fields" style={{ maxWidth: '520px', margin: '0 auto' }}>
                                    {pendingGoals.map((goal) => {
                                        const Icon = getGoalIcon(goal.name);
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
                                    })}
                                </div>
                            </div>
                        )}

                        {screen === VALUE && pendingGoals.length > 0 && (
                            <div className="question-container">
                                <h2 className="question-title">
                                    If you were to achieve this goal today, how much would it cost approximately?
                                </h2>

                                <div className="question-fields" style={{ maxWidth: '520px', margin: '0 auto' }}>
                                    {pendingGoals.map((goal) => {
                                        const Icon = getGoalIcon(goal.name);
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
                                    })}
                                </div>
                            </div>
                        )}

                        {screen === SUMMARY && (
                            <div className="question-container">
                                <h2 className="question-title" style={{ fontSize: '1.4rem', marginBottom: '1.5rem' }}>
                                    Your Financial Goals
                                </h2>

                                {validGoals.length === 0 ? (
                                    <div style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
                                        No goals added yet. Add your first goal to continue.
                                    </div>
                                ) : (
                                    <div style={{ maxWidth: '500px', margin: '0 auto 1.5rem', textAlign: 'left' }}>
                                        {validGoals.map((goal) => {
                                            const Icon = getGoalIcon(goal.name);
                                            const futureCost = calculateFutureCost(goal.presentValue, goal.yearsToGoal, goal.inflationRate);
                                            return (
                                                <div key={goal.id} className="goal-summary-card">
                                                    <div className="goal-summary-info">
                                                        <div className="goal-summary-icon"><Icon size={18} /></div>
                                                        <div>
                                                            <div className="goal-summary-name">{goal.name}</div>
                                                            <div className="goal-summary-meta">
                                                                {goal.yearsToGoal ? `${goal.yearsToGoal} years` : ''}
                                                                {goal.presentValue ? ` • ${formatInr(goal.presentValue)}` : ''}
                                                            </div>
                                                            {futureCost > 0 && (
                                                                <div style={{ fontSize: '0.8rem', color: 'var(--positive)', marginTop: '0.2rem' }}>
                                                                    Estimated Future Cost: {formatInr(futureCost)}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button className="goal-remove-btn" onClick={() => removeGoal(goal.id)} title="Remove goal">
                                                        <Trash2 size={16} />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}

                                <button className="add-goal-btn" onClick={handleAddAnother}>
                                    <Plus size={18} /> Add Another Goal
                                </button>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                <div className="step-nav-bar">
                    <div>
                        {(screen === INTRO || screen === SUMMARY) && (
                            <button className="step-nav-btn" onClick={async () => {
                                if (savePlanData) {
                                    try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
                                }
                                navigate('/summary-flow/liabilities');
                            }}>
                                <ArrowLeft size={16} /> Previous Section
                            </button>
                        )}
                    </div>
                    <div>
                        {screen === SUMMARY && (
                            <button className="step-nav-btn primary" onClick={handleViewSummary}>
                                {hasGeneratedReport ? 'View Summary Report' : 'Generate Summary Report'}
                                <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default SummaryGoals;
