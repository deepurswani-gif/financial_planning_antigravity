import { describe, it, expect } from 'vitest';
import {
  ACTIVATION_STRATEGIES,
  resolveActivation,
  resolveInstanceActivation,
  buildActivationRequest,
  getExperienceById,
  resolveLanding,
} from './index';
import { normalizeExperience, validateExperience } from './schema';

const landingFor = (id) => resolveLanding(getExperienceById(id), { capability: 'full' });

describe('Activation strategies', () => {
  it('exposes the full strategy vocabulary', () => {
    expect(ACTIVATION_STRATEGIES).toContain('openFocusedEditor');
    expect(ACTIVATION_STRATEGIES).toContain('openConfigureModal');
    expect(ACTIVATION_STRATEGIES).toContain('openConfigureScreen');
    expect(ACTIVATION_STRATEGIES).toContain('openCollectionPicker');
    expect(ACTIVATION_STRATEGIES).toContain('openExistingInstance');
    expect(ACTIVATION_STRATEGIES).toContain('openAddFlow');
    expect(ACTIVATION_STRATEGIES).toContain('noActivation');
  });
});

describe('resolveInstanceActivation — add / existing / picker', () => {
  it('opens Add flow when no instance exists', () => {
    expect(resolveInstanceActivation([])).toBe('openAddFlow');
    expect(resolveInstanceActivation(null)).toBe('openAddFlow');
  });
  it('opens the single instance directly', () => {
    expect(resolveInstanceActivation([{ amount: 1 }])).toBe('openExistingInstance');
  });
  it('never guesses when multiple exist — shows the picker', () => {
    expect(resolveInstanceActivation([{}, {}])).toBe('openCollectionPicker');
    expect(resolveInstanceActivation([{}, {}, {}])).toBe('openCollectionPicker');
  });
});

describe('resolveActivation — metadata driven', () => {
  it('scalars open the Focused editor', () => {
    const exp = getExperienceById('income.salary');
    expect(resolveActivation(exp, landingFor('income.salary'))).toBe('openFocusedEditor');
  });

  it('calculator experiences open the configure modal', () => {
    const exp = getExperienceById('planning.incomeTax');
    expect(resolveActivation(exp, landingFor('planning.incomeTax'))).toBe('openConfigureModal');
  });

  it('deterministic configure (home loan, PPF) opens a configure modal', () => {
    expect(resolveActivation(getExperienceById('liabilities.homeLoan'), landingFor('liabilities.homeLoan'))).toBe(
      'openConfigureModal',
    );
    expect(resolveActivation(getExperienceById('savings.ppf'), landingFor('savings.ppf'))).toBe(
      'openConfigureModal',
    );
  });

  it('Life Insurance lands on premiums without opening the policy modal', () => {
    expect(resolveActivation(getExperienceById('protection.lifeInsurance'), landingFor('protection.lifeInsurance'))).toBe(
      'noActivation',
    );
    expect(buildActivationRequest(getExperienceById('protection.lifeInsurance'), landingFor('protection.lifeInsurance'))).toBeNull();
  });

  it('Add experiences land without activation so users can add another instance', () => {
    expect(resolveActivation(getExperienceById('savings.addRecurringDeposit'), landingFor('savings.addRecurringDeposit'))).toBe(
      'noActivation',
    );
    expect(resolveActivation(getExperienceById('assets.addFixedDeposit'), landingFor('assets.addFixedDeposit'))).toBe(
      'noActivation',
    );
    expect(resolveActivation(getExperienceById('savings.addPpf'), landingFor('savings.addPpf'))).toBe(
      'noActivation',
    );
    expect(buildActivationRequest(getExperienceById('savings.addRecurringDeposit'), landingFor('savings.addRecurringDeposit'))).toBeNull();
  });

  it('collections refine by instance count', () => {
    const fd = getExperienceById('assets.fixedDeposits');
    const landing = landingFor('assets.fixedDeposits');
    expect(resolveActivation(fd, landing)).toBe('openCollectionPicker'); // unknown count
    expect(resolveActivation(fd, landing, { instances: [] })).toBe('openAddFlow');
    expect(resolveActivation(fd, landing, { instances: [{}] })).toBe('openExistingInstance');
    expect(resolveActivation(fd, landing, { instances: [{}, {}] })).toBe('openCollectionPicker');
  });

  it('read-only experiences do not activate', () => {
    const exp = getExperienceById('explain.totalEmi');
    expect(resolveActivation(exp, landingFor('explain.totalEmi'))).toBe('noActivation');
  });
});

describe('buildActivationRequest', () => {
  it('builds a channelled request for configure experiences', () => {
    const req = buildActivationRequest(
      getExperienceById('liabilities.homeLoan'),
      landingFor('liabilities.homeLoan'),
    );
    expect(req).toMatchObject({ channel: 'loanModal', key: 'homeLoan', collection: false });
  });

  it('flags collection requests', () => {
    const req = buildActivationRequest(
      getExperienceById('assets.fixedDeposits'),
      landingFor('assets.fixedDeposits'),
    );
    expect(req).toMatchObject({ channel: 'fdCollection', collection: true });
    expect(req.collectionFieldId).toBe('assets.fixedDeposits');
  });

  it('returns null when there is no activation channel (scalars)', () => {
    const req = buildActivationRequest(getExperienceById('income.salary'), landingFor('income.salary'));
    expect(req).toBeNull();
  });
});

describe('schema — activation validation', () => {
  it('accepts an activation with a channel', () => {
    const exp = normalizeExperience({
      id: 'x.y',
      title: 'X',
      experienceType: 'configure',
      launchStrategy: 'configure_screen',
      registryTargets: ['income.self.monthlyTakeHome'],
      activation: { channel: 'loanModal', key: 'homeLoan' },
    });
    expect(validateExperience(exp)).toEqual([]);
  });

  it('rejects an activation without a channel', () => {
    const exp = normalizeExperience({
      id: 'x.y',
      title: 'X',
      experienceType: 'configure',
      launchStrategy: 'configure_screen',
      registryTargets: ['income.self.monthlyTakeHome'],
      activation: { key: 'homeLoan' },
    });
    expect(validateExperience(exp).some((e) => e.includes('activation.channel'))).toBe(true);
  });
});
