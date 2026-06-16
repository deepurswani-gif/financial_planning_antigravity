import { describe, it, expect } from 'vitest';
import {
    getAssetAmount,
    sumFixedDeposits,
    migrateLegacyOtherAsset,
    classifyWealthSnapshot,
    hasWealthDetailEntered,
    hasLiabilityDetailEntered,
    syncSummaryWealthSnapshots,
    initializeWealthSnapshots,
    getSummaryAssetTotal,
    reconcileWealthBuckets,
    getPortfolioBreakdownTotal,
} from './wealthDetailSync';

describe('wealthDetailSync', () => {
    it('sums configured FD objects in an array', () => {
        const fds = [{ amount: 100000 }, { amount: 250000 }, ''];
        expect(sumFixedDeposits(fds)).toBe(350000);
    });

    it('migrates legacy summary scalars into snapshot fields and clears detail fields', () => {
        const result = initializeWealthSnapshots(
            {
                investments: { mutualFunds: '500000', equity: '', fixedDeposit: '' },
                cash: { savings: '200000', cashInHand: '' },
                realEstate: { residential: '5000000', secondProperty: '', landPlot: '' },
                insurance: { ulip: '' },
                retirement: { epf: '', ppf: '', nps: '' },
                custom: [],
            },
            {
                loans: { home: '3500000', personal: '100000', creditCard: '45000', car: '', education: '', otherEmis: '' },
                custom: [],
            },
        );

        expect(result.assetCategories.summaryPortfolioValue).toBe('500000');
        expect(result.assetCategories.summaryLiquidCash).toBe('200000');
        expect(result.assetCategories.summaryRealEstateAssets).toBe('5000000');
        expect(result.liabilityCategories.summaryOutstandingLoans).toBe('3500000');
        expect(result.liabilityCategories.summaryCreditCardDues).toBe('45000');
        expect(result.liabilityCategories.summaryOtherPayables).toBe('100000');

        expect(result.assetCategories.investments.mutualFunds).toBe('');
        expect(result.assetCategories.cash.savings).toBe('');
        expect(result.assetCategories.realEstate.residential).toBe('');
        expect(result.liabilityCategories.loans.home).toBe('');
        expect(result.liabilityCategories.loans.creditCard).toBe('');
        expect(result.liabilityCategories.loans.personal).toBe('');
    });

    it('preserves detailed breakdown once user has entered it', () => {
        const result = initializeWealthSnapshots(
            {
                summaryPortfolioValue: '500000',
                investments: { mutualFunds: '300000', equity: '200000', fixedDeposit: '' },
                cash: { savings: '', cashInHand: '' },
                realEstate: { residential: '1000000', secondProperty: '', landPlot: '' },
                insurance: { ulip: '' },
                retirement: { epf: '', ppf: '', nps: '' },
                custom: [],
            },
            { loans: { home: '', personal: '', car: '', education: '', otherEmis: '', creditCard: '' }, custom: [] },
        );

        expect(result.assetCategories.investments.mutualFunds).toBe('300000');
        expect(result.assetCategories.realEstate.residential).toBe('1000000');
    });

    it('migrates others.other into custom and clears legacy key', () => {
        const result = migrateLegacyOtherAsset({
            others: { other: '120000' },
            custom: [],
        });
        expect(result.others.other).toBe('');
        expect(result.custom).toHaveLength(1);
        expect(result.custom[0].label).toBe('Other Assets');
        expect(result.custom[0].value).toBe('120000');
    });

    it('classifies landPlot as income and residential as legacy', () => {
        const result = classifyWealthSnapshot({
            realEstate: { residential: 5000000, landPlot: 800000 },
            cash: { savings: '', cashInHand: '' },
            investments: { equity: '', mutualFunds: '', fixedDeposit: '' },
            insurance: { ulip: '' },
            retirement: { epf: '', ppf: '', nps: '' },
            custom: [],
        });
        expect(result.legacyTotal).toBe(5000000);
        expect(result.incomeTotal).toBe(800000);
    });

    it('summary totals use snapshot fields only', () => {
        const synced = syncSummaryWealthSnapshots(
            { investments: { mutualFunds: '400000' }, cash: { savings: '50000' }, realEstate: { residential: '2000000' } },
            { loans: { home: '1000000', creditCard: '10000', personal: '' } },
        );
        expect(getSummaryAssetTotal({
            summaryPortfolioValue: synced.summaryPortfolioValue,
            summaryLiquidCash: synced.summaryLiquidCash,
            summaryRealEstateAssets: synced.summaryRealEstateAssets,
        })).toBe(2450000);
    });

    it('detects liability detail entry separately from summary snapshots', () => {
        expect(hasLiabilityDetailEntered({ loans: { home: '100000', car: '50000' } })).toBe(true);
        expect(hasLiabilityDetailEntered({ loans: { home: '100000' } })).toBe(false);
        expect(hasLiabilityDetailEntered({
            summaryOutstandingLoans: '100000',
            loans: { home: '', car: '', personal: '', education: '', otherEmis: '', creditCard: '' },
        })).toBe(false);
    });

    it('detects asset detail beyond summary scalars', () => {
        expect(hasWealthDetailEntered({
            summaryPortfolioValue: '500000',
            investments: { mutualFunds: '', equity: '100000' },
        })).toBe(true);
    });

    it('reconcileWealthBuckets compares portfolio summary vs detailed total', () => {
        const buckets = reconcileWealthBuckets({
            summaryPortfolioValue: '500000',
            investments: { equity: '300000', mutualFunds: '100000', fixedDeposit: '' },
            retirement: { epf: '', ppf: '', nps: '' },
            insurance: { ulip: '' },
            realEstate: { landPlot: '' },
        });
        expect(buckets.portfolio.status).toBe('under');
        expect(getPortfolioBreakdownTotal({
            investments: { equity: '300000', mutualFunds: '100000' },
        })).toBe(400000);
    });
});
