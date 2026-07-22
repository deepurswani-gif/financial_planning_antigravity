import { validateRecommendation } from './schema';
import { getFieldById } from '../questionRegistry';
import { extractTokens } from './templating';

/**
 * Cross-entry registry diagnostics for tests and tooling.
 * Returns { ok, issues, errorCount, warningCount }.
 *
 * @param {import('./schema').Recommendation[]} recommendations
 */
export function validateRegistry(recommendations) {
  const issues = [];
  const byId = new Map();

  for (const rec of recommendations) {
    validateRecommendation(rec).forEach((message) => {
      issues.push({ severity: 'error', code: 'schema', id: rec.id, message });
    });

    if (byId.has(rec.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_id',
        id: rec.id,
        message: `Duplicate recommendation id "${rec.id}"`,
      });
    } else {
      byId.set(rec.id, rec);
    }

    // relatedFields must reference real canonical question-registry fields.
    for (const fieldId of rec.relatedFields ?? []) {
      if (!getFieldById(fieldId)) {
        issues.push({
          severity: 'error',
          code: 'dangling_field',
          id: rec.id,
          message: `relatedFields references unknown question-registry field "${fieldId}"`,
        });
      }
    }

    // High-severity recommendations should explain themselves.
    if ((rec.severity === 'critical' || rec.severity === 'high') && !rec.businessMeaning) {
      issues.push({
        severity: 'warning',
        code: 'missing_business_meaning',
        id: rec.id,
        message: `High-severity recommendation "${rec.id}" is missing businessMeaning`,
      });
    }

    // Every template token should be declared as a supporting metric so the
    // report receives the raw value alongside the interpolated string.
    const declared = new Set(rec.supportingMetrics ?? []);
    const templateTokens = new Set([
      ...extractTokens(rec.summary),
      ...extractTokens(rec.description),
    ]);
    for (const token of templateTokens) {
      if (!declared.has(token)) {
        issues.push({
          severity: 'warning',
          code: 'undeclared_token',
          id: rec.id,
          message: `Template token "{${token}}" is not listed in supportingMetrics`,
        });
      }
    }
  }

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
  };
}
