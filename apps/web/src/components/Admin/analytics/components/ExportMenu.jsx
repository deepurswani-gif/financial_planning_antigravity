import { Download, FileSpreadsheet, FileText } from 'lucide-react';
import { DRILLDOWN_COLUMNS, exportCsv, exportExcel, exportPdf } from '../services/analyticsExport';

export default function ExportMenu({ title, columns = DRILLDOWN_COLUMNS, rows = [] }) {
  const safeRows = rows || [];
  return (
    <div className="ba-export">
      <button
        type="button"
        className="ba-secondary-btn"
        onClick={() => exportCsv(`${slug(title)}.csv`, columns, safeRows)}
      >
        <Download size={14} /> CSV
      </button>
      <button
        type="button"
        className="ba-secondary-btn"
        onClick={() => exportExcel(`${slug(title)}.xls`, columns, safeRows, title)}
      >
        <FileSpreadsheet size={14} /> Excel
      </button>
      <button
        type="button"
        className="ba-secondary-btn"
        onClick={() => exportPdf(title, columns, safeRows)}
      >
        <FileText size={14} /> PDF
      </button>
    </div>
  );
}

function slug(value) {
  return String(value || 'analytics')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}
