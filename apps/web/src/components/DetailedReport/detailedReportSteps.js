export const DETAILED_REPORT_BASE = '/detailed-report';

export const detailedReportSteps = [
    { slug: 'your_money_flow', label: 'Your Money Flow', path: '/detailed-report/your_money_flow' },
    { slug: 'put_your_money_to_work', label: 'Put Your Money to Work', path: '/detailed-report/put_your_money_to_work' },
];

export const DEFAULT_DETAILED_REPORT_PATH = detailedReportSteps[0].path;

/** Linked from invest surplus section on Your Money Flow page. */
export const PUT_YOUR_MONEY_TO_WORK_PATH = '/detailed-report/put_your_money_to_work';

export const detailedReportSlugs = new Set(detailedReportSteps.map((step) => step.slug));
