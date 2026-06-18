import React from 'react';
import {
    calculateIncomeTaxFromDetail,
    showPensionerTaxNote,
    showInHandSalaryEstimateNote,
    PENSIONER_STANDARD_DEDUCTION_NOTE,
    IN_HAND_SALARY_ESTIMATE_NOTE,
} from './IncomeTaxLogic';
import IncomeTaxOutput from './IncomeTaxOutput';
import { guessEmploymentTypeFromSummaryOccupation } from '../DetailedFlow/employmentTypeSync';
import { createEmptyIncomeDetail } from '../DetailedFlow/incomeDetailSync';

const resolveEmploymentType = (member) => (
    member?.employmentType || guessEmploymentTypeFromSummaryOccupation(member?.occupation) || 'Private Sector'
);

const IncomeTaxModule = ({ familyMembers, income, onNext, onBack, isCalculatorMode = false }) => {
    const selfMember = familyMembers.find(m => m.relation?.toLowerCase() === 'self') || { name: 'Self', occupation: 'Salaried' };
    const spouseMember = familyMembers.find(m => m.relation?.toLowerCase() === 'spouse');

    const isSpouseHousewife = spouseMember?.occupation?.toLowerCase() === 'housewife';

    const selfEmploymentType = resolveEmploymentType(selfMember);
    const spouseEmploymentType = resolveEmploymentType(spouseMember);

    const selfDetail = income.selfDetail || createEmptyIncomeDetail();
    const spouseDetail = income.spouseDetail || createEmptyIncomeDetail();

    const selfTaxResults = calculateIncomeTaxFromDetail(selfDetail, selfEmploymentType);

    let spouseTaxResults = null;
    if (spouseMember && !isSpouseHousewife) {
        spouseTaxResults = calculateIncomeTaxFromDetail(spouseDetail, spouseEmploymentType);
    }

    const renderMemberTax = (member, employmentType, detail, taxResults) => (
        <>
            {showInHandSalaryEstimateNote(detail, employmentType) && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: '#f0f9ff',
                    borderLeft: '4px solid #0284c7',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem',
                    color: '#0c4a6e',
                }}>
                    {IN_HAND_SALARY_ESTIMATE_NOTE}
                </div>
            )}
            {showPensionerTaxNote(employmentType) && (
                <div style={{
                    padding: '0.75rem 1rem',
                    background: '#fefce8',
                    borderLeft: '4px solid #ca8a04',
                    borderRadius: '4px',
                    marginBottom: '1rem',
                    fontSize: '0.85rem',
                    color: '#854d0e',
                }}>
                    <strong>Assumption:</strong> {PENSIONER_STANDARD_DEDUCTION_NOTE}
                </div>
            )}
            <IncomeTaxOutput results={taxResults} />
        </>
    );

    return (
        <div className="fade-in" style={{ marginTop: '2rem' }}>
            <div className="card">
                <div style={{ padding: '1rem', background: '#eff6ff', borderLeft: '4px solid #2563eb', borderRadius: '4px', marginBottom: '2rem' }}>
                    <h4 style={{ margin: '0 0 0.5rem 0', color: '#1e40af' }}>Tax Calculation Info</h4>
                    <p style={{ margin: 0, fontSize: '0.9rem', color: '#1e3a8a' }}>
                        Tax calculation is based on the <strong>New Tax Regime (FY 2025-26)</strong>.
                        The tax calculated here is an approximation and should not be taken as the actual tax liability.
                    </p>
                </div>

                <h1 style={{ marginBottom: '0.5rem' }}>Income Tax Estimation (Step 8)</h1>
                <p className="text-muted" style={{ marginBottom: '2rem' }}>
                    A breakdown of your projected annual income tax based on the latest regime rules.
                </p>

                <div className="tax-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', gap: '2rem' }}>
                    <div>
                        <h2 style={{ color: 'var(--primary)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                            {selfMember.name || 'Self'}'s Tax ({selfMember.employmentType || selfMember.occupation})
                        </h2>
                        {renderMemberTax(selfMember, selfEmploymentType, selfDetail, selfTaxResults)}
                    </div>

                    {spouseMember && (
                        <div>
                            <h2 style={{ color: 'var(--accent)', borderBottom: '2px solid var(--border)', paddingBottom: '0.5rem' }}>
                                {spouseMember.name || 'Spouse'}'s Tax ({spouseMember.employmentType || spouseMember.occupation})
                            </h2>
                            {isSpouseHousewife ? (
                                <div style={{ padding: '2rem', textAlign: 'center', background: 'var(--bg-main)', borderRadius: '8px', marginTop: '1rem' }}>
                                    <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>
                                        No tax calculation applicable for Housewife as there is no active income source.
                                    </p>
                                </div>
                            ) : (
                                renderMemberTax(spouseMember, spouseEmploymentType, spouseDetail, spouseTaxResults)
                            )}
                        </div>
                    )}
                </div>

                {!isCalculatorMode && (
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginTop: '3rem', marginBottom: '2rem' }}>
                        <button className="btn btn-secondary" onClick={onBack} style={{ padding: '1rem 3rem' }}>
                            Back to Life Goals
                        </button>
                        <button className="btn btn-primary" onClick={onNext} style={{ padding: '1rem 3rem' }}>
                            Proceed to Journey Roadmap
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default IncomeTaxModule;
