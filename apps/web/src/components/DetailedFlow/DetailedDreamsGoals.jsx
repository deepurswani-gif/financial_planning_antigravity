import React from 'react';
import { useNavigate } from 'react-router-dom';
import DetailedProgressiveLayout from './DetailedProgressiveLayout';
import { useDreamsGoalsQuestions } from './useDreamsGoalsQuestions';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import {
    DEFAULT_DETAIL_TAB_ID,
    financialWorkspacePath,
} from '../FinancialWorkspace/workspaceNavConfig';

const DetailedDreamsGoals = () => {
    const navigate = useNavigate();
    const { markDetailedPlanningComplete } = useFinancialPlan();
    const {
        dreamsGoalsQuestions,
        navigateToQuestionId,
        clearNavigateToQuestion,
    } = useDreamsGoalsQuestions();

    return (
        <DetailedProgressiveLayout
            currentStepId="dreams_goals"
            questions={dreamsGoalsQuestions}
            narrative="Perfect. I now have a clear picture of what you're working toward — and what it will take to get there."
            lastSectionLabel="View Detailed Report"
            onComplete={() =>
                (async () => {
                    markDetailedPlanningComplete?.();
                    navigate(
                        financialWorkspacePath('full', { report: DEFAULT_DETAIL_TAB_ID })
                    );
                })()
            }
            navigateToQuestionId={navigateToQuestionId}
            onNavigateToQuestionHandled={clearNavigateToQuestion}
            contentWidth="wide"
        />
    );
};

export default DetailedDreamsGoals;
