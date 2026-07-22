import React from 'react';

/**
 * Optional supporting metric chip. Registry-agnostic — receives prepared props.
 */
const RecommendationMetric = ({ label, value, className = '' }) => {
  if (!value) return null;
  return (
    <div className={`rec-metric ${className}`.trim()}>
      {label ? <span className="rec-metric-label">{label}</span> : null}
      <span className="rec-metric-value">{value}</span>
    </div>
  );
};

export default RecommendationMetric;
