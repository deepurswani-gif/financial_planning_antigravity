import React from 'react';
import { Plus, Trash2, Edit2 } from 'lucide-react';
import { useWealthSnapshotQuestions } from '../../DetailedFlow/useWealthSnapshotQuestions';
import InvestmentDetailsModal from '../../CashFlowModule/InvestmentDetailsModal';
import CurrencyInput from '../../common/CurrencyInput';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

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

const INCOME_FIELDS = [
    { category: 'cash', key: 'savings', label: 'Bank Savings' },
    { category: 'cash', key: 'cashInHand', label: 'Cash-in-hand' },
    { category: 'investments', key: 'equity', label: 'Equity Investments (Stocks, ETFs)' },
    { category: 'investments', key: 'mutualFunds', label: 'Mutual Funds Portfolio' },
    { category: 'realEstate', key: 'landPlot', label: 'Land / Plot (Investment)' },
];

const LEGACY_FIELDS = [
    { category: 'realEstate', key: 'residential', label: 'Residential House' },
    { category: 'realEstate', key: 'secondProperty', label: 'Second Property' },
    { category: 'vehicles', key: 'idv', label: 'Vehicles (IDV)' },
    { category: 'valuables', key: 'gold', label: 'Gold Jewellery' },
    { category: 'valuables', key: 'art', label: 'Art / Collectibles' },
];

const RETIREMENT_FIELDS = [
    { category: 'retirement', key: 'epf', label: 'EPF' },
    { category: 'retirement', key: 'ppf', label: 'PPF' },
    { category: 'retirement', key: 'nps', label: 'NPS' },
];

const BreakdownAssets = () => {
    const {
        assetCategories,
        handleAssetChange,
        activeFdModal,
        setActiveFdModal,
        handleFdSave,
        activeFdInitialData,
        fdInstances,
        openFd,
        addFd,
        addCustomAsset,
        updateCustomAsset,
        removeCustomAsset,
    } = useWealthSnapshotQuestions();

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', paddingBottom: '2rem' }}>
            {/* CASH & INVESTMENTS */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#111', margin: '0 0 1.5rem 0' }}>Cash & Investments</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {INCOME_FIELDS.map(({ category, key, label }) => (
                        <CurrencyField
                            key={key}
                            label={label}
                            value={assetCategories[category]?.[key] || ''}
                            onChange={(val) => handleAssetChange(category, key, val)}
                        />
                    ))}
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid #eaeaea' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                        <h4 style={{ fontSize: '0.95rem', margin: 0, fontWeight: 600 }}>Fixed Deposits (FD)</h4>
                        <button type="button" className="btn btn-secondary" onClick={addFd} style={{ fontSize: '0.8rem', padding: '0.3rem 0.6rem' }}>
                            <Plus size={14} style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} /> Add FD
                        </button>
                    </div>
                    
                    {fdInstances.length === 0 && (
                        <p style={{ fontSize: '0.85rem', color: '#666' }}>No Fixed Deposits added.</p>
                    )}
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.75rem' }}>
                        {fdInstances.map((fd, i) => (
                            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                                <div>
                                    <div style={{ fontSize: '0.9rem', fontWeight: 600 }}>FD #{i + 1}</div>
                                    <div style={{ fontSize: '0.8rem', color: '#64748b' }}>{formatInr(fd?.amount)}</div>
                                </div>
                                <button type="button" onClick={() => openFd(i)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', padding: '0.5rem' }}>
                                    <Edit2 size={16} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* REAL ESTATE & VALUABLES */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#111', margin: '0 0 1.5rem 0' }}>Real Estate, Vehicles & Valuables</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {LEGACY_FIELDS.map(({ category, key, label }) => (
                        <CurrencyField
                            key={key}
                            label={label}
                            value={assetCategories[category]?.[key] || ''}
                            onChange={(val) => handleAssetChange(category, key, val)}
                        />
                    ))}
                </div>
            </section>

            {/* RETIREMENT ASSETS */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#111', margin: '0 0 1.5rem 0' }}>Retirement Corpus</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    {RETIREMENT_FIELDS.map(({ category, key, label }) => (
                        <CurrencyField
                            key={key}
                            label={label}
                            value={assetCategories[category]?.[key] || ''}
                            onChange={(val) => handleAssetChange(category, key, val)}
                        />
                    ))}
                </div>
            </section>

            {/* CUSTOM ASSETS */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#111', margin: 0 }}>Other Assets</h3>
                    <button type="button" className="btn btn-secondary" onClick={addCustomAsset} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                        <Plus size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} /> Add Custom
                    </button>
                </div>

                {(!assetCategories.custom || assetCategories.custom.length === 0) && (
                    <p style={{ fontSize: '0.85rem', color: '#666', textAlign: 'center', padding: '1rem 0' }}>No custom assets added.</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {(assetCategories.custom || []).map((asset, index) => (
                        <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '1rem', alignItems: 'end', background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Asset Name</label>
                                <input
                                    type="text"
                                    className="conversational-input"
                                    placeholder="e.g. Vintage Car"
                                    value={asset.label || ''}
                                    onChange={(e) => updateCustomAsset(index, 'label', e.target.value)}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Current Value</label>
                                <CurrencyInput
                                    className="conversational-input"
                                    value={asset.value || ''}
                                    onValueChange={(v) => updateCustomAsset(index, 'value', v == null ? '' : String(v))}
                                    placeholder="0"
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => removeCustomAsset(index)}
                                style={{ background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer', padding: '0.75rem', marginBottom: '0.2rem' }}
                                aria-label="Remove asset"
                            >
                                <Trash2 size={20} />
                            </button>
                        </div>
                    ))}
                </div>
            </section>

            {/* FD MODAL - High Z-Index to stay above BreakdownSheet */}
            {activeFdModal && (
                <div style={{ position: 'relative', zIndex: 99999 }}>
                    <InvestmentDetailsModal
                        isOpen={!!activeFdModal}
                        onClose={() => setActiveFdModal(null)}
                        onSave={handleFdSave}
                        initialData={activeFdInitialData}
                        investmentTypeTitle="Fixed Deposit (FD)"
                    />
                </div>
            )}
        </div>
    );
};

export default BreakdownAssets;
