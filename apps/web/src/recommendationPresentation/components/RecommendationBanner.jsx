import React from 'react';

/**
 * Future-ready banner surface for high-priority recommendations.
 * Minimal stub — not used by Phase 9 pilots.
 */
const RecommendationBanner = ({ model, className = '' }) => {
  if (!model) return null;
  return (
    <aside
      className={`rec-banner ${model.severityStyle?.className ?? ''} ${className}`.trim()}
      style={{ '--rec-accent': model.severityStyle?.accent }}
      data-recommendation-id={model.id}
    >
      <span className="rec-severity-badge">{model.severityStyle?.label}</span>
      <strong className="rec-banner-title">{model.title}</strong>
      <p className="rec-banner-summary">{model.summary}</p>
    </aside>
  );
};

export default RecommendationBanner;
