import React from 'react';
import ProgressiveQuestionLayout from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const SummaryAssets = () => {
    const { assetCategories, setAssetCategories } = useFinancialPlan();

    const handleSnapshotChange = (field, value) => {
        setAssetCategories(prev => ({
            ...prev,
            [field]: value,
        }));
    };

    const formatInr = (val) => {
        if (!val || isNaN(val)) return '₹0';
        return new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
            maximumFractionDigits: 0
        }).format(val);
    };

    const narrative = "You've already created a meaningful financial foundation. Let me also understand your ongoing obligations so I can calculate your true financial position.";

    const questions = [
        // Q1: Investment Portfolio Value
        {
            id: 'portfolio-value',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Over the years, you must have built investments and wealth assets.
                    </p>
                    <h2 className="question-title">
                        What is the current value of your investment portfolio?
                    </h2>
                    <p className="question-helper">
                        Mutual Funds, Stocks, ETFs, Bonds, etc.
                    </p>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                            Portfolio Value
                        </label>
                        <div className="currency-input-wrapper">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                className="conversational-input"
                                placeholder="e.g. 500000"
                                value={assetCategories.summaryPortfolioValue || ''}
                                onChange={(e) => handleSnapshotChange('summaryPortfolioValue', e.target.value)}
                            />
                        </div>
                        {assetCategories.summaryPortfolioValue && (
                            <div className="currency-display">
                                {formatInr(assetCategories.summaryPortfolioValue)}
                            </div>
                        )}
                    </div>
                </div>
            )
        },
        // Q2: Liquid Cash / Emergency Fund
        {
            id: 'emergency-fund',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Financial confidence also comes from liquidity.
                    </p>
                    <h2 className="question-title">
                        How much emergency or readily available cash do you currently maintain?
                    </h2>
                    <p className="question-helper">
                        Savings Account balance, emergency funds, liquid funds, cash reserves, etc.
                    </p>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                            Liquid Cash / Emergency Fund
                        </label>
                        <div className="currency-input-wrapper">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                className="conversational-input"
                                placeholder="e.g. 200000"
                                value={assetCategories.summaryLiquidCash || ''}
                                onChange={(e) => handleSnapshotChange('summaryLiquidCash', e.target.value)}
                            />
                        </div>
                        {assetCategories.summaryLiquidCash && (
                            <div className="currency-display">
                                {formatInr(assetCategories.summaryLiquidCash)}
                            </div>
                        )}
                    </div>
                </div>
            )
        },
        // Q3: Real Estate / High-Value Assets
        {
            id: 'real-estate-assets',
            content: (
                <div className="question-container">
                    <h2 className="question-title">
                        Do you own any real estate or high-value assets?
                    </h2>
                    <p className="question-helper">
                        Property, land, gold, commercial assets, valuable possessions, etc.
                    </p>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.2rem', display: 'block' }}>
                            Current Asset Value
                        </label>
                        <div className="currency-input-wrapper">
                            <span className="currency-symbol">₹</span>
                            <input
                                type="number"
                                className="conversational-input"
                                placeholder="e.g. 5000000"
                                value={assetCategories.summaryRealEstateAssets || ''}
                                onChange={(e) => handleSnapshotChange('summaryRealEstateAssets', e.target.value)}
                            />
                        </div>
                        {assetCategories.summaryRealEstateAssets && (
                            <div className="currency-display">
                                {formatInr(assetCategories.summaryRealEstateAssets)}
                            </div>
                        )}
                    </div>
                </div>
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
