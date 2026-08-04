/**
 * Global + hyper filter definitions (Phase 1 + future fields).
 */

export const FILTER_FIELD_TYPES = {
  DATE: 'date',
  SELECT: 'select',
  NUMBER: 'number',
  RANGE: 'range',
};

export const PHASE1_FILTERS = [
  {
    id: 'dateRange',
    label: 'Date Range',
    type: FILTER_FIELD_TYPES.DATE,
    keys: ['dateFrom', 'dateTo'],
  },
  {
    id: 'advisorId',
    label: 'Advisor',
    type: FILTER_FIELD_TYPES.SELECT,
    optionKey: 'advisors',
  },
  {
    id: 'userActivity',
    label: 'User Activity',
    type: FILTER_FIELD_TYPES.SELECT,
    options: [
      { value: '', label: 'All' },
      { value: 'active_7d', label: 'Active (7 days)' },
      { value: 'active_30d', label: 'Active (30 days)' },
      { value: 'inactive_30d', label: 'Inactive (30+ days)' },
      { value: 'inactive_90d', label: 'Inactive (90+ days)' },
    ],
  },
  {
    id: 'wealthmapStatus',
    label: 'WealthMap Status',
    type: FILTER_FIELD_TYPES.SELECT,
    options: [
      { value: '', label: 'All' },
      { value: 'not_started', label: 'Not started' },
      { value: 'started', label: 'Started' },
      { value: 'in_progress', label: 'In progress' },
      { value: 'completed', label: 'Completed' },
    ],
  },
  {
    id: 'goalStatus',
    label: 'Goal Status',
    type: FILTER_FIELD_TYPES.SELECT,
    options: [
      { value: '', label: 'All' },
      { value: 'none', label: 'No goals' },
      { value: 'defined', label: 'Goals defined' },
      { value: 'active', label: 'Active (WealthMap done)' },
    ],
  },
  {
    id: 'wellnessRange',
    label: 'Financial Wellness Score',
    type: FILTER_FIELD_TYPES.RANGE,
    keys: ['wellnessMin', 'wellnessMax'],
  },
  {
    id: 'investmentRange',
    label: 'Investment Range',
    type: FILTER_FIELD_TYPES.RANGE,
    keys: ['investmentMin', 'investmentMax'],
  },
  {
    id: 'sipRange',
    label: 'SIP Range',
    type: FILTER_FIELD_TYPES.RANGE,
    keys: ['sipMin', 'sipMax'],
  },
  {
    id: 'insuranceRange',
    label: 'Insurance Range',
    type: FILTER_FIELD_TYPES.RANGE,
    keys: ['insuranceMin', 'insuranceMax'],
  },
  {
    id: 'netWorthRange',
    label: 'Net Worth Range',
    type: FILTER_FIELD_TYPES.RANGE,
    keys: ['netWorthMin', 'netWorthMax'],
  },
];

/** Declared for IA — not rendered until data exists */
export const FUTURE_FILTERS = [
  { id: 'city', label: 'City', phase: 2 },
  { id: 'state', label: 'State', phase: 2 },
  { id: 'acquisitionSource', label: 'Acquisition Source', phase: 2 },
  { id: 'device', label: 'Device', phase: 2 },
  { id: 'browser', label: 'Browser', phase: 2 },
  { id: 'campaign', label: 'Campaign', phase: 3 },
  { id: 'notificationCohort', label: 'Notification Cohorts', phase: 3 },
];

export const HYPER_FIELD_OPTIONS = [
  { value: 'wealthmap_status', label: 'WealthMap Status' },
  { value: 'goal_status', label: 'Goal Status' },
  { value: 'advisor_id', label: 'Advisor ID' },
  { value: 'wellness_score', label: 'Wellness Score' },
  { value: 'sip_monthly', label: 'SIP Monthly' },
  { value: 'net_worth', label: 'Net Worth' },
  { value: 'protection_gap', label: 'Protection Gap' },
  { value: 'assets_total', label: 'Investment Value' },
  { value: 'monthly_surplus', label: 'Monthly Surplus' },
  { value: 'subscription_active', label: 'Subscription Active' },
];

export const HYPER_OPERATORS = [
  { value: 'eq', label: 'equals' },
  { value: 'neq', label: 'not equals' },
  { value: 'gte', label: '≥' },
  { value: 'lte', label: '≤' },
  { value: 'is_null', label: 'is empty' },
  { value: 'not_null', label: 'is not empty' },
];

export function emptyFilters() {
  return {
    dateFrom: '',
    dateTo: '',
    advisorId: '',
    userActivity: '',
    wealthmapStatus: '',
    goalStatus: '',
    wellnessMin: '',
    wellnessMax: '',
    investmentMin: '',
    investmentMax: '',
    sipMin: '',
    sipMax: '',
    insuranceMin: '',
    insuranceMax: '',
    netWorthMin: '',
    netWorthMax: '',
    hyper: { op: 'AND', conditions: [] },
  };
}

/** Strip empty values for RPC payload */
export function serializeFilters(filters) {
  const out = {};
  Object.entries(filters || {}).forEach(([key, value]) => {
    if (key === 'hyper') {
      const conditions = (value?.conditions || []).filter((c) => c?.field);
      if (conditions.length) {
        out.hyper = { op: value.op || 'AND', conditions };
      }
      return;
    }
    if (value !== '' && value !== null && value !== undefined) {
      out[key] = value;
    }
  });
  return out;
}
