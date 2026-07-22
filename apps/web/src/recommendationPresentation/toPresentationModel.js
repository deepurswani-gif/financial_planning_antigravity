/**
 * Instance → presentation view-model.
 *
 * This is the ONLY place in the Recommendation Presentation System that may
 * read the Recommendation Registry (e.g. businessMeaning). Downstream
 * components are registry-agnostic and receive fully prepared props.
 */

import { getRecommendationById } from '../recommendationRegistry';
import { severityStyle } from './severityStyles';
import { resolveConfidencePresentation } from './confidence';
import { buildSupportingMetrics, pickPrimaryMetric } from './metricDisplay';
import { resolvePrimaryActionLabel } from './primaryActionLabels';
import { isCommercialCtaEligible } from './ctaEligibility';

export const PRIMARY_ACTION_UPDATE_INFORMATION = 'update_information';
export const SECONDARY_ACTION_COMMERCIAL_CTA = 'commercial_cta';

/**
 * @typedef {object} PresentationAction
 * @property {string} id
 * @property {string} kind
 * @property {string} label
 * @property {import('../commercialCtaRegistry/resolveCommercialCta').ResolvedCta} [cta]
 */

/**
 * @typedef {object} RecommendationPresentationModel
 * @property {string} id
 * @property {string} title
 * @property {string} summary
 * @property {string} description
 * @property {string|null} businessMeaning
 * @property {string} severity
 * @property {ReturnType<typeof severityStyle>} severityStyle
 * @property {{ state: string, label: string, message: string }|null} confidence
 * @property {{ key: string, label: string, value: string }|null} primaryMetric
 * @property {{ key: string, label: string, value: string }[]} supportingMetrics
 * @property {PresentationAction[]} primaryActions
 * @property {PresentationAction[]} secondaryActions
 * @property {object} source - original recommendation instance (intent payload only)
 */

/**
 * @param {object} instance - recommendation instance from the Orchestration Engine
 * @returns {RecommendationPresentationModel}
 */
export function toPresentationModel(instance) {
  const recommendationId = instance?.recommendationId ?? instance?.id ?? '';
  const definition = getRecommendationById(recommendationId) ?? null;
  const type = instance?.type ?? definition?.type ?? null;
  const category = instance?.category ?? definition?.category ?? null;
  const metrics = buildSupportingMetrics(instance?.metrics ?? {}, instance?.supportingMetrics ?? []);
  const primaryMetric = pickPrimaryMetric(metrics);

  const primaryLabel = resolvePrimaryActionLabel({
    recommendationId,
    id: recommendationId,
    type,
    category,
  });

  /** @type {PresentationAction[]} */
  const primaryActions = [
    {
      id: `${recommendationId || 'rec'}:update`,
      kind: PRIMARY_ACTION_UPDATE_INFORMATION,
      label: primaryLabel,
    },
  ];

  /** @type {PresentationAction[]} */
  const secondaryActions = [];
  const eligible = isCommercialCtaEligible({
    recommendationId,
    id: recommendationId,
    type,
    tags: instance?.tags ?? definition?.tags ?? [],
  });
  if (eligible && instance?.cta) {
    secondaryActions.push({
      id: `${recommendationId}:cta:${instance.cta.ctaId}`,
      kind: SECONDARY_ACTION_COMMERCIAL_CTA,
      label: instance.cta.label,
      cta: instance.cta,
    });
  }

  return {
    id: recommendationId,
    title: instance?.title ?? '',
    summary: instance?.summary ?? '',
    description: instance?.description ?? '',
    businessMeaning: definition?.businessMeaning ?? null,
    severity: instance?.severity ?? 'medium',
    severityStyle: severityStyle(instance?.severity),
    confidence: resolveConfidencePresentation(instance?.confidence),
    primaryMetric,
    supportingMetrics: metrics,
    primaryActions,
    secondaryActions,
    source: instance,
  };
}

/** Map a list of instances to presentation models. */
export function toPresentationModels(instances = []) {
  return (instances ?? []).map(toPresentationModel);
}
