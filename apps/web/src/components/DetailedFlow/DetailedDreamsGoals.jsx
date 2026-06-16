import React from 'react';
import DetailedProgressiveLayout from './DetailedProgressiveLayout';
import { useDreamsGoalsQuestions } from './useDreamsGoalsQuestions';

const DetailedDreamsGoals = () => {
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
            lastSectionLabel="View Summary Report"
            navigateToQuestionId={navigateToQuestionId}
            onNavigateToQuestionHandled={clearNavigateToQuestion}
        />
    );
};

export default DetailedDreamsGoals;
