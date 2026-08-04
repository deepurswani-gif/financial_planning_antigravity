/**
 * Export helpers — CSV, Excel-compatible spreadsheet, and print PDF.
 * No extra dependencies; Excel opens CSV/TSV and SpreadsheetML HTML.
 */

function escapeCsv(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;
  return str;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function rowsToCsv(columns, rows) {
  const header = columns.map((c) => escapeCsv(c.label || c.key)).join(',');
  const lines = rows.map((row) =>
    columns.map((c) => escapeCsv(row[c.key])).join(','),
  );
  return [header, ...lines].join('\n');
}

export function exportCsv(filename, columns, rows) {
  const csv = `\uFEFF${rowsToCsv(columns, rows)}`;
  downloadBlob(filename.endsWith('.csv') ? filename : `${filename}.csv`, new Blob([csv], { type: 'text/csv;charset=utf-8' }));
}

/** Excel-friendly workbook via HTML table (opens in Excel). */
export function exportExcel(filename, columns, rows, sheetName = 'Analytics') {
  const header = columns.map((c) => `<th>${escapeHtml(c.label || c.key)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join('')}</tr>`,
    )
    .join('');
  const html = `
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
<head><meta charset="utf-8" />
<!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet>
<x:Name>${escapeHtml(sheetName)}</x:Name>
<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions>
</x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body><table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`;
  const name = filename.endsWith('.xls') ? filename : `${filename}.xls`;
  downloadBlob(name, new Blob([html], { type: 'application/vnd.ms-excel' }));
}

export function exportPdf(title, columns, rows) {
  const header = columns.map((c) => `<th>${escapeHtml(c.label || c.key)}</th>`).join('');
  const body = rows
    .map(
      (row) =>
        `<tr>${columns.map((c) => `<td>${escapeHtml(row[c.key])}</td>`).join('')}</tr>`,
    )
    .join('');
  const win = window.open('', '_blank', 'noopener,noreferrer,width=1024,height=768');
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Segoe UI, sans-serif; padding: 24px; color: #111; }
      h1 { font-size: 18px; margin: 0 0 8px; }
      p { color: #666; font-size: 12px; margin: 0 0 16px; }
      table { width: 100%; border-collapse: collapse; font-size: 11px; }
      th, td { border: 1px solid #ddd; padding: 6px 8px; text-align: left; }
      th { background: #f3f4f6; }
      @media print { button { display: none; } }
    </style></head><body>
    <button onclick="window.print()">Print / Save PDF</button>
    <h1>${escapeHtml(title)}</h1>
    <p>Generated ${new Date().toLocaleString()}</p>
    <table><thead><tr>${header}</tr></thead><tbody>${body || '<tr><td colspan="99">No rows</td></tr>'}</tbody></table>
    </body></html>`);
  win.document.close();
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export const DRILLDOWN_COLUMNS = [
  { key: 'user_full_name', label: 'Name' },
  { key: 'user_email', label: 'Email' },
  { key: 'advisor_name', label: 'Advisor' },
  { key: 'wealthmap_status', label: 'WealthMap' },
  { key: 'funnel_step', label: 'Funnel Step' },
  { key: 'wellness_score', label: 'Wellness' },
  { key: 'net_worth', label: 'Net Worth' },
  { key: 'sip_monthly', label: 'SIP' },
  { key: 'monthly_surplus', label: 'Surplus' },
  { key: 'protection_gap', label: 'Protection Gap' },
  { key: 'health_insurance_gap', label: 'Health Gap' },
  { key: 'goal_count', label: 'Goals' },
  { key: 'subscription_active', label: 'Subscribed' },
];
