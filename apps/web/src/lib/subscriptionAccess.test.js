import { describe, expect, it } from 'vitest';
import {
  getAnnualPlanPriceInr,
  getSubscriptionValidUntilDate,
  isIntroPricing,
  isSubscriptionCurrentlyValid,
  INTRO_PLAN_INR,
  STANDARD_PLAN_INR,
} from './subscriptionAccess';

describe('subscriptionAccess', () => {
  it('uses intro price through calendar year 2026', () => {
    expect(getAnnualPlanPriceInr(new Date('2026-08-03'))).toBe(INTRO_PLAN_INR);
    expect(isIntroPricing(new Date('2026-12-31'))).toBe(true);
  });

  it('uses standard price from 2027', () => {
    expect(getAnnualPlanPriceInr(new Date('2027-01-01'))).toBe(STANDARD_PLAN_INR);
    expect(isIntroPricing(new Date('2027-01-01'))).toBe(false);
  });

  it('sets valid_until to Dec 31 of the purchase year', () => {
    expect(getSubscriptionValidUntilDate(new Date('2026-03-15'))).toBe('2026-12-31');
    expect(getSubscriptionValidUntilDate(new Date('2027-06-01'))).toBe('2027-12-31');
  });

  it('grants access for active subscription within valid_until', () => {
    expect(
      isSubscriptionCurrentlyValid({
        subscription_active: true,
        subscription_valid_until: '2026-12-31',
        now: new Date('2026-08-03T10:00:00'),
      }),
    ).toBe(true);
  });

  it('denies access after valid_until', () => {
    expect(
      isSubscriptionCurrentlyValid({
        subscription_active: true,
        subscription_valid_until: '2026-12-31',
        now: new Date('2027-01-01T00:00:01'),
      }),
    ).toBe(false);
  });

  it('lets admin and agent bypass payment', () => {
    expect(
      isSubscriptionCurrentlyValid({
        subscription_active: false,
        role: 'admin',
      }),
    ).toBe(true);
    expect(
      isSubscriptionCurrentlyValid({
        subscription_active: false,
        role: 'agent',
      }),
    ).toBe(true);
  });

  it('grandfathers active rows with null valid_until', () => {
    expect(
      isSubscriptionCurrentlyValid({
        subscription_active: true,
        subscription_valid_until: null,
        now: new Date('2026-08-03'),
      }),
    ).toBe(true);
  });
});
