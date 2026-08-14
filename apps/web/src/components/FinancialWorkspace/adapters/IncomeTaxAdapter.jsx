import React from 'react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import IncomeTaxModule from '../../IncomeTaxModule/IncomeTaxModule';

/**
 * Props adapter for hosting IncomeTaxModule inside CalculatorModal.
 * IncomeTaxModule expects familyMembers, income, isCalculatorMode — unchanged.
 */
export default function IncomeTaxAdapter() {
  const { familyMembers = [], income = {}, setIncome } = useFinancialPlan();

  return (
    <IncomeTaxModule
      familyMembers={familyMembers}
      income={income}
      setIncome={setIncome}
      isCalculatorMode
    />
  );
}
