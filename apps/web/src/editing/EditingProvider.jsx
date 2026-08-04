import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useReducer,
  useRef,
  useState,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useFinancialPlan } from '../contexts/FinancialPlanContext';
import { useAuth } from '../contexts/AuthContext';
import { getFieldById } from '../questionRegistry';
import {
  EDIT_EVENTS,
  createInitialEditState,
  editSessionReducer,
} from './editSessionMachine';
import { createEditSession, encodeReturnToOriginParams } from './editSession';
import { runSavePipeline } from './savePipeline';
import { validateFieldValues } from './validation';
import { computeRootUpdate, readValueByPath } from './planAccessor';
import { FINANCIAL_WORKSPACE_PATH } from '../components/FinancialWorkspace/workspaceNavConfig';
import { applySmartEditWriteBack } from './smartEditWriteBack';
import { AnalyticsEventName, trackAnalyticsEvent } from '../lib/analytics';
import { dispatchWealthMapUpdated, dispatchCoachNotificationsAfterRecalc } from '../notificationDelivery';

/**
 * EditingProvider — Finbrella's reusable Editing Platform runtime.
 *
 * Wires the pure Edit Session machine + Save Pipeline to real persistence
 * (FinancialPlanContext) and navigation. Every editing entry point (Quick Edit,
 * AI-assisted edits, report links, deep links) starts a session here and gets
 * the same lifecycle, single Save, and Return-to-Origin behaviour.
 *
 * Backward compatible: mounting this provider changes nothing until an entry
 * point calls `startEditSession`. No existing flow triggers it in Phase 3.
 */

const EditingContext = createContext(null);

/** Map of registry root state key → FinancialPlanContext setter. */
function buildRootSetters(plan) {
  return {
    familyMembers: plan.setFamilyMembers,
    income: plan.setIncome,
    expenseCategories: plan.setExpenseCategories,
    assetCategories: plan.setAssetCategories,
    liabilityCategories: plan.setLiabilityCategories,
    goals: plan.setGoals,
    policies: plan.setPolicies,
    contingencyFund: plan.setContingencyFund,
    inflationRates: plan.setInflationRates,
    hasEMI: plan.setHasEMI,
    hasSpouseIncome: plan.setHasSpouseIncome,
    hasLifeInsurance: plan.setHasLifeInsurance,
    hasHealthInsurance: plan.setHasHealthInsurance,
    summaryLifeCover: plan.setSummaryLifeCover,
    summaryHealthCover: plan.setSummaryHealthCover,
  };
}

/** Snapshot of the roots we can read/write, for accessor computations. */
function buildPlanSnapshot(plan) {
  return {
    familyMembers: plan.familyMembers,
    income: plan.income,
    expenseCategories: plan.expenseCategories,
    assetCategories: plan.assetCategories,
    liabilityCategories: plan.liabilityCategories,
    goals: plan.goals,
    policies: plan.policies,
    contingencyFund: plan.contingencyFund,
    inflationRates: plan.inflationRates,
    hasEMI: plan.hasEMI,
    hasSpouseIncome: plan.hasSpouseIncome,
    hasLifeInsurance: plan.hasLifeInsurance,
    hasHealthInsurance: plan.hasHealthInsurance,
    summaryLifeCover: plan.summaryLifeCover,
    summaryHealthCover: plan.summaryHealthCover,
  };
}

/**
 * Full state path for a field, composing collection instance addressing when
 * the field is a collection item edited for a specific instance.
 */
function resolveFieldStatePath(field, instanceId) {
  const path = field?.state?.path;
  if (!path) return null;
  if (field.kind === 'collectionItemField' && instanceId) {
    const collection = getFieldById(field.collectionId);
    const collectionPath = collection?.state?.path;
    const idKey = collection?.state?.idKey ?? 'id';
    if (collectionPath) {
      return `${collectionPath}[${idKey}=${instanceId}].${path}`;
    }
  }
  return path;
}

/** Field ids whose values are hosted together for a given session. */
function hostFieldIdsForSession(session) {
  const field = getFieldById(session.fieldId);
  const hosts = field?.editExperience?.hostsFieldIds;
  const scope = session.target?.savePolicy?.scope ?? field?.savePolicy?.scope;
  if (scope === 'hosts' && Array.isArray(hosts) && hosts.length) {
    return hosts;
  }
  return [session.fieldId];
}

export function EditingProvider({ children, onRecalculate }) {
  const plan = useFinancialPlan();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [ctx, dispatch] = useReducer(editSessionReducer, undefined, createInitialEditState);
  const [savePhase, setSavePhase] = useState(null);

  // Refs keep the latest values reachable inside the async pipeline without
  // recreating callbacks or reading stale closures.
  const planRef = useRef(plan);
  planRef.current = plan;
  const userRef = useRef(user);
  userRef.current = user;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;
  const ctxRef = useRef(ctx);
  ctxRef.current = ctx;

  const readCurrentValues = useCallback((session) => {
    const snapshot = buildPlanSnapshot(planRef.current);
    const draft = {};
    for (const fieldId of hostFieldIdsForSession(session)) {
      const field = getFieldById(fieldId);
      const path = resolveFieldStatePath(field, session.instanceId);
      draft[fieldId] = path ? readValueByPath(snapshot, path) : undefined;
    }
    return draft;
  }, []);

  const startEditSession = useCallback(
    (fieldId, options = {}) => {
      const capability =
        options.capability ??
        (planRef.current.workspaceCapability === 'full' ? 'full' : 'summary');
      let session;
      try {
        session = createEditSession(fieldId, { ...options, capability });
      } catch (err) {
        dispatch({ type: EDIT_EVENTS.START });
        dispatch({ type: EDIT_EVENTS.START_FAILED, error: err.message });
        return null;
      }
      dispatch({ type: EDIT_EVENTS.START, session });
      const draft = readCurrentValues(session);
      dispatch({ type: EDIT_EVENTS.RESOLVED, session, draft });
      return session;
    },
    [readCurrentValues],
  );

  const updateDraft = useCallback((fieldIdOrValue, maybeValue) => {
    const prev = ctxRef.current;
    const current = prev.draft ?? {};
    const onlyField = prev.session?.fieldId;
    let nextDraft;
    if (maybeValue !== undefined) {
      nextDraft = { ...current, [fieldIdOrValue]: maybeValue };
    } else if (typeof fieldIdOrValue === 'string' && getFieldById(fieldIdOrValue)) {
      // A bare known field id with no value clears that field.
      nextDraft = { ...current, [fieldIdOrValue]: undefined };
    } else {
      // Single-field convenience: updateDraft(value).
      nextDraft = { ...current, [onlyField]: fieldIdOrValue };
    }
    dispatch({ type: EDIT_EVENTS.CHANGE, draft: nextDraft });
  }, []);

  const applyValues = useCallback((values) => {
    const currentPlan = planRef.current;
    const session = ctxRef.current.session;
    const setters = buildRootSetters(currentPlan);
    let snapshot = buildPlanSnapshot(currentPlan);
    const touchedRoots = new Set();

    for (const [fieldId, value] of Object.entries(values ?? {})) {
      const field = getFieldById(fieldId);
      const path = resolveFieldStatePath(field, session?.instanceId);
      if (!path) continue;
      const { rootKey, rootValue } = computeRootUpdate(snapshot, path, value);
      snapshot = { ...snapshot, [rootKey]: rootValue };
      touchedRoots.add(rootKey);

      // Summary → detail write-back so prefer-detail reports pick up smart edits.
      const before = snapshot;
      snapshot = applySmartEditWriteBack(snapshot, fieldId, value);
      if (snapshot !== before) {
        Object.keys(setters).forEach((key) => {
          if (snapshot[key] !== before[key]) touchedRoots.add(key);
        });
      }
    }

    // Commit to context state. The existing debounced autosave effect performs
    // the durable write; reports re-derive reactively from the new state.
    for (const rootKey of touchedRoots) {
      const setter = setters[rootKey];
      if (setter) setter(snapshot[rootKey]);
    }
  }, []);

  const collectImpacts = useCallback((session) => {
    const impacts = new Set();
    for (const fieldId of hostFieldIdsForSession(session)) {
      const field = getFieldById(fieldId);
      (field?.impacts ?? []).forEach((impact) => impacts.add(impact));
    }
    return [...impacts];
  }, []);

  const returnToOrigin = useCallback(
    (session) => {
      const params = encodeReturnToOriginParams(session, searchParamsRef.current);
      navigate(`${FINANCIAL_WORKSPACE_PATH}?${params.toString()}`);
    },
    [navigate],
  );

  const save = useCallback(async () => {
    const session = ctxRef.current.session;
    if (!session) return { ok: false, phase: 'validate', errors: ['No active edit session'] };

    dispatch({ type: EDIT_EVENTS.REQUEST_SAVE });

    const draftMap = ctxRef.current.draft ?? {};
    const result = await runSavePipeline({
      validate: () => validateFieldValues(draftMap),
      persist: (values) => applyValues(values),
      recalculate: (impacts) => onRecalculate?.(impacts, session),
      close: () => {},
      returnToOrigin: () => returnToOrigin(session),
      getImpacts: () => collectImpacts(session),
      onPhase: setSavePhase,
    });

    if (result.ok) {
      trackAnalyticsEvent({
        eventName: AnalyticsEventName.SMART_EDIT_SAVE,
        eventCategory: 'ai',
        component: 'EditingProvider',
        feature: 'smart_edit',
        properties: {
          fieldId: session.target?.fieldId ?? session.fieldId ?? null,
          experienceId: session.experienceId ?? null,
        },
      });

      // Coach pushes after persist + recalculate for a meaningful edit.
      const wasMeaningful = Boolean(ctxRef.current.dirty) || (result.impacts?.length ?? 0) > 0;
      if (wasMeaningful) {
        const uid = userRef.current?.id;
        const pid = planRef.current?.planId;
        const opts = { userId: uid, planId: pid };
        void (async () => {
          await dispatchWealthMapUpdated(opts);
          // Protection → Surplus → Goals (rate limits / cooldowns applied per notification)
          await dispatchCoachNotificationsAfterRecalc(planRef.current, opts);
        })();
      }

      dispatch({ type: EDIT_EVENTS.SAVE_SUCCESS });
      dispatch({ type: EDIT_EVENTS.RETURN_DONE });
      setSavePhase(null);
    } else {
      dispatch({
        type: EDIT_EVENTS.SAVE_FAILED,
        phase: result.phase,
        error: result.errors?.join('; '),
      });
    }
    return result;
  }, [applyValues, collectImpacts, onRecalculate, returnToOrigin]);

  const cancel = useCallback(() => {
    const session = ctxRef.current.session;
    dispatch({ type: EDIT_EVENTS.CANCEL });
    if (session) returnToOrigin(session);
    dispatch({ type: EDIT_EVENTS.RETURN_DONE });
    setSavePhase(null);
  }, [returnToOrigin]);

  const retry = useCallback(() => {
    dispatch({ type: EDIT_EVENTS.RETRY });
  }, []);

  const value = useMemo(
    () => ({
      ...ctx,
      savePhase,
      field: ctx.session ? getFieldById(ctx.session.fieldId) : null,
      startEditSession,
      updateDraft,
      save,
      cancel,
      retry,
    }),
    [ctx, savePhase, startEditSession, updateDraft, save, cancel, retry],
  );

  return <EditingContext.Provider value={value}>{children}</EditingContext.Provider>;
}

export function useEditing() {
  const ctx = useContext(EditingContext);
  if (!ctx) {
    throw new Error('useEditing must be used within an EditingProvider');
  }
  return ctx;
}

/** Safe accessor that returns null outside a provider (for optional consumers). */
export function useOptionalEditing() {
  return useContext(EditingContext);
}
