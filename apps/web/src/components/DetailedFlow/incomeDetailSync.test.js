import { describe, it, expect } from 'vitest';
import {
    reconcileMemberIncome,
    reconcileSalarySlip,
    computeMonthlyGrossFromSalarySlip,
    computeMonthlyDeductionsFromSalarySlip,
    buildMonthlyTdsArray,
    syncLedgerTdsFromIncome,
    getMemberDetailMonthlyTotal,
    initializeIncomeSnapshots,
    normalizeIncomeState,
    applyDetailSyncToIncome,
    syncSummaryAmountToDetailPrimary,
    getSummaryIncomeTarget,
    hasIncomeBreakdown,
    buildTaxInput,
    computeAnnualSalaryFromTaxSlip,
    sumOtherIncomeAnnual,
    scaleIncomeDetail,
    applySalarySlipDerivedTotals,
    getMemberAnnualGrossFromDetail,
    getMemberDetailForProjection,
    shouldIncludeSpouseIncome,
    getHouseholdMonthlyInflow,
} from './incomeDetailSync';
import { resolveEmploymentType } from './employmentTypeSync';

describe('incomeDetailSync', () => {
    it('initializeIncomeSnapshots migrates legacy self into summarySelfInHand', () => {
        const result = initializeIncomeSnapshots({ self: '80000', spouse: '' });
        expect(result.summarySelfInHand).toBe('80000');
    });

    it('initializeIncomeSnapshots keeps snapshot when self drifts after detail sync', () => {
        const result = initializeIncomeSnapshots({
            self: '90000',
            summarySelfInHand: '100000',
        });
        expect(result.summarySelfInHand).toBe('100000');
        expect(result.self).toBe('90000');
    });

    it('getMemberDetailMonthlyTotal sums primary passive and other income', () => {
        const total = getMemberDetailMonthlyTotal({
            takeHomeProfit: '70000',
            passiveIncome: '10000',
            otherIncome: [{ amount: '5000' }],
        }, 'Business Owner');
        expect(total).toBe(85000);
    });

    it('reconcileMemberIncome reports under when detail total is below summary anchor', () => {
        const result = reconcileMemberIncome('100000', { inHandSalary: '80000' }, 'Private Sector');
        expect(result.status).toBe('under');
        expect(result.delta).toBe(20000);
    });

    it('reconcileMemberIncome matches when detail split equals summary anchor', () => {
        const result = reconcileMemberIncome('100000', {
            inHandSalary: '90000',
            otherIncome: [{ amount: '10000' }],
        }, 'Private Sector');
        expect(result.status).toBe('match');
    });

    it('normalizeIncomeState preserves summary snapshot when self differs', () => {
        const normalized = normalizeIncomeState({
            self: '90000',
            summarySelfInHand: '100000',
        });
        expect(normalized.summarySelfInHand).toBe('100000');
        expect(normalized.self).toBe('90000');
    });

    it('applyDetailSyncToIncome does not overwrite summary snapshots', () => {
        const result = applyDetailSyncToIncome({
            selfDetail: { inHandSalary: '90000', otherIncome: [{ amount: '10000' }] },
            spouseDetail: { inHandSalary: '65000', otherIncome: [{ amount: '10000' }] },
            summarySelfInHand: '100000',
            summarySpouseInHand: '75000',
        }, 'Private Sector', 'Private Sector');

        expect(result.self).toBe('90000');
        expect(result.selfOther).toBe('10000');
        expect(result.summarySelfInHand).toBe('100000');
        expect(result.spouse).toBe('65000');
        expect(result.spouseOther).toBe('10000');
        expect(result.summarySpouseInHand).toBe('75000');
    });

    it('syncSummaryAmountToDetailPrimary sets inHandSalary for salaried employment', () => {
        const detail = syncSummaryAmountToDetailPrimary({}, '95000', 'Private Sector');
        expect(detail.inHandSalary).toBe('95000');
    });

    it('syncSummaryAmountToDetailPrimary sets takeHomeProfit for business employment', () => {
        const detail = syncSummaryAmountToDetailPrimary({}, '95000', 'Business Owner');
        expect(detail.takeHomeProfit).toBe('95000');
    });

    it('getSummaryIncomeTarget prefers snapshot over synced primary', () => {
        expect(getSummaryIncomeTarget({ self: '90000', summarySelfInHand: '100000' }, 'self')).toBe('100000');
        expect(getSummaryIncomeTarget({ spouse: '65000', summarySpouseInHand: '75000' }, 'spouse')).toBe('75000');
    });

    it('hasIncomeBreakdown is true when other income is entered', () => {
        expect(hasIncomeBreakdown({
            inHandSalary: '90000',
            otherIncome: [{ amount: '10000' }],
        }, 'Private Sector')).toBe(true);
    });

    it('hasIncomeBreakdown is false when only primary is entered', () => {
        expect(hasIncomeBreakdown({ inHandSalary: '100000' }, 'Private Sector')).toBe(false);
    });

    it('sumOtherIncomeAnnual multiplies monthly other income by 12', () => {
        expect(sumOtherIncomeAnnual([{ amount: '5000' }, { amount: '2500' }])).toBe(90000);
    });

    it('buildTaxInput uses tax slip when tax planning is enabled', () => {
        const input = buildTaxInput({
            needTaxPlanning: true,
            inHandSalary: '50000',
            taxPlanning: {
                earnings: {
                    basicPay: '70000',
                    dearnessAllowance: '',
                    houseRentAllowance: '',
                    allowances: '',
                    performanceBonus: '60000',
                },
            },
        }, 'Private Sector');
        expect(input.usedTaxSlip).toBe(true);
        expect(input.annualSalary).toBe(900000);
    });

    it('buildTaxInput returns null when salaried tax planning is disabled', () => {
        expect(buildTaxInput({
            needTaxPlanning: false,
            inHandSalary: '100000',
        }, 'Private Sector')).toBeNull();
    });

    it('buildTaxInput returns null when tax planning is enabled but salary slip is empty', () => {
        expect(buildTaxInput({
            needTaxPlanning: true,
            inHandSalary: '100000',
        }, 'Private Sector')).toBeNull();
    });

    it('applySalarySlipDerivedTotals computes gross and in-hand from salary slip', () => {
        const detail = applySalarySlipDerivedTotals({
            needTaxPlanning: true,
            taxPlanning: {
                earnings: { basicPay: '70000', dearnessAllowance: '10000', performanceBonus: '120000' },
                deductions: { employeePF: '12000', incomeTax: '6000' },
            },
        }, 'Private Sector');

        expect(detail.grossSalary).toBe('90000');
        expect(detail.inHandSalary).toBe('72000');
    });

    it('computeAnnualSalaryFromTaxSlip treats performance bonus as annual', () => {
        const annual = computeAnnualSalaryFromTaxSlip({
            taxPlanning: { earnings: { basicPay: '80000', performanceBonus: '120000' } },
        }, 'Private Sector');
        expect(annual).toBe(1080000);
    });

    it('scaleIncomeDetail scales primary income, tax slip components, and incomeTax', () => {
        const scaled = scaleIncomeDetail({
            inHandSalary: '100000',
            otherIncome: [{ amount: '5000' }],
            taxPlanning: {
                earnings: { basicPay: '80000', performanceBonus: '120000' },
                deductions: { incomeTax: '8000', employeePF: '12000' },
            },
        }, 1.1);

        expect(scaled.inHandSalary).toBe('110000');
        expect(scaled.otherIncome[0].amount).toBe('5500');
        expect(scaled.taxPlanning.earnings.basicPay).toBe('88000');
        expect(scaled.taxPlanning.earnings.performanceBonus).toBe('132000');
        expect(scaled.taxPlanning.deductions.incomeTax).toBe('8800');
        expect(scaled.taxPlanning.deductions.employeePF).toBe('13200');
    });

    it('getMemberAnnualGrossFromDetail uses tax slip gross when enabled', () => {
        const gross = getMemberAnnualGrossFromDetail({
            needTaxPlanning: true,
            inHandSalary: '50000',
            taxPlanning: { earnings: { basicPay: '70000' } },
        }, 'Private Sector');
        expect(gross).toBe(840000);
    });

    it('reconcileSalarySlip matches when gross minus deductions equals in-hand salary', () => {
        const result = reconcileSalarySlip({
            grossSalary: '100000',
            inHandSalary: '82000',
            taxPlanning: {
                deductions: {
                    employeePF: '12000',
                    incomeTax: '6000',
                },
            },
        }, 'Private Sector');

        expect(result.status).toBe('match');
        expect(result.gross).toBe(100000);
        expect(result.deductions).toBe(18000);
        expect(result.computedInHand).toBe(82000);
    });

    it('reconcileSalarySlip flags partial deductions when only TDS is entered', () => {
        const result = reconcileSalarySlip({
            grossSalary: '100000',
            inHandSalary: '82000',
            taxPlanning: { deductions: { incomeTax: '6000' } },
        }, 'Private Sector');

        expect(result.isPartial).toBe(true);
        expect(result.status).toBe('over');
    });

    it('buildMonthlyTdsArray repeats the same monthly amount across all months', () => {
        expect(buildMonthlyTdsArray('7500')).toEqual(Array(12).fill(7500));
    });

    it('syncLedgerTdsFromIncome populates selfIncomeTax when salary-slip TDS is entered', () => {
        const familyMembers = [{ relation: 'Self', employmentType: 'Private Sector' }];
        const income = {
            selfDetail: {
                taxPlanning: { deductions: { incomeTax: '5000' } },
            },
        };
        const next = syncLedgerTdsFromIncome(
            { income: Array(12).fill(0), household: Array(12).fill(0) },
            income,
            familyMembers,
            false,
            resolveEmploymentType,
            5,
        );

        expect(next.selfIncomeTax).toEqual(Array(12).fill(5000));
    });

    it('syncLedgerTdsFromIncome preserves manual ledger edits until salary-slip TDS changes', () => {
        const familyMembers = [{ relation: 'Self', employmentType: 'Private Sector' }];
        const income = {
            selfDetail: {
                taxPlanning: { deductions: { incomeTax: '5000' } },
            },
        };
        const ledger = {
            selfIncomeTax: [...Array(8).fill(5000), 6000, ...Array(3).fill(6000)],
        };

        const unchanged = syncLedgerTdsFromIncome(
            ledger,
            income,
            familyMembers,
            false,
            resolveEmploymentType,
            5,
        );
        expect(unchanged).toBe(ledger);

        const updated = syncLedgerTdsFromIncome(
            ledger,
            {
                selfDetail: {
                    taxPlanning: { deductions: { incomeTax: '5500' } },
                },
            },
            familyMembers,
            false,
            resolveEmploymentType,
            5,
        );
        expect(updated.selfIncomeTax).toEqual(Array(12).fill(5500));
    });

    it('getMemberDetailForProjection falls back to legacy self income', () => {
        const detail = getMemberDetailForProjection({ self: '85000', selfPassive: '5000' }, 'self', 'Private Sector');
        expect(detail.inHandSalary).toBe('85000');
        expect(detail.passiveIncome).toBe('5000');
    });

    it('getMemberDetailForProjection resyncs summary anchor over stale partial detail', () => {
        const income = {
            summarySelfInHand: '80000',
            selfDetail: { inHandSalary: '8', otherIncome: [{ amount: '' }] },
            summarySpouseInHand: '60000',
            spouseDetail: { inHandSalary: '6', otherIncome: [{ amount: '' }] },
        };
        expect(getMemberDetailForProjection(income, 'self', 'Private Sector').inHandSalary).toBe('80000');
        expect(getMemberDetailForProjection(income, 'spouse', 'Private Sector').inHandSalary).toBe('60000');
    });

    it('shouldIncludeSpouseIncome follows isSpouseWorking and hasSpouseIncome flags', () => {
        const spouse = { relation: 'Spouse', isSpouseWorking: true };
        expect(shouldIncludeSpouseIncome(spouse, false, {})).toBe(true);
        expect(shouldIncludeSpouseIncome({ relation: 'Spouse' }, true, {})).toBe(true);
        expect(shouldIncludeSpouseIncome({ relation: 'Spouse' }, false, { spouse: '50000' })).toBe(true);
        expect(shouldIncludeSpouseIncome({ relation: 'Spouse' }, false, {})).toBe(false);
        expect(shouldIncludeSpouseIncome(null, true, {})).toBe(true);
        expect(shouldIncludeSpouseIncome(null, false, { summarySpouseInHand: '75000' })).toBe(true);
    });

    it('getHouseholdMonthlyInflow includes spouse income from summary flow without spouse member', () => {
        const familyMembers = [{ relation: 'Self', employmentType: 'Private Sector' }];
        const income = {
            summarySelfInHand: '100000',
            summarySpouseInHand: '75000',
            selfDetail: { inHandSalary: '100000', otherIncome: [{ amount: '' }] },
            spouseDetail: { inHandSalary: '75000', otherIncome: [{ amount: '' }] },
        };
        expect(getHouseholdMonthlyInflow(income, familyMembers, true, resolveEmploymentType)).toBe(175000);
    });

    it('getHouseholdMonthlyInflow sums detailed in-hand totals for self and spouse', () => {
        const familyMembers = [
            { relation: 'Self', employmentType: 'Private Sector' },
            { relation: 'Spouse', employmentType: 'Private Sector', isSpouseWorking: true },
        ];
        const income = {
            selfDetail: { inHandSalary: '100000', otherIncome: [{ amount: '' }] },
            spouseDetail: { inHandSalary: '50000', otherIncome: [{ amount: '' }] },
        };
        expect(getHouseholdMonthlyInflow(income, familyMembers, false, resolveEmploymentType)).toBe(150000);
    });
});
