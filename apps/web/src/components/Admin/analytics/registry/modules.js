/**
 * Extensible analytics module registry.
 * Phase 2/3 modules are declared now so navigation IA stays stable.
 */

export const ANALYTICS_PHASE = {
  AVAILABLE: 1,
  INSTRUMENTATION: 2,
  BUSINESS_DEPTH: 3,
};

/** @typedef {{ id: string, label: string, phase: number, description: string, icon?: string }} AnalyticsModule */

/** @type {AnalyticsModule[]} */
export const ANALYTICS_MODULES = [
  {
    id: 'executive',
    label: 'Executive Dashboard',
    phase: ANALYTICS_PHASE.AVAILABLE,
    description: 'CEO view of business, financial intelligence, and journey KPIs',
  },
  {
    id: 'users',
    label: 'Users',
    phase: ANALYTICS_PHASE.AVAILABLE,
    description: 'User base, subscriptions, and activity',
  },
  {
    id: 'funnel',
    label: 'WealthMap Funnel',
    phase: ANALYTICS_PHASE.AVAILABLE,
    description: 'Onboarding step completion and drop-off',
  },
  {
    id: 'financial',
    label: 'Financial Intelligence',
    phase: ANALYTICS_PHASE.AVAILABLE,
    description: 'Wellness, surplus, protection and goal gaps',
  },
  {
    id: 'investment',
    label: 'Investment & Insurance',
    phase: ANALYTICS_PHASE.AVAILABLE,
    description: 'SIP, net worth, cover and maturities',
  },
  {
    id: 'revenue',
    label: 'Revenue & Subscription',
    phase: ANALYTICS_PHASE.AVAILABLE,
    description: 'Checkout revenue and subscription penetration',
  },
  {
    id: 'advisors',
    label: 'Advisors',
    phase: ANALYTICS_PHASE.AVAILABLE,
    description: 'Advisor client load and outcomes',
  },
  {
    id: 'engagement',
    label: 'Engagement Analytics',
    phase: ANALYTICS_PHASE.INSTRUMENTATION,
    description: 'Sessions, duration, notifications — requires analytics_events',
  },
  {
    id: 'product',
    label: 'Product Analytics',
    phase: ANALYTICS_PHASE.INSTRUMENTATION,
    description: 'Screens, features, CTAs — requires analytics_events',
  },
  {
    id: 'ai',
    label: 'AI Analytics',
    phase: ANALYTICS_PHASE.INSTRUMENTATION,
    description: 'Smart Edit and AI recommendation usage — requires analytics_events',
  },
  {
    id: 'notifications',
    label: 'Notifications',
    phase: ANALYTICS_PHASE.BUSINESS_DEPTH,
    description: 'Campaign delivery and conversion — Phase 3',
  },
];

export const DEFAULT_ANALYTICS_MODULE = 'executive';

export function getModuleById(id) {
  return ANALYTICS_MODULES.find((m) => m.id === id) || ANALYTICS_MODULES[0];
}

export function isModuleAvailable(module, currentPhase = 1) {
  return (module?.phase ?? 99) <= currentPhase;
}
