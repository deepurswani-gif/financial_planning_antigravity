import { calculateIncomeTaxFromDetail, calculateProjectedMemberTax } from '../IncomeTaxModule/IncomeTaxLogic';
import {
    createEmptyIncomeDetail,
    getMemberDetailForProjection,
    getHouseholdMonthlyInflow,
    shouldIncludeSpouseIncome,
    isSalariedEmployment,
    isGovernmentSector,
    isPensionerEmployment,
    isBusinessEmployment,
    scaleIncomeDetail,
} from '../DetailedFlow/incomeDetailSync';
import {
    getEffectiveMonthlyHousehold,
    getEffectiveMonthlyEmi,
} from '../DetailedFlow/expenseDetailSync';
import { getEffectiveMonthlyInsurance } from '../DetailedFlow/insuranceDetailSync';
import { getEffectiveMonthlySavings } from '../DetailedFlow/savingsDetailSync';
import { convertToMonthly } from '../CashFlowModule/CashFlowUtils';

export const MONTH_LABELS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_LABELS_LONG = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

/** June (0-indexed) — additional tax payment assumed */
export const TAX_PAYMENT_MONTH = 5;
/** September — income tax refund assumed */
export const TAX_REFUND_MONTH = 8;

const parseAmount = (value) => parseFloat(value) || 0;

const sumOtherIncome = (otherIncome = []) => (
    otherIncome.reduce((sum, item) => sum + parseAmount(item?.amount), 0)
);

/**
 * Net inflow for ledger: in-hand / take-home / pension + other income (employment-specific).
 */
export function getMemberNetInflowForLedger(detail, employmentType) {
    const d = { ...createEmptyIncomeDetail(), ...detail };
    const other = sumOtherIncome(d.otherIncome);

    if (isSalariedEmployment(employmentType)) {
        return parseAmount(d.inHandSalary) + other;
    }
    if (isBusinessEmployment(employmentType)) {
        return parseAmount(d.takeHomeProfit) + parseAmount(d.passiveIncome) + other;
    }
    if (isPensionerEmployment(employmentType)) {
        return parseAmount(d.netPension) + other;
    }
    return parseAmount(d.inHandSalary) + other;
}

/** Household monthly for ledger — includes education; prefers effective household helper. */
export function getLedgerHouseholdMonthly(expenseCategories = {}, familyMembers = []) {
    return Math.round(getEffectiveMonthlyHousehold(expenseCategories, familyMembers));
}

/** Combined net inflow for all included household earners. */
export function getLedgerNetIncomeMonthly(income, familyMembers, hasSpouseIncome, resolveEmploymentType) {
    const selfMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'self');
    const spouseMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'spouse');
    if (!selfMember) {
        return Math.round(getHouseholdMonthlyInflow(income, familyMembers, hasSpouseIncome, resolveEmploymentType));
    }

    const selfType = resolveEmploymentType(selfMember);
    const spouseType = spouseMember ? resolveEmploymentType(spouseMember) : '';
    const includeSpouse = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, income);

    const selfDetail = getMemberDetailForProjection(income, 'self', selfType);
    let total = getMemberNetInflowForLedger(selfDetail, selfType);

    if (includeSpouse) {
        const spouseDetail = getMemberDetailForProjection(
            income,
            'spouse',
            spouseMember ? spouseType : 'Private Sector',
        );
        total += getMemberNetInflowForLedger(spouseDetail, spouseMember ? spouseType : 'Private Sector');
    }

    if (total > 0) return Math.round(total);
    return Math.round(getHouseholdMonthlyInflow(income, familyMembers, hasSpouseIncome, resolveEmploymentType));
}

export function usesMarchFebruarySalaryYear(employmentType) {
    return isGovernmentSector(employmentType) || isPensionerEmployment(employmentType);
}

/** Annual TDS from salary slip (incomeTax deduction × 12) for one member. */
export function getMemberAnnualTdsFromSlip(detail, employmentType) {
    if (!isSalariedEmployment(employmentType)) return 0;
    const d = { ...createEmptyIncomeDetail(), ...detail };
    if (d.needTaxPlanning !== true) return 0;
    const monthlyTds = parseAmount(d.taxPlanning?.deductions?.incomeTax);
    if (monthlyTds <= 0) return 0;
    return Math.round(monthlyTds * 12);
}

/** TDS for a projection year after income-increment scaling (matches Journey Step 8). */
export function getProjectedMemberAnnualTds(detail, employmentType, yearIndex, incomeIncrementPercent = 0) {
    const factor = Math.pow(1 + (incomeIncrementPercent / 100), yearIndex);
    const scaledDetail = scaleIncomeDetail(detail, factor);
    return getMemberAnnualTdsFromSlip(scaledDetail, employmentType);
}

/** Computed tax vs TDS for one member in a projection year. */
export function computeMemberProjectedTaxReconciliation(
    detail,
    employmentType,
    yearIndex,
    incomeIncrementPercent = 0,
) {
    const taxResult = calculateProjectedMemberTax(detail, employmentType, yearIndex, incomeIncrementPercent);
    const computedTax = taxResult?.finalTax || 0;
    const tdsWithheld = getProjectedMemberAnnualTds(detail, employmentType, yearIndex, incomeIncrementPercent);
    return {
        computedTax,
        tdsWithheld,
        taxReconciliation: computedTax - tdsWithheld,
    };
}

/**
 * Household tax reconciliation for Journey projections — aligned with ledger logic.
 * Current calendar year: no adjustment (prior-year ITR assumed filed).
 * Later years: net impact = computed tax − TDS already withheld via salary slip.
 */
export function computeHouseholdProjectedTaxReconciliation({
    selfDetail,
    selfEmploymentType,
    spouseDetail,
    spouseEmploymentType,
    includeSpouse,
    yearIndex,
    incomeIncrementPercent = 0,
    projectionYear,
    asOfYear = new Date().getFullYear(),
}) {
    const self = computeMemberProjectedTaxReconciliation(
        selfDetail,
        selfEmploymentType,
        yearIndex,
        incomeIncrementPercent,
    );
    let computedTax = self.computedTax;
    let tdsWithheld = self.tdsWithheld;

    if (includeSpouse && spouseDetail) {
        const spouse = computeMemberProjectedTaxReconciliation(
            spouseDetail,
            spouseEmploymentType,
            yearIndex,
            incomeIncrementPercent,
        );
        computedTax += spouse.computedTax;
        tdsWithheld += spouse.tdsWithheld;
    }

    const taxReconciliation = computedTax - tdsWithheld;
    const applies = projectionYear > asOfYear;
    const taxImpact = applies ? taxReconciliation : 0;

    return { computedTax, tdsWithheld, taxReconciliation, taxImpact, applies };
}

/**
 * Tax adjustment for assessment year after current calendar year.
 * Current year: ignored (ITR already filed). Next calendar year+: Jun payment or Sep refund.
 */
export function computeTaxAdjustmentArray({
    income,
    familyMembers,
    hasSpouseIncome,
    resolveEmploymentType,
    calendarYear,
    asOfYear = new Date().getFullYear(),
}) {
    const empty = Array(12).fill(0);
    const baseMeta = {
        applies: false,
        actualTax: 0,
        tdsTotal: 0,
        difference: 0,
        type: null,
        paymentMonth: TAX_PAYMENT_MONTH,
        refundMonth: TAX_REFUND_MONTH,
    };

    if (calendarYear <= asOfYear) {
        return {
            adjustment: empty,
            meta: {
                ...baseMeta,
                reason: 'Income tax return for the prior year is assumed filed for the current calendar year. Tax adjustment applies from the next assessment cycle.',
            },
        };
    }

    const selfMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'self');
    const spouseMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'spouse');
    if (!selfMember) {
        return { adjustment: empty, meta: { ...baseMeta, reason: 'No profile data for tax adjustment.' } };
    }

    const selfType = resolveEmploymentType(selfMember);
    const spouseType = spouseMember ? resolveEmploymentType(spouseMember) : '';
    const includeSpouse = shouldIncludeSpouseIncome(spouseMember, hasSpouseIncome, income);

    let totalActualTax = 0;
    let totalTds = 0;
    let hasTaxData = false;

    const selfDetail = getMemberDetailForProjection(income, 'self', selfType);
    const selfTax = calculateIncomeTaxFromDetail(selfDetail, selfType);
    if (selfTax) {
        totalActualTax += selfTax.finalTax || 0;
        hasTaxData = true;
    }
    totalTds += getMemberAnnualTdsFromSlip(selfDetail, selfType);

    if (includeSpouse && spouseMember) {
        const spouseDetail = getMemberDetailForProjection(income, 'spouse', spouseType);
        const spouseTax = calculateIncomeTaxFromDetail(spouseDetail, spouseType);
        if (spouseTax) {
            totalActualTax += spouseTax.finalTax || 0;
            hasTaxData = true;
        }
        totalTds += getMemberAnnualTdsFromSlip(spouseDetail, spouseType);
    }

    if (!hasTaxData || totalTds <= 0) {
        return {
            adjustment: empty,
            meta: {
                ...baseMeta,
                reason: 'Tax adjustment requires salary-slip TDS and computed income tax from Income Tax module.',
            },
        };
    }

    const difference = Math.round(totalActualTax - totalTds);
    if (Math.abs(difference) < 1) {
        return {
            adjustment: empty,
            meta: { ...baseMeta, applies: true, actualTax: totalActualTax, tdsTotal: totalTds, difference: 0, type: 'balanced' },
        };
    }

    const adjustment = Array(12).fill(0);
    let type = null;
    if (difference > 0) {
        adjustment[TAX_PAYMENT_MONTH] = -difference;
        type = 'additional_tax';
    } else {
        adjustment[TAX_REFUND_MONTH] = -difference;
        type = 'refund';
    }

    return {
        adjustment,
        meta: {
            applies: true,
            actualTax: totalActualTax,
            tdsTotal: totalTds,
            difference,
            type,
            paymentMonth: TAX_PAYMENT_MONTH,
            refundMonth: TAX_REFUND_MONTH,
            reason: difference > 0
                ? `Additional tax of ₹${difference.toLocaleString('en-IN')} (actual tax minus TDS deducted) assumed payable in ${MONTH_LABELS_LONG[TAX_PAYMENT_MONTH]}.`
                : `Refund of ₹${(-difference).toLocaleString('en-IN')} (TDS minus actual tax) assumed received in ${MONTH_LABELS_LONG[TAX_REFUND_MONTH]}.`,
        },
    };
}

const LEDGER_SYNC_KEYS = ['income', 'household', 'emi', 'insurance', 'savings'];

/** Sync active/future ledger months from monthly totals. Preserves past months and taxAdjustment. */
export function syncLedgerFromMonthlyTotals(ledger, totals = {}) {
    const currentMonth = new Date().getMonth();
    const prev = ledger || {};
    const monthlyTotals = {
        income: 0,
        household: 0,
        emi: 0,
        insurance: 0,
        savings: 0,
        ...totals,
    };

    let changed = false;
    const next = { ...prev };

    LEDGER_SYNC_KEYS.forEach((key) => {
        const sum = Math.round(monthlyTotals[key]) || 0;
        const prevArr = prev[key] || Array(12).fill(0);
        const newArr = [...prevArr];
        for (let i = currentMonth; i < 12; i++) {
            if (newArr[i] !== sum) {
                newArr[i] = sum;
                changed = true;
            }
        }
        next[key] = newArr;
    });

    const nextAdjustment = monthlyTotals.taxAdjustment ?? prev.taxAdjustment ?? Array(12).fill(0);
    const adjustmentChanged = JSON.stringify(nextAdjustment) !== JSON.stringify(prev.taxAdjustment || Array(12).fill(0));

    if (!changed && !adjustmentChanged) return prev;

    return {
        ...next,
        taxAdjustment: nextAdjustment,
    };
}

/** Resolve a 12-month ledger row, falling back to a flat monthly total when missing. */
export function resolveLedgerMonthlyRow(ledgerArray, fallbackMonthly = 0) {
    if (Array.isArray(ledgerArray) && ledgerArray.length === 12) {
        return ledgerArray.map(parseAmount);
    }
    return Array(12).fill(Math.round(parseAmount(fallbackMonthly)) || 0);
}

export function getMonthlyInsuranceTotal(expenseCategories = {}) {
    return Math.round(getEffectiveMonthlyInsurance(expenseCategories));
}

/** Effective income after tax adjustment for a month index. */
export function getAdjustedIncomeMonth(incomeArr, taxAdjustmentArr, monthIndex) {
    return parseAmount(incomeArr?.[monthIndex]) + parseAmount(taxAdjustmentArr?.[monthIndex]);
}

export const VIEW_MODES = {
    MONTHLY: 'monthly',
    QUARTERLY: 'quarterly',
    ANNUAL: 'annual',
};

const sumArrayRange = (arr, from, to) => (
    arr.slice(from, to + 1).reduce((s, v) => s + parseAmount(v), 0)
);

/** Replace values before plan start with null for display. */
export function maskValuesForPlanStart(values, planStartMonth) {
    const start = Math.min(Math.max(planStartMonth, 0), 11);
    return values.map((v, idx) => (idx < start ? null : parseAmount(v)));
}

/** YTD sum from plan start through current month (inclusive). */
export function computeYtdTotal(values, planStartMonth, currentMonth) {
    const start = Math.min(Math.max(planStartMonth, 0), 11);
    const end = Math.min(Math.max(currentMonth, 0), 11);
    if (end < start) return null;
    return Math.round(sumArrayRange(values, start, end));
}

export function aggregateToQuarterly(values, planStartMonth) {
    const start = Math.min(Math.max(planStartMonth, 0), 11);
    return [0, 1, 2, 3].map((q) => {
        const monthStart = q * 3;
        const monthEnd = q * 3 + 2;
        const activeStart = Math.max(monthStart, start);
        if (activeStart > monthEnd) return null;
        return Math.round(sumArrayRange(values, activeStart, monthEnd));
    });
}

export function aggregateToAnnual(values, planStartMonth) {
    const start = Math.min(Math.max(planStartMonth, 0), 11);
    if (start > 11) return null;
    return Math.round(sumArrayRange(values, start, 11));
}

export function getViewColumns(viewMode, currentMonth) {
    if (viewMode === VIEW_MODES.QUARTERLY) {
        const currentQuarter = Math.floor(currentMonth / 3);
        return ['Q1', 'Q2', 'Q3', 'Q4'].map((label, idx) => ({
            label,
            idx,
            isCurrent: idx === currentQuarter,
        }));
    }
    if (viewMode === VIEW_MODES.ANNUAL) {
        return [{ label: 'Full Year', idx: 0, isCurrent: true }];
    }
    return MONTH_LABELS_SHORT.map((label, idx) => ({
        label,
        idx,
        isCurrent: idx === currentMonth,
    }));
}

export function getDisplayValues(values, viewMode, planStartMonth) {
    if (viewMode === VIEW_MODES.QUARTERLY) {
        return aggregateToQuarterly(values, planStartMonth);
    }
    if (viewMode === VIEW_MODES.ANNUAL) {
        return [aggregateToAnnual(values, planStartMonth)];
    }
    return maskValuesForPlanStart(values, planStartMonth);
}

export function computeMoneyFlowInsights(report) {
    const { meta, baseline, ledger } = report;
    const { planStartMonth, currentMonth, currentMonthLabel } = meta;
    const insights = [];

    if (currentMonth >= planStartMonth) {
        const adjustedNow = ledger.adjustedIncome[currentMonth] || 0;
        const freeCashFlow = ledger.unallocatedSurplus[currentMonth] || 0;
        const householdNow = ledger.household[currentMonth] || 0;

        if (currentMonth > planStartMonth && currentMonth > 0) {
            const prevMonth = currentMonth - 1;
            if (prevMonth >= planStartMonth) {
                const householdPrev = ledger.household[prevMonth] || 0;
                if (householdPrev > 0 && householdNow !== householdPrev) {
                    const pctChange = Math.round(((householdNow - householdPrev) / householdPrev) * 100);
                    const prevLabel = MONTH_LABELS_LONG[prevMonth];
                    if (pctChange !== 0) {
                        const direction = pctChange > 0 ? 'increased' : 'decreased';
                        insights.push({
                            id: 'household-change',
                            text: `Household spending ${direction} by ${Math.abs(pctChange)}% from ${prevLabel}.`,
                            tone: pctChange > 0 ? 'warning' : 'positive',
                        });
                    }
                }
            }
        }

        if (adjustedNow > 0) {
            const emiBurden = Math.round((baseline.monthlyEmi / adjustedNow) * 100);
            insights.push({
                id: 'emi-burden',
                text: `EMI burden is ${emiBurden}% of income.`,
                tone: emiBurden > 40 ? 'warning' : 'neutral',
            });
        }

        if (freeCashFlow > 0) {
            insights.push({
                id: 'allocate-surplus',
                text: `Consider allocating unused surplus of ${formatInsightCurrency(freeCashFlow)}.`,
                tone: 'accent',
                actionTarget: '#ius-section',
            });
        }
    } else {
        insights.push({
            id: 'plan-not-started',
            text: `Your plan starts in ${meta.planStartMonthLabel}. Tracking figures will appear from that month.`,
            tone: 'neutral',
        });
    }

    return insights;
}

function formatInsightCurrency(value) {
    return `₹${Math.round(value || 0).toLocaleString('en-IN')}`;
}

export function buildYourMoneyFlowReport({
    currentYearLedger,
    planStartMonth,
    familyMembers,
    income,
    expenseCategories,
    hasSpouseIncome,
    resolveEmploymentType,
    journeyProjections,
    calendarYear = new Date().getFullYear(),
    currentMonth = new Date().getMonth(),
}) {
    const selfMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'self') || { name: 'Self' };
    const spouseMember = familyMembers?.find((m) => m.relation?.toLowerCase() === 'spouse');
    const selfType = resolveEmploymentType(selfMember);
    const salaryYearLabel = usesMarchFebruarySalaryYear(selfType)
        ? 'March – February'
        : 'April – March';

    const ledgerIncome = resolveLedgerMonthlyRow(currentYearLedger?.income);
    const ledgerHousehold = resolveLedgerMonthlyRow(currentYearLedger?.household);
    const taxAdjustment = currentYearLedger?.taxAdjustment || Array(12).fill(0);

    const monthlyEmi = Math.round(getEffectiveMonthlyEmi(expenseCategories));
    const monthlyInsurance = getMonthlyInsuranceTotal(expenseCategories);
    const monthlySavings = Math.round(getEffectiveMonthlySavings(expenseCategories));

    const ledgerEmi = resolveLedgerMonthlyRow(currentYearLedger?.emi, monthlyEmi);
    const ledgerInsurance = resolveLedgerMonthlyRow(currentYearLedger?.insurance, monthlyInsurance);
    const ledgerSavings = resolveLedgerMonthlyRow(currentYearLedger?.savings, monthlySavings);

    const baselineNetIncome = getLedgerNetIncomeMonthly(income, familyMembers, hasSpouseIncome, resolveEmploymentType);
    const baselineHousehold = getLedgerHouseholdMonthly(expenseCategories, familyMembers);

    const adjustedIncome = ledgerIncome.map((val, idx) => getAdjustedIncomeMonth(ledgerIncome, taxAdjustment, idx));
    const monthlySurplus = adjustedIncome.map((val, idx) => (
        Math.round(val - ledgerHousehold[idx] - ledgerEmi[idx] - ledgerInsurance[idx])
    ));
    const unallocatedSurplus = monthlySurplus.map((val, idx) => Math.round(val - ledgerSavings[idx]));

    const sumRange = (arr, from, to) => arr.slice(from, to + 1).reduce((s, v) => s + parseAmount(v), 0);

    const ytdEnd = currentMonth;
    const proratedStart = Math.min(Math.max(planStartMonth, 0), 11);
    const proratedEnd = 11;

    const year1Projection = journeyProjections?.find((p) => p.year === calendarYear);
    const year1NetInvestibleSurplus = year1Projection?.netInvestibleSurplus || 0;
    const remainingMonths = Math.max(1, 12 - proratedStart);
    const proratedNetInvestibleSurplus = (year1NetInvestibleSurplus / 12) * remainingMonths;

    const { meta: taxMeta } = computeTaxAdjustmentArray({
        income,
        familyMembers,
        hasSpouseIncome,
        resolveEmploymentType,
        calendarYear,
    });

    return {
        meta: {
            calendarYear,
            planStartMonth: proratedStart,
            planStartMonthLabel: MONTH_LABELS_LONG[proratedStart],
            currentMonth,
            currentMonthLabel: MONTH_LABELS_LONG[currentMonth],
            remainingMonths,
            salaryYearLabel,
            assessmentNote:
                'In FY 2026-27, income of PY 2025-26 is assessed. Tax adjustment applies from the next calendar year after your current ITR is filed.',
        },
        members: {
            selfName: selfMember.name || 'Self',
            spouseName: spouseMember?.name || 'Spouse',
        },
        baseline: {
            monthlyNetIncome: baselineNetIncome,
            monthlyHousehold: baselineHousehold,
            monthlyEmi,
            monthlyInsurance,
            monthlySavings,
        },
        taxAdjustmentMeta: taxMeta,
        ledger: {
            months: MONTH_LABELS_SHORT,
            income: ledgerIncome,
            taxAdjustment: taxAdjustment.map(parseAmount),
            adjustedIncome: adjustedIncome.map(Math.round),
            household: ledgerHousehold,
            emi: ledgerEmi,
            insurance: ledgerInsurance,
            monthlySurplus,
            savings: ledgerSavings,
            unallocatedSurplus,
        },
        totals: {
            ytdAdjustedIncome: sumRange(adjustedIncome, 0, ytdEnd),
            ytdHousehold: sumRange(ledgerHousehold, 0, ytdEnd),
            ytdSurplus: sumRange(monthlySurplus, 0, ytdEnd),
            ytdUnallocated: sumRange(unallocatedSurplus, 0, ytdEnd),
            proratedAdjustedIncome: sumRange(adjustedIncome, proratedStart, proratedEnd),
            proratedHousehold: sumRange(ledgerHousehold, proratedStart, proratedEnd),
            proratedSurplus: sumRange(monthlySurplus, proratedStart, proratedEnd),
            proratedUnallocated: sumRange(unallocatedSurplus, proratedStart, proratedEnd),
            fullYearSurplus: sumRange(monthlySurplus, 0, 11),
            fullYearUnallocated: sumRange(unallocatedSurplus, 0, 11),
        },
        journeyLink: {
            year1NetInvestibleSurplus,
            proratedNetInvestibleSurplus: Math.round(proratedNetInvestibleSurplus),
        },
    };
}
