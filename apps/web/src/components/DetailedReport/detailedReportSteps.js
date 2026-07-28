export const DETAILED_REPORT_BASE = '/detailed-report';

export const detailedReportSteps = [
    { slug: 'your_money_flow', label: 'Your Money Flow', path: '/detailed-report/your_money_flow' },
    { slug: 'fix_your_financial_gaps', label: 'Fix Your Financial Gaps', path: '/detailed-report/fix_your_financial_gaps' },
    { slug: 'put_your_money_to_work', label: 'Put Your Money to Work', path: '/detailed-report/put_your_money_to_work' },
    { slug: 'your_moneys_magic', label: "Your Money's Magic", path: '/detailed-report/your_moneys_magic' },
];

export const DEFAULT_DETAILED_REPORT_PATH = detailedReportSteps[0].path;

/** Linked from invest surplus section on Your Money Flow page. */
export const FIX_YOUR_FINANCIAL_GAPS_PATH = '/detailed-report/fix_your_financial_gaps';

export const PUT_YOUR_MONEY_TO_WORK_PATH = '/detailed-report/put_your_money_to_work';

export const YOUR_MONEYS_MAGIC_PATH = '/detailed-report/your_moneys_magic';

/** @deprecated Use YOUR_MONEYS_MAGIC_PATH */
export const TRACK_SURPLUS_ALLOCATION_PATH = YOUR_MONEYS_MAGIC_PATH;

export const detailedReportSlugs = new Set(detailedReportSteps.map((step) => step.slug));
