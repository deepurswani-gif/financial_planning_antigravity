/**
 * Resolve a recommendation intent into an Experience Registry id.
 *
 * Used only by the Financial Workspace launchRecommendationAction API.
 * Recommendation Presentation components never import this module — they only
 * express the intent "update the information behind this recommendation".
 *
 * Preferred experience overrides ensure launches land on the correct editor
 * (Life Insurance, Health Insurance, Goals picker, SIP, Loans) without
 * chevron browsing — without modifying the Experience Registry.
 */

import { getRecommendationById } from '../../recommendationRegistry';
import { EXPERIENCE_REGISTRY, getExperienceById } from '../../experienceRegistry';

/**
 * Explicit recommendation → experience mapping for validated Smart Edit launches.
 * Takes precedence over relatedFields lookup.
 */
export const PREFERRED_EXPERIENCE_BY_RECOMMENDATION = Object.freeze({
  'protection.lifeGap': 'protection.lifeInsurance',
  'protection.investSurplusGap': 'protection.lifeInsurance',
  'protection.closeCoverageGaps': 'protection.lifeInsurance',
  'protection.healthAbsent': 'protection.healthInsurance',
  'protection.healthPartial': 'protection.healthInsurance',
  'goals.increaseFundingPace': 'goals.collection',
  'goals.fundingGap': 'goals.collection',
  'retirement.shortfall': 'savings.sip',
  'investments.readyToDeploy': 'savings.sip',
  'investments.yearEndSurplus': 'savings.sip',
  'investments.existingAllocations': 'savings.sip',
  'investments.noAllocations': 'savings.sip',
  'investments.retirementHorizon': 'savings.sip',
  'investments.wealthSip': 'savings.sip',
  'investments.increaseSips': 'savings.sip',
  'cashflow.highEmiBurden': 'debt.loans',
  'cashflow.improveSurplus': 'income.salary',
  'cashflow.noFreeCash': 'income.salary',
  'behaviour.completeMoneyFlow': 'income.salary',
  'tax.planningOpportunity': 'income.salary',
  'wealth.assetDiversification': 'assets.fixedDeposits',
});

/**
 * When relatedFields would resolve to a read-only / wrong experience, prefer these.
 * Example: debt.emi.monthlyTotal → explain.totalEmi (readonly) — use debt.loans instead.
 */
export const PREFERRED_EXPERIENCE_BY_FIELD = Object.freeze({
  'protection.life.totalCover': 'protection.lifeInsurance',
  'protection.life.policies': 'protection.lifeInsurance',
  'protection.health.totalCover': 'protection.healthInsurance',
  'goals.items': 'goals.collection',
  'savings.sip': 'savings.sip',
  'debt.emi.monthlyTotal': 'debt.loans',
  'debt.emi.loans': 'debt.loans',
  'income.self.monthlyTakeHome': 'income.salary',
  'expenses.household.monthlyTotal': 'expenses.household',
  'liabilities.loans.home': 'liabilities.homeLoan',
});

const experienceByFieldCache = new Map();

function findExperienceIdForField(fieldId) {
  if (!fieldId) return null;
  if (PREFERRED_EXPERIENCE_BY_FIELD[fieldId]) {
    const preferred = PREFERRED_EXPERIENCE_BY_FIELD[fieldId];
    if (getExperienceById(preferred)) return preferred;
  }
  if (experienceByFieldCache.has(fieldId)) return experienceByFieldCache.get(fieldId);
  let match = null;
  for (const experience of EXPERIENCE_REGISTRY) {
    if ((experience.registryTargets ?? []).includes(fieldId)) {
      // Prefer curated, non-readonly experiences.
      if (experience.launchStrategy === 'readonly_explanation') continue;
      if (!experience.derived) {
        match = experience.id;
        break;
      }
      if (!match) match = experience.id;
    }
  }
  experienceByFieldCache.set(fieldId, match);
  return match;
}

/**
 * @param {{ recommendationId?: string, id?: string }} recommendation
 * @returns {string|null} experienceId
 */
export function resolveExperienceIdForRecommendation(recommendation) {
  const recommendationId = recommendation?.recommendationId ?? recommendation?.id;
  if (!recommendationId) return null;

  const preferred = PREFERRED_EXPERIENCE_BY_RECOMMENDATION[recommendationId];
  if (preferred && getExperienceById(preferred)) return preferred;

  const definition = getRecommendationById(recommendationId);
  for (const fieldId of definition?.relatedFields ?? []) {
    const experienceId = findExperienceIdForField(fieldId);
    if (experienceId) return experienceId;
  }
  return null;
}
