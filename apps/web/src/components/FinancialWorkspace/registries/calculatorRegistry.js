import SIPCalculator from '../../Calculators/SIPCalculator';
import LumpsumCalculator from '../../Calculators/LumpsumCalculator';
import EquityCalculator from '../../Calculators/EquityCalculator';
import FDCalculator from '../../Calculators/FDCalculator';
import RDCalculator from '../../Calculators/RDCalculator';
import PPFCalculator from '../../Calculators/PPFCalculator';
import NPSCalculator from '../../Calculators/NPSCalculator';
import SWPCalculator from '../../Calculators/SWPCalculator';
import PersonalLoanCalculator from '../../Calculators/PersonalLoanCalculator';
import HomeLoanCalculator from '../../Calculators/HomeLoanCalculator';
import CarLoanCalculator from '../../Calculators/CarLoanCalculator';
import TwoWheelerCalculator from '../../Calculators/TwoWheelerCalculator';
import EducationLoanCalculator from '../../Calculators/EducationLoanCalculator';
import IncomeTaxAdapter from '../adapters/IncomeTaxAdapter';
import {
  SECONDARY_NAV_BY_PRIMARY,
  STANDALONE_CALCULATOR_ITEMS,
  resolveCanonicalId,
} from '../workspaceNavConfig';

/**
 * Canonical workspace calculator ID → production component.
 * Do not pass canonical IDs as calculatorKey — components keep legacy
 * FinancialPlanContext keys (fd, equity, edu_loan, …) via their defaults.
 */
const CALCULATOR_COMPONENT_BY_ID = {
  sip: SIPCalculator,
  lumpsum: LumpsumCalculator,
  equity_etfs: EquityCalculator,
  fixed_deposit: FDCalculator,
  recurring_deposit: RDCalculator,
  ppf: PPFCalculator,
  nps: NPSCalculator,
  swp: SWPCalculator,
  personal_loan: PersonalLoanCalculator,
  home_loan: HomeLoanCalculator,
  car_loan: CarLoanCalculator,
  two_wheeler_loan: TwoWheelerCalculator,
  education_loan: EducationLoanCalculator,
  income_tax: IncomeTaxAdapter,
};

const toolbarCalculators = Object.values(SECONDARY_NAV_BY_PRIMARY).flat();
const allCalculatorItems = [...toolbarCalculators, ...STANDALONE_CALCULATOR_ITEMS];

/**
 * Registry of calculators keyed by canonical IDs only.
 */
export const CALCULATOR_REGISTRY = Object.fromEntries(
  allCalculatorItems.map((item) => [
    item.id,
    {
      id: item.id,
      label: item.label,
      component: CALCULATOR_COMPONENT_BY_ID[item.id],
    },
  ])
);

export function getCalculatorRegistryEntry(id) {
  return CALCULATOR_REGISTRY[resolveCanonicalId(id)] ?? null;
}
