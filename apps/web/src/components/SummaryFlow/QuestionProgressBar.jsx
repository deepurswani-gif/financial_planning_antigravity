import React from 'react';

/**
 * Segment progress bar with totalQuestions + 1 nodes on a horizontal track.
 * The first segment is prefilled on every step (node 0 complete, active at node currentIndex + 1).
 */
const QuestionProgressBar = ({ totalQuestions, currentIndex }) => {
    if (!totalQuestions || totalQuestions < 2) return null;

    const nodeCount = totalQuestions + 1;
    const fillPercent = ((currentIndex + 1) / totalQuestions) * 100;

    return (
        <div className="question-progress-bar" aria-hidden="true">
            <div className="question-progress-track">
                <div
                    className="question-progress-fill"
                    style={{ width: `${fillPercent}%` }}
                />
            </div>
            <div className="question-progress-nodes">
                {Array.from({ length: nodeCount }).map((_, idx) => {
                    const isCompleted = idx <= currentIndex;
                    const isActive = idx === currentIndex + 1;
                    return (
                        <div
                            key={idx}
                            className={`question-progress-node${isCompleted ? ' completed' : ''}${isActive ? ' active' : ''}`}
                        />
                    );
                })}
            </div>
        </div>
    );
};

export default QuestionProgressBar;
