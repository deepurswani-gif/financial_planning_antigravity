/**
 * Assemble coach-notification signals from live plan engines/adapters.
 * No finance recalculation beyond existing report builders.
 */

import { calculateProtectionData } from '../components/SummaryReport/SafetyNetLogic';
import { buildSafetyNetSignals } from '../recommendationRegistry/adapters/safetyNetAdapter';
import { buildYourMoneyFlowReport } from '../components/DetailedReport/moneyFlowLedgerLogic';
import { buildInvestSurplusReport } from '../components/DetailedReport/investSurplusLogic';
import { buildInvestSurplusSignals } from '../recommendationRegistry/adapters/investSurplusAdapter';
import { buildGoalFundingPlan } from '../components/DetailedReport/allocationEngine/goalFundingEngine';
import { calculateCashFlow } from '../components/CashFlowModule/CashFlowLogic';
import { resolveEmploymentType } from '../components/DetailedFlow/employmentTypeSync';

function formatAmountDisplay(value) {
  return Math.round(Number(value) || 0).toLocaleString('en-IN');
}

/**
 * @param {object} plan - FinancialPlanContext-like snapshot
 */
export function buildProtectionGapSignals(plan = {}) {
  const protectionData = calculateProtectionData(
    plan.expenseCategories,
    plan.summaryLifeCover,
    plan.familyMembers,
    plan.policies,
  );
  const base = buildSafetyNetSignals({ protectionData });
  const gap = Math.round(base.protectionGap || 0);
  const weakest = protectionData?.self?.isGap
    ? 'self'
    : protectionData?.spouse?.isGap
      ? 'spouse'
      : 'none';

  return {
    hasProtectionGap: Boolean(base.hasProtectionGap),
    protectionGapResolved: !base.hasProtectionGap,
    protectionGapFingerprint: `gap:${gap}:${weakest}`,
    protectionGap: gap,
    protectionGapDisplay: base.protectionGapDisplay,
  };
}

/**
 * @param {object} plan
 */
export function buildSurplusAvailableSignals(plan = {}) {
  const moneyFlowReport = buildYourMoneyFlowReport({
    currentYearLedger: plan.currentYearLedger,
    planStartMonth: plan.planStartMonth,
    familyMembers: plan.familyMembers,
    income: plan.income,
    expenseCategories: plan.expenseCategories,
    hasSpouseIncome: plan.hasSpouseIncome,
    resolveEmploymentType,
    journeyProjections: plan.journeyProjections,
  });

  const report = buildInvestSurplusReport({
    moneyFlowReport,
    familyMembers: plan.familyMembers,
    expenseCategories: plan.expenseCategories,
    assetCategories: plan.assetCategories,
    contingencyFund: plan.contingencyFund,
    summaryLifeCover: plan.summaryLifeCover,
    investmentAllocations: plan.investmentAllocations,
    policies: plan.policies,
  });

  const surplus = buildInvestSurplusSignals(report);
  // Prefer deployable (after committed SIPs); fall back to free cash.
  const investable = Math.max(
    0,
    Number(surplus.deployableMonthly ?? surplus.monthlyFreeCash ?? 0),
  );
  const display = formatAmountDisplay(investable);

  return {
    hasInvestableSurplus: investable > 0,
    monthlySurplusAmount: investable,
    monthlySurplusDisplay: display,
    amount: display,
  };
}

/**
 * @param {object} plan
 * @returns {{ hasGoalBehindSchedule: boolean, behindGoals: { goalId: string, label?: string }[] }}
 */
export function buildGoalBehindSignals(plan = {}) {
  const cashFlowResults = calculateCashFlow(
    plan.income,
    plan.expenseCategories,
    plan.familyMembers,
    plan.hasSpouseIncome,
  );

  const funding = buildGoalFundingPlan({
    goals: plan.goals,
    cashFlowResults,
    expenseCategories: plan.expenseCategories,
    inflationRates: plan.inflationRates,
    existingMonthly: {},
  });

  const behindGoals = (funding.fundedGoals || [])
    .filter((g) => {
      const deficit = Number(g.monthlyFundingDeficit) || 0;
      const notAchievable = g.readiness && g.readiness.isAchievable === false;
      return deficit > 0 || notAchievable;
    })
    .map((g) => ({
      goalId: String(g.goalId || g.id),
      label: g.label,
    }));

  return {
    hasGoalBehindSchedule: behindGoals.length > 0,
    behindGoalIds: behindGoals.map((g) => g.goalId),
    behindGoals,
    goalId: behindGoals[0]?.goalId ?? null,
  };
}

/**
 * @param {object} plan
 */
export function buildMonthlyWealthSummarySignals(plan = {}) {
  const moneyFlowReport = buildYourMoneyFlowReport({
    currentYearLedger: plan.currentYearLedger,
    planStartMonth: plan.planStartMonth,
    familyMembers: plan.familyMembers,
    income: plan.income,
    expenseCategories: plan.expenseCategories,
    hasSpouseIncome: plan.hasSpouseIncome,
    resolveEmploymentType,
    journeyProjections: plan.journeyProjections,
  });

  const hasMoneyFlow = moneyFlowReport?.meta?.hasData !== false
    && Array.isArray(moneyFlowReport?.ledger?.unallocatedSurplus);

  const summaryMarked = Boolean(plan.summaryReportGeneratedAt);

  return {
    monthlyWealthSummaryReady: summaryMarked || hasMoneyFlow,
    summaryReportGeneratedAt: plan.summaryReportGeneratedAt ?? null,
  };
}

/**
 * Full post-recalculation signal pack (protection / surplus / goals).
 * @param {object} plan
 */
export function buildPostRecalcCoachSignals(plan = {}) {
  return {
    protection: buildProtectionGapSignals(plan),
    surplus: buildSurplusAvailableSignals(plan),
    goals: buildGoalBehindSignals(plan),
  };
}
