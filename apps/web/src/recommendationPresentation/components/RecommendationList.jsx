import React, { useMemo } from 'react';
import RecommendationCard from './RecommendationCard';
import RecommendationEmptyState from './RecommendationEmptyState';
import { toPresentationModels } from '../toPresentationModel';
import { applyDensityLimit } from '../density';
import { resolveEmptyMessage } from '../emptyStateCopy';
import '../recommendationPresentation.css';

/**
 * Ordered list of recommendation cards.
 *
 * Accepts either orchestration instances (mapped via toPresentationModel) or
 * already-prepared presentation models. Applies presentation density limits
 * without changing orchestration ranking. Renders RecommendationEmptyState when
 * there are no applicable recommendations.
 *
 * @param {'summary'|'detailed'|number} [density] - max cards (summary=3, detailed=5)
 */
const RecommendationList = ({
  recommendations = [],
  models,
  onPrimaryAction,
  ctaContext = {},
  density,
  emptyMessage,
  emptySurface,
  className = '',
  cardClassName = '',
}) => {
  const presentationModels = useMemo(() => {
    const mapped = models ?? toPresentationModels(recommendations);
    return applyDensityLimit(mapped, density);
  }, [models, recommendations, density]);

  if (!presentationModels.length) {
    return (
      <RecommendationEmptyState
        message={resolveEmptyMessage(emptyMessage ?? emptySurface)}
        className={className}
      />
    );
  }

  return (
    <div className={`rec-list ${className}`.trim()}>
      {presentationModels.map((model) => (
        <RecommendationCard
          key={model.id}
          model={model}
          onPrimaryAction={onPrimaryAction}
          ctaContext={ctaContext}
          className={cardClassName}
        />
      ))}
    </div>
  );
};

export default RecommendationList;
