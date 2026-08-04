import { validateNotification } from './schema';
import { extractTokens } from './templating';
import { NOTIFICATION_TRIGGER_EVALUATORS } from './triggerEvaluators';

/**
 * @param {import('./schema').NotificationDefinition[]} notifications
 */
export function validateRegistry(notifications) {
  const issues = [];
  const byId = new Map();

  for (const n of notifications) {
    validateNotification(n).forEach((message) => {
      issues.push({ severity: 'error', code: 'schema', id: n.id, message });
    });

    if (byId.has(n.id)) {
      issues.push({
        severity: 'error',
        code: 'duplicate_id',
        id: n.id,
        message: `Duplicate notification id "${n.id}"`,
      });
    } else {
      byId.set(n.id, n);
    }

    if (!NOTIFICATION_TRIGGER_EVALUATORS[n.event]) {
      issues.push({
        severity: 'error',
        code: 'missing_evaluator',
        id: n.id,
        message: `No trigger evaluator for event "${n.event}"`,
      });
    }

    // Warn if templates reference undeclared placeholders
    const used = new Set(
      [
        ...extractTokens(n.title),
        ...extractTokens(n.body),
        ...n.variants.flatMap((v) => [...extractTokens(v.title), ...extractTokens(v.body)]),
      ],
    );
    for (const token of used) {
      if (!(n.placeholders ?? []).includes(token)) {
        issues.push({
          severity: 'warning',
          code: 'undeclared_placeholder',
          id: n.id,
          message: `Template uses "{{${token}}}" but placeholders[] does not declare it`,
        });
      }
    }
  }

  const errorCount = issues.filter((i) => i.severity === 'error').length;
  const warningCount = issues.filter((i) => i.severity === 'warning').length;
  return {
    ok: errorCount === 0,
    issues,
    errorCount,
    warningCount,
  };
}
