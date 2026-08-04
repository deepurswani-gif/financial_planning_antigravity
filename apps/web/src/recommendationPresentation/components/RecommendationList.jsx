import React, { useEffect, useMemo, useRef } from 'react';
import RecommendationCard from './RecommendationCard';
import RecommendationEmptyState from './RecommendationEmptyState';
import { toPresentationModels } from '../toPresentationModel';
import { applyDensityLimit } from '../density';
import { resolveEmptyMessage } from '../emptyStateCopy';
import { AnalyticsEventName, trackAnalyticsEvent } from '../../lib/analytics';
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

  const viewedIdsRef = useRef(new Set());
  const modelIdsKey = presentationModels.map((m) => m.id).join('|');

  useEffect(() => {
    if (!presentationModels.length) return;
    presentationModels.forEach((m) => {
      if (!m?.id || viewedIdsRef.current.has(m.id)) return;
      viewedIdsRef.current.add(m.id);
      trackAnalyticsEvent({
        eventName: AnalyticsEventName.RECOMMENDATION_VIEW,
        eventCategory: 'recommendation',
        component: 'RecommendationCard',
        feature: 'recommendations',
        properties: { recommendationId: m.id, title: m.title ?? null },
      });
    });
  }, [modelIdsKey, presentationModels]);

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
