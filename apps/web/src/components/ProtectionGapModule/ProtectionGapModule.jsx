import React, { useState, useEffect } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import ProtectionGapOutput from './ProtectionGapOutput';
import FinancialPyramid from './FinancialPyramid';
import { calculateProtectionGap } from './ProtectionGapLogic';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

const ProtectionGapModule = ({ onNext, onBack }) => {
    const { familyMembers, expenseCategories, policies, assetCategories, liabilityCategories, calculatorInputs, proposedSIPs, proposedEquities, goals, goalMappings, income, inflationRates } = useFinancialPlan();
    const [results, setResults] = useState(null);

    useEffect(() => {
        const calculated = calculateProtectionGap(expenseCategories, policies, familyMembers, income, inflationRates, calculatorInputs, goals, assetCategories, liabilityCategories);
        setResults(calculated);
    }, [expenseCategories, policies, familyMembers, income, inflationRates, calculatorInputs, goals, assetCategories, liabilityCategories]);

    return (
        <div className="fade-in" style={{ marginTop: '2rem' }}>
            <div className="card" style={{ marginBottom: '2rem' }}>
                <h1>Protection Gap Analysis (Module 6)</h1>
                <p className="text-muted" style={{ marginBottom: '1.5rem' }}>
                    We analyze the gap between your Human Life Value (HLV) and your existing life insurance coverage.
                </p>

                <div style={{ background: 'var(--bg-main)', padding: '1rem', borderRadius: '8px', fontSize: '0.9rem', border: '1px solid var(--border)' }}>
                    <strong>Note:</strong> Multiplier of 200x monthly expenses is used to estimate the capital required to sustain your family's lifestyle in your absence.
                </div>
            </div>

            <FinancialPyramid 
                expenseCategories={expenseCategories}
                policies={policies}
                assetCategories={assetCategories}
                calculatorInputs={calculatorInputs}
                proposedSIPs={proposedSIPs}
                proposedEquities={proposedEquities}
                goals={goals}
                goalMappings={goalMappings}
                protectionGapResults={results}
            />

            <ProtectionGapOutput results={results} familyMembers={familyMembers} />

            <div className="sticky-action-bar">
                <button className="btn btn-secondary" onClick={onBack} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <ChevronLeft size={20} />
                    Back to Insurance
                </button>
                <button className="btn btn-primary" onClick={onNext} style={{ padding: '0.75rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: 'var(--shadow-md)' }}>
                    Proceed to Contingency Planning
                    <ChevronRight size={20} />
                </button>
            </div>
        </div>
    );
};

export default ProtectionGapModule;
