import React from 'react';
import { useNavigate } from 'react-router-dom';
import DetailedProgressiveLayout from './DetailedProgressiveLayout';
import { useDreamsGoalsQuestions } from './useDreamsGoalsQuestions';
import { DEFAULT_DETAILED_REPORT_PATH } from '../DetailedReport/detailedReportSteps';

const DetailedDreamsGoals = () => {
    const navigate = useNavigate();
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
            onComplete={() => navigate(DEFAULT_DETAILED_REPORT_PATH)}
            navigateToQuestionId={navigateToQuestionId}
            onNavigateToQuestionHandled={clearNavigateToQuestion}
        />
    );
};

export default DetailedDreamsGoals;
