import React from 'react';

/**
 * Positive empty state when a recommendation list has nothing to show.
 */
const RecommendationEmptyState = ({
  message = 'No recommendations right now — you are in good shape for this section.',
  className = '',
}) => (
  <div className={`rec-empty ${className}`.trim()} role="status">
    <p className="rec-empty-message">{message}</p>
  </div>
);

export default RecommendationEmptyState;
