import { describe, it, expect } from 'vitest';
import {
  resolveExperienceAvailability,
  resolveAvailableExperiences,
  getAvailabilityDiagnostics,
  validateAvailabilityModel,
  capabilitiesFromWorkspaceMode,
  getRequiredCapabilities,
  availableModel,
  lockedModel,
  hiddenModel,
} from './index';
import { listExperiences, getExperienceById } from '../experienceRegistry';

describe('experienceAvailability — model factories', () => {
  it('builds an immutable launch model', () => {
    const model = availableModel();
    expect(model).toEqual({
      available: true,
      locked: false,
      hidden: false,
      reason: null,
      subtitle: null,
      action: 'launch',
      requiredCapability: null,
    });
    expect(Object.isFrozen(model)).toBe(true);
    expect(validateAvailabilityModel(model).ok).toBe(true);
  });

  it('builds an immutable locked upgrade model', () => {
    const model = lockedModel();
    expect(model.available).toBe(false);
    expect(model.locked).toBe(true);
    expect(model.hidden).toBe(false);
    expect(model.action).toBe('upgrade');
    expect(model.reason).toBe('Requires Complete Financial Planning');
    expect(model.subtitle).toBe('Available in Complete Financial Planning');
    expect(validateAvailabilityModel(model).ok).toBe(true);
  });

  it('builds an immutable hidden model', () => {
    const model = hiddenModel({ reason: 'Requires Advisor', requiredCapability: 'advisor' });
    expect(model).toMatchObject({
      available: false,
      locked: false,
      hidden: true,
      action: 'none',
      requiredCapability: 'advisor',
    });
    expect(validateAvailabilityModel(model).ok).toBe(true);
  });
});

describe('experienceAvailability — capability mapping', () => {
  it('maps experience.capability to product requirements', () => {
    expect(getRequiredCapabilities({ capability: 'any' })).toEqual([]);
    expect(getRequiredCapabilities({ capability: 'summary' })).toEqual(['summary']);
    expect(getRequiredCapabilities({ capability: 'full' })).toEqual(['detailed']);
  });

  it('prefers requiredCapabilities metadata when present', () => {
    expect(
      getRequiredCapabilities({
        capability: 'full',
        requiredCapabilities: ['advisor', 'detailed'],
      }),
    ).toEqual(['advisor', 'detailed']);
  });

  it('derives user capabilities from workspace mode', () => {
    expect(capabilitiesFromWorkspaceMode('summary').detailed).toBe(false);
    expect(capabilitiesFromWorkspaceMode('full').detailed).toBe(true);
    expect(capabilitiesFromWorkspaceMode('full').summary).toBe(true);
  });
});

describe('experienceAvailability — Summary user', () => {
  const ctx = { capability: 'summary' };

  it('sees Summary / any experiences as available', () => {
    const salary = getExperienceById('income.salary');
    const availability = resolveExperienceAvailability(salary, ctx);
    expect(availability.available).toBe(true);
    expect(availability.locked).toBe(false);
    expect(availability.action).toBe('launch');
  });

  it('sees Detailed (full) experiences as locked, not hidden', () => {
    const homeLoan = getExperienceById('liabilities.homeLoan');
    expect(homeLoan.capability).toBe('full');
    const availability = resolveExperienceAvailability(homeLoan, ctx);
    expect(availability.available).toBe(false);
    expect(availability.locked).toBe(true);
    expect(availability.hidden).toBe(false);
    expect(availability.action).toBe('upgrade');
    expect(availability.reason).toBe('Requires Complete Financial Planning');
    expect(availability.subtitle).toBe('Available in Complete Financial Planning');
    expect(availability.requiredCapability).toBe('detailed');
  });

  it('keeps locked experiences in resolveAvailableExperiences', () => {
    const experiences = [
      getExperienceById('income.salary'),
      getExperienceById('liabilities.homeLoan'),
    ];
    const resolved = resolveAvailableExperiences(experiences, ctx);
    expect(resolved).toHaveLength(2);
    expect(resolved.find((r) => r.experience.id === 'liabilities.homeLoan').availability.locked).toBe(
      true,
    );
  });
});

describe('experienceAvailability — paid / full users', () => {
  const ctx = { capability: 'full' };

  it('retains launch access to Detailed experiences', () => {
    const homeLoan = getExperienceById('liabilities.homeLoan');
    const availability = resolveExperienceAvailability(homeLoan, ctx);
    expect(availability.available).toBe(true);
    expect(availability.locked).toBe(false);
    expect(availability.action).toBe('launch');
  });

  it('marks the whole curated catalogue available under full capability', () => {
    const curated = listExperiences({ curatedOnly: true });
    const diag = getAvailabilityDiagnostics(curated, ctx);
    expect(diag.locked).toBe(0);
    expect(diag.hidden).toBe(0);
    expect(diag.available).toBe(curated.length);
  });
});

describe('experienceAvailability — hidden experiences', () => {
  it('hides experiences that require future capabilities the user lacks', () => {
    const experience = {
      id: 'future.advisorReview',
      capability: 'any',
      requiredCapabilities: ['advisor'],
    };
    const availability = resolveExperienceAvailability(experience, {
      capability: 'full',
    });
    expect(availability.hidden).toBe(true);
    expect(availability.available).toBe(false);
    expect(availability.action).toBe('none');
  });

  it('omits hidden experiences from resolveAvailableExperiences', () => {
    const experiences = [
      getExperienceById('income.salary'),
      {
        id: 'future.aiAssist',
        capability: 'any',
        requiredCapabilities: ['aiAssistant'],
      },
    ];
    const resolved = resolveAvailableExperiences(experiences, { capability: 'full' });
    expect(resolved.map((r) => r.experience.id)).toEqual(['income.salary']);
  });

  it('hides experiences gated by a disabled futureFeature flag', () => {
    const experience = {
      id: 'future.flagged',
      capability: 'any',
      futureFeature: 'betaAdvisor',
    };
    expect(
      resolveExperienceAvailability(experience, {
        capability: 'full',
        featureFlags: { betaAdvisor: false },
      }).hidden,
    ).toBe(true);
    expect(
      resolveExperienceAvailability(experience, {
        capability: 'full',
        featureFlags: { betaAdvisor: true },
      }).available,
    ).toBe(true);
  });
});

describe('experienceAvailability — diagnostics', () => {
  it('reports available / locked / hidden counts for Summary users', () => {
    const curated = listExperiences({ curatedOnly: true });
    const diag = getAvailabilityDiagnostics(curated, { capability: 'summary' });
    expect(diag.total).toBe(curated.length);
    expect(diag.available).toBeGreaterThan(0);
    expect(diag.locked).toBeGreaterThan(0);
    expect(diag.userCapabilities.detailed).toBe(false);
    expect(diag.samples.locked.length).toBeGreaterThan(0);
    expect(Object.isFrozen(diag)).toBe(true);
  });
});

describe('experienceAvailability — validateAvailabilityModel invariants', () => {
  it('rejects available+locked combinations', () => {
    const result = validateAvailabilityModel({
      available: true,
      locked: true,
      hidden: false,
      reason: null,
      subtitle: null,
      action: 'launch',
      requiredCapability: null,
    });
    expect(result.ok).toBe(false);
  });
});
