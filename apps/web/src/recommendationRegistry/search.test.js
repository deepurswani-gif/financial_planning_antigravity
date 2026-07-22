import { describe, it, expect } from 'vitest';
import { searchRecommendations, RECOMMENDATION_REGISTRY } from './index';

describe('searchRecommendations', () => {
  it('returns everything for an empty query', () => {
    expect(searchRecommendations('')).toHaveLength(RECOMMENDATION_REGISTRY.length);
  });

  it('ranks an exact id match first', () => {
    const results = searchRecommendations('protection.lifeGap');
    expect(results[0].id).toBe('protection.lifeGap');
  });

  it('matches by category and type', () => {
    const byType = searchRecommendations('healthCoverage');
    expect(byType.map((r) => r.id)).toContain('protection.healthAbsent');
  });

  it('matches by title text', () => {
    const results = searchRecommendations('emergency fund');
    expect(results.map((r) => r.id)).toContain('emergency.buildFund');
  });

  it('is stable and deterministic', () => {
    const a = searchRecommendations('sip').map((r) => r.id);
    const b = searchRecommendations('sip').map((r) => r.id);
    expect(a).toEqual(b);
  });
});
