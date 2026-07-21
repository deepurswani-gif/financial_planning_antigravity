import { SECTION_IDS } from '../../components/FinancialWorkspace/sectionIds';
import { normalizeField } from '../schema';

/**
 * Growth Expectations — Detailed Flow standalone page (no progressive question ids).
 * Synthetic questionId `growth-expectations` represents the whole form.
 */
/** @type {import('../schema').QuestionField[]} */
export const ASSUMPTION_FIELDS = [
  normalizeField({
    id: 'assumptions.incomeGrowthRate',
    kind: 'field',
    label: 'Income Growth (%)',
    shortLabel: 'Income growth',
    aliases: ['income increment', 'salary hike', 'income inflation'],
    domain: 'assumptions',
    uiCategory: 'growth_assumptions',
    valueType: 'percent',
    importance: 'high',
    quickEditPriority: 'low',
    searchBoost: 8,
    businessMeaning:
      'Assumed annual income growth used in long-range cash-flow and retirement projections.',
    editExperience: { type: 'question' },
    state: { path: 'inflationRates.incomeIncrement' },
    editSurfaces: [
      {
        flow: 'detailed',
        sectionId: SECTION_IDS.GROWTH_EXPECTATIONS,
        questionId: 'growth-expectations',
        capability: 'full',
        role: 'primary',
      },
    ],
    preferredSurface: { whenCapabilitySummary: 'summary', whenCapabilityFull: 'detailed' },
    impacts: [
      'report.detail.put_your_money_to_work',
      'engine.retirementHorizon',
      'engine.projections',
    ],
    tags: ['assumptions'],
  }),

  normalizeField({
    id: 'assumptions.householdInflationRate',
    kind: 'field',
    label: 'Household Expense Growth (%)',
    shortLabel: 'Expense growth',
    aliases: ['expense inflation', 'household inflation', 'cpi'],
    domain: 'assumptions',
    uiCategory: 'growth_assumptions',
    valueType: 'percent',
    importance: 'high',
    quickEditPriority: 'low',
    searchBoost: 8,
    businessMeaning:
      'Assumed household expense inflation for surplus sustainability and long-range projections.',
    editExperience: { type: 'question' },
    state: { path: 'inflationRates.householdInflation' },
    editSurfaces: [
      {
        flow: 'detailed',
        sectionId: SECTION_IDS.GROWTH_EXPECTATIONS,
        questionId: 'growth-expectations',
        capability: 'full',
        role: 'primary',
      },
    ],
    preferredSurface: { whenCapabilitySummary: 'summary', whenCapabilityFull: 'detailed' },
    impacts: ['engine.projections', 'engine.cashFlow'],
    tags: ['assumptions'],
  }),

  normalizeField({
    id: 'assumptions.educationInflationRate',
    kind: 'field',
    label: 'Education Cost Growth (%)',
    shortLabel: 'Education inflation',
    aliases: ['education inflation', 'tuition inflation'],
    domain: 'assumptions',
    uiCategory: 'growth_assumptions',
    valueType: 'percent',
    importance: 'high',
    quickEditPriority: 'low',
    searchBoost: 6,
    businessMeaning:
      'Assumed education cost inflation used when projecting child education goals and related funding.',
    editExperience: { type: 'question' },
    state: { path: 'inflationRates.educationInflation' },
    editSurfaces: [
      {
        flow: 'detailed',
        sectionId: SECTION_IDS.GROWTH_EXPECTATIONS,
        questionId: 'growth-expectations',
        capability: 'full',
        role: 'primary',
      },
    ],
    preferredSurface: { whenCapabilitySummary: 'summary', whenCapabilityFull: 'detailed' },
    impacts: ['engine.education', 'engine.goals', 'engine.projections'],
    tags: ['assumptions', 'education'],
  }),
];
