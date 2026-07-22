import { describe, it, expect } from 'vitest';
import {
  COMMERCIAL_CTA_REGISTRY,
  getCtaById,
  hasCta,
  listCtas,
  listActiveCtas,
  getCommercialCtaRegistryDiagnostics,
  CTA_ACTION_TYPES,
  EXECUTION_STRATEGIES,
  AVAILABILITY,
  REGULATORY_STATUS,
  COMMERCIAL_CAPABILITY_KEYS,
} from './index';

describe('Commercial CTA Registry integrity', () => {
  it('loads a non-empty registry with zero errors', () => {
    expect(COMMERCIAL_CTA_REGISTRY.length).toBeGreaterThanOrEqual(10);
    const diagnostics = getCommercialCtaRegistryDiagnostics();
    expect(diagnostics.errorCount, JSON.stringify(diagnostics.issues, null, 2)).toBe(0);
    expect(diagnostics.ok).toBe(true);
  });

  it('has unique ids and is frozen', () => {
    const ids = COMMERCIAL_CTA_REGISTRY.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.isFrozen(COMMERCIAL_CTA_REGISTRY)).toBe(true);
  });

  it('activates only Contact Finbrella today; everything else is inactive metadata', () => {
    const active = listActiveCtas();
    expect(active.map((c) => c.id)).toEqual(['contactFinbrella']);
    const diagnostics = getCommercialCtaRegistryDiagnostics();
    expect(diagnostics.activeCount).toBe(1);
    expect(diagnostics.inactiveCount).toBe(COMMERCIAL_CTA_REGISTRY.length - 1);
  });

  it('never activates a commercial CTA while regulatory approval is pending', () => {
    for (const cta of COMMERCIAL_CTA_REGISTRY) {
      if (cta.commercial && cta.availability === 'active') {
        expect(cta.regulatoryStatus).not.toBe('pending');
      }
    }
  });

  it('keeps regulated buy/view/sip CTAs inactive and pending', () => {
    for (const id of ['viewPlans', 'comparePlans', 'buyProduct', 'startSip', 'increaseSip']) {
      const cta = getCtaById(id);
      expect(cta.availability).toBe('inactive');
      expect(cta.regulatoryStatus).toBe('pending');
      expect(cta.commercial).toBe(true);
    }
  });

  it('only references valid enums and capability keys', () => {
    for (const cta of COMMERCIAL_CTA_REGISTRY) {
      expect(CTA_ACTION_TYPES).toContain(cta.actionType);
      expect(EXECUTION_STRATEGIES).toContain(cta.executionStrategy);
      expect(AVAILABILITY).toContain(cta.availability);
      expect(REGULATORY_STATUS).toContain(cta.regulatoryStatus);
      if (cta.futureCapability) expect(COMMERCIAL_CAPABILITY_KEYS).toContain(cta.futureCapability);
    }
  });

  it('exposes lookup + filter helpers', () => {
    expect(hasCta('contactFinbrella')).toBe(true);
    expect(getCtaById('nope')).toBeNull();
    expect(listCtas({ commercial: true }).every((c) => c.commercial)).toBe(true);
  });

  it('every non-universal CTA falls back to an active CTA', () => {
    for (const cta of COMMERCIAL_CTA_REGISTRY) {
      if (cta.id === 'contactFinbrella') continue;
      expect(cta.fallbackCtaId).toBe('contactFinbrella');
    }
  });

  it('the active email CTA references the existing email flow', () => {
    const cta = getCtaById('contactFinbrella');
    expect(cta.executionStrategy).toBe('email');
    expect(cta.emailTemplateRef).toBe('support_request');
  });
});
