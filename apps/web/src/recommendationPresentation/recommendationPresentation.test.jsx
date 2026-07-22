import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  toPresentationModel,
  resolveConfidencePresentation,
  CONFIDENCE_STATES,
  buildSupportingMetrics,
  pickPrimaryMetric,
  severityStyle,
  PRIMARY_ACTION_UPDATE_INFORMATION,
  SECONDARY_ACTION_COMMERCIAL_CTA,
  resolvePrimaryActionLabel,
  isCommercialCtaEligible,
  applyDensityLimit,
  DENSITY_LIMITS,
  resolveEmptyMessage,
  RecommendationCard,
  RecommendationList,
  RecommendationEmptyState,
  RecommendationActions,
  RecommendationMetric,
} from './index';

function makeInstance(overrides = {}) {
  return {
    recommendationId: 'protection.lifeGap',
    instanceId: 'protection.lifeGap',
    title: 'Fill Protection Gap',
    summary: 'Buy term cover of 5.0 L to secure your family.',
    description: 'Detailed protection guidance.',
    severity: 'critical',
    category: 'protection',
    type: 'protectionGap',
    priority: 10,
    triggerId: 'HAS_PROTECTION_GAP',
    supportingMetrics: ['protectionGap', 'protectionGapDisplay'],
    metrics: {
      protectionGap: 500000,
      protectionGapDisplay: '5.0 L',
    },
    action: { type: 'viewPlans' },
    cta: {
      ctaId: 'contactFinbrella',
      label: 'Contact Finbrella for Help',
      executionStrategy: 'email',
      fallbackApplied: true,
    },
    tags: [],
    originatingSources: [],
    originatingReports: ['safety_net'],
    ...overrides,
  };
}

describe('primary action labels', () => {
  it('resolves context-aware labels by id, type, and category', () => {
    expect(resolvePrimaryActionLabel({ recommendationId: 'protection.lifeGap' })).toBe(
      'Update Insurance Details',
    );
    expect(resolvePrimaryActionLabel({ type: 'healthCoverage' })).toBe('Update Health Coverage');
    expect(resolvePrimaryActionLabel({ type: 'emergencyFund' })).toBe('Review Emergency Fund');
    expect(resolvePrimaryActionLabel({ type: 'missingInformation' })).toBe('Complete Information');
    expect(resolvePrimaryActionLabel({})).toBe('Update Information');
  });

  it('applies context-aware labels on the presentation model', () => {
    const model = toPresentationModel(makeInstance());
    expect(model.primaryActions[0].label).toBe('Update Insurance Details');
    expect(
      toPresentationModel(makeInstance({ recommendationId: 'emergency.buildFund', type: 'emergencyFund', cta: null }))
        .primaryActions[0].label,
    ).toBe('Review Emergency Fund');
  });
});

describe('commercial CTA eligibility', () => {
  it('allows advisory/commercial recommendations', () => {
    expect(isCommercialCtaEligible(makeInstance())).toBe(true);
    expect(isCommercialCtaEligible({ type: 'sipOpportunity', recommendationId: 'investments.readyToDeploy' })).toBe(
      true,
    );
  });

  it('blocks missing-info and non-commercial types', () => {
    expect(
      isCommercialCtaEligible({
        recommendationId: 'behaviour.completeMoneyFlow',
        type: 'missingInformation',
        tags: ['empty-state'],
      }),
    ).toBe(false);
    expect(isCommercialCtaEligible({ type: 'emergencyFund', recommendationId: 'emergency.buildFund' })).toBe(false);
    expect(isCommercialCtaEligible({ type: 'goalFundingGap' })).toBe(false);
  });

  it('omits secondaryActions when ineligible even if cta exists', () => {
    const model = toPresentationModel(
      makeInstance({
        recommendationId: 'emergency.buildFund',
        type: 'emergencyFund',
        category: 'emergency',
      }),
    );
    expect(model.secondaryActions).toEqual([]);
  });

  it('keeps secondaryActions for eligible commercial recommendations', () => {
    const model = toPresentationModel(makeInstance());
    expect(model.secondaryActions).toHaveLength(1);
    expect(model.secondaryActions[0].kind).toBe(SECONDARY_ACTION_COMMERCIAL_CTA);
  });
});

describe('density limits', () => {
  it('limits summary to 3 and detailed to 5 without reordering', () => {
    expect(DENSITY_LIMITS.summary).toBe(3);
    expect(DENSITY_LIMITS.detailed).toBe(5);
    const items = [1, 2, 3, 4, 5, 6];
    expect(applyDensityLimit(items, 'summary')).toEqual([1, 2, 3]);
    expect(applyDensityLimit(items, 'detailed')).toEqual([1, 2, 3, 4, 5]);
    expect(applyDensityLimit(items, null)).toEqual(items);
  });

  it('RecommendationList truncates to density', () => {
    const models = [1, 2, 3, 4].map((n) =>
      toPresentationModel(
        makeInstance({
          recommendationId: `protection.lifeGap`,
          id: `id-${n}`,
          title: `Rec ${n}`,
        }),
      ),
    );
    // Force unique ids for list keys
    models.forEach((m, i) => {
      m.id = `rec-${i}`;
    });
    const html = renderToStaticMarkup(
      <RecommendationList models={models} density="summary" onPrimaryAction={() => {}} />,
    );
    expect(html).toContain('Rec 1');
    expect(html).toContain('Rec 3');
    expect(html).not.toContain('Rec 4');
  });
});

describe('toPresentationModel', () => {
  it('builds primaryActions[] and secondaryActions[] groups', () => {
    const model = toPresentationModel(makeInstance());
    expect(model.primaryActions).toHaveLength(1);
    expect(model.primaryActions[0].kind).toBe(PRIMARY_ACTION_UPDATE_INFORMATION);
    expect(model.secondaryActions[0].cta.ctaId).toBe('contactFinbrella');
  });

  it('omits confidence when metadata is absent', () => {
    expect(toPresentationModel(makeInstance()).confidence).toBeNull();
  });

  it('includes confidence only when instance provides it', () => {
    const model = toPresentationModel(makeInstance({ confidence: CONFIDENCE_STATES.HIGH }));
    expect(model.confidence.label).toBe('High Confidence');
  });
});

describe('card hierarchy', () => {
  it('places actions before expand controls in markup', () => {
    const model = toPresentationModel(makeInstance());
    const html = renderToStaticMarkup(<RecommendationCard model={model} />);
    const actionIdx = html.indexOf('Update Insurance Details');
    const expandIdx = html.indexOf('View details');
    expect(actionIdx).toBeGreaterThan(-1);
    expect(expandIdx).toBeGreaterThan(actionIdx);
    // Metrics stay collapsed until expanded
    expect(html).not.toContain('Why this matters');
  });

  it('shows business meaning and metrics when expanded', () => {
    const model = toPresentationModel(makeInstance());
    const html = renderToStaticMarkup(<RecommendationCard model={model} defaultExpanded />);
    expect(html).toContain('Why this matters');
    expect(html).toContain('Protection Gap');
    expect(html).toContain('Detailed protection guidance.');
  });
});

describe('empty state', () => {
  it('uses positive surface copy', () => {
    expect(resolveEmptyMessage('useful_insights')).toContain('Excellent');
    expect(resolveEmptyMessage()).toContain('Excellent');
  });

  it('renders empty state when list is empty', () => {
    const html = renderToStaticMarkup(
      <RecommendationList recommendations={[]} emptySurface="safety_net" />,
    );
    expect(html).toContain('rec-empty');
    expect(html).toContain('healthy');
  });
});

describe('RecommendationActions', () => {
  it('orders primaryActions before secondaryActions', () => {
    const model = toPresentationModel(makeInstance());
    const html = renderToStaticMarkup(
      <RecommendationActions
        primaryActions={model.primaryActions}
        secondaryActions={model.secondaryActions}
        source={model.source}
        onPrimaryAction={() => {}}
      />,
    );
    expect(html.indexOf('Update Insurance Details')).toBeLessThan(
      html.indexOf('Contact Finbrella for Help'),
    );
  });
});

describe('metric helpers', () => {
  it('formats supporting metrics without recalculation', () => {
    const metrics = buildSupportingMetrics(
      { emergencyMonthsCovered: 3.2, emergencyGapDisplay: '2.0 L', emergencyGap: 200000 },
      ['emergencyMonthsCovered', 'emergencyGap', 'emergencyGapDisplay'],
    );
    expect(pickPrimaryMetric(metrics)?.key).toBe('emergencyGapDisplay');
  });

  it('maps severity tokens', () => {
    expect(severityStyle('critical').className).toBe('rec-severity-critical');
  });

  it('renders metric chip', () => {
    expect(renderToStaticMarkup(<RecommendationMetric label="Gap" value="5 L" />)).toContain('5 L');
  });

  it('renders empty state component', () => {
    expect(renderToStaticMarkup(<RecommendationEmptyState message="All clear." />)).toContain(
      'All clear.',
    );
  });

  it('omits confidence presentation when missing', () => {
    expect(resolveConfidencePresentation(null)).toBeNull();
  });
});
