import { describe, it, expect } from 'vitest';
import {
  RECOMMENDATION_REGISTRY,
  getRecommendationById,
  hasRecommendation,
  listRecommendations,
  getRecommendationRegistryDiagnostics,
  CATEGORIES,
  isCategoryId,
  RECOMMENDATION_TYPES,
  SEVERITY,
  TRIGGER_IDS,
  ACTION_TYPES,
  REPORT_IDS,
} from './index';

describe('Recommendation Registry integrity', () => {
  it('loads a non-empty registry with zero schema errors', () => {
    expect(RECOMMENDATION_REGISTRY.length).toBeGreaterThanOrEqual(15);
    const diagnostics = getRecommendationRegistryDiagnostics();
    expect(diagnostics.errorCount, JSON.stringify(diagnostics.issues, null, 2)).toBe(0);
    expect(diagnostics.ok).toBe(true);
  });

  it('has unique recommendation ids', () => {
    const ids = RECOMMENDATION_REGISTRY.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is frozen (immutable single source of truth)', () => {
    expect(Object.isFrozen(RECOMMENDATION_REGISTRY)).toBe(true);
  });

  it('only references valid categories, types, severities, triggers, actions and reports', () => {
    for (const rec of RECOMMENDATION_REGISTRY) {
      expect(isCategoryId(rec.category), `bad category on ${rec.id}`).toBe(true);
      if (rec.type != null) expect(RECOMMENDATION_TYPES).toContain(rec.type);
      expect(SEVERITY).toContain(rec.severity);
      expect(TRIGGER_IDS).toContain(rec.triggerId);
      expect(ACTION_TYPES).toContain(rec.action.type);
      rec.reports.forEach((reportId) => expect(REPORT_IDS).toContain(reportId));
    }
  });

  it('keeps recommendations declarative — no executable fields', () => {
    for (const rec of RECOMMENDATION_REGISTRY) {
      for (const value of Object.values(rec)) {
        expect(typeof value).not.toBe('function');
      }
      // futureCTA was replaced by a generic metadata-only action model.
      expect(rec).not.toHaveProperty('futureCTA');
      expect(rec).not.toHaveProperty('applies');
      expect(rec).not.toHaveProperty('tokens');
    }
  });

  it('reserves aiExplanation as a null placeholder', () => {
    for (const rec of RECOMMENDATION_REGISTRY) {
      expect(rec.aiExplanation).toBeNull();
    }
  });

  it('uses only high-level financial domains as categories', () => {
    const ids = CATEGORIES.map((c) => c.id);
    expect(ids).toEqual([
      'protection',
      'emergency',
      'cashflow',
      'investments',
      'retirement',
      'goals',
      'tax',
      'wealth',
      'behaviour',
    ]);
  });

  it('exposes lookup helpers', () => {
    expect(hasRecommendation('protection.lifeGap')).toBe(true);
    expect(getRecommendationById('protection.lifeGap')?.category).toBe('protection');
    expect(getRecommendationById('does.notExist')).toBeNull();
  });

  it('lists recommendations filtered by category and report', () => {
    const protection = listRecommendations({ category: 'protection' });
    expect(protection.length).toBeGreaterThan(0);
    expect(protection.every((r) => r.category === 'protection')).toBe(true);

    const safetyNet = listRecommendations({ report: 'safety_net' });
    expect(safetyNet.map((r) => r.id)).toContain('emergency.buildFund');
  });

  it('covers every category with at least one recommendation', () => {
    const used = new Set(RECOMMENDATION_REGISTRY.map((r) => r.category));
    for (const category of CATEGORIES) {
      expect(used.has(category.id), `no recommendation for category ${category.id}`).toBe(true);
    }
  });
});
