import { describe, it, expect } from 'vitest';

import {
  orchestrateRecommendations,
  createRecommendationStore,
  createInstance,
  buildDiagnostics,
  sortInstances,
  compareInstances,
  LIFECYCLE_STATUS,
  LIFECYCLE_STATES,
  canTransition,
  applyTransition,
  applyLifecycleOverride,
  isRenderableStatus,
  sourceForReport,
  mergeOriginatingSources,
  reportIdsFromSources,
  SOURCE_BY_REPORT,
} from './index';

const NOW = Date.UTC(2026, 0, 1);

// Safety-net signals: protection gap + no health cover + emergency gap.
function safetyNetSignals() {
  return {
    hasProtectionGap: true,
    protectionGap: 500000,
    protectionGapDisplay: '5.0 L',
    hasSelfProtectionGap: true,
    selfProtectionGap: 500000,
    selfProtectionGapDisplay: '5.0 L',
    selfName: 'Alex',
    hasHealthGap: true,
    healthStatus: 'none',
    healthCoverageHave: 0,
    healthGap: 500000,
    healthGapDisplay: '5.0 L',
    healthMin: 500000,
    healthMinDisplay: '5.0 L',
    healthCoverRequired: 500000,
    emergencyGap: 200000,
    emergencyGapDisplay: '2.0 L',
    emergencyMonthsCovered: 2,
    emergencyIdealMonths: 6,
  };
}

const SAFETY_NET = ['safety_net'];
const SAFETY_NET_SOURCE = SOURCE_BY_REPORT.safety_net;

describe('lifecycle model', () => {
  it('defines the required states and only renders ACTIVE', () => {
    expect(LIFECYCLE_STATES).toEqual([
      'active',
      'satisfied',
      'dismissed',
      'pending_assistance',
      'completed',
      'expired',
    ]);
    expect(isRenderableStatus(LIFECYCLE_STATUS.ACTIVE)).toBe(true);
    expect(isRenderableStatus(LIFECYCLE_STATUS.DISMISSED)).toBe(false);
    expect(isRenderableStatus(LIFECYCLE_STATUS.SATISFIED)).toBe(false);
  });

  it('validates transitions and applies them purely', () => {
    expect(canTransition('active', 'dismissed')).toBe(true);
    expect(canTransition('completed', 'active')).toBe(false);
    expect(canTransition('active', 'nonsense')).toBe(false);

    const instance = { recommendationId: 'x', status: 'active', updatedAt: 'before' };
    const dismissed = applyTransition(instance, 'dismissed', NOW);
    expect(dismissed.status).toBe('dismissed');
    expect(dismissed.updatedAt).toBe(new Date(NOW).toISOString());
    // original unchanged (pure)
    expect(instance.status).toBe('active');

    // invalid transition returns instance unchanged
    expect(applyTransition(instance, 'nonsense', NOW)).toBe(instance);
  });

  it('applies a lifecycle overlay to freshly created instances', () => {
    const instance = { recommendationId: 'protection.lifeGap', status: 'active' };
    const overridden = applyLifecycleOverride(
      instance,
      { 'protection.lifeGap': 'dismissed' },
      NOW,
    );
    expect(overridden.status).toBe('dismissed');

    // no override -> untouched
    expect(applyLifecycleOverride(instance, {}, NOW)).toBe(instance);
  });
});

describe('instance creation', () => {
  it('turns a resolved descriptor into an active instance with adapter provenance', () => {
    const { instances } = orchestrateRecommendations(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
    });
    const lifeGap = instances.find((i) => i.recommendationId === 'protection.lifeGap');
    expect(lifeGap).toBeDefined();
    expect(lifeGap.status).toBe(LIFECYCLE_STATUS.ACTIVE);
    expect(lifeGap.triggerId).toBe('HAS_SELF_PROTECTION_GAP');
    expect(lifeGap.instanceId).toBe('protection.lifeGap');
    expect(lifeGap.severity).toBe('critical');
    expect(lifeGap.category).toBe('protection');
    expect(lifeGap.originatingSources).toEqual([SAFETY_NET_SOURCE]);
    expect(lifeGap.originatingReports).toEqual(['safety_net']);
    expect(lifeGap.createdAt).toBe(new Date(NOW).toISOString());
    expect(lifeGap.updatedAt).toBe(new Date(NOW).toISOString());
  });

  it('createInstance uses originatingSources from context (not category)', () => {
    const source = {
      reportId: 'invest_surplus',
      reportName: 'Invest Surplus',
      engineId: 'investSurplusLogic',
      engineName: 'Invest Surplus Logic',
    };
    const instance = createInstance(
      {
        id: 'demo',
        title: 'Demo',
        summary: 's',
        description: 'd',
        category: 'investments',
        type: null,
        severity: 'low',
        priority: 99,
        triggerId: 'ALWAYS',
        reports: ['invest_surplus'],
        supportingMetrics: [],
        metrics: {},
        action: { type: 'none' },
        tags: [],
      },
      { now: NOW, originatingSources: [source] },
    );
    expect(instance.originatingSources).toEqual([source]);
    expect(instance.originatingReports).toEqual(['invest_surplus']);
    expect(instance).not.toHaveProperty('originatingEngine');
  });
});

describe('originating sources', () => {
  it('resolves provenance from report/adapter context, not category', () => {
    expect(sourceForReport('safety_net')).toEqual(SAFETY_NET_SOURCE);
    expect(sourceForReport('useful_insights').engineId).toBe('executiveSummaryLogic');
    expect(sourceForReport('invest_surplus').engineId).toBe('investSurplusLogic');
    // unknown report falls back without inventing a category engine
    expect(sourceForReport('unknown_report')).toEqual({
      reportId: 'unknown_report',
      reportName: 'unknown_report',
      engineId: 'unknownEngine',
      engineName: 'Unknown Engine',
    });
  });

  it('accepts sourceByReport overrides from adapter context', () => {
    const override = {
      reportId: 'safety_net',
      reportName: 'Custom Safety Net',
      engineId: 'customSafetyNet',
      engineName: 'Custom Safety Net Engine',
    };
    const { instances } = orchestrateRecommendations(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
      sourceByReport: { safety_net: override },
    });
    expect(instances[0].originatingSources).toEqual([override]);
  });

  it('merges originatingSources across contributing reports without discarding provenance', () => {
    const a = {
      reportId: 'safety_net',
      reportName: 'The Safety Net',
      engineId: 'safetyNetLogic',
      engineName: 'Safety Net Logic',
    };
    const b = {
      reportId: 'useful_insights',
      reportName: 'Useful Insights',
      engineId: 'executiveSummaryLogic',
      engineName: 'Executive Summary Logic',
    };
    expect(mergeOriginatingSources([a], [b, a])).toEqual([a, b]);
    expect(reportIdsFromSources([a, b])).toEqual(['safety_net', 'useful_insights']);
  });

  it('dedupe path merges sources when the same report scope is resolved twice', () => {
    const { instances, diagnostics } = orchestrateRecommendations(safetyNetSignals(), {
      reports: ['safety_net', 'safety_net'],
      now: NOW,
    });
    expect(diagnostics.duplicatesRemoved).toBeGreaterThan(0);
    for (const instance of instances) {
      expect(instance.originatingSources).toEqual([SAFETY_NET_SOURCE]);
      expect(instance.originatingReports).toEqual(['safety_net']);
    }
  });
});

describe('deduplication', () => {
  it('produces one canonical instance even across overlapping report scopes', () => {
    const { instances, diagnostics } = orchestrateRecommendations(safetyNetSignals(), {
      reports: ['safety_net', 'safety_net'],
      now: NOW,
    });
    const ids = instances.map((i) => i.recommendationId);
    const unique = new Set(ids);
    expect(ids.length).toBe(unique.size);
    expect(diagnostics.duplicatesRemoved).toBeGreaterThan(0);
  });

  it('never emits duplicate recommendation ids for the full global run', () => {
    const { instances, diagnostics } = orchestrateRecommendations(safetyNetSignals(), {
      now: NOW,
    });
    const ids = instances.map((i) => i.recommendationId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(diagnostics.duplicateIds).toEqual([]);
  });
});

describe('priority ordering', () => {
  it('orders one global list by registry priority then severity', () => {
    const { instances } = orchestrateRecommendations(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
    });
    expect(instances.map((i) => i.recommendationId)).toEqual([
      'protection.lifeGap', // priority 10
      'protection.healthAbsent', // priority 20
      'emergency.buildFund', // priority 30
    ]);
    expect(instances.map((i) => i.priorityRank)).toEqual([1, 2, 3]);
  });

  it('compareInstances breaks priority ties by severity then id', () => {
    const a = { priority: 10, severity: 'low', recommendationId: 'a' };
    const b = { priority: 10, severity: 'critical', recommendationId: 'b' };
    const c = { priority: 10, severity: 'critical', recommendationId: 'a' };
    const sorted = sortInstances([a, b, c]);
    // critical before low; among criticals, id 'a' before 'b'
    expect(sorted.map((x) => x.recommendationId)).toEqual(['a', 'b', 'a']);
    expect(compareInstances(a, b)).toBeGreaterThan(0);
  });
});

describe('recommendation store', () => {
  it('filters by report, category and severity (active only)', () => {
    const store = createRecommendationStore(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
    });
    expect(store.getByReport('safety_net').map((i) => i.recommendationId)).toEqual([
      'protection.lifeGap',
      'protection.healthAbsent',
      'emergency.buildFund',
    ]);
    expect(store.getByReport('invest_surplus')).toEqual([]);

    expect(store.getByCategory('protection').map((i) => i.recommendationId)).toEqual([
      'protection.lifeGap',
      'protection.healthAbsent',
    ]);
    expect(store.getByCategory('emergency').map((i) => i.recommendationId)).toEqual([
      'emergency.buildFund',
    ]);

    expect(store.getBySeverity('critical').map((i) => i.recommendationId)).toEqual([
      'protection.lifeGap',
      'emergency.buildFund',
    ]);
  });

  it('looks up any instance by id and excludes non-active from list queries', () => {
    const store = createRecommendationStore(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
      lifecycleOverrides: { 'protection.lifeGap': 'dismissed' },
    });
    // dismissed instance is not in active list queries...
    expect(store.getActive().map((i) => i.recommendationId)).not.toContain('protection.lifeGap');
    expect(store.getByReport('safety_net')).toHaveLength(2);
    // ...but is still retrievable via lookup
    const looked = store.getById('protection.lifeGap');
    expect(looked).not.toBeNull();
    expect(looked.status).toBe('dismissed');
    expect(store.getById('does.not.exist')).toBeNull();
  });
});

describe('resolver integration', () => {
  it('exposes interpolated copy from the resolver (no raw tokens)', () => {
    const store = createRecommendationStore(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
    });
    const lifeGap = store.getById('protection.lifeGap');
    expect(lifeGap.summary).toContain('Alex');
    expect(lifeGap.summary).not.toContain('{');
  });
});

describe('CTA integration', () => {
  it('attaches a resolved CTA to instances (reports never call the CTA resolver)', () => {
    const store = createRecommendationStore(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
    });
    const health = store.getById('protection.healthAbsent');
    // viewPlans is regulated/inactive -> falls back to Contact Finbrella (email)
    expect(health.cta).not.toBeNull();
    expect(health.cta.ctaId).toBe('contactFinbrella');
    expect(health.cta.fallbackApplied).toBe(true);
    expect(health.cta.executionStrategy).toBe('email');
    expect(health.cta.requestedCtaId).toBe('viewPlans');
  });
});

describe('diagnostics', () => {
  it('reports counts, lifecycle distribution, originating sources and ordering', () => {
    const { instances, diagnostics } = orchestrateRecommendations(safetyNetSignals(), {
      reports: SAFETY_NET,
      now: NOW,
    });
    expect(diagnostics.total).toBe(3);
    expect(diagnostics.active).toBe(3);
    expect(diagnostics.byLifecycle.active).toBe(3);
    expect(diagnostics.byCategory).toEqual({ protection: 2, emergency: 1 });
    expect(diagnostics.byOriginatingEngine).toBeUndefined();
    expect(diagnostics.originatingSources).toEqual([
      {
        reportId: 'safety_net',
        reportName: 'The Safety Net',
        engineId: 'safetyNetLogic',
        engineName: 'Safety Net Logic',
        count: 3,
      },
    ]);
    expect(diagnostics.byOriginatingSource['safety_net::safetyNetLogic']).toEqual({
      reportId: 'safety_net',
      reportName: 'The Safety Net',
      engineId: 'safetyNetLogic',
      engineName: 'Safety Net Logic',
      count: 3,
    });
    expect(diagnostics.byReport).toEqual({ safety_net: 3 });
    expect(diagnostics.priorityOrdering[0]).toMatchObject({
      recommendationId: 'protection.lifeGap',
      priority: 10,
      severity: 'critical',
      rank: 1,
      originatingSources: [SAFETY_NET_SOURCE],
    });
    expect(instances).toHaveLength(3);
  });

  it('buildDiagnostics tolerates an empty instance set', () => {
    const diagnostics = buildDiagnostics([]);
    expect(diagnostics.total).toBe(0);
    expect(diagnostics.active).toBe(0);
    expect(diagnostics.duplicateIds).toEqual([]);
    expect(diagnostics.originatingSources).toEqual([]);
  });
});
