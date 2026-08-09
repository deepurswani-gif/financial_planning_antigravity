import React from 'react';
import ProgressiveQuestionLayout, { useProgressiveAdvance } from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { formatInrInWords } from '../../lib/formatInrInWords';
import { syncEmergencyFundAmount } from '../DetailedFlow/wealthDetailSync';
import CurrencyInput from '../common/CurrencyInput';

const toStored = (v) => (v == null ? '' : String(v));

const CurrentAssetsScreen = ({ assetCategories, handleSnapshotChange }) => {
    const { advance } = useProgressiveAdvance();
    return (
        <div className="question-container">
            <p className="question-narrative">
                Let&apos;s understand what you&apos;ve already built.
            </p>

            <h2 className="question-title">
                Investment Portfolio Value <span className="tooltip-wrapper" data-tooltip="Total current value of your Mutual Funds, Stocks, ETFs, Bonds, etc." style={{ cursor: 'help', color: 'var(--primary)', fontSize: '0.8em', verticalAlign: 'middle' }}>ⓘ</span>
            </h2>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Portfolio Value
                </label>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 500000"
                    value={assetCategories.summaryPortfolioValue || ''}
                    onValueChange={(v) => handleSnapshotChange('summaryPortfolioValue', toStored(v))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') advance();
                    }}
                    enterKeyHint="done"
                />
                {assetCategories.summaryPortfolioValue && (
                    <div className="currency-display">
                        {formatInrInWords(assetCategories.summaryPortfolioValue)}
                    </div>
                )}
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
                Liquid Cash / Emergency Fund <span className="tooltip-wrapper" data-tooltip="Readily available cash in Savings Accounts, emergency funds, liquid funds, etc." style={{ cursor: 'help', color: 'var(--primary)', fontSize: '0.8em', verticalAlign: 'middle' }}>ⓘ</span>
            </h2>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Liquid Cash / Emergency Fund
                </label>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 200000"
                    value={assetCategories.summaryLiquidCash || ''}
                    onValueChange={(v) => handleSnapshotChange('summaryLiquidCash', toStored(v))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') advance();
                    }}
                    enterKeyHint="done"
                />
                {assetCategories.summaryLiquidCash && (
                    <div className="currency-display">
                        {formatInrInWords(assetCategories.summaryLiquidCash)}
                    </div>
                )}
            </div>

            <h2 className="question-title" style={{ marginTop: '2rem' }}>
                Real Estate & High-Value Assets <span className="tooltip-wrapper" data-tooltip="Estimated current value of Property, land, gold, commercial assets, etc." style={{ cursor: 'help', color: 'var(--primary)', fontSize: '0.8em', verticalAlign: 'middle' }}>ⓘ</span>
            </h2>

            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                    Current Asset Value
                </label>
                <CurrencyInput
                    className="conversational-input"
                    placeholder="e.g. 5000000"
                    value={assetCategories.summaryRealEstateAssets || ''}
                    onValueChange={(v) => handleSnapshotChange('summaryRealEstateAssets', toStored(v))}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') advance();
                    }}
                    enterKeyHint="done"
                />
                {assetCategories.summaryRealEstateAssets && (
                    <div className="currency-display">
                        {formatInrInWords(assetCategories.summaryRealEstateAssets)}
                    </div>
                )}
            </div>
        </div>
    );
};

const SummaryAssets = () => {
    const { assetCategories, setAssetCategories } = useFinancialPlan();

    const handleSnapshotChange = (field, value) => {
        setAssetCategories((prev) => {
            if (field === 'summaryLiquidCash') {
                return syncEmergencyFundAmount(prev, value);
            }
            return {
                ...prev,
                [field]: value,
            };
        });
    };

    const narrative = "Almost there! Now let's capture your financial commitments.";

    const questions = [
        {
            id: 'current-assets',
            content: (
                <CurrentAssetsScreen
                    assetCategories={assetCategories}
                    handleSnapshotChange={handleSnapshotChange}
                />
            )
        }
    ];

    return (
        <ProgressiveQuestionLayout
            currentStepId="assets"
            questions={questions}
            narrative={narrative}
        />
    );
};

export default SummaryAssets;
