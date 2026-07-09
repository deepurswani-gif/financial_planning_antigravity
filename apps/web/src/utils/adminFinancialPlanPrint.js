import { calculateCashFlow, formatCurrency } from '../components/CashFlowModule/CashFlowLogic.js';
import { calculateNetWorth } from '../components/AssetModule/AssetLogic.js';

function escapeHtml(s) {
  if (s == null || s === '') return '—';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function humanizeKey(key) {
  return String(key)
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function renderTable(headers, rows) {
  const head = `<tr>${headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr>`;
  const body = rows
    .map((cells) => `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`)
    .join('');
  return `<table><thead>${head}</thead><tbody>${body}</tbody></table>`;
}

function simpleKeyValueTable(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) {
    return '<p class="muted">—</p>';
  }
  const rows = Object.entries(obj)
    .filter(([, v]) => v != null && v !== '')
    .map(
      ([k, v]) =>
        `<tr><td>${escapeHtml(humanizeKey(k))}</td><td>${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : String(v))}</td></tr>`,
    )
    .join('');
  return rows ? `<table class="kv"><tbody>${rows}</tbody></table>` : '<p class="muted">—</p>';
}

function genericArrayTable(rows, preferredKeys) {
  if (!Array.isArray(rows) || rows.length === 0) return '<p class="muted">None.</p>';
  const keys =
    preferredKeys && preferredKeys.length
      ? preferredKeys
      : [...new Set(rows.flatMap((r) => (r && typeof r === 'object' ? Object.keys(r) : [])))];
  if (keys.length === 0) return '<p class="muted">None.</p>';
  const headers = keys.map(humanizeKey);
  const body = rows.map((obj) =>
    keys.map((k) => {
      const v = obj?.[k];
      if (v == null) return '—';
      if (typeof v === 'object') return escapeHtml(JSON.stringify(v));
      return escapeHtml(String(v));
    }),
  );
  return renderTable(headers, body);
}

function incomeRowsFlat(income) {
  const inc = income || {};
  const pairs = [
    ['Self (salary)', inc.self],
    ['Self bonus', inc.selfBonus],
    ['Self passive', inc.selfPassive],
    ['Self other', inc.selfOther],
    ['Spouse', inc.spouse],
    ['Spouse bonus', inc.spouseBonus],
    ['Spouse passive', inc.spousePassive],
    ['Spouse other', inc.spouseOther],
    ['Family (legacy)', inc.family],
    ['Bonus (legacy)', inc.bonus],
    ['Passive (legacy)', inc.passive],
    ['Other (legacy)', inc.other],
  ];
  return pairs
    .filter(([, v]) => parseFloat(v) > 0)
    .map(([label, v]) => [label, formatCurrency(parseFloat(v) || 0)]);
}

function goalsTable(goals) {
  if (!Array.isArray(goals) || goals.length === 0) {
    return '<p class="muted">No goals entered.</p>';
  }
  const headers = ['Goal', 'Years', 'Present value', 'Future value', 'Inflation %'];
  const rows = goals.map((g) => [
    escapeHtml(g.name || g.placeholder || 'Goal'),
    escapeHtml(g.yearsToGoal ?? '—'),
    formatCurrency(parseFloat(g.presentValue) || 0),
    formatCurrency(parseFloat(g.futureValue) || 0),
    escapeHtml(g.inflationRate ?? '—'),
  ]);
  return renderTable(headers, rows);
}

function policiesTable(policies) {
  if (!Array.isArray(policies) || policies.length === 0) {
    return '<p class="muted">No policies entered.</p>';
  }
  const headers = ['Insured', 'Company / plan', 'Sum assured', 'Premium', 'Frequency', 'Policy term', 'Payment term'];
  const rows = policies.map((p) => [
    escapeHtml(p.insuredName || p.name || '—'),
    escapeHtml([p.company, p.planName].filter(Boolean).join(' — ') || '—'),
    formatCurrency(parseFloat(p.sumAssured) || 0),
    formatCurrency(parseFloat(p.premium) || 0),
    escapeHtml(p.frequency || '—'),
    escapeHtml(p.policyTerm ?? '—'),
    escapeHtml(p.paymentTerm ?? '—'),
  ]);
  return renderTable(headers, rows);
}

function allocationsTable(allocations) {
  if (!Array.isArray(allocations) || allocations.length === 0) {
    return '<p class="muted">None.</p>';
  }
  const headers = ['Type', 'Amount', 'Insured / goal', 'Note'];
  const rows = allocations.map((a) => [
    escapeHtml(a.type || '—'),
    formatCurrency(parseFloat(a.amount) || 0),
    escapeHtml(a.insuredMember || a.goalName || a.goalId || '—'),
    escapeHtml(a.note || '—'),
  ]);
  return renderTable(headers, rows);
}

function buildDocument(plan, clientMeta) {
  const income = plan.income || {};
  const expenseCategories = plan.expense_categories || {};
  const family = Array.isArray(plan.family_members) ? plan.family_members : [];
  const cash = calculateCashFlow(income, expenseCategories, family);
  const nw = calculateNetWorth(plan.asset_categories || {}, plan.liability_categories || {});

  const clientName = clientMeta?.full_name || plan.family_members?.[0]?.name || 'Client';
  const clientEmail = clientMeta?.email || '—';
  const generated = new Date().toLocaleString('en-IN', {
    dateStyle: 'long',
    timeStyle: 'short',
  });

  const familyHeaders = ['Name', 'Relation', 'DOB', 'Occupation', 'Retirement age', 'Mobile'];
  const familyRows = family.map((m) => [
    escapeHtml(m.name),
    escapeHtml(m.relation),
    escapeHtml(m.dob),
    escapeHtml(m.occupation),
    escapeHtml(m.retirementAge ?? '—'),
    escapeHtml(m.mobile ?? '—'),
  ]);

  const incRows = incomeRowsFlat(income).map(([a, b]) => [escapeHtml(a), escapeHtml(b)]);
  const expenseLines = (cash.expenseBreakdown || [])
    .filter((e) => e.value > 0)
    .map((e) => [
      escapeHtml(e.category || ''),
      escapeHtml(e.name || ''),
      formatCurrency(e.value),
    ]);

  const assetBreakRows = (nw.assetBreakdown || []).map((a) => [
    escapeHtml(a.category || ''),
    escapeHtml(a.name || ''),
    formatCurrency(a.value),
  ]);

  const inflation = plan.inflation_rates || {};

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(plan.plan_name || 'Financial Plan')} — Report</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; font-size: 11pt; color: #111; line-height: 1.45; margin: 24px; max-width: 900px; }
    h1 { font-size: 20pt; margin: 0 0 8px 0; }
    .subtitle { color: #555; font-size: 10pt; margin-bottom: 24px; }
    h2 { font-size: 13pt; margin: 20px 0 10px 0; padding-bottom: 6px; border-bottom: 2px solid #222; page-break-after: avoid; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0 16px 0; font-size: 10pt; }
    th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #f0f0f0; font-weight: 600; }
    .kv td.sub { width: 36%; color: #444; }
    .muted { color: #666; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 10px; margin: 12px 0; }
    .pill { border: 1px solid #ddd; border-radius: 8px; padding: 10px; background: #fafafa; }
    .pill strong { display: block; font-size: 9pt; color: #555; margin-bottom: 4px; }
    @media print {
      body { margin: 12mm; }
      h2 { page-break-after: avoid; }
      table { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Finbrella — Client financial report</h1>
  <p class="subtitle">
    <strong>Plan:</strong> ${escapeHtml(plan.plan_name || 'Untitled')} &nbsp;|&nbsp;
    <strong>Client:</strong> ${escapeHtml(clientName)} &nbsp;|&nbsp;
    <strong>Email:</strong> ${escapeHtml(clientEmail)}<br />
    Plan ID: ${escapeHtml(plan.id)} · User ID: ${escapeHtml(plan.user_id)} · Module progress: Step ${escapeHtml(plan.current_step ?? 1)} / 12<br />
    Created: ${escapeHtml(plan.created_at ? new Date(plan.created_at).toLocaleString('en-IN') : '—')} ·
    Updated: ${escapeHtml(plan.updated_at ? new Date(plan.updated_at).toLocaleString('en-IN') : '—')}<br />
    <span class="muted">Generated (admin export): ${escapeHtml(generated)}</span>
  </p>

  <div class="summary-grid">
    <div class="pill"><strong>Monthly income (total)</strong>${escapeHtml(formatCurrency(cash.totalIncome))}</div>
    <div class="pill"><strong>Monthly expenses (excl. savings)</strong>${escapeHtml(formatCurrency(cash.totalExpenses))}</div>
    <div class="pill"><strong>Monthly surplus</strong>${escapeHtml(formatCurrency(cash.surplus))}</div>
    <div class="pill"><strong>Net worth</strong>${escapeHtml(formatCurrency(nw.netWorth))}</div>
    <div class="pill"><strong>Total assets</strong>${escapeHtml(formatCurrency(nw.totalAssets))}</div>
    <div class="pill"><strong>Total liabilities</strong>${escapeHtml(formatCurrency(nw.totalLiabilities))}</div>
    <div class="pill"><strong>Contingency fund</strong>${escapeHtml(formatCurrency(parseFloat(plan.contingency_fund) || 0))}</div>
  </div>

  <h2>Family profile</h2>
  ${family.length ? renderTable(familyHeaders, familyRows) : '<p class="muted">No family members listed.</p>'}

  <h2>Income (monthly amounts)</h2>
  ${incRows.length ? renderTable(['Source', 'Amount'], incRows) : '<p class="muted">No income figures entered.</p>'}

  <h2>Expense breakdown (monthly)</h2>
  ${expenseLines.length ? renderTable(['Category', 'Item', 'Amount'], expenseLines) : '<p class="muted">No expense lines with amounts.</p>'}

  <h2>Assets & liabilities (summary)</h2>
  <p><strong>Net worth:</strong> ${escapeHtml(formatCurrency(nw.netWorth))}</p>
  ${assetBreakRows.length ? renderTable(['Group', 'Line item', 'Amount'], assetBreakRows) : '<p class="muted">No asset line items with values.</p>'}

  <h2>Goals</h2>
  ${goalsTable(plan.goals)}

  <h2>Insurance policies</h2>
  ${policiesTable(plan.policies)}

  <h2>Inflation assumptions</h2>
  ${simpleKeyValueTable(inflation)}

  <h2>Proposed allocations</h2>
  ${allocationsTable(plan.investment_allocations)}

  <h2>Loan proposals</h2>
  ${genericArrayTable(plan.loan_proposals || [])}

  <p class="muted" style="margin-top: 2rem;">End of report. Use your browser Print dialog → Save as PDF.</p>
</body>
</html>`;
}

/**
 * Opens a print-ready HTML document for an admin-exportable client report (readable tables, not raw JSON).
 * Same workflow as Overview "Export PDF": browser print → Save as PDF.
 */
export function openAdminFinancialPlanPrint(plan, clientMeta = null) {
  if (!plan || !plan.id) {
    window.alert('No plan data to export.');
    return;
  }
  let html;
  try {
    html = buildDocument(plan, clientMeta);
  } catch (err) {
    console.error('adminFinancialPlanPrint:', err);
    window.alert('Could not build this report from the saved plan. Try View Client Data to inspect raw fields.');
    return;
  }
  const w = window.open('', '_blank');
  if (!w) {
    window.alert('Please allow pop-ups for this site to download the PDF.');
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
  const triggerPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      /* ignore */
    }
  };
  if (w.document.readyState === 'complete') {
    setTimeout(triggerPrint, 200);
  } else {
    w.onload = () => setTimeout(triggerPrint, 200);
  }
}
