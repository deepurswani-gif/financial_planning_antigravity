import { describe, it, expect } from 'vitest';
import { resolveEntities, searchEntities, matchScore } from './dynamicEntities';
import { searchSmartEdit, describeEntity } from './smartEditModel';
import { getExperienceById } from '../../../experienceRegistry';

/**
 * A representative Financial Plan with the user's live financial objects.
 */
const PLAN = {
  policies: [
    { id: 'p1', company: 'LIC', planName: 'Jeevan Anand', planType: 'Term Plan' },
    { id: 'p2', company: 'HDFC', planName: 'Click2Protect', planType: 'Term Plan' },
    { id: 'p3', company: '', planName: '' }, // incomplete → skipped
  ],
  expenseCategories: {
    emi: {
      homeLoan: { principal: 5000000, emi: 40000 },
      carLoan: { principal: 800000, emi: 15000 },
      personalLoan: { principal: 0 }, // not configured → skipped
    },
    savings: {
      rd: [
        { amount: 5000, name: 'Axis RD' },
        { amount: 3000 }, // unnamed → positional label
        '', // empty → skipped
      ],
    },
  },
  assetCategories: {
    investments: {
      fixedDeposit: [
        { amount: 200000 },
        { amount: 0 }, // not configured → skipped
      ],
    },
    custom: [{ id: 'c1', label: 'Warehouse', value: 900000 }, { label: '' }],
  },
  liabilityCategories: {
    custom: [{ id: 'l1', label: 'Private Loan', value: 100000 }],
  },
  goals: [
    { id: 'g1', name: 'Marriage' },
    { id: 'g2', name: 'MBA' },
    { id: 'g3', name: '' }, // no name → skipped
  ],
  familyMembers: [
    { relation: 'Self', name: 'Ravi' },
    { relation: 'Child', name: 'Aarav' },
    { relation: 'Child', name: 'Riya' },
  ],
};

describe('resolveEntities — extraction from the Financial Plan', () => {
  const entities = resolveEntities(PLAN);
  const byType = (t) => entities.filter((e) => e.entityType === t);

  it('extracts named life policies and skips incomplete ones', () => {
    const life = byType('lifePolicy');
    expect(life.map((e) => e.displayName)).toEqual(['LIC Jeevan Anand', 'HDFC Click2Protect']);
    expect(life[0].activation).toEqual({ channel: 'lifePolicyModal' });
  });

  it('extracts only configured loans and routes Home Loan to its own experience', () => {
    const loans = byType('loan');
    expect(loans.map((e) => e.displayName).sort()).toEqual(['Car Loan', 'Home Loan']);
    const home = loans.find((e) => e.displayName === 'Home Loan');
    expect(home.experienceId).toBe('liabilities.homeLoan');
    expect(home.activation).toEqual({ channel: 'loanModal', key: 'homeLoan' });
    const car = loans.find((e) => e.displayName === 'Car Loan');
    expect(car.experienceId).toBe('debt.loans');
    expect(car.activation).toEqual({ channel: 'loanModal', key: 'carLoan' });
  });

  it('extracts configured FDs with an exact index activation', () => {
    const fds = byType('fixedDeposit');
    expect(fds).toHaveLength(1);
    expect(fds[0].activation).toEqual({ channel: 'fdCollection', index: 0 });
  });

  it('extracts RDs, using names when present and positional labels otherwise', () => {
    const rds = byType('recurringDeposit');
    expect(rds.map((e) => e.displayName)).toEqual(['Axis RD', 'Recurring Deposit 2']);
    expect(rds[0].activation).toEqual({ channel: 'rdCollection', index: 0 });
    expect(rds[1].activation).toEqual({ channel: 'rdCollection', index: 1 });
  });

  it('extracts goals and children by their remembered names', () => {
    expect(byType('goal').map((e) => e.displayName)).toEqual(['Marriage', 'MBA']);
    expect(byType('child').map((e) => e.displayName)).toEqual(['Aarav', 'Riya']);
  });

  it('extracts custom assets/liabilities and references a real experience', () => {
    const asset = byType('customAsset')[0];
    const liab = byType('customLiability')[0];
    expect(asset.displayName).toBe('Warehouse');
    expect(liab.displayName).toBe('Private Loan');
    expect(getExperienceById(asset.experienceId)).toBeTruthy();
    expect(getExperienceById(liab.experienceId)).toBeTruthy();
  });

  it('never references an experience that does not exist', () => {
    entities.forEach((e) => {
      expect(getExperienceById(e.experienceId)).toBeTruthy();
    });
  });

  it('produces stable, unique entity ids', () => {
    const ids = entities.map((e) => e.entityId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('is pure — an empty plan yields no entities', () => {
    expect(resolveEntities({})).toEqual([]);
    expect(resolveEntities()).toEqual([]);
  });
});

describe('matchScore — ranking primitive', () => {
  it('ranks exact > alias-exact > prefix > substring', () => {
    expect(matchScore('lic', 'LIC')).toBe(100);
    expect(matchScore('term', 'LIC', ['term'])).toBe(90);
    expect(matchScore('lic', 'LIC Jeevan Anand')).toBe(70);
    expect(matchScore('jeevan', 'LIC Jeevan Anand')).toBe(40);
    expect(matchScore('zzz', 'LIC Jeevan Anand')).toBe(0);
  });
});

describe('searchEntities', () => {
  const entities = resolveEntities(PLAN);

  it('finds a specific policy the user remembers', () => {
    const results = searchEntities(entities, 'LIC');
    expect(results[0].entity.displayName).toBe('LIC Jeevan Anand');
  });

  it('finds a goal by name', () => {
    const results = searchEntities(entities, 'Marriage');
    expect(results[0].entity.displayName).toBe('Marriage');
  });

  it('returns nothing for a blank query', () => {
    expect(searchEntities(entities, '')).toEqual([]);
  });
});

describe('searchSmartEdit — merged experience + entity results', () => {
  const opts = { entities: resolveEntities(PLAN), limit: 20 };

  it('surfaces a remembered entity ("LIC") that no experience matches', () => {
    const results = searchSmartEdit('LIC', opts);
    const top = results[0];
    expect(top.kind).toBe('entity');
    expect(top.name).toBe('LIC Jeevan Anand');
    expect(top.experienceId).toBe('protection.lifeInsurance');
  });

  it('returns "Marriage" as a goal entity carrying its experience', () => {
    const results = searchSmartEdit('Marriage', opts);
    expect(results[0].kind).toBe('entity');
    expect(results[0].experienceId).toBe('goals.collection');
  });

  it('returns a child entity for "Aarav"', () => {
    const results = searchSmartEdit('Aarav', opts);
    expect(results[0].name).toBe('Aarav');
    expect(results[0].experienceId).toBe('family.children');
  });

  it('falls back to the generic experience when no entity matches ("SIP")', () => {
    const results = searchSmartEdit('SIP', opts);
    expect(results.some((r) => r.kind === 'experience' && r.experienceId === 'savings.sip')).toBe(true);
  });

  it('still returns the generic FD experience for the bare term "fixed deposit"', () => {
    const results = searchSmartEdit('fixed deposit', opts);
    expect(results.some((r) => r.experienceId === 'assets.fixedDeposits')).toBe(true);
  });

  it('works with no dynamic entities (experience-only)', () => {
    const results = searchSmartEdit('salary', {});
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.kind === 'experience')).toBe(true);
  });
});

describe('describeEntity — launch descriptor for exact-instance editing', () => {
  it('carries instance identity + activation override', () => {
    const [fd] = resolveEntities(PLAN).filter((e) => e.entityType === 'fixedDeposit');
    const d = describeEntity(fd);
    expect(d.kind).toBe('entity');
    expect(d.experienceId).toBe('assets.fixedDeposits');
    expect(d.instanceIndex).toBe(0);
    expect(d.activation).toEqual({ channel: 'fdCollection', index: 0 });
  });
});
