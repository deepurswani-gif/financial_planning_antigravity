import { useMemo } from 'react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { getHouseholdBreakdownTotal, sumConfiguredEmis } from '../DetailedFlow/expenseDetailSync';
import { getMemberDetailMonthlyTotal } from '../DetailedFlow/incomeDetailSync';
import { getInsuranceMonthlyTotal } from '../DetailedFlow/insuranceDetailSync';
import { guessEmploymentTypeFromSummaryOccupation } from '../DetailedFlow/employmentTypeSync';
import { sumConfiguredSavings } from '../DetailedFlow/savingsDetailSync';
import { hasWealthDetailEntered, hasLiabilityDetailEntered } from '../DetailedFlow/wealthDetailSync';

export function useProfileCompletion() {
  const {
    income,
    expenseCategories,
    assetCategories,
    liabilityCategories,
    familyMembers,
    policies,
  } = useFinancialPlan();

  return useMemo(() => {
    const selfMember = (familyMembers || []).find(m => m.relation === 'Self') || {};
    const selfType = selfMember.employmentType || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation) || 'Private Sector';
    const isIncomeCompleted = getMemberDetailMonthlyTotal(income?.selfDetail || {}, selfType) > 0;
    
    const isExpensesCompleted = getHouseholdBreakdownTotal(expenseCategories, familyMembers) > 0;
    const isSavingsCompleted = sumConfiguredSavings(expenseCategories?.savings || {}) > 0;
    const isDebtCompleted = sumConfiguredEmis(expenseCategories?.emi || {}) > 0;
    const isInsuranceCompleted = getInsuranceMonthlyTotal(expenseCategories?.insurance || {}) > 0;

    const isFamilyCompleted = (familyMembers || []).some(m => m.dob || (m.name && m.name.trim() !== '') || m.employmentType);
    const isAssetsCompleted = hasWealthDetailEntered(assetCategories);
    const isLiabilitiesCompleted = hasLiabilityDetailEntered(liabilityCategories);
    
    // Vault completion: At least one policy uploaded
    const isVaultCompleted = (policies || []).length > 0;

    const sections = [
      isIncomeCompleted,
      isExpensesCompleted,
      isSavingsCompleted,
      isDebtCompleted,
      isInsuranceCompleted,
      isFamilyCompleted,
      isAssetsCompleted,
      isLiabilitiesCompleted,
      isVaultCompleted
    ];

    const incompleteCount = sections.filter(c => !c).length;

    return {
      incompleteCount,
      isComplete: incompleteCount === 0,
      isIncomeCompleted,
      isExpensesCompleted,
      isSavingsCompleted,
      isDebtCompleted,
      isInsuranceCompleted,
      isFamilyCompleted,
      isAssetsCompleted,
      isLiabilitiesCompleted,
      isVaultCompleted
    };
  }, [income, expenseCategories, assetCategories, liabilityCategories, familyMembers, policies]);
}
