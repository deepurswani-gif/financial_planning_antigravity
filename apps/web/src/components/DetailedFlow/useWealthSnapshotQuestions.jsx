import { useMemo, useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import {
    initializeWealthSnapshots,
    getSummaryAssetTotal,
    getSummaryLiabilityTotal,
    getAssetAmount,
    getTotalAssetBreakdownTotal,
    getTotalLiabilityBreakdownTotal,
    syncEmergencyFundAmount,
} from './wealthDetailSync';
import { reconcileAmounts } from './detailReconcile';
import ReconciliationBar from './ReconciliationBar';
import CurrencyInput from '../common/CurrencyInput';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

const toStored = (v) => (v == null ? '' : String(v));

const CurrencyField = ({ label, value, onChange, placeholder = '0', helperText, readOnly, onClick }) => (
    <div>
        {label && (
            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                {label}
            </label>
        )}
        <CurrencyInput
            className="conversational-input"
            placeholder={placeholder}
            value={value ?? ''}
            readOnly={readOnly}
            onClick={onClick}
            onValueChange={(v) => {
                if (!readOnly) onChange(toStored(v));
            }}
            style={readOnly ? { cursor: 'pointer', background: 'var(--bg-card)', fontWeight: 600 } : undefined}
        />
        {helperText && (
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.45 }}>
                {helperText}
            </p>
        )}
    </div>
);

const LEGACY_FIELDS = [
    { category: 'realEstate', key: 'residential', label: 'Residential House' },
    { category: 'realEstate', key: 'secondProperty', label: 'Second Property' },
    { category: 'vehicles', key: 'idv', label: 'Vehicles (IDV)' },
    { category: 'valuables', key: 'gold', label: 'Gold Jewellery' },
    { category: 'valuables', key: 'art', label: 'Art / Collectibles' },
];

const INCOME_FIELDS = [
    { category: 'realEstate', key: 'landPlot', label: 'Land / Plot (Investment Purpose)' },
    { category: 'cash', key: 'savings', label: 'Bank Savings' },
    { category: 'cash', key: 'cashInHand', label: 'Cash-in-hand' },
    { category: 'investments', key: 'equity', label: 'Equity Investments (Stocks, ETFs)' },
    { category: 'investments', key: 'mutualFunds', label: 'Mutual Funds Portfolio' },
];

const RETIREMENT_FIELDS = [
    { category: 'retirement', key: 'epf', label: 'EPF' },
    { category: 'retirement', key: 'ppf', label: 'PPF' },
    { category: 'retirement', key: 'nps', label: 'NPS' },
];

const LIABILITY_FIELDS = [
    { key: 'home', label: 'Home Loan (Outstanding Amount)' },
    { key: 'personal', label: 'Personal Loan (Outstanding Amount)' },
    { key: 'car', label: 'Car Loan (Outstanding Amount)' },
    { key: 'education', label: 'Education Loan (Outstanding Amount)' },
    { key: 'otherEmis', label: 'Other EMIs (Outstanding Amount)' },
    { key: 'creditCard', label: 'Credit Card' },
];

export function useWealthSnapshotQuestions() {
    const {
        assetCategories,
        setAssetCategories,
        liabilityCategories,
        setLiabilityCategories,
        hasEMI,
        loading,
    } = useFinancialPlan();

    const [editingRecap, setEditingRecap] = useState(false);
    const [editPortfolio, setEditPortfolio] = useState('');
    const [editLiquidCash, setEditLiquidCash] = useState('');
    const [editRealEstate, setEditRealEstate] = useState('');
    const [editLoans, setEditLoans] = useState('');
    const [editCreditCard, setEditCreditCard] = useState('');
    const [editOtherPayables, setEditOtherPayables] = useState('');
    const [activeFdModal, setActiveFdModal] = useState(null);

    useEffect(() => {
        if (loading) return;
        const { assetCategories: nextAssets, liabilityCategories: nextLiabilities } = initializeWealthSnapshots(
            assetCategories,
            liabilityCategories,
        );
        setAssetCategories(nextAssets);
        setLiabilityCategories(nextLiabilities);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading]);

    const handleAssetChange = useCallback((category, key, value) => {
        setAssetCategories((prev) => {
            if (category === 'cash' && key === 'savings') {
                return syncEmergencyFundAmount(prev, value);
            }
            return {
                ...prev,
                [category]: { ...prev[category], [key]: value },
            };
        });
    }, [setAssetCategories]);

    const handleLiabilityChange = useCallback((key, value) => {
        setLiabilityCategories((prev) => ({
            ...prev,
            loans: { ...prev.loans, [key]: value },
        }));
    }, [setLiabilityCategories]);

    const handleFdSave = useCallback((configuredData) => {
        if (!activeFdModal) return;
        const { index } = activeFdModal;
        setAssetCategories((prev) => {
            const raw = prev.investments?.fixedDeposit;
            const arr = Array.isArray(raw) ? [...raw] : (raw ? [raw] : []);
            arr[index] = configuredData;
            return {
                ...prev,
                investments: { ...prev.investments, fixedDeposit: arr },
            };
        });
        setActiveFdModal(null);
    }, [activeFdModal, setAssetCategories]);

    const addCustomAsset = useCallback(() => {
        setAssetCategories((prev) => ({
            ...prev,
            custom: [...(prev.custom || []), { label: '', value: '' }],
        }));
    }, [setAssetCategories]);

    const updateCustomAsset = useCallback((index, field, value) => {
        setAssetCategories((prev) => {
            const custom = [...(prev.custom || [])];
            custom[index] = { ...custom[index], [field]: value };
            return { ...prev, custom };
        });
    }, [setAssetCategories]);

    const removeCustomAsset = useCallback((index) => {
        setAssetCategories((prev) => ({
            ...prev,
            custom: (prev.custom || []).filter((_, i) => i !== index),
        }));
    }, [setAssetCategories]);

    const addCustomLiability = useCallback(() => {
        setLiabilityCategories((prev) => ({
            ...prev,
            custom: [...(prev.custom || []), { label: '', value: '' }],
        }));
    }, [setLiabilityCategories]);

    const updateCustomLiability = useCallback((index, field, value) => {
        setLiabilityCategories((prev) => {
            const custom = [...(prev.custom || [])];
            custom[index] = { ...custom[index], [field]: value };
            return { ...prev, custom };
        });
    }, [setLiabilityCategories]);

    const removeCustomLiability = useCallback((index) => {
        setLiabilityCategories((prev) => ({
            ...prev,
            custom: (prev.custom || []).filter((_, i) => i !== index),
        }));
    }, [setLiabilityCategories]);

    const startRecapEdit = useCallback(() => {
        setEditPortfolio(assetCategories.summaryPortfolioValue || '');
        setEditLiquidCash(assetCategories.summaryLiquidCash || '');
        setEditRealEstate(assetCategories.summaryRealEstateAssets || '');
        setEditLoans(liabilityCategories.summaryOutstandingLoans || '');
        setEditCreditCard(liabilityCategories.summaryCreditCardDues || '');
        setEditOtherPayables(liabilityCategories.summaryOtherPayables || '');
        setEditingRecap(true);
    }, [assetCategories, liabilityCategories]);

    const saveRecapEdits = useCallback(() => {
        setAssetCategories((prev) => syncEmergencyFundAmount({
            ...prev,
            summaryPortfolioValue: editPortfolio,
            summaryRealEstateAssets: editRealEstate,
        }, editLiquidCash));
        setLiabilityCategories((prev) => ({
            ...prev,
            summaryOutstandingLoans: editLoans,
            summaryCreditCardDues: editCreditCard,
            summaryOtherPayables: editOtherPayables,
        }));
        setEditingRecap(false);
    }, [editPortfolio, editLiquidCash, editRealEstate, editLoans, editCreditCard, editOtherPayables, setAssetCategories, setLiabilityCategories]);

    const rawFD = assetCategories.investments?.fixedDeposit;
    const fdArray = Array.isArray(rawFD) ? rawFD : (rawFD ? [rawFD] : []);

    const openFd = useCallback((index) => {
        setActiveFdModal({ index });
    }, []);

    const addFd = useCallback(() => {
        const nextIndex = fdArray.length;
        handleAssetChange('investments', 'fixedDeposit', [...fdArray, '']);
        setActiveFdModal({ index: nextIndex });
    }, [fdArray, handleAssetChange]);

    const summaryAssetTotal = getSummaryAssetTotal(assetCategories);
    const summaryLiabilityTotal = getSummaryLiabilityTotal(liabilityCategories, hasEMI);
    const assetBreakdownTotal = getTotalAssetBreakdownTotal(assetCategories);
    const liabilityBreakdownTotal = getTotalLiabilityBreakdownTotal(liabilityCategories, hasEMI);
    const assetReconciliation = reconcileAmounts(summaryAssetTotal, assetBreakdownTotal);
    const liabilityReconciliation = reconcileAmounts(summaryLiabilityTotal, liabilityBreakdownTotal);

    const renderAssetReconciliationPanel = () => (
        summaryAssetTotal > 0 ? (
            <ReconciliationBar
                summaryLabel="Summary Assets"
                detailLabel="Detailed assets"
                summaryAmount={summaryAssetTotal}
                detailAmount={assetBreakdownTotal}
                reconciliation={assetReconciliation}
            />
        ) : null
    );

    const renderLiabilityReconciliationPanel = () => (
        summaryLiabilityTotal > 0 ? (
            <ReconciliationBar
                summaryLabel="Summary Liabilities"
                detailLabel="Detailed liabilities"
                summaryAmount={summaryLiabilityTotal}
                detailAmount={liabilityBreakdownTotal}
                reconciliation={liabilityReconciliation}
            />
        ) : null
    );

    const renderFixedDepositSection = () => (
        <div style={{ maxWidth: '480px', margin: '1.5rem auto 0', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border)', background: 'var(--bg-card)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, margin: 0 }}>Fixed Deposits (FD)</label>
                <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ fontSize: '0.78rem', padding: '0.35rem 0.65rem' }}
                    onClick={() => handleAssetChange('investments', 'fixedDeposit', [...fdArray, ''])}
                >
                    <Plus size={13} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Add FD
                </button>
            </div>
            {fdArray.length === 0 && (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                    No Fixed Deposits added.
                </p>
            )}
            {fdArray.map((fdItem, fdIndex) => {
                const isConfigured = fdItem !== null && typeof fdItem === 'object' && fdItem.amount > 0;
                const displayValue = isConfigured ? fdItem.amount : fdItem;
                return (
                    <div key={`fd-${fdIndex}`} style={{ marginBottom: fdIndex < fdArray.length - 1 ? '0.85rem' : 0, padding: '0.85rem', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-main)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary)' }}>FD #{fdIndex + 1}</span>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    type="button"
                                    onClick={() => setActiveFdModal({ index: fdIndex })}
                                    style={{ background: 'transparent', border: 'none', color: isConfigured ? 'var(--success)' : 'var(--primary)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                >
                                    {isConfigured ? '✓ Configured' : '⚙ Configure'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        const newFds = fdArray.filter((_, i) => i !== fdIndex);
                                        handleAssetChange('investments', 'fixedDeposit', newFds.length > 0 ? newFds : '');
                                    }}
                                    style={{ background: 'transparent', border: 'none', color: 'var(--negative)', fontSize: '0.75rem', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                                >
                                    <Trash2 size={13} style={{ verticalAlign: 'middle' }} /> Remove
                                </button>
                            </div>
                        </div>
                        <CurrencyField
                            value={displayValue || ''}
                            readOnly
                            onClick={() => setActiveFdModal({ index: fdIndex })}
                        />
                    </div>
                );
            })}
        </div>
    );

    const activeFdInitialData = activeFdModal
        ? (Array.isArray(assetCategories.investments?.fixedDeposit)
            ? assetCategories.investments.fixedDeposit[activeFdModal.index]
            : assetCategories.investments?.fixedDeposit)
        : null;

    const renderFieldGrid = (fields, onChange) => (
        <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1.25rem' }}>
            {fields.map(({ category, key, label }) => (
                <CurrencyField
                    key={`${category}-${key}`}
                    label={label}
                    value={assetCategories[category]?.[key] || ''}
                    onChange={(v) => onChange(category, key, v)}
                />
            ))}
        </div>
    );

    const questions = useMemo(() => {
        const list = [{
            id: 'wealth-recap',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Here is what we captured about your wealth in the summary. Let&apos;s take a closer look at what you&apos;ve built.
                    </p>
                    <h2 className="question-title">Your wealth snapshot</h2>
                    <p className="question-helper" style={{ maxWidth: '480px', margin: '0 auto 1rem' }}>
                        These are consolidated figures from your summary. Break them down in the questions that follow.
                    </p>
                    <div className="card" style={{ padding: '1.25rem', maxWidth: '480px', margin: '0 auto', textAlign: 'left' }}>
                        {!editingRecap ? (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>From your summary</h3>
                                    <button type="button" className="btn btn-secondary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={startRecapEdit}>
                                        <Pencil size={13} style={{ marginRight: '0.3rem' }} /> Edit
                                    </button>
                                </div>
                                <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
                                    <div><strong>Investment portfolio (all investments):</strong> {formatInr(assetCategories.summaryPortfolioValue)}</div>
                                    <div><strong>Liquid cash / emergency fund:</strong> {formatInr(assetCategories.summaryLiquidCash)}</div>
                                    <div><strong>Real estate / high-value assets:</strong> {formatInr(assetCategories.summaryRealEstateAssets)}</div>
                                    {hasEMI && (
                                        <div><strong>Outstanding loans (all loans combined):</strong> {formatInr(liabilityCategories.summaryOutstandingLoans)}</div>
                                    )}
                                    <div><strong>Credit card dues:</strong> {formatInr(liabilityCategories.summaryCreditCardDues)}</div>
                                    {getAssetAmount(liabilityCategories.summaryOtherPayables) > 0 && (
                                        <div><strong>Other payables:</strong> {formatInr(liabilityCategories.summaryOtherPayables)}</div>
                                    )}
                                    <div style={{ marginTop: '0.35rem', fontWeight: 600, color: 'var(--primary)' }}>
                                        Assets: {formatInr(summaryAssetTotal)}
                                        {(hasEMI || getAssetAmount(liabilityCategories.summaryCreditCardDues) > 0 || getAssetAmount(liabilityCategories.summaryOtherPayables) > 0) && (
                                            <> · Liabilities: {formatInr(summaryLiabilityTotal)}</>
                                        )}
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                    <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--primary)' }}>Edit summary amounts</h3>
                                    <button type="button" className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }} onClick={saveRecapEdits}>
                                        <Check size={13} style={{ marginRight: '0.3rem' }} /> Done
                                    </button>
                                </div>
                                <div className="question-fields" style={{ gap: '1rem' }}>
                                    <CurrencyField label="Investment portfolio (all investments)" value={editPortfolio} onChange={setEditPortfolio} />
                                    <CurrencyField label="Liquid cash / emergency fund" value={editLiquidCash} onChange={setEditLiquidCash} />
                                    <CurrencyField label="Real estate / high-value assets" value={editRealEstate} onChange={setEditRealEstate} />
                                    {hasEMI && (
                                        <CurrencyField label="Outstanding loans (all loans combined)" value={editLoans} onChange={setEditLoans} />
                                    )}
                                    <CurrencyField label="Credit card dues" value={editCreditCard} onChange={setEditCreditCard} />
                                    <CurrencyField label="Other payables" value={editOtherPayables} onChange={setEditOtherPayables} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ),
        }];

        list.push({
            id: 'assets-breakdown',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Every asset tells a story of hard work, discipline, and dreams fulfilled. Let&apos;s break them down.
                    </p>
                    <h2 className="question-title">Your assets</h2>
                    {renderAssetReconciliationPanel()}
                    <div style={{ maxWidth: '480px', margin: '0 auto' }}>
                        <h3 style={{ fontSize: '1rem', color: 'var(--primary)', margin: '0 0 0.35rem', textAlign: 'left' }}>Legacy assets</h3>
                        <p className="question-helper" style={{ margin: '0 0 1rem', textAlign: 'left' }}>
                            Property, vehicles, and valuables typically passed to the next generation.
                        </p>
                        {renderFieldGrid(LEGACY_FIELDS, handleAssetChange)}

                        <h3 style={{ fontSize: '1rem', color: 'var(--primary)', margin: '2rem 0 0.35rem', textAlign: 'left' }}>Income assets</h3>
                        <p className="question-helper" style={{ margin: '0 0 1rem', textAlign: 'left' }}>
                            Assets that can generate income or be liquidated when needed.
                        </p>
                        {renderFieldGrid(INCOME_FIELDS, handleAssetChange)}
                        {renderFixedDepositSection()}
                        <div style={{ marginTop: '1.25rem' }}>
                            <CurrencyField
                                label="Fund Value of ULIP Policies"
                                value={assetCategories.insurance?.ulip || ''}
                                onChange={(v) => handleAssetChange('insurance', 'ulip', v)}
                            />
                        </div>

                        <h3 style={{ fontSize: '1rem', color: 'var(--primary)', margin: '2rem 0 0.35rem', textAlign: 'left' }}>Retirement assets</h3>
                        <p className="question-helper" style={{ margin: '0 0 1rem', textAlign: 'left' }}>
                            Retirement accounts form the backbone of your long-term security.
                        </p>
                        {renderFieldGrid(RETIREMENT_FIELDS, handleAssetChange)}
                    </div>
                </div>
            ),
        });

        list.push({
            id: 'custom-assets',
            content: (
                <div className="question-container">
                    <h2 className="question-title">Any other assets?</h2>
                    <p className="question-helper">Add anything not covered above.</p>
                    {renderAssetReconciliationPanel()}
                    <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1rem' }}>
                        {(assetCategories.custom || []).map((field, index) => (
                            <div key={`asset-custom-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Name</label>
                                    <input
                                        type="text"
                                        className="conversational-input"
                                        placeholder="Asset name"
                                        value={field.label || ''}
                                        onChange={(e) => updateCustomAsset(index, 'label', e.target.value)}
                                    />
                                </div>
                                <CurrencyField
                                    label="Amount"
                                    value={field.value || ''}
                                    onChange={(v) => updateCustomAsset(index, 'value', v)}
                                />
                                <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem', marginBottom: '0.1rem' }} onClick={() => removeCustomAsset(index)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'center' }} onClick={addCustomAsset}>
                            <Plus size={14} style={{ marginRight: '0.35rem' }} /> Add More Asset
                        </button>
                    </div>
                </div>
            ),
        });

        list.push({
            id: 'liabilities',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Every liability reflects a commitment you&apos;ve made for your family&apos;s future. Let&apos;s take a closer look at the responsibilities that come with it.
                    </p>
                    <h2 className="question-title">Liabilities</h2>
                    {renderLiabilityReconciliationPanel()}
                    <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1.25rem' }}>
                        {LIABILITY_FIELDS.map(({ key, label }) => (
                            <CurrencyField
                                key={key}
                                label={label}
                                value={liabilityCategories.loans?.[key] || ''}
                                onChange={(v) => handleLiabilityChange(key, v)}
                            />
                        ))}
                    </div>
                </div>
            ),
        });

        list.push({
            id: 'custom-liabilities',
            content: (
                <div className="question-container">
                    <h2 className="question-title">Any other liabilities?</h2>
                    {renderLiabilityReconciliationPanel()}
                    <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1rem' }}>
                        {(liabilityCategories.custom || []).map((field, index) => (
                            <div key={`liab-custom-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '0.75rem', alignItems: 'end' }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.35rem', display: 'block' }}>Name</label>
                                    <input
                                        type="text"
                                        className="conversational-input"
                                        placeholder="Liability name"
                                        value={field.label || ''}
                                        onChange={(e) => updateCustomLiability(index, 'label', e.target.value)}
                                    />
                                </div>
                                <CurrencyField
                                    label="Amount"
                                    value={field.value || ''}
                                    onChange={(v) => updateCustomLiability(index, 'value', v)}
                                />
                                <button type="button" className="btn btn-secondary" style={{ padding: '0.5rem', marginBottom: '0.1rem' }} onClick={() => removeCustomLiability(index)}>
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        ))}
                        <button type="button" className="btn btn-secondary" style={{ alignSelf: 'center' }} onClick={addCustomLiability}>
                            <Plus size={14} style={{ marginRight: '0.35rem' }} /> Add More Liability
                        </button>
                    </div>
                </div>
            ),
        });

        return list;
    }, [
        editingRecap, assetCategories, liabilityCategories, hasEMI,
        summaryAssetTotal, summaryLiabilityTotal, assetBreakdownTotal, liabilityBreakdownTotal,
        assetReconciliation, liabilityReconciliation,
        editPortfolio, editLiquidCash, editRealEstate, editLoans, editCreditCard, editOtherPayables,
        fdArray, handleAssetChange, handleLiabilityChange,
        startRecapEdit, saveRecapEdits,
        addCustomAsset, updateCustomAsset, removeCustomAsset,
        addCustomLiability, updateCustomLiability, removeCustomLiability,
    ]);

    return {
        questions,
        activeFdModal,
        setActiveFdModal,
        handleFdSave,
        activeFdInitialData,
        // Smart Edit activation helpers
        fdInstances: fdArray,
        openFd,
        addFd,
    };
}
