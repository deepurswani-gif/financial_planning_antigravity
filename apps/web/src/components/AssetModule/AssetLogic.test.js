import { describe, it, expect } from 'vitest';
import { calculateNetWorth } from './AssetLogic';

describe('AssetLogic', () => {
    it('calculates Net Worth correctly', () => {
        const assetCategories = {
            investments: { equity: 100000, mutualFunds: 50000 },
            retirement: { ppf: 50000 },
            realEstate: { residential: 5000000 },
            valuables: { gold: 200000 }
        };
        const liabilityCategories = {
            loans: { home: 1000000, car: 200000 }
        };

        const results = calculateNetWorth(assetCategories, liabilityCategories);

        expect(results.totalAssets).toBe(5400000);
        expect(results.totalLiabilities).toBe(1200000);
        expect(results.netWorth).toBe(4200000);
    });

    it('includes summary snapshot totals when detail fields are blank', () => {
        const assetCategories = {
            summaryPortfolioValue: '500000',
            summaryLiquidCash: '200000',
            summaryRealEstateAssets: '5000000',
            investments: { equity: '', mutualFunds: '' },
            cash: { savings: '', cashInHand: '' },
            realEstate: { residential: '', secondProperty: '', landPlot: '' },
        };
        const liabilityCategories = {
            summaryOutstandingLoans: '1000000',
            summaryCreditCardDues: '50000',
            summaryOtherPayables: '100000',
            loans: { home: '', personal: '', car: '', education: '', otherEmis: '', creditCard: '' },
        };

        const results = calculateNetWorth(assetCategories, liabilityCategories);

        expect(results.totalAssets).toBe(5700000);
        expect(results.totalLiabilities).toBe(1150000);
        expect(results.netWorth).toBe(4550000);
    });

    it('calculates asset allocation percentages correctly', () => {
        const assetCategories = {
            investments: { equity: 30000, fixedDeposit: 70000 }
        };
        const liabilityCategories = { loans: {} };

        const results = calculateNetWorth(assetCategories, liabilityCategories);

        // All fields are in 'investments' category now, so one slice in allocation
        expect(results.allocation).toContainEqual({ name: 'Investments', value: 100000, percentage: 100 });
    });
});
