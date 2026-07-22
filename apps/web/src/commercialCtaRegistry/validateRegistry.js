import { validateCta } from './schema';
import { DEFAULT_FALLBACK_CTA_ID } from './actionMap';

/**
 * Cross-entry CTA registry diagnostics.
 * Returns { ok, issues, errorCount, warningCount, activeCount, inactiveCount }.
 *
 * @param {import('./schema').CommercialCta[]} ctas
 */
export function validateRegistry(ctas) {
  const issues = [];
  const byId = new Map();

  for (const cta of ctas) {
    validateCta(cta).forEach((message) => {
      issues.push({ severity: 'error', code: 'schema', id: cta.id, message });
    });

    if (byId.has(cta.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_id',
        id: cta.id,
        message: `Duplicate CTA id "${cta.id}"`,
      });
    } else {
      byId.set(cta.id, cta);
    }
  }

  // fallbackCtaId must reference an existing, active CTA (fallbacks must work).
  for (const cta of ctas) {
    if (!cta.fallbackCtaId) continue;
    const fallback = byId.get(cta.fallbackCtaId);
    if (!fallback) {
      issues.push({
        severity: 'error',
        code: 'dangling_fallback',
        id: cta.id,
        message: `fallbackCtaId "${cta.fallbackCtaId}" does not exist`,
      });
    } else if (fallback.availability !== 'active') {
      issues.push({
        severity: 'warning',
        code: 'inactive_fallback',
        id: cta.id,
        message: `fallbackCtaId "${cta.fallbackCtaId}" is not active`,
      });
    }
  }

  // The universal fallback must exist and be active.
  const universal = byId.get(DEFAULT_FALLBACK_CTA_ID);
  if (!universal) {
    issues.push({
      severity: 'error',
      code: 'missing_universal_fallback',
      id: DEFAULT_FALLBACK_CTA_ID,
      message: `Universal fallback CTA "${DEFAULT_FALLBACK_CTA_ID}" is missing`,
    });
  } else if (universal.availability !== 'active') {
    issues.push({
      severity: 'error',
      code: 'universal_fallback_inactive',
      id: DEFAULT_FALLBACK_CTA_ID,
      message: `Universal fallback CTA "${DEFAULT_FALLBACK_CTA_ID}" must be active`,
    });
  }

  // Commercial CTAs must not be active while regulatory approval is pending.
  for (const cta of ctas) {
    if (cta.commercial && cta.availability === 'active' && cta.regulatoryStatus === 'pending') {
      issues.push({
        severity: 'error',
        code: 'active_pending_commercial',
        id: cta.id,
        message: `Commercial CTA "${cta.id}" is active but regulatoryStatus is pending`,
      });
    }
  }

  const activeCount = ctas.filter((c) => c.availability === 'active').length;

  return {
    ok: !issues.some((i) => i.severity === 'error'),
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
    activeCount,
    inactiveCount: ctas.length - activeCount,
  };
}
