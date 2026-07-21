import { describe, it, expect } from 'vitest';
import {
  LANDING_TARGETS,
  LANDING_CONTROLS,
  getLandingTarget,
  isLandingTargetId,
  listLandingTargets,
  getExperienceById,
  resolveLaunch,
  resolveLanding,
} from './index';
import { getFieldById } from '../questionRegistry';
import { normalizeExperience, validateExperience } from './schema';

describe('Landing Targets — catalog integrity', () => {
  it('every landing target references a known registry field', () => {
    for (const target of LANDING_TARGETS) {
      expect(getFieldById(target.fieldId), `field for ${target.id}`).toBeTruthy();
    }
  });

  it('every landing target has a valid control', () => {
    for (const target of LANDING_TARGETS) {
      expect(LANDING_CONTROLS).toContain(target.control);
    }
  });

  it('ids are unique and stable logical identifiers (no indexes)', () => {
    const ids = new Set();
    for (const target of LANDING_TARGETS) {
      expect(ids.has(target.id)).toBe(false);
      ids.add(target.id);
      expect(target.id).toMatch(/^[a-z][a-zA-Z]*\.[a-zA-Z]+$/);
    }
    expect(listLandingTargets()).toHaveLength(LANDING_TARGETS.length);
  });

  it('accessors work', () => {
    expect(isLandingTargetId('income.selfSalary')).toBe(true);
    expect(isLandingTargetId('nope.nope')).toBe(false);
    expect(getLandingTarget('loan.personal')?.fieldId).toBe('debt.emi.loans');
  });
});

describe('Landing resolver', () => {
  it('resolves a scalar landing to a concrete question (full)', () => {
    const salary = getExperienceById('income.salary');
    const landing = resolveLanding(salary, { capability: 'full' });
    expect(landing.landingTargetId).toBe('income.selfSalary');
    expect(landing.control).toBe('scalar');
    expect(landing.questionId).toBeTruthy();
    expect(landing.sectionId).toBeTruthy();
  });

  it('resolves life insurance to the detailed life-insurance question', () => {
    const life = getExperienceById('protection.lifeInsurance');
    const landing = resolveLanding(life, { capability: 'full' });
    expect(landing.control).toBe('collection');
    expect(landing.questionId).toBe('life-insurance');
    expect(landing.collectionFieldId).toBe('protection.life.policies');
  });

  it('resolves personal loan to the emi-loans configure question', () => {
    const loans = getExperienceById('debt.loans');
    const landing = resolveLanding(loans, { capability: 'full' });
    expect(landing.questionId).toBe('emi-loans');
  });

  it('resolves goals sub-questions distinctly', () => {
    const goals = getExperienceById('goals.collection');
    const landing = resolveLanding(goals, { capability: 'full' });
    expect(landing.questionId).toBe('goals-catalog');

    const yearsTarget = getLandingTarget('goal.years');
    const experienceLike = normalizeExperience({
      id: 'x.y',
      title: 'X',
      experienceType: 'collection',
      registryTargets: [yearsTarget.fieldId],
      landingTarget: 'goal.years',
    });
    const yearsLanding = resolveLanding(experienceLike, { capability: 'full' });
    expect(yearsLanding.questionId).toBe('goals-years');
  });

  it('falls back to the primary target when no explicit landing target', () => {
    const experienceLike = normalizeExperience({
      id: 'x.y',
      title: 'X',
      experienceType: 'scalar',
      registryTargets: ['income.self.monthlyTakeHome'],
    });
    const landing = resolveLanding(experienceLike, { capability: 'full' });
    expect(landing.landingTargetId).toBeNull();
    expect(landing.questionId).toBeTruthy();
  });
});

describe('resolveLaunch — landing descriptor', () => {
  it('section launches carry landing question + control', () => {
    const life = getExperienceById('protection.lifeInsurance');
    const descriptor = resolveLaunch(life, { capability: 'full' });
    expect(descriptor.sectionId).toBeTruthy();
    expect(descriptor.landingQuestionId).toBe('life-insurance');
    expect(descriptor.landingControl).toBe('collection');
    expect(descriptor.collectionFieldId).toBe('protection.life.policies');
  });

  it('focused edits still resolve a landing target id', () => {
    const salary = getExperienceById('income.salary');
    const descriptor = resolveLaunch(salary, { capability: 'full' });
    expect(descriptor.strategy).toBe('focused_edit_session');
    expect(descriptor.landingTargetId).toBe('income.selfSalary');
  });
});

describe('Experience schema — landingTarget validation', () => {
  it('accepts a known landing target id', () => {
    const experience = normalizeExperience({
      id: 'x.y',
      title: 'X',
      experienceType: 'scalar',
      registryTargets: ['income.self.monthlyTakeHome'],
      landingTarget: 'income.selfSalary',
    });
    expect(validateExperience(experience)).toEqual([]);
  });

  it('rejects an unknown landing target id', () => {
    const experience = normalizeExperience({
      id: 'x.y',
      title: 'X',
      experienceType: 'scalar',
      registryTargets: ['income.self.monthlyTakeHome'],
      landingTarget: 'bogus.target',
    });
    const errors = validateExperience(experience);
    expect(errors.some((e) => e.includes('landingTarget'))).toBe(true);
  });
});
