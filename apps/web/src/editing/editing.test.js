import { describe, it, expect } from 'vitest';
import {
  EDIT_STATES,
  EDIT_EVENTS,
  createInitialEditState,
  editSessionReducer,
  isActive,
  canSave,
} from './editSessionMachine';
import { runSavePipeline, SAVE_PHASES } from './savePipeline';
import {
  createEditSession,
  encodeEditSessionToParams,
  decodeEditSessionFromParams,
  encodeReturnToOriginParams,
} from './editSession';
import { validateFieldValue, validateFieldValues, coerceValue } from './validation';
import { parsePath, getRootKey, readValueByPath, computeRootUpdate } from './planAccessor';

describe('editSessionMachine', () => {
  it('drives the full happy-path lifecycle Idle→Starting→Editing→Saving→Returning→Idle', () => {
    let ctx = createInitialEditState();
    expect(ctx.state).toBe(EDIT_STATES.IDLE);

    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.START, session: { id: 's1' } });
    expect(ctx.state).toBe(EDIT_STATES.STARTING);

    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.RESOLVED, draft: { a: 1 } });
    expect(ctx.state).toBe(EDIT_STATES.EDITING);
    expect(canSave(ctx)).toBe(true);

    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.CHANGE, draft: { a: 2 } });
    expect(ctx.dirty).toBe(true);
    expect(ctx.draft).toEqual({ a: 2 });

    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.REQUEST_SAVE });
    expect(ctx.state).toBe(EDIT_STATES.SAVING);

    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.SAVE_SUCCESS });
    expect(ctx.state).toBe(EDIT_STATES.RETURNING);

    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.RETURN_DONE });
    expect(ctx.state).toBe(EDIT_STATES.IDLE);
    expect(ctx.session).toBeNull();
  });

  it('routes save failures to Error with the failing phase and supports retry', () => {
    let ctx = createInitialEditState();
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.START, session: { id: 's' } });
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.RESOLVED, draft: {} });
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.REQUEST_SAVE });
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.SAVE_FAILED, phase: 'persist', error: 'boom' });
    expect(ctx.state).toBe(EDIT_STATES.ERROR);
    expect(ctx.failedPhase).toBe('persist');
    expect(ctx.error).toBe('boom');

    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.RETRY });
    expect(ctx.state).toBe(EDIT_STATES.EDITING);
    expect(ctx.error).toBeNull();
  });

  it('ignores invalid transitions and never interrupts an in-flight save', () => {
    let ctx = createInitialEditState();
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.START, session: { id: 's' } });
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.RESOLVED, draft: {} });
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.REQUEST_SAVE });
    const saving = ctx;
    // START during SAVING is a no-op.
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.START, session: { id: 's2' } });
    expect(ctx).toBe(saving);
  });

  it('cancel from Editing or Error returns to origin without persisting', () => {
    let ctx = createInitialEditState();
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.START, session: { id: 's' } });
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.RESOLVED, draft: {} });
    ctx = editSessionReducer(ctx, { type: EDIT_EVENTS.CANCEL });
    expect(ctx.state).toBe(EDIT_STATES.RETURNING);
    expect(isActive(ctx)).toBe(false);
  });
});

describe('savePipeline', () => {
  it('runs phases in order and returns impacts on success', async () => {
    const order = [];
    const result = await runSavePipeline({
      validate: () => {
        order.push('validate');
        return { valid: true, values: { x: 1 } };
      },
      persist: (v) => {
        order.push('persist');
        expect(v).toEqual({ x: 1 });
      },
      recalculate: () => order.push('recalculate'),
      close: () => order.push('close'),
      returnToOrigin: () => order.push('return'),
      getImpacts: () => ['report.summary'],
      onPhase: (p) => order.push(`phase:${p}`),
    });

    expect(result.ok).toBe(true);
    expect(result.impacts).toEqual(['report.summary']);
    // Effect order (ignoring phase markers) must match SAVE_PHASES.
    const effects = order.filter((o) => !o.startsWith('phase:'));
    expect(effects).toEqual(SAVE_PHASES);
  });

  it('stops at validate on invalid input, never persisting or returning', async () => {
    let persisted = false;
    let returned = false;
    const result = await runSavePipeline({
      validate: () => ({ valid: false, errors: ['bad'] }),
      persist: () => { persisted = true; },
      recalculate: () => {},
      close: () => {},
      returnToOrigin: () => { returned = true; },
    });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('validate');
    expect(result.errors).toEqual(['bad']);
    expect(persisted).toBe(false);
    expect(returned).toBe(false);
  });

  it('stops at persist on error and does not close or return', async () => {
    let returned = false;
    const result = await runSavePipeline({
      validate: () => ({ valid: true, values: {} }),
      persist: () => { throw new Error('db down'); },
      recalculate: () => {},
      close: () => {},
      returnToOrigin: () => { returned = true; },
    });
    expect(result.ok).toBe(false);
    expect(result.phase).toBe('persist');
    expect(result.errors[0]).toContain('db down');
    expect(returned).toBe(false);
  });
});

describe('editSession (registry-driven)', () => {
  const fixedNow = () => '2026-01-01T00:00:00.000Z';
  const fixedId = () => 'es_test';

  it('creates a session resolving the registry edit target', () => {
    const session = createEditSession('family.self.dob', {
      capability: 'full',
      origin: { workspaceMode: 'full', reportId: 'report.life_journey', source: 'quick_edit' },
      now: fixedNow,
      idFactory: fixedId,
    });
    expect(session.fieldId).toBe('family.self.dob');
    expect(session.mode).toBe('focused');
    expect(session.target.sectionId).toBeTruthy();
    expect(session.target.questionId).toBeTruthy();
    expect(session.origin.reportId).toBe('report.life_journey');
  });

  it('throws for unknown fields', () => {
    expect(() => createEditSession('nope.missing')).toThrow(/Unknown registry field/);
  });

  it('round-trips through URL params', () => {
    const session = createEditSession('family.self.dob', {
      capability: 'full',
      origin: { workspaceMode: 'full', reportId: 'report.life_journey' },
      now: fixedNow,
      idFactory: fixedId,
    });
    const params = encodeEditSessionToParams(session);
    expect(params.get('field')).toBe('family.self.dob');
    expect(params.get('editMode')).toBe('focused');

    const decoded = decodeEditSessionFromParams(params);
    expect(decoded).not.toBeNull();
    expect(decoded.fieldId).toBe('family.self.dob');
    expect(decoded.origin.reportId).toBe('report.life_journey');
  });

  it('ignores param sets without a focused edit descriptor', () => {
    const params = new URLSearchParams('mode=full&report=report.summary&edit=familyInformation');
    expect(decodeEditSessionFromParams(params)).toBeNull();
  });

  it('return-to-origin params strip focused-edit keys but keep report', () => {
    const session = createEditSession('family.self.dob', {
      capability: 'full',
      origin: { workspaceMode: 'full', reportId: 'report.life_journey' },
      now: fixedNow,
      idFactory: fixedId,
    });
    const editParams = encodeEditSessionToParams(session);
    const returnParams = encodeReturnToOriginParams(session, editParams);
    expect(returnParams.get('field')).toBeNull();
    expect(returnParams.get('editMode')).toBeNull();
    expect(returnParams.get('edit')).toBeNull();
    expect(returnParams.get('report')).toBe('report.life_journey');
    expect(returnParams.get('mode')).toBe('full');
  });
});

describe('validation', () => {
  it('coerces value types', () => {
    expect(coerceValue('currency', '1,200')).toBe(1200);
    expect(coerceValue('boolean', 'true')).toBe(true);
    expect(coerceValue('text', 'hi')).toBe('hi');
    expect(coerceValue('number', '')).toBe('');
  });

  it('enforces required + min/max from field rules', () => {
    const field = {
      id: 'x.y',
      label: 'Amount',
      valueType: 'number',
      validation: { required: true, min: 0, max: 100 },
    };
    expect(validateFieldValue(field, '').valid).toBe(false);
    expect(validateFieldValue(field, 50).valid).toBe(true);
    expect(validateFieldValue(field, 150).errors[0]).toContain('at most');
    expect(validateFieldValue(field, -5).errors[0]).toContain('at least');
  });

  it('rejects impossible dates for date valueType', () => {
    const field = {
      id: 'family.self.dob',
      label: 'Date of birth',
      shortLabel: 'DOB',
      valueType: 'date',
      validation: { required: true },
    };
    expect(validateFieldValue(field, '1990-05-20').valid).toBe(true);
    expect(validateFieldValue(field, '2026-02-31').valid).toBe(false);
    expect(validateFieldValue(field, '2025-02-29').valid).toBe(false);
  });

  it('validates a real registry field', () => {
    const result = validateFieldValues({ 'family.self.dob': '1990-05-20' });
    expect(result.valid).toBe(true);
    expect(result.values['family.self.dob']).toBe('1990-05-20');
  });
});

describe('planAccessor', () => {
  it('parses dotted and selector paths', () => {
    expect(parsePath('a.b.c').map((s) => s.key)).toEqual(['a', 'b', 'c']);
    const seg = parsePath('familyMembers[relation=Self].dob');
    expect(seg[0].selector).toEqual({ field: 'relation', value: 'Self' });
    expect(getRootKey('income.selfDetail.inHandSalary')).toBe('income');
  });

  it('reads nested and array-selector values', () => {
    const plan = {
      expenseCategories: { summaryHouseholdTotal: 42000 },
      familyMembers: [
        { relation: 'Self', dob: '1990-01-01' },
        { relation: 'Spouse', dob: '1992-01-01' },
      ],
    };
    expect(readValueByPath(plan, 'expenseCategories.summaryHouseholdTotal')).toBe(42000);
    expect(readValueByPath(plan, 'familyMembers[relation=Self].dob')).toBe('1990-01-01');
  });

  it('immutably computes root updates for nested paths', () => {
    const plan = { expenseCategories: { summaryHouseholdTotal: 100, other: 1 } };
    const { rootKey, rootValue } = computeRootUpdate(plan, 'expenseCategories.summaryHouseholdTotal', 250);
    expect(rootKey).toBe('expenseCategories');
    expect(rootValue).toEqual({ summaryHouseholdTotal: 250, other: 1 });
    // original is untouched
    expect(plan.expenseCategories.summaryHouseholdTotal).toBe(100);
  });

  it('immutably updates a matched array member', () => {
    const plan = {
      familyMembers: [
        { relation: 'Self', dob: '1990-01-01' },
        { relation: 'Spouse', dob: '1992-01-01' },
      ],
    };
    const { rootKey, rootValue } = computeRootUpdate(plan, 'familyMembers[relation=Self].dob', '1991-06-06');
    expect(rootKey).toBe('familyMembers');
    expect(rootValue[0].dob).toBe('1991-06-06');
    expect(rootValue[1].dob).toBe('1992-01-01');
    expect(plan.familyMembers[0].dob).toBe('1990-01-01');
  });
});
