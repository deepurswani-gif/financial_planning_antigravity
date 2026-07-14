import { useMemo, useState, useCallback, useEffect } from 'react';
import { Pencil, Check, Plus, Trash2 } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import {
    initializeSavingsSnapshots,
    sumConfiguredSavings,
    getSummarySavingsTotal,
} from './savingsDetailSync';
import ReconciliationBar from './ReconciliationBar';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

const CurrencyField = ({ label, value, onChange, placeholder = '0', helperText }) => (
    <div>
        {label && (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                {label}
            </label>
        )}
        <div className="currency-input-wrapper">
            <span className="currency-symbol">₹</span>
            <input
                type="number"
                className="conversational-input"
                placeholder={placeholder}
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
            />
        </div>
        {helperText && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                {helperText}
            </p>
        )}
    </div>
);

export function useSavingsInvestmentQuestions() {
    const { expenseCategories, setExpenseCategories, loading } = useFinancialPlan();

    const [editingSnapshot, setEditingSnapshot] = useState(false);
    const [editInvestments, setEditInvestments] = useState('');
    const [editOtherSavings, setEditOtherSavings] = useState('');
    const [activeInvModal, setActiveInvModal] = useState(null);

    useEffect(() => {
        if (loading) return;
        setExpenseCategories((prev) => initializeSavingsSnapshots(prev));
    }, [loading, setExpenseCategories]);

    const savings = expenseCategories.savings || {};
    const summaryInvestments = expenseCategories.summaryMonthlyInvestments || '';
    const summaryOtherSavings = expenseCategories.summaryOtherSavings || '';
    const summaryCombined = getSummarySavingsTotal(expenseCategories);
    const detailedTotal = sumConfiguredSavings(savings);
    const remainingToAllocate = summaryCombined - detailedTotal;

    const handleSavingsChange = useCallback((field, value) => {
        setExpenseCategories((prev) => ({
            ...prev,
            savings: {
                ...prev.savings,
                [field]: value,
            },
        }));
    }, [setExpenseCategories]);

    const handleInvSave = useCallback((configuredData) => {
        if (typeof activeInvModal === 'string') {
            setExpenseCategories((prev) => ({
                ...prev,
                savings: {
                    ...prev.savings,
                    [activeInvModal]: configuredData,
                },
            }));
        } else if (activeInvModal) {
            setExpenseCategories((prev) => {
                const rawArray = prev.savings[activeInvModal.key];
                const arr = Array.isArray(rawArray) ? [...rawArray] : (rawArray ? [rawArray] : []);
                arr[activeInvModal.index] = configuredData;
                return {
                    ...prev,
                    savings: {
                        ...prev.savings,
                        [activeInvModal.key]: arr,
                    },
                };
            });
        }
    }, [activeInvModal, setExpenseCategories]);

    const saveSnapshotEdits = () => {
        setExpenseCategories((prev) => ({
            ...prev,
            summaryMonthlyInvestments: editInvestments,
            summaryOtherSavings: editOtherSavings,
        }));
        setEditingSnapshot(false);
    };

    const startSnapshotEdit = () => {
        setEditInvestments(summaryInvestments);
        setEditOtherSavings(summaryOtherSavings);
        setEditingSnapshot(true);
    };

    const rawRD = savings.rd;
    const rdArray = Array.isArray(rawRD) ? rawRD : (rawRD ? [rawRD] : []);

    const renderConfiguredField = (invKey, label) => {
        const rawValue = savings[invKey] || '';
        const isConfigured = rawValue !== null && typeof rawValue === 'object' && rawValue.amount > 0;
        const displayValue = isConfigured ? rawValue.amount : rawValue;

        return (
            <div key={invKey}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600 }}>{label}</label>
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            type="button"
                            onClick={() => setActiveInvModal(invKey)}
                            style={{
                                background: 'transparent',
                                border: 'none',
                                color: isConfigured ? 'var(--success)' : 'var(--primary)',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                cursor: 'pointer',
                                padding: 0,
                            }}
                        >
                            {isConfigured ? '✓ Configured' : '⚙ Configure'}
                        </button>
                        {isConfigured && (
                            <button
                                type="button"
                                onClick={() => handleSavingsChange(invKey, null)}
                                style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--negative)',
                                    fontSize: '0.75rem',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    padding: 0,
                                }}
                            >
                                ✕ Clear
                            </button>
                        )}
                    </div>
                </div>
                <div className="currency-input-wrapper">
                    <span className="currency-symbol">₹</span>
                    <input
                        type="number"
                        className="conversational-input"
                        readOnly
                        value={displayValue || ''}
                        onClick={() => setActiveInvModal(invKey)}
                        placeholder="0"
                        style={{
                            cursor: 'pointer',
                            background: 'var(--bg-card)',
                            fontWeight: 600,
                            color: isConfigured ? 'var(--primary)' : 'var(--text-muted)',
                        }}
                    />
                </div>
            </div>
        );
    };

    const questions = useMemo(() => {
        const list = [{
            id: 'savings-snapshot',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Here is what you told us about saving and investing. Let&apos;s break it down in detail.
                    </p>
                    <h2 className="question-title">Your savings snapshot</h2>
                    <div className="card" style={{ padding: '1.25rem', maxWidth: '420px', margin: '0 auto', textAlign: 'left' }}>
                        {!editingSnapshot ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>From your summary</h3>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={startSnapshotEdit}>
                                        <Pencil size={13} style={{ marginRight: '0.3rem' }} /> Edit
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
                                    <div><strong>Monthly investments:</strong> {formatInr(summaryInvestments)} / month</div>
                                    <div><strong>Other monthly savings:</strong> {formatInr(summaryOtherSavings)} / month</div>
                                    <div style={{ marginTop: '0.35rem', fontWeight: 600, color: 'var(--primary)' }}>
                                        Combined: {formatInr(summaryCombined)} / month
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Edit summary amounts</h3>
                                    <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={saveSnapshotEdits}>
                                        <Check size={13} style={{ marginRight: '0.3rem' }} /> Done
                                    </button>
                                </div>
                                <div className="question-fields" style={{ gap: '1rem' }}>
                                    <CurrencyField
                                        label="Monthly investments"
                                        value={editInvestments}
                                        onChange={setEditInvestments}
                                    />
                                    <CurrencyField
                                        label="Other monthly savings"
                                        value={editOtherSavings}
                                        onChange={setEditOtherSavings}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ),
        }];

        list.push({
            id: 'savings-breakdown',
            content: (
                <div className="question-container">
                    <p className="question-narrative">Split your monthly investments across the instruments you use.</p>
                    <h2 className="question-title">Savings &amp; investments</h2>
                    {summaryCombined > 0 && (
                        <ReconciliationBar
                            summaryLabel="Summary Savings"
                            detailLabel="Detailed savings"
                            summaryAmount={summaryCombined}
                            detailAmount={detailedTotal}
                            reconciliation={{
                                summaryTotal: summaryCombined,
                                detailTotal: detailedTotal,
                                delta: remainingToAllocate,
                                status: remainingToAllocate === 0 ? 'match' : remainingToAllocate > 0 ? 'under' : 'over',
                            }}
                        />
                    )}
                    <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1.25rem' }}>
                        <CurrencyField
                            label="Mutual Fund SIPs"
                            value={savings.sip}
                            onChange={(v) => handleSavingsChange('sip', v)}
                        />

                        {renderConfiguredField('ppf', 'PPF')}
                        {renderConfiguredField('nps', 'NPS')}

                        <div style={{ paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>Recurring Deposits (RD)</label>
                                <button
                                    type="button"
                                    className="btn btn-secondary"
                                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                                    onClick={() => handleSavingsChange('rd', [...rdArray, ''])}
                                >
                                    <Plus size={13} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Add RD
                                </button>
                            </div>
                            {rdArray.length === 0 && (
                                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: '0 0 0.75rem' }}>
                                    No Recurring Deposits added.
                                </p>
                            )}
                            {rdArray.map((rdItem, rdIndex) => {
                                const isConfigured = rdItem !== null && typeof rdItem === 'object' && rdItem.amount > 0;
                                const displayValue = isConfigured ? rdItem.amount : rdItem;

                                return (
                                    <div key={`rd-${rdIndex}`} style={{ marginBottom: '0.85rem', padding: '0.85rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-card)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>RD #{rdIndex + 1}</span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => setActiveInvModal({ key: 'rd', index: rdIndex })}
                                                    style={{ background: 'transparent', border: 'none', color: isConfigured ? 'var(--success)' : 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                                >
                                                    {isConfigured ? '✓ Configured' : '⚙ Configure'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const newRds = rdArray.filter((_, i) => i !== rdIndex);
                                                        handleSavingsChange('rd', newRds.length > 0 ? newRds : '');
                                                    }}
                                                    style={{ background: 'transparent', border: 'none', color: 'var(--negative)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                                >
                                                    <Trash2 size={13} style={{ verticalAlign: 'middle' }} /> Remove
                                                </button>
                                            </div>
                                        </div>
                                        <div className="currency-input-wrapper">
                                            <span className="currency-symbol">₹</span>
                                            <input
                                                type="number"
                                                className="conversational-input"
                                                readOnly
                                                value={displayValue || ''}
                                                onClick={() => setActiveInvModal({ key: 'rd', index: rdIndex })}
                                                placeholder="0"
                                                style={{ cursor: 'pointer', background: 'var(--bg-main)', fontWeight: 600, color: isConfigured ? 'var(--primary)' : 'var(--text-muted)' }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <CurrencyField
                            label="Any other Saving"
                            value={savings.otherSaving}
                            onChange={(v) => handleSavingsChange('otherSaving', v)}
                            helperText="Include direct stock investing, equity SIPs outside mutual funds, and any monthly saving not covered above."
                        />

                    </div>
                </div>
            ),
        });

        return list;
    }, [
        editingSnapshot, summaryInvestments, summaryOtherSavings, summaryCombined,
        savings, rdArray, detailedTotal, remainingToAllocate,
        editInvestments, editOtherSavings, handleSavingsChange,
    ]);

    const activeInvInitialData = activeInvModal
        ? (typeof activeInvModal === 'string'
            ? savings[activeInvModal]
            : rdArray[activeInvModal.index])
        : null;

    const activeInvTitle = activeInvModal
        ? (typeof activeInvModal === 'string'
            ? activeInvModal.toUpperCase()
            : activeInvModal.key.toUpperCase())
        : '';

    return {
        savingsQuestions: questions,
        activeInvModal,
        setActiveInvModal,
        handleInvSave,
        activeInvInitialData,
        activeInvTitle,
    };
}
