export const DETAILED_REPORT_BASE = '/detailed-report';

export const detailedReportSteps = [
    { slug: 'your_money_flow', label: 'Your Money Flow', path: '/detailed-report/your_money_flow' },
];

export const DEFAULT_DETAILED_REPORT_PATH = detailedReportSteps[0].path;

/** Next module route — linked from Your Money Flow; not shown in tab bar until built. */
export const INVEST_UNALLOCATED_SURPLUS_PATH = '/detailed-report/invest_unallocated_surplus';

export const detailedReportSlugs = new Set([
    ...detailedReportSteps.map((step) => step.slug),
    'invest_unallocated_surplus',
]);
