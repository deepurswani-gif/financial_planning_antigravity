import React, { useMemo, useState, useCallback } from 'react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import {
    FREQUENCY_OPTIONS,
    getMemberInsuranceKey,
    migrateLifeEntry,
    applyLifeEntryUpdate,
    getLifeMemberMonthlyTotal,
    syncPolicySlots,
} from '../../DetailedFlow/insuranceDetailSync';
import CurrencyInput from '../../common/CurrencyInput';
import IntegerInput from '../../common/IntegerInput';
import LifePolicyDetailsModal from '../../DetailedFlow/LifePolicyDetailsModal';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

const toStored = (v) => (v == null ? '' : String(v));

const CurrencyField = ({ label, value, onChange, placeholder = '0' }) => (
    <div>
        {label && (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block', color: 'var(--text-main)' }}>
                {label}
            </label>
        )}
        <CurrencyInput
            className="conversational-input"
            placeholder={placeholder}
            value={value ?? ''}
            onValueChange={(v) => onChange(toStored(v))}
        />
    </div>
);

const FrequencySelect = ({ value, onChange }) => (
    <div>
        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block', color: 'var(--text-main)' }}>
            Frequency
        </label>
        <select
            className="conversational-input conversational-select"
            value={value || 'Annual'}
            onChange={(e) => onChange(e.target.value)}
        >
            {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
        </select>
    </div>
);

const UserNote = ({ children }) => (
    <div style={{
        fontWeight: 500,
        fontSize: '0.85rem',
        color: 'var(--primary)',
        marginTop: '0.75rem',
        marginBottom: '1rem',
        background: 'rgba(37, 99, 235, 0.05)',
        padding: '0.65rem 0.85rem',
        borderRadius: '8px',
        borderLeft: '4px solid var(--primary)',
        lineHeight: 1.5,
    }}>
        {children}
    </div>
);

const BreakdownInsurance = () => {
    const {
        familyMembers,
        expenseCategories,
        setExpenseCategories,
        policies,
        setPolicies,
    } = useFinancialPlan();

    const [showPolicyDetailsModal, setShowPolicyDetailsModal] = useState(false);

    const insurance = expenseCategories.insurance || {};
    const lifeMap = insurance.life || {};

    const handleInsurancePremiumChange = useCallback((key, field, value) => {
        setExpenseCategories((prev) => ({
            ...prev,
            insurance: {
                ...prev.insurance,
                [key]: {
                    ...prev.insurance?.[key],
                    [field]: value,
                },
            },
        }));
    }, [setExpenseCategories]);

    const updateLifeMember = useCallback((member, updater) => {
        const memberKey = getMemberInsuranceKey(member);
        const memberName = member.name || member.relation;
        setExpenseCategories((prev) => {
            const current = migrateLifeEntry(prev.insurance?.life?.[memberKey]);
            const updatedEntry = typeof updater === 'function'
                ? updater(current)
                : applyLifeEntryUpdate(current, updater);

            setPolicies((p) => syncPolicySlots(
                memberName,
                updatedEntry.policyCount,
                p,
                updatedEntry.premiums,
                false,
            ));

            return {
                ...prev,
                insurance: {
                    ...prev.insurance,
                    life: {
                        ...prev.insurance?.life,
                        [memberKey]: updatedEntry,
                    },
                },
            };
        });
    }, [setExpenseCategories, setPolicies]);

    const adultLifeMembers = useMemo(
        () => familyMembers.filter((m) => m.relation === 'Self' || m.relation === 'Spouse'),
        [familyMembers],
    );

    const childLifeMembers = useMemo(
        () => familyMembers.filter((m) => m.relation === 'Child'),
        [familyMembers],
    );

    const renderInsuranceLine = (key, label) => (
        <div key={key} style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #eaeaea' }}>
            <div style={{ fontSize: '1rem', fontWeight: 600, color: '#111', marginBottom: '1rem' }}>
                {label}
            </div>
            <div style={{ display: 'grid', gap: '1rem' }}>
                <CurrencyField
                    label="Premium amount"
                    value={insurance[key]?.value}
                    onChange={(v) => handleInsurancePremiumChange(key, 'value', v)}
                />
                <FrequencySelect
                    value={insurance[key]?.frequency}
                    onChange={(v) => handleInsurancePremiumChange(key, 'frequency', v)}
                />
            </div>
        </div>
    );

    const renderLifeMemberBlock = (member) => {
        const memberKey = getMemberInsuranceKey(member);
        const displayName = member.name || member.relation;
        const entry = migrateLifeEntry(lifeMap[memberKey]);
        const monthlyTotal = getLifeMemberMonthlyTotal(entry);

        return (
            <div
                key={memberKey}
                style={{
                    marginBottom: '1.5rem',
                    paddingBottom: '1.5rem',
                    borderBottom: '1px solid #eaeaea',
                }}
            >
                <div style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: '#111' }}>
                    {displayName}
                    {member.relation !== 'Self' && member.relation !== 'Spouse' && (
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                            {' '}({member.relation})
                        </span>
                    )}
                </div>

                <div style={{ marginBottom: '1rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block', color: 'var(--text-main)' }}>
                        Number of policies
                    </label>
                    <IntegerInput
                        min={0}
                        className="conversational-input"
                        placeholder="0"
                        value={entry.policyCount || ''}
                        onValueChange={(v) => {
                            if (v == null) {
                                updateLifeMember(member, () => applyLifeEntryUpdate(entry, { policyCount: 0 }));
                                return;
                            }
                            const count = Math.max(0, v);
                            updateLifeMember(member, () => applyLifeEntryUpdate(entry, { policyCount: count }));
                        }}
                    />
                </div>

                {entry.premiums.map((row, idx) => (
                    <div
                        key={`${memberKey}-policy-${idx}`}
                        style={{
                            marginBottom: '1rem',
                            padding: '1rem',
                            background: '#fdfdfd',
                            borderRadius: '8px',
                            border: '1px solid #eaeaea',
                        }}
                    >
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#555', marginBottom: '0.75rem' }}>
                            Policy {idx + 1}
                        </div>
                        <div style={{ display: 'grid', gap: '1rem' }}>
                            <CurrencyField
                                label="Premium amount"
                                value={row.amount}
                                onChange={(v) => {
                                    const premiums = entry.premiums.map((p, i) =>
                                        i === idx ? { ...p, amount: v } : p,
                                    );
                                    updateLifeMember(member, () => applyLifeEntryUpdate(entry, { premiums }));
                                }}
                            />
                            <FrequencySelect
                                value={row.frequency}
                                onChange={(v) => {
                                    const premiums = entry.premiums.map((p, i) =>
                                        i === idx ? { ...p, frequency: v } : p,
                                    );
                                    updateLifeMember(member, () => applyLifeEntryUpdate(entry, { premiums }));
                                }}
                            />
                            
                            {/* Fill Policy Details directly below the premium amount per user request */}
                            <button
                                type="button"
                                className="btn btn-secondary"
                                style={{
                                    width: '100%',
                                    marginTop: '0.5rem',
                                    borderStyle: 'dashed',
                                    borderColor: 'var(--primary)',
                                    color: 'var(--primary)',
                                    fontWeight: 600,
                                }}
                                onClick={() => setShowPolicyDetailsModal(true)}
                            >
                                Fill policy details (Policy {idx + 1})
                            </button>
                        </div>
                    </div>
                ))}

                {monthlyTotal > 0 && (
                    <div style={{ fontSize: '0.9rem', color: 'var(--primary)', fontWeight: 600 }}>
                        Total for {displayName}: {formatInr(monthlyTotal)} / month
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="breakdown-insurance-container">
            {renderInsuranceLine('health', 'Health Insurance')}
            
            <div style={{ marginBottom: '1.5rem', paddingBottom: '1.5rem', borderBottom: '1px solid #eaeaea' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#111', marginBottom: '1rem', marginTop: 0 }}>Life Insurance</h3>
                
                {adultLifeMembers.map(renderLifeMemberBlock)}
                
                {childLifeMembers.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                        <div style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '1rem', paddingTop: '1rem', borderTop: '1px solid #eaeaea' }}>
                            Children's life insurance
                        </div>
                        {childLifeMembers.map(renderLifeMemberBlock)}
                    </div>
                )}
            </div>

            {renderInsuranceLine('car', 'Car Insurance')}
            {renderInsuranceLine('bike', 'Two-wheeler Insurance')}
            {renderInsuranceLine('others', 'Other Insurance (Property, etc.)')}
            
            <UserNote>
                You can upload all your PDFs safely in the Document Vault.
            </UserNote>
            
            {showPolicyDetailsModal && (
                <LifePolicyDetailsModal
                    isOpen={showPolicyDetailsModal}
                    onClose={() => setShowPolicyDetailsModal(false)}
                    familyMembers={familyMembers}
                    policies={policies}
                    setPolicies={setPolicies}
                />
            )}
        </div>
    );
};

export default BreakdownInsurance;
