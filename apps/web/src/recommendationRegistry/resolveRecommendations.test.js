import { describe, it, expect } from 'vitest';
import { resolveRecommendations, RECOMMENDATION_REGISTRY } from './index';
import { resolveRecommendations as resolveFrom } from './resolveRecommendations';
import { normalizeRecommendation } from './schema';

describe('Recommendation Resolver', () => {
  it('returns only recommendations whose trigger applies, filtered by report', () => {
    const signals = {
      hasProtectionGap: true,
      hasSelfProtectionGap: true,
      protectionGap: 2500000,
      protectionGapDisplay: '₹25.00 L',
      selfProtectionGap: 2500000,
      selfProtectionGapDisplay: '₹25.00 L',
      selfName: 'Alex',
      hasHealthGap: false,
      emergencyGap: 0,
    };
    const resolved = resolveRecommendations(signals, { report: 'safety_net' });
    const ids = resolved.map((r) => r.id);
    expect(ids).toContain('protection.lifeGap');
    expect(ids).not.toContain('emergency.buildFund'); // no emergency gap
    expect(ids).not.toContain('protection.healthAbsent'); // no health gap
  });

  it('interpolates templates from the signals snapshot (byte-for-byte copy)', () => {
    const signals = {
      hasSelfProtectionGap: true,
      selfProtectionGap: 2500000,
      selfProtectionGapDisplay: '₹25.00 L',
      selfName: 'Alex',
    };
    const [rec] = resolveRecommendations(signals, { report: 'safety_net' });
    expect(rec.summary).toBe(
      "Buy term cover to close this gap on Alex.",
    );
  });

  it('exposes supporting metrics resolved from signals', () => {
    const signals = { emergencyGap: 300000, emergencyGapDisplay: '₹3.00 L' };
    const [rec] = resolveRecommendations(signals, { report: 'safety_net' });
    expect(rec.id).toBe('emergency.buildFund');
    expect(rec.metrics.emergencyGap).toBe(300000);
  });

  it('orders safety-net recovery steps by priority (protection, health, emergency)', () => {
    const signals = {
      hasProtectionGap: true,
      hasSelfProtectionGap: true,
      protectionGap: 1000000,
      protectionGapDisplay: '₹10.00 L',
      selfProtectionGap: 1000000,
      selfProtectionGapDisplay: '₹10.00 L',
      selfName: 'Alex',
      hasHealthGap: true,
      healthStatus: 'partial',
      healthCoverageHave: 500000,
      healthGap: 500000,
      healthGapDisplay: '₹5.00 L',
      healthMinDisplay: '₹10.00 L',
      emergencyGap: 300000,
      emergencyGapDisplay: '₹3.00 L',
    };
    const ids = resolveRecommendations(signals, { report: 'safety_net' }).map((r) => r.id);
    expect(ids).toEqual(['protection.lifeGap', 'protection.healthPartial', 'emergency.buildFund']);
  });

  it('includes spouse protection recommendation when spouse gap exists', () => {
    const signals = {
      hasSelfProtectionGap: true,
      selfProtectionGap: 1000000,
      selfProtectionGapDisplay: '₹10.00 L',
      selfName: 'Alex',
      hasSpouseProtectionGap: true,
      spouseProtectionGap: 2000000,
      spouseProtectionGapDisplay: '₹20.00 L',
      spouseName: 'Sam',
    };
    const ids = resolveRecommendations(signals, { report: 'safety_net' }).map((r) => r.id);
    expect(ids).toEqual(['protection.lifeGap', 'protection.lifeGapSpouse']);
  });

  it('selects the absent vs partial health recommendation from signals', () => {
    const absent = resolveRecommendations(
      { hasHealthGap: true, healthStatus: 'none', healthCoverageHave: 0, healthMinDisplay: '₹10.00 L' },
      { report: 'safety_net' },
    ).map((r) => r.id);
    expect(absent).toContain('protection.healthAbsent');
    expect(absent).not.toContain('protection.healthPartial');
  });

  it('shows the no-free-cash insight instead of deployment insights when surplus is non-positive', () => {
    const ids = resolveRecommendations(
      { hasMoneyFlowData: true, monthlyFreeCash: 0 },
      { report: 'invest_surplus' },
    ).map((r) => r.id);
    expect(ids).toEqual(['cashflow.noFreeCash']);
  });

  it('orders invest-surplus deployment insights by priority', () => {
    const signals = {
      hasMoneyFlowData: true,
      monthlyFreeCash: 40000,
      monthlyFreeCashDisplay: '₹40,000',
      proratedUnallocated: 120000,
      proratedUnallocatedDisplay: '₹1,20,000',
      allocationCount: 0,
      deployableMonthly: 40000,
      yearsToRetirement: 25,
    };
    const ids = resolveRecommendations(signals, { report: 'invest_surplus' }).map((r) => r.id);
    expect(ids).toEqual([
      'investments.readyToDeploy',
      'investments.yearEndSurplus',
      'investments.noAllocations',
      'investments.retirementHorizon',
    ]);
  });

  it('resolves executive-summary weak-pillar priorities', () => {
    const signals = { weakestPillars: ['emergency', 'family-protection', 'goal-readiness'] };
    const ids = resolveRecommendations(signals, { report: 'useful_insights' }).map((r) => r.id);
    expect(ids).toContain('emergency.buildReserves');
    expect(ids).toContain('protection.closeCoverageGaps');
    expect(ids).toContain('goals.increaseFundingPace');
    expect(ids).not.toContain('cashflow.improveSurplus'); // daily-stability not weak
  });

  it('does not calculate — missing signals simply yield no matches', () => {
    const resolved = resolveRecommendations({}, { report: 'safety_net' });
    expect(resolved).toEqual([]);
  });

  it('dedupes by id when the same recommendation is listed twice', () => {
    const dupe = normalizeRecommendation({
      id: 'protection.lifeGap',
      title: 'dupe',
      summary: 'dupe',
      category: 'protection',
      severity: 'low',
      priority: 1,
      triggerId: 'ALWAYS',
      reports: ['safety_net'],
    });
    const list = [...RECOMMENDATION_REGISTRY, dupe];
    const resolved = resolveFrom(list, { hasSelfProtectionGap: true }, { report: 'safety_net' });
    const lifeGaps = resolved.filter((r) => r.id === 'protection.lifeGap');
    expect(lifeGaps).toHaveLength(1);
  });
});
