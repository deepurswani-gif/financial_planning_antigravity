export const SUMMARY_REPORT_BASE = '/summary-report';

export const summaryReportSteps = [
    { slug: 'money_story', label: 'Your Money Story', path: '/summary-report/money_story' },
    { slug: 'safety_net', label: 'The Safety Net', path: '/summary-report/safety_net' },
    { slug: 'your_future_self', label: 'Your Future Self', path: '/summary-report/your_future_self' },
    { slug: 'useful_insights', label: 'Useful Insights', path: '/summary-report/useful_insights' },
];

export const DEFAULT_SUMMARY_REPORT_PATH = summaryReportSteps[0].path;

export const summaryReportSlugs = new Set(summaryReportSteps.map((step) => step.slug));
