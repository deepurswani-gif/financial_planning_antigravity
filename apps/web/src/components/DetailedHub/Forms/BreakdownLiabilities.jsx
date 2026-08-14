import React from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useWealthSnapshotQuestions } from '../../DetailedFlow/useWealthSnapshotQuestions';
import CurrencyInput from '../../common/CurrencyInput';

const toStored = (v) => (v == null ? '' : String(v));

const CurrencyField = ({ label, value, onChange, placeholder = '0', readOnly, onClick }) => (
    <div style={{ marginBottom: '1rem' }}>
        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
            {label}
        </label>
        <CurrencyInput
            className="conversational-input"
            placeholder={placeholder}
            value={value ?? ''}
            readOnly={readOnly}
            onClick={onClick}
            onValueChange={(v) => {
                if (!readOnly && onChange) onChange(toStored(v));
            }}
            style={readOnly ? { cursor: 'pointer', background: '#f8fafc', fontWeight: 600 } : undefined}
        />
    </div>
);

const LIABILITY_FIELDS = [
    { key: 'home', label: 'Home Loan (Outstanding Principal)' },
    { key: 'personal', label: 'Personal Loan (Outstanding Principal)' },
    { key: 'car', label: 'Car Loan (Outstanding Principal)' },
    { key: 'twoWheeler', label: 'Two-Wheeler Loan (Outstanding Principal)' },
    { key: 'education', label: 'Education Loan (Outstanding Principal)' },
    { key: 'otherEmis', label: 'Other EMIs (Outstanding Principal)' },
    { key: 'creditCard', label: 'Credit Card Outstanding' },
];

const BreakdownLiabilities = () => {
    const {
        liabilityCategories,
        handleLiabilityChange,
        addCustomLiability,
        updateCustomLiability,
        removeCustomLiability,
    } = useWealthSnapshotQuestions();

    const loans = liabilityCategories.loans || {};

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
            {/* COMMON LOANS */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#111', margin: '0 0 1.5rem 0' }}>Outstanding Balances</h3>
                <p style={{ fontSize: '0.85rem', color: '#666', marginBottom: '1.5rem' }}>
                    Enter the total remaining principal to be paid, not the monthly EMI amount.
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {LIABILITY_FIELDS.map(({ key, label }) => (
                        <CurrencyField
                            key={key}
                            label={label}
                            value={loans[key] || ''}
                            onChange={(val) => handleLiabilityChange(key, val)}
                        />
                    ))}
                </div>
            </section>

            {/* CUSTOM LIABILITIES */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#111', margin: 0 }}>Other Liabilities</h3>
                    <button type="button" className="btn btn-secondary" onClick={addCustomLiability} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                        <Plus size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} /> Add Custom
                    </button>
                </div>

                {(!liabilityCategories.custom || liabilityCategories.custom.length === 0) && (
                    <p style={{ fontSize: '0.85rem', color: '#666', textAlign: 'center', padding: '1rem 0' }}>No custom liabilities added.</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(liabilityCategories.custom || []).map((liability, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Liability Name</label>
                                <input
                                    type="text"
                                    className="conversational-input"
                                    placeholder="e.g. Loan from relative"
                                    value={liability.label || ''}
                                    onChange={(e) => updateCustomLiability(index, 'label', e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Outstanding Balance</label>
                                <CurrencyInput
                                    className="conversational-input"
                                    value={liability.value || ''}
                                    onValueChange={(v) => updateCustomLiability(index, 'value', v == null ? '' : String(v))}
                                    placeholder="0"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeCustomLiability(index)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer', padding: '0.75rem', marginBottom: '0.2rem' }}
                                aria-label="Remove liability"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default BreakdownLiabilities;
