import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { detailedFlowSteps } from './detailedFlowSteps';
import { useProgressiveShellWidth } from '../SummaryFlow/useProgressiveShellWidth';
import { financialWorkspacePath, DEFAULT_DETAIL_TAB_ID, DEFAULT_SUMMARY_REPORT_ID } from '../FinancialWorkspace/workspaceNavConfig';
import { resolveSectionId } from '../FinancialWorkspace/sectionIds';
import { useLandingQuestion, focusLandingControl } from '../FinancialWorkspace/smartEdit/useLandingQuestion';
import { scrollProgressiveFlowToTop } from '../SummaryFlow/scrollProgressiveFlowToTop';

const useTypewriter = (text, speed = 30) => {
    const [displayed, setDisplayed] = useState('');
    const [isComplete, setIsComplete] = useState(false);

    useEffect(() => {
        setDisplayed('');
        setIsComplete(false);
        if (!text) return;

        let i = 0;
        const timer = setInterval(() => {
            setDisplayed(text.slice(0, i + 1));
            i++;
            if (i >= text.length) {
                clearInterval(timer);
                setIsComplete(true);
            }
        }, speed);

        return () => clearInterval(timer);
    }, [text, speed]);

    return { displayed, isComplete };
};

const NarrativeScreen = ({ text, onContinue }) => {
    const { displayed, isComplete } = useTypewriter(text, 25);

    return (
        <div className="narrative-overlay">
            <div className="narrative-card">
                <div className="narrative-icon">
                    <Sparkles size={28} />
                </div>
                <p className="narrative-text">
                    &ldquo;{displayed}&rdquo;
                    {!isComplete && <span className="typewriter-cursor" />}
                </p>
                {isComplete && (
                    <motion.button
                        className="narrative-continue-btn"
                        onClick={onContinue}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                    >
                        Continue <ArrowRight size={18} />
                    </motion.button>
                )}
            </div>
        </div>
    );
};

const DetailedProgressiveLayout = ({
    currentStepId,
    questions = [],
    narrative,
    onComplete,
    nextSectionLabel = 'Next Section',
    lastSectionLabel = 'Next Section',
    navigateToQuestionId,
    onNavigateToQuestionHandled,
    contentWidth = 'default',
}) => {
    const navigate = useNavigate();
  const location = useLocation();
    const { savePlanData } = useFinancialPlan();
    const shellClassName = useProgressiveShellWidth(contentWidth);

  const query = new URLSearchParams(location.search);
  const inWorkspaceEdit = location.pathname.startsWith('/financial-workspace') && Boolean(query.get('edit'));
    const [currentQuestionId, setCurrentQuestionId] = useState(() => questions[0]?.id ?? '');
    const [direction, setDirection] = useState(1);
    const [showNarrative, setShowNarrative] = useState(false);
    const { landingQuestionId, control: landingControl, clearLanding } = useLandingQuestion(questions);
    const suppressScrollUntilRef = useRef(0);

    const currentGlobalIndex = detailedFlowSteps.findIndex(s => s.id === currentStepId);

    const currentIndex = Math.max(0, questions.findIndex(q => q.id === currentQuestionId));
    const resolvedIndex = currentIndex >= 0 ? currentIndex : 0;
    const currentQuestion = questions[resolvedIndex] ?? questions[0];

    // Keep the next question/section starting at the top of the viewport.
    // Smart Edit landing temporarily suppresses this so focusLandingControl can scroll to the control.
    useEffect(() => {
        if (Date.now() < suppressScrollUntilRef.current) return;
        scrollProgressiveFlowToTop();
    }, [currentQuestionId, currentStepId]);

    const handleNextQuestion = useCallback(() => {
        const idx = questions.findIndex(q => q.id === currentQuestionId);
        const activeIdx = idx >= 0 ? idx : 0;
        if (activeIdx < questions.length - 1) {
            setDirection(1);
            setCurrentQuestionId(questions[activeIdx + 1].id);
        }
    }, [currentQuestionId, questions]);

    const handlePrevQuestion = useCallback(() => {
        const idx = questions.findIndex(q => q.id === currentQuestionId);
        const activeIdx = idx >= 0 ? idx : 0;
        if (activeIdx > 0) {
            setDirection(-1);
            setCurrentQuestionId(questions[activeIdx - 1].id);
        }
    }, [currentQuestionId, questions]);

    const navigateToNextStep = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        scrollProgressiveFlowToTop();
        if (onComplete) {
            onComplete();
            return;
        }
        const nextStep = detailedFlowSteps[currentGlobalIndex + 1];
        if (nextStep) {
            if (inWorkspaceEdit) {
                const nextSectionId = resolveSectionId(nextStep.id);
                const nextQuery = new URLSearchParams(location.search);
                nextQuery.set('edit', nextSectionId);
                navigate(`${location.pathname}?${nextQuery.toString()}`);
            } else {
                navigate(nextStep.path);
            }
        } else {
            if (inWorkspaceEdit) {
                const mode = query.get('mode') === 'summary' ? 'summary' : 'full';
                const report = query.get('report') ?? DEFAULT_DETAIL_TAB_ID;
                navigate(financialWorkspacePath(mode, { report }));
            } else {
                navigate(financialWorkspacePath('full', { report: DEFAULT_DETAIL_TAB_ID }));
            }
        }
    };

    const handleNextStep = () => {
        if (narrative) {
            setShowNarrative(true);
        } else {
            navigateToNextStep();
        }
    };

    const handlePrevStep = async () => {
        if (savePlanData) {
            try { await savePlanData(); } catch (e) { console.error('Save failed on nav', e); }
        }
        scrollProgressiveFlowToTop();
        if (currentGlobalIndex <= 0) {
            if (inWorkspaceEdit) {
                const mode = query.get('mode') === 'summary' ? 'summary' : 'full';
                const report = query.get('report') ?? DEFAULT_SUMMARY_REPORT_ID;
                navigate(financialWorkspacePath(mode, { report }));
            } else {
                navigate(financialWorkspacePath('summary', { report: DEFAULT_SUMMARY_REPORT_ID }));
            }
            return;
        }
        const prevStep = detailedFlowSteps[currentGlobalIndex - 1];
        if (prevStep) {
            if (inWorkspaceEdit) {
                const prevSectionId = resolveSectionId(prevStep.id);
                const prevQuery = new URLSearchParams(location.search);
                prevQuery.set('edit', prevSectionId);
                navigate(`${location.pathname}?${prevQuery.toString()}`);
            } else {
                navigate(prevStep.path);
            }
        }
    };

    const handleNarrativeContinue = () => {
        setShowNarrative(false);
        navigateToNextStep();
    };

    useEffect(() => {
        setCurrentQuestionId(questions[0]?.id ?? '');
        setDirection(1);
    }, [currentStepId]);

    useEffect(() => {
        if (!navigateToQuestionId) return;
        if (!questions.some((q) => q.id === navigateToQuestionId)) return;
        setDirection(1);
        setCurrentQuestionId(navigateToQuestionId);
        onNavigateToQuestionHandled?.();
    }, [navigateToQuestionId, questions, onNavigateToQuestionHandled]);

    // Smart Edit landing: jump directly to the requested question (no chevrons),
    // focus/scroll the first control, then clear the one-shot landing params.
    useEffect(() => {
        if (!landingQuestionId) return;
        suppressScrollUntilRef.current = Date.now() + 700;
        setDirection(1);
        setCurrentQuestionId(landingQuestionId);
        focusLandingControl(landingControl);
        clearLanding();
    }, [landingQuestionId, landingControl, clearLanding]);

    useEffect(() => {
        if (questions.length === 0) return;
        if (questions.some(q => q.id === currentQuestionId)) return;

        const childMatch = currentQuestionId.match(/^child-\d+-education$/);
        if (childMatch) {
            const childQ = questions.find(q => q.id.startsWith('child-') && q.id.endsWith('-education'));
            if (childQ) {
                setCurrentQuestionId(childQ.id);
                return;
            }
        }

        const stepOrder = [
            'recap', 'self-profile', 'self-main', 'self-tax-earnings', 'self-tax-deductions',
            'spouse-main', 'spouse-tax-earnings', 'spouse-tax-deductions',
            'spouse-details', 'spouse-employment', 'children',
            'recap-household', 'household-breakup', 'recap-emi', 'emi-loans',
            'savings-snapshot', 'savings-breakdown',
            'wealth-recap', 'assets-breakdown', 'custom-assets', 'liabilities', 'custom-liabilities',
            'goals-intro', 'goals-catalog', 'goals-years', 'goals-value', 'goals-review',
        ];
        const prevIdx = stepOrder.indexOf(currentQuestionId);
        for (let i = prevIdx >= 0 ? prevIdx : stepOrder.length - 1; i >= 0; i--) {
            if (questions.some(q => q.id === stepOrder[i])) {
                setCurrentQuestionId(stepOrder[i]);
                return;
            }
        }
        setCurrentQuestionId(questions[questions.length - 1].id);
    }, [questions, currentQuestionId]);

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (showNarrative) return;
            const idx = questions.findIndex(q => q.id === currentQuestionId);
            const activeIdx = idx >= 0 ? idx : 0;
            if (e.key === 'ArrowRight' && activeIdx < questions.length - 1) {
                handleNextQuestion();
            } else if (e.key === 'ArrowLeft' && activeIdx > 0) {
                handlePrevQuestion();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [currentQuestionId, questions, showNarrative, handleNextQuestion, handlePrevQuestion]);

    const variants = {
        enter: (dir) => ({
            x: dir > 0 ? '100%' : '-100%',
            opacity: 0,
        }),
        center: {
            x: 0,
            opacity: 1,
        },
        exit: (dir) => ({
            x: dir < 0 ? '100%' : '-100%',
            opacity: 0,
        }),
    };

    const isFirstQuestion = resolvedIndex === 0;
    const isLastQuestion = resolvedIndex === questions.length - 1;
    const isFirstStep = currentGlobalIndex === 0;
    const isLastStep = currentGlobalIndex === detailedFlowSteps.length - 1;

    return (
        <>
            <AnimatePresence>
                {showNarrative && narrative && (
                    <NarrativeScreen
                        text={narrative}
                        onContinue={handleNarrativeContinue}
                    />
                )}
            </AnimatePresence>

            <button
                className={`nav-chevron nav-chevron-left ${isFirstQuestion ? 'hidden' : ''}`}
                onClick={handlePrevQuestion}
                aria-label="Previous question"
                type="button"
            >
                <ChevronLeft size={24} />
            </button>

            <button
                className={`nav-chevron nav-chevron-right ${isLastQuestion ? 'hidden' : ''}`}
                onClick={handleNextQuestion}
                aria-label="Next question"
                type="button"
            >
                <ChevronRight size={24} />
            </button>

            <div className={shellClassName}>
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={`${currentStepId}-${currentQuestion?.id ?? resolvedIndex}`}
                        custom={direction}
                        variants={variants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{
                            duration: 0.5,
                            ease: [0.45, 0, 0.15, 1],
                        }}
                        style={{ width: '100%' }}
                    >
                        {currentQuestion?.content}
                    </motion.div>
                </AnimatePresence>

                {questions.length > 1 && (
                    <div className="question-dots">
                        {questions.map((q, idx) => (
                            <div
                                key={q.id}
                                className={`question-dot ${idx === resolvedIndex ? 'active' : ''} ${idx < resolvedIndex ? 'completed' : ''}`}
                            />
                        ))}
                    </div>
                )}

                <div className="step-nav-bar">
                    <div>
                        {isFirstQuestion && (
                            <button className="step-nav-btn" onClick={handlePrevStep} type="button">
                                <ArrowLeft size={16} /> {isFirstStep ? 'Back to Summary Report' : 'Previous Section'}
                            </button>
                        )}
                    </div>
                    <div>
                        {isLastQuestion && (
                            <button className="step-nav-btn primary" onClick={handleNextStep} type="button">
                                {isLastStep ? lastSectionLabel : nextSectionLabel} <ArrowRight size={16} />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};

export default DetailedProgressiveLayout;
