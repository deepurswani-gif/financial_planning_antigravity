/**
 * Recommendation Presentation System — public API.
 *
 * Visual layer over orchestration instances. Reports compose these components
 * and never rebuild recommendation card chrome. Components are registry-agnostic;
 * only toPresentationModel may read recommendation definitions.
 */

export { severityStyle, SEVERITY_STYLES } from './severityStyles';
export {
  CONFIDENCE_STATES,
  CONFIDENCE_COPY,
  resolveConfidencePresentation,
} from './confidence';
export {
  METRIC_LABELS,
  buildSupportingMetrics,
  pickPrimaryMetric,
} from './metricDisplay';
export {
  toPresentationModel,
  toPresentationModels,
  PRIMARY_ACTION_UPDATE_INFORMATION,
  SECONDARY_ACTION_COMMERCIAL_CTA,
} from './toPresentationModel';
export {
  resolvePrimaryActionLabel,
  DEFAULT_PRIMARY_ACTION_LABEL,
  PRIMARY_LABEL_BY_ID,
  PRIMARY_LABEL_BY_TYPE,
} from './primaryActionLabels';
export { isCommercialCtaEligible, CTA_ELIGIBLE_TYPES, CTA_INELIGIBLE_TYPES } from './ctaEligibility';
export { DENSITY_LIMITS, applyDensityLimit, resolveDensityLimit } from './density';
export { DEFAULT_EMPTY_MESSAGE, EMPTY_MESSAGE_BY_SURFACE, resolveEmptyMessage } from './emptyStateCopy';

export { default as RecommendationMetric } from './components/RecommendationMetric';
export { default as RecommendationActions } from './components/RecommendationActions';
export { default as RecommendationCard } from './components/RecommendationCard';
export { default as RecommendationList } from './components/RecommendationList';
export { default as RecommendationEmptyState } from './components/RecommendationEmptyState';
export { default as RecommendationGroup } from './components/RecommendationGroup';
export { default as RecommendationBanner } from './components/RecommendationBanner';
