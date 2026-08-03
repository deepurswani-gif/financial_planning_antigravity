/**
 * Calendar-year subscription pricing and validity helpers.
 *
 * Intro: ₹399 covers the calendar year through 31 Dec 2026.
 * From 2027 onward the list price applies (placeholder until set).
 */

export const INTRO_PLAN_INR = 399;
export const STANDARD_PLAN_INR = 2000;
export const INTRO_THROUGH_YEAR = 2026;

/** End of the calendar year that a purchase unlocks (YYYY-MM-DD). */
export function getSubscriptionValidUntilDate(fromDate = new Date()) {
  const year = fromDate.getFullYear();
  return `${year}-12-31`;
}

/** Amount charged for unlocking the current calendar year. */
export function getAnnualPlanPriceInr(fromDate = new Date()) {
  return fromDate.getFullYear() <= INTRO_THROUGH_YEAR ? INTRO_PLAN_INR : STANDARD_PLAN_INR;
}

export function isIntroPricing(fromDate = new Date()) {
  return fromDate.getFullYear() <= INTRO_THROUGH_YEAR;
}

export function getPlanYearLabel(fromDate = new Date()) {
  return String(fromDate.getFullYear());
}

/**
 * Whether the profile currently has paid/coupon access to detailed planning.
 * Admins and agents always pass. Active with null valid_until is grandfathered
 * (treated as valid) so older rows keep working until re-activated.
 */
export function isSubscriptionCurrentlyValid({
  subscription_active,
  subscription_valid_until,
  role,
  now = new Date(),
} = {}) {
  if (role === 'admin' || role === 'agent') return true;
  if (subscription_active !== true) return false;
  if (!subscription_valid_until) return true;

  const until = new Date(`${subscription_valid_until}T23:59:59`);
  if (Number.isNaN(until.getTime())) return false;
  return until >= now;
}
