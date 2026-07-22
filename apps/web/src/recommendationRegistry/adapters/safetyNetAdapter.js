/**
 * Safety Net adapter.
 *
 * Maps existing SafetyNetLogic engine outputs (calculateProtectionData,
 * calculateContingencyData, calculateHealthInsuranceData) into a normalized
 * `signals` snapshot for the Recommendation Resolver. It does NOT recalculate
 * anything — it only reads engine keys and pre-formats display strings using
 * the same formatter the report already used (formatCompactSN), so migrated
 * copy stays byte-for-byte identical.
 */

import { formatCompactSN } from '../../components/SummaryReport/SafetyNetLogic';

export function buildSafetyNetSignals({
  protectionData = {},
  contingencyData = {},
  healthData = {},
} = {}) {
  const protectionGap = protectionData.protectionGap ?? 0;
  const healthGap = healthData.healthGap ?? 0;
  const healthMin = healthData.minimumRequired ?? 0;
  const emergencyGap = contingencyData.gap ?? 0;

  return {
    // Protection
    hasProtectionGap: Boolean(protectionData.hasGap),
    protectionGap,
    protectionGapDisplay: formatCompactSN(protectionGap),

    // Health
    hasHealthGap: Boolean(healthData.hasGap),
    healthStatus: healthData.status ?? null,
    healthCoverageHave: healthData.coverageHave ?? 0,
    healthGap,
    healthGapDisplay: formatCompactSN(healthGap),
    healthMin,
    healthMinDisplay: formatCompactSN(healthMin),
    healthCoverRequired: healthMin,

    // Emergency
    emergencyGap,
    emergencyGapDisplay: formatCompactSN(emergencyGap),
    emergencyMonthsCovered: Math.round((contingencyData.monthsCoveredByFund ?? 0) * 10) / 10,
    emergencyIdealMonths: contingencyData.contingencyPeriod ?? 6,
  };
}
