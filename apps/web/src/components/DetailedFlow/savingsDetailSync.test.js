import { describe, it, expect } from 'vitest';
import {
    initializeSavingsSnapshots,
    syncSummarySavingsSnapshots,
    getEffectiveMonthlySavings,
    getGrowthSavingsMonthly,
    getSavingsMonthlyAmount,
    sumConfiguredSavings,
    buildSavingsBreakdownAnnual,
} from './savingsDetailSync';

describe('savingsDetailSync', () => {
    it('migrates legacy savings.sip scalar to summaryMonthlyInvestments when no snapshot exists', () => {
        const result = initializeSavingsSnapshots({
            savings: { sip: '15000', ppf: '', nps: '', rd: '', otherSaving: '' },
            summaryMonthlyInvestments: '',
            summaryOtherSavings: '',
        });

        expect(result.summaryMonthlyInvestments).toBe('15000');
        expect(result.savings.sip).toBe('');
    });

    it('migrates legacy savings.otherSaving scalar to summaryOtherSavings', () => {
        const result = initializeSavingsSnapshots({
            savings: { sip: '', ppf: '', nps: '', rd: '', otherSaving: '5000' },
            summaryMonthlyInvestments: '',
            summaryOtherSavings: '',
        });

        expect(result.summaryOtherSavings).toBe('5000');
        expect(result.savings.otherSaving).toBe('');
    });

    it('preserves configured savings breakdown and does not overwrite snapshots from scalars', () => {
        const configuredPpf = {
            amount: 5000,
            startMonth: 4,
            startYear: 2024,
            duration: 15,
        };
        const result = initializeSavingsSnapshots({
            savings: { sip: '3000', ppf: configuredPpf, nps: '', rd: '', otherSaving: '' },
            summaryMonthlyInvestments: '15000',
            summaryOtherSavings: '',
        });

        expect(result.savings.ppf).toEqual(configuredPpf);
        expect(result.savings.sip).toBe('3000');
        expect(result.summaryMonthlyInvestments).toBe('15000');
    });

    it('getEffectiveMonthlySavings uses snapshot totals when detailed fields are cleared', () => {
        expect(getEffectiveMonthlySavings({
            summaryMonthlyInvestments: '15000',
            summaryOtherSavings: '5000',
            savings: { sip: '', ppf: '', nps: '', rd: '', otherSaving: '' },
        })).toBe(20000);
    });

    it('getEffectiveMonthlySavings prefers configured savings over snapshot', () => {
        expect(getEffectiveMonthlySavings({
            summaryMonthlyInvestments: '15000',
            summaryOtherSavings: '5000',
            savings: {
                sip: '8000',
                ppf: '',
                nps: '',
                rd: '',
                otherSaving: '2000',
            },
        })).toBe(10000);
    });

    it('getGrowthSavingsMonthly sums SIP + PPF + NPS and excludes RD/other', () => {
        expect(getGrowthSavingsMonthly({
            savings: {
                sip: { amount: '10000' },
                ppf: { amount: '2000' },
                nps: { amount: '3000' },
                rd: { amount: '5000' },
                otherSaving: { amount: '1000' },
            },
        })).toBe(15000);
    });

    it('sums RD array amounts', () => {
        expect(getSavingsMonthlyAmount([
            { amount: 3000 },
            { amount: 2000 },
        ])).toBe(5000);
        expect(sumConfiguredSavings({
            sip: '1000',
            rd: [{ amount: 3000 }, { amount: 2000 }],
        })).toBe(6000);
    });

    it('syncSummarySavingsSnapshots replaces rather than accumulates', () => {
        expect(syncSummarySavingsSnapshots({
            summaryMonthlyInvestments: '10000',
            savings: { sip: '20000', otherSaving: '' },
        }).summaryMonthlyInvestments).toBe('20000');
    });

    it('buildSavingsBreakdownAnnual uses snapshots when no configured breakdown', () => {
        const breakdown = buildSavingsBreakdownAnnual({
            summaryMonthlyInvestments: '12000',
            summaryOtherSavings: '3000',
            savings: { sip: '', ppf: '', nps: '', rd: '', otherSaving: '' },
        });

        expect(breakdown.sip).toBe(144000);
        expect(breakdown.otherSaving).toBe(36000);
        expect(breakdown.ppf).toBe(0);
    });
});
