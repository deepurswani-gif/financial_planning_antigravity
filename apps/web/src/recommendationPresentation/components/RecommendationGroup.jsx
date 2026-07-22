import React from 'react';
import RecommendationList from './RecommendationList';

/**
 * Grouped recommendation list with an optional heading.
 */
const RecommendationGroup = ({
  title,
  recommendations = [],
  models,
  onPrimaryAction,
  ctaContext = {},
  density,
  emptyMessage,
  emptySurface,
  className = '',
}) => (
  <section className={`rec-group ${className}`.trim()}>
    {title ? <h3 className="rec-group-title">{title}</h3> : null}
    <RecommendationList
      recommendations={recommendations}
      models={models}
      onPrimaryAction={onPrimaryAction}
      ctaContext={ctaContext}
      density={density}
      emptyMessage={emptyMessage}
      emptySurface={emptySurface}
    />
  </section>
);

export default RecommendationGroup;
