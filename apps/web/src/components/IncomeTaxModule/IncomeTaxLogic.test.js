import { describe, it, expect } from 'vitest';
import {
    calculateIncomeTaxFromDetail,
    calculateProjectedMemberTax,
    calculateSlabTax,
    applyRebateAndMarginalRelief,
    calculateSurcharge,
    calculateIncomeTaxFromInput,
    showInHandSalaryEstimateNote,
    buildTaxBreakdownPresentation,
} from './IncomeTaxLogic';
import { buildTaxInput, computeAnnualSalaryFromTaxSlip } from '../DetailedFlow/incomeDetailSync';

describe('IncomeTaxLogic', () => {
    it('zeros tax via 87A rebate when taxable income is at or below 12 lakh', () => {
        const { totalTax } = calculateSlabTax(1200000);
        const { rebate87A, taxAfterRebate } = applyRebateAndMarginalRelief(totalTax, 1200000);
        expect(totalTax).toBe(60000);
        expect(rebate87A).toBe(60000);
        expect(taxAfterRebate).toBe(0);
    });

    it('applies marginal relief when taxable income is just above 12 lakh', () => {
        const taxableIncome = 1210000;
        const { totalTax } = calculateSlabTax(taxableIncome);
        const { rebate87A, marginalRelief, taxAfterRebate } = applyRebateAndMarginalRelief(totalTax, taxableIncome);
        expect(rebate87A).toBe(0);
        expect(marginalRelief).toBeGreaterThan(0);
        expect(taxAfterRebate).toBe(10000);
    });

    it('applies surcharge at 10% for taxable income above 50 lakh', () => {
        const taxAfterRebate = 100000;
        expect(calculateSurcharge(taxAfterRebate, 5500000)).toBe(10000);
    });

    it('calculates salaried tax from tax slip with annual bonus', () => {
        const detail = {
            needTaxPlanning: true,
            inHandSalary: '80000',
            otherIncome: [{ amount: '5000' }],
            taxPlanning: {
                earnings: {
                    basicPay: '60000',
                    dearnessAllowance: '10000',
                    houseRentAllowance: '15000',
                    allowances: '5000',
                    performanceBonus: '100000',
                    other: { name: 'Shift allowance', amount: '24000' },
                },
            },
        };

        const taxInput = buildTaxInput(detail, 'Private Sector');
        expect(taxInput.usedTaxSlip).toBe(true);
        expect(taxInput.annualSalary).toBe(1204000);
        expect(taxInput.otherIncomeAnnual).toBe(60000);
        expect(taxInput.taxableIncome).toBe(1189000);

        const result = calculateIncomeTaxFromDetail(detail, 'Private Sector');
        expect(result.rebate87A).toBeGreaterThan(0);
        expect(result.finalTax).toBe(0);
    });

    it('uses in-hand salary fallback when tax planning is disabled', () => {
        const detail = {
            needTaxPlanning: false,
            inHandSalary: '100000',
            otherIncome: [{ amount: '' }],
        };
        const taxInput = buildTaxInput(detail, 'Private Sector');
        expect(taxInput.usedTaxSlip).toBe(false);
        expect(taxInput.annualSalary).toBe(1200000);
        expect(taxInput.taxableIncome).toBe(1125000);
    });

    it('applies standard deduction for pensioner income', () => {
        const detail = {
            netPension: '90000',
            otherIncome: [{ amount: '5000' }],
        };
        const result = calculateIncomeTaxFromDetail(detail, 'Pensioner');
        expect(result.standardDeduction).toBe(75000);
        expect(result.annualSalary).toBe(1080000);
        expect(result.otherIncomeAnnual).toBe(60000);
        expect(result.taxableIncome).toBe(1065000);
    });

    it('calculates business income without standard deduction', () => {
        const detail = {
            takeHomeProfit: '80000',
            passiveIncome: '10000',
            otherIncome: [{ amount: '5000' }],
        };
        const result = calculateIncomeTaxFromDetail(detail, 'Business Owner');
        expect(result.standardDeduction).toBe(0);
        expect(result.taxableIncome).toBe(1140000);
    });

    it('includes cess on tax plus surcharge', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 6000000,
            annualSalary: 6000000,
            otherIncomeAnnual: 0,
            standardDeduction: 75000,
            taxableIncome: 5925000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        expect(result.surcharge).toBeGreaterThan(0);
        const taxPlusSurcharge = result.taxAfterRebate + result.surcharge - result.surchargeMarginalRelief;
        expect(result.cess).toBeCloseTo(taxPlusSurcharge * 0.04, 0);
    });

    it('applies marginal relief on surcharge at 51 lakh (ClearTax reference)', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 5100000,
            annualSalary: 5100000,
            otherIncomeAnnual: 0,
            standardDeduction: 0,
            taxableIncome: 5100000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        expect(result.surchargeMarginalRelief).toBe(41000);
        expect(result.finalTax).toBe(1227200);
    });

    it('applies marginal relief on surcharge at 1.01 crore (new regime)', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 10100000,
            annualSalary: 10100000,
            otherIncomeAnnual: 0,
            standardDeduction: 0,
            taxableIncome: 10100000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        expect(result.surchargeMarginalRelief).toBe(63500);
        expect(result.finalTax).toBe(3055520);
    });

    it('does not apply surcharge marginal relief well above 50 lakh', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 5500000,
            annualSalary: 5500000,
            otherIncomeAnnual: 0,
            standardDeduction: 0,
            taxableIncome: 5500000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        expect(result.surchargeMarginalRelief).toBe(0);
    });

    it('does not apply surcharge at exactly 50 lakh threshold', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 5000000,
            annualSalary: 5000000,
            otherIncomeAnnual: 0,
            standardDeduction: 0,
            taxableIncome: 5000000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        expect(result.surcharge).toBe(0);
        expect(result.surchargeMarginalRelief).toBe(0);
    });

    it('applies surcharge marginal relief when crossing 2 crore threshold', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 20100000,
            annualSalary: 20100000,
            otherIncomeAnnual: 0,
            standardDeduction: 0,
            taxableIncome: 20100000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        expect(result.surchargeMarginalRelief).toBe(495500);
        expect(result.finalTax).toBe(6777680);
    });

    it('annualizes government tax slip components correctly', () => {
        const annualSalary = computeAnnualSalaryFromTaxSlip({
            taxPlanning: {
                earnings: {
                    basicPay: '50000',
                    dearnessAllowance: '10000',
                    houseRentAllowance: '8000',
                    allowances: '2000',
                    bonus: '50000',
                    leaveEncashment: '30000',
                    other: { amount: '12000' },
                },
            },
        }, 'Government Sector');
        expect(annualSalary).toBe((50000 + 10000 + 8000 + 2000) * 12 + 50000 + 30000 + 12000);
    });

    it('shows in-hand salary estimate note for salaried members without tax planning', () => {
        expect(showInHandSalaryEstimateNote({ needTaxPlanning: false }, 'Private Sector')).toBe(true);
        expect(showInHandSalaryEstimateNote({ needTaxPlanning: true }, 'Private Sector')).toBe(false);
        expect(showInHandSalaryEstimateNote({ needTaxPlanning: false }, 'Business Owner')).toBe(false);
    });

    it('builds slab breakdown with income in slab and formula text', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 1264000,
            annualSalary: 1204000,
            otherIncomeAnnual: 60000,
            standardDeduction: 75000,
            taxableIncome: 1189000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        const breakdown = buildTaxBreakdownPresentation(result);

        expect(breakdown.slabBreakdown).toHaveLength(3);
        expect(breakdown.slabBreakdown[1].incomeInSlab).toBe(400000);
        expect(breakdown.slabBreakdown[1].taxAmount).toBe(20000);
        expect(breakdown.slabBreakdown[2].incomeInSlab).toBe(389000);
        expect(breakdown.slabBreakdown[2].taxAmount).toBe(38900);
        expect(breakdown.slabBreakdown[2].formulaText).toContain('10%');
        expect(breakdown.insights.effectiveTaxRate).toBe(0);
        expect(breakdown.insights.marginalRate).toBe(0.10);
        expect(breakdown.insights.summaryNote).toContain('Section 87A');
    });

    it('builds marginal relief summary for income just above 12 lakh', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 1275000,
            annualSalary: 1275000,
            otherIncomeAnnual: 0,
            standardDeduction: 0,
            taxableIncome: 1210000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        const breakdown = buildTaxBreakdownPresentation(result);

        expect(result.marginalRelief).toBeGreaterThan(0);
        expect(result.taxAfterRebate).toBe(10000);
        expect(breakdown.insights.summaryNote).toContain('Marginal relief');
        expect(breakdown.adjustments.some((a) => a.title.includes('Marginal relief'))).toBe(true);
    });

    it('includes surcharge and cess in adjustments for high income', () => {
        const result = calculateIncomeTaxFromInput({
            grossTotalIncome: 5100000,
            annualSalary: 5100000,
            otherIncomeAnnual: 0,
            standardDeduction: 0,
            taxableIncome: 5100000,
            usedTaxSlip: false,
            employmentType: 'Private Sector',
        });
        const breakdown = buildTaxBreakdownPresentation(result);

        expect(breakdown.adjustments.some((a) => a.title === 'Surcharge')).toBe(true);
        expect(breakdown.adjustments.some((a) => a.title.includes('Cess'))).toBe(true);
        expect(breakdown.insights.effectiveTaxRate).toBeGreaterThan(0);
        expect(breakdown.insights.marginalRate).toBe(0.30);
    });

    it('calculateProjectedMemberTax matches year 0 with calculateIncomeTaxFromDetail', () => {
        const detail = {
            inHandSalary: '100000',
            otherIncome: [{ amount: '5000' }],
        };
        const yearZero = calculateProjectedMemberTax(detail, 'Private Sector', 0, 10);
        const direct = calculateIncomeTaxFromDetail(detail, 'Private Sector');
        expect(yearZero.finalTax).toBe(direct.finalTax);
    });

    it('calculateProjectedMemberTax increases tax when income grows above rebate threshold', () => {
        const detail = { inHandSalary: '95000' };
        const yearZero = calculateProjectedMemberTax(detail, 'Private Sector', 0, 10);
        const yearFive = calculateProjectedMemberTax(detail, 'Private Sector', 5, 10);
        expect(yearFive.finalTax).toBeGreaterThanOrEqual(yearZero.finalTax);
    });
});
