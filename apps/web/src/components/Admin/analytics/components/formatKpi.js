export function formatKpiValue(value, format, { unavailable } = {}) {
  if (unavailable || value === null || value === undefined) return '—';
  if (typeof value === 'number' && Number.isNaN(value)) return '—';

  switch (format) {
    case 'percent':
      return `${Number(value).toLocaleString(undefined, { maximumFractionDigits: 1 })}%`;
    case 'currency':
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(Number(value) || 0);
    case 'number':
      return Number(value).toLocaleString('en-IN', { maximumFractionDigits: 1 });
    default:
      return String(value);
  }
}
