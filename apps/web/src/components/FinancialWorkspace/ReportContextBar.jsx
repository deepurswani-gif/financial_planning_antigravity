import React from 'react';

const PLACEHOLDER_FIELDS = [
  { id: 'current_report', label: 'Current Report', value: '—' },
  { id: 'plan_start', label: 'Plan Start', value: '—' },
  { id: 'current_month', label: 'Current Month', value: '—' },
  { id: 'last_updated', label: 'Last Updated', value: '—' },
  { id: 'projection_year', label: 'Projection Year', value: '—' },
];

/**
 * Compact context toolbar owned by the workspace chrome.
 */
export default function ReportContextBar({ fields = PLACEHOLDER_FIELDS }) {
  return (
    <div className="fw-report-context-bar" role="region" aria-label="Report context">
      <div className="fw-report-context-bar-inner">
        {fields.map((field, index) => (
          <React.Fragment key={field.id}>
            {index > 0 && <span className="fw-context-sep" aria-hidden="true" />}
            <div className="fw-context-field">
              <span className="fw-context-label">{field.label}</span>
              <span className="fw-context-value">{field.value}</span>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
