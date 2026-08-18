import { describe, it, expect } from 'vitest';
import { resolveRecommendations } from '../index';
import { buildSafetyNetSignals } from './safetyNetAdapter';
import { buildInvestSurplusSignals } from './investSurplusAdapter';
import { buildExecutiveSummarySignals, PILLAR_TO_RECOMMENDATION_ID } from './executiveSummaryAdapter';

describe('safetyNetAdapter', () => {
  it('maps engine outputs to signals without recalculating', () => {
    const signals = buildSafetyNetSignals({
      protectionData: {
        hasGap: true,
        protectionGap: 2500000,
        self: { name: 'Alex', isGap: true, gap: 2500000 },
      },
      contingencyData: { gap: 300000, monthsCoveredByFund: 2.3, contingencyPeriod: 6 },
      healthData: { hasGap: true, status: 'partial', coverageHave: 500000, healthGap: 500000, minimumRequired: 1000000 },
    });
    expect(signals.protectionGapDisplay).toBe('₹25.00 L');
    expect(signals.selfProtectionGapDisplay).toBe('₹25.00 L');
    expect(signals.healthGapDisplay).toBe('₹5.00 L');
    expect(signals.healthMinDisplay).toBe('₹10.00 L');
    expect(signals.emergencyGapDisplay).toBe('₹3.00 L');
  });

  it('reproduces separate self and spouse recovery-step copy', () => {
    const signals = buildSafetyNetSignals({
      protectionData: {
        hasGap: true,
        protectionGap: 5500000,
        self: { name: 'Alex', isGap: true, gap: 2500000 },
        spouse: { name: 'Sam', isGap: true, gap: 3000000 },
      },
    });
    const resolved = resolveRecommendations(signals, { report: 'safety_net' });
    const selfRec = resolved.find((r) => r.id === 'protection.lifeGap');
    const spouseRec = resolved.find((r) => r.id === 'protection.lifeGapSpouse');
    expect(selfRec.summary).toBe(
      "Buy term cover to close this gap on Alex.",
    );
    expect(spouseRec.summary).toBe(
      "Buy term cover to close this gap on Sam.",
    );
  });

  it('falls back to aggregate gap for legacy protectionData shape', () => {
    const signals = buildSafetyNetSignals({
      protectionData: { hasGap: true, protectionGap: 2500000 },
    });
    const [rec] = resolveRecommendations(signals, { report: 'safety_net' });
    expect(rec.id).toBe('protection.lifeGap');
    expect(rec.summary).toBe("Buy term cover to close this gap on you.");
  });
});

describe('investSurplusAdapter', () => {
  const report = {
    meta: { hasData: true, yearsToRetirement: 25 },
    hero: { monthlyFreeCash: 40000, proratedUnallocated: 120000, deployableMonthly: 40000 },
    allocationsSummary: { count: 2, monthlyCommitted: 15000 },
    sipProjection: { futureValue: 5000000 },
  };

  it('maps the report into deployment signals', () => {
    const signals = buildInvestSurplusSignals(report);
    expect(signals.hasMoneyFlowData).toBe(true);
    expect(signals.monthlyFreeCashDisplay).toBe('₹40,000');
    expect(signals.allocationPlural).toBe('s');
    expect(signals.monthlyCommittedDisplay).toBe('₹15,000');
  });

  it('reproduces the existing-allocations insight byte-for-byte', () => {
    const signals = buildInvestSurplusSignals(report);
    const resolved = resolveRecommendations(signals, { report: 'invest_surplus' });
    const rec = resolved.find((r) => r.id === 'investments.existingAllocations');
    expect(rec.summary).toBe('2 investment allocations already planned (₹15,000/month committed).');
  });
});

describe('executiveSummaryAdapter', () => {
  it('derives weakest pillars (ascending score) exactly like actionPriorities', () => {
    const report = {
      pillars: [
        { id: 'daily-stability', score: 18 },
        { id: 'emergency', score: 4 },
        { id: 'family-protection', score: 7 },
        { id: 'wealth-building', score: 15 },
        { id: 'goal-readiness', score: 9 },
      ],
    };
    const signals = buildExecutiveSummarySignals(report);
    expect(signals.weakestPillars).toEqual(['emergency', 'family-protection', 'goal-readiness']);
  });

  it('maps each pillar to a registry recommendation', () => {
    for (const recId of Object.values(PILLAR_TO_RECOMMENDATION_ID)) {
      expect(typeof recId).toBe('string');
    }
    const report = { pillars: [{ id: 'emergency', score: 2 }] };
    const signals = buildExecutiveSummarySignals(report);
    const resolved = resolveRecommendations(signals, { report: 'useful_insights' });
    expect(resolved.map((r) => r.id)).toContain('emergency.buildReserves');
  });
});
