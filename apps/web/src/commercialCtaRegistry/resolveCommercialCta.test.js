import { describe, it, expect } from 'vitest';
import { resolveCommercialCta, explainResolution, COMMERCIAL_CTA_REGISTRY } from './index';
import { resolveCommercialCta as resolveFrom } from './resolveCommercialCta';

const rec = (overrides = {}) => ({
  id: 'protection.healthAbsent',
  action: { type: 'viewPlans' },
  ...overrides,
});

describe('Commercial CTA Resolver', () => {
  it('resolves a regulated commercial recommendation to Contact Finbrella today', () => {
    const cta = resolveCommercialCta(rec(), { report: 'safety_net' });
    expect(cta.ctaId).toBe('contactFinbrella');
    expect(cta.label).toBe('Contact Finbrella for Help');
    expect(cta.executionStrategy).toBe('email');
    expect(cta.fallbackApplied).toBe(true);
    expect(cta.requestedCtaId).toBe('viewPlans');
  });

  it('pilot: Health Insurance Gap → Contact Finbrella for Help', () => {
    const health = resolveCommercialCta(
      { id: 'protection.healthAbsent', action: { type: 'viewPlans' } },
      { report: 'safety_net' },
    );
    expect(health.ctaId).toBe('contactFinbrella');
    expect(health.emailTemplateRef).toBe('support_request');
  });

  it('returns null when a recommendation has no action', () => {
    expect(resolveCommercialCta({ id: 'x.y', action: { type: 'none' } })).toBeNull();
    expect(resolveCommercialCta({ id: 'x.y' })).toBeNull();
  });

  it('exposes analytics metadata without emitting anything', () => {
    const cta = resolveCommercialCta(rec(), { report: 'safety_net' });
    expect(cta.analytics).toMatchObject({
      recommendationId: 'protection.healthAbsent',
      ctaId: 'contactFinbrella',
      requestedCtaId: 'viewPlans',
      originatingReport: 'safety_net',
      actionType: 'viewPlans',
      fallbackApplied: true,
      completionStatus: 'pending',
    });
    expect(cta.analytics.timestamp).toBeNull();
  });

  it('capability alone is not enough while the registry keeps View Plans inactive/pending', () => {
    const capabilities = {
      'assistance.contactFinbrella': true,
      'commerce.viewPlans': true,
    };
    const cta = resolveCommercialCta(rec(), { report: 'safety_net', capabilities });
    expect(cta.ctaId).toBe('contactFinbrella');
  });

  it('is capability-aware: a future active+approved registry + capability resolves to the ideal CTA (only registry + resolver change)', () => {
    // Simulate the future: View Plans is switched active + approved.
    const futureRegistry = COMMERCIAL_CTA_REGISTRY.map((cta) =>
      cta.id === 'viewPlans'
        ? { ...cta, availability: 'active', regulatoryStatus: 'approved' }
        : cta,
    );
    const capabilities = {
      'assistance.contactFinbrella': true,
      'commerce.viewPlans': true,
    };
    const resolved = resolveFrom(futureRegistry, rec(), { report: 'safety_net', capabilities });
    expect(resolved.ctaId).toBe('viewPlans');
    expect(resolved.fallbackApplied).toBe(false);

    // Without the capability, it still falls back — no report change required.
    const gated = resolveFrom(futureRegistry, rec(), { report: 'safety_net' });
    expect(gated.ctaId).toBe('contactFinbrella');
  });

  it('non-commercial actions also fall back to the only active CTA today', () => {
    const cta = resolveCommercialCta({ id: 'goals.x', action: { type: 'learnMore' } });
    expect(cta.ctaId).toBe('contactFinbrella');
    expect(cta.requestedCtaId).toBe('learnMore');
  });

  it('explains the resolution reason', () => {
    const explanation = explainResolution(rec(), { report: 'safety_net' });
    expect(explanation).toMatchObject({
      actionType: 'viewPlans',
      requestedCtaId: 'viewPlans',
      resolvedCtaId: 'contactFinbrella',
      fallbackApplied: true,
      reason: 'requested_cta_inactive',
    });

    const noCta = explainResolution({ id: 'x.y', action: { type: 'none' } });
    expect(noCta.reason).toBe('no_cta_for_action');
  });
});
