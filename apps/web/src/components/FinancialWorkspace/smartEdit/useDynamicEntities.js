import { useMemo } from 'react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import { resolveEntities } from './dynamicEntities';

/**
 * Live editable entities derived from the current Financial Plan.
 *
 * Rebuilds only when a relevant plan slice changes (not on every keystroke),
 * so searching hundreds of entities stays instantaneous. The resolver itself is
 * pure + stateless; this hook is just the memoized binding to plan state.
 *
 * @returns {import('./dynamicEntities').DynamicEntity[]}
 */
export function useDynamicEntities() {
  const {
    policies,
    expenseCategories,
    assetCategories,
    liabilityCategories,
    goals,
    familyMembers,
  } = useFinancialPlan();

  return useMemo(
    () =>
      resolveEntities({
        policies,
        expenseCategories,
        assetCategories,
        liabilityCategories,
        goals,
        familyMembers,
      }),
    [policies, expenseCategories, assetCategories, liabilityCategories, goals, familyMembers],
  );
}
