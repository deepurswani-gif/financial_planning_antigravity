/**
 * Severity → presentation tokens only. No business logic.
 */

export const SEVERITY_STYLES = Object.freeze({
  critical: Object.freeze({
    id: 'critical',
    label: 'Critical',
    accent: '#DC2626',
    className: 'rec-severity-critical',
  }),
  high: Object.freeze({
    id: 'high',
    label: 'High',
    accent: '#EA580C',
    className: 'rec-severity-high',
  }),
  medium: Object.freeze({
    id: 'medium',
    label: 'Medium',
    accent: '#00A9F2',
    className: 'rec-severity-medium',
  }),
  low: Object.freeze({
    id: 'low',
    label: 'Low',
    accent: '#64748B',
    className: 'rec-severity-low',
  }),
  informational: Object.freeze({
    id: 'informational',
    label: 'Info',
    accent: '#94A3B8',
    className: 'rec-severity-informational',
  }),
});

export function severityStyle(severity) {
  return SEVERITY_STYLES[severity] ?? SEVERITY_STYLES.medium;
}
