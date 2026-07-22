import { describe, it, expect } from 'vitest';
import {
  resolveExperienceIdForRecommendation,
  PREFERRED_EXPERIENCE_BY_RECOMMENDATION,
} from './recommendationActionLaunch';

describe('resolveExperienceIdForRecommendation', () => {
  it('maps protection gap to Life Insurance editing', () => {
    expect(resolveExperienceIdForRecommendation({ recommendationId: 'protection.lifeGap' })).toBe(
      'protection.lifeInsurance',
    );
  });

  it('maps health coverage to Health Insurance editing', () => {
    expect(
      resolveExperienceIdForRecommendation({ recommendationId: 'protection.healthAbsent' }),
    ).toBe('protection.healthInsurance');
    expect(
      resolveExperienceIdForRecommendation({ recommendationId: 'protection.healthPartial' }),
    ).toBe('protection.healthInsurance');
  });

  it('maps goals to the Goals collection picker', () => {
    expect(
      resolveExperienceIdForRecommendation({ recommendationId: 'goals.increaseFundingPace' }),
    ).toBe('goals.collection');
  });

  it('maps retirement and SIP opportunities to SIP editor', () => {
    expect(resolveExperienceIdForRecommendation({ recommendationId: 'retirement.shortfall' })).toBe(
      'savings.sip',
    );
    expect(
      resolveExperienceIdForRecommendation({ recommendationId: 'investments.increaseSips' }),
    ).toBe('savings.sip');
  });

  it('maps high EMI burden to Loans — not the read-only EMI explanation', () => {
    expect(
      resolveExperienceIdForRecommendation({ recommendationId: 'cashflow.highEmiBurden' }),
    ).toBe('debt.loans');
  });

  it('maps FD diversification to Fixed Deposits configure', () => {
    expect(
      resolveExperienceIdForRecommendation({ recommendationId: 'wealth.assetDiversification' }),
    ).toBe('assets.fixedDeposits');
  });

  it('returns null for unknown recommendations', () => {
    expect(resolveExperienceIdForRecommendation({ recommendationId: 'does.not.exist' })).toBeNull();
    expect(resolveExperienceIdForRecommendation({})).toBeNull();
  });

  it('preferred map only references real experience ids', () => {
    for (const [recId, experienceId] of Object.entries(PREFERRED_EXPERIENCE_BY_RECOMMENDATION)) {
      expect(resolveExperienceIdForRecommendation({ recommendationId: recId })).toBe(experienceId);
    }
  });
});
