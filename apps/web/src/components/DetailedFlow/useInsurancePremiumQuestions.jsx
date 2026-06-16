import { useMemo, useState, useCallback, useEffect } from 'react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { useAuth } from '../../contexts/AuthContext';
import DocumentUploadButton from '../common/DocumentUploadButton';
import ContextualHelpPopup from '../common/ContextualHelpPopup';
import SharedDocumentVault from '../InsuranceModule/SharedDocumentVault';
import { buildSupportEmailContextFromUser } from '../../services/supportRequestEmailService';
import logo from '../../assets/finbrella_logo.png';
import {
    FREQUENCY_OPTIONS,
    getMemberInsuranceKey,
    migrateLifeEntry,
    applyLifeEntryUpdate,
    getLifeMemberMonthlyTotal,
    initializeInsuranceSnapshots,
    sumExistingPoliciesAnnual,
    sumAllLifeAnnual,
    syncPolicySlots,
    reconcileLifeCover,
    reconcileHealthCover,
    sumPolicySumAssured,
    sumHealthPolicyCover,
} from './insuranceDetailSync';
import ReconciliationStatus from './ReconciliationStatus';

const formatInr = (val) => {
    if (!val || isNaN(val)) return '₹0';
    return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
    }).format(val);
};

const UserNote = ({ children }) => (
    <div
        style={{
            fontWeight: 500,
            fontSize: '0.85rem',
            color: 'var(--primary)',
            marginTop: '0.75rem',
            background: 'rgba(37, 99, 235, 0.05)',
            padding: '0.65rem 0.85rem',
            borderRadius: '8px',
            borderLeft: '4px solid var(--primary)',
            lineHeight: 1.5,
        }}
    >
        {children}
    </div>
);

const CurrencyField = ({ label, value, onChange, placeholder = '0' }) => (
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
    </div>
);

const FrequencySelect = ({ value, onChange }) => (
    <div>
        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
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

export function useInsurancePremiumQuestions() {
    const {
        familyMembers,
        expenseCategories,
        setExpenseCategories,
        policies,
        setPolicies,
        loading,
        hasHealthInsurance,
        hasLifeInsurance,
        summaryLifeCover,
        summaryHealthCover,
    } = useFinancialPlan();
    const { user } = useAuth();

    const [showPolicyDetailsModal, setShowPolicyDetailsModal] = useState(false);
    const [showLifeUploadHelp, setShowLifeUploadHelp] = useState(false);
    const [showLifeVault, setShowLifeVault] = useState(false);

    useEffect(() => {
        if (loading) return;
        setExpenseCategories((prev) => initializeInsuranceSnapshots(prev));

        const saved = localStorage.getItem('cashflow_policy_docs');
        if (saved) {
            try {
                const docs = JSON.parse(saved);
                setExpenseCategories((prev) => {
                    const existing = prev.insurance?.policyDocs || {};
                    const hasOverlap = Object.keys(docs).some((k) => docs[k] && !existing[k]);
                    if (!hasOverlap) return prev;
                    return {
                        ...prev,
                        insurance: {
                            ...prev.insurance,
                            policyDocs: { ...existing, ...docs },
                        },
                    };
                });
            } catch {
                /* ignore */
            }
        }
    }, [loading, setExpenseCategories]);

    const insurance = expenseCategories.insurance || {};
    const policyDocs = insurance.policyDocs || {};
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

    const handlePolicyDocChange = useCallback((key, fileName) => {
        setExpenseCategories((prev) => {
            const docs = { ...prev.insurance?.policyDocs };
            if (fileName) {
                docs[key] = fileName;
            } else {
                delete docs[key];
            }
            return {
                ...prev,
                insurance: {
                    ...prev.insurance,
                    policyDocs: docs,
                },
            };
        });
        const saved = localStorage.getItem('cashflow_policy_docs');
        let legacy = {};
        try { legacy = saved ? JSON.parse(saved) : {}; } catch { legacy = {}; }
        if (fileName) legacy[key] = fileName;
        else delete legacy[key];
        localStorage.setItem('cashflow_policy_docs', JSON.stringify(legacy));
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

    const skipHealthInsuranceQuestion = hasHealthInsurance === false;

    const policyDetailsMembers = useMemo(() => {
        return familyMembers.filter((m) => {
            const key = getMemberInsuranceKey(m);
            const entry = migrateLifeEntry(lifeMap[key]);
            if (entry.policyCount > 0) return true;
            const memberName = m.name || m.relation;
            return policies.some((p) => p.insuredName === memberName && !p.isProposed);
        });
    }, [familyMembers, lifeMap, policies]);

    const premiumMismatch = useMemo(() => {
        const cashFlowAnnual = sumAllLifeAnnual(lifeMap);
        const policyAnnual = sumExistingPoliciesAnnual(policies);
        if (cashFlowAnnual <= 0 && policyAnnual <= 0) return null;
        if (Math.round(cashFlowAnnual) !== Math.round(policyAnnual)) {
            return { cashFlowAnnual: Math.round(cashFlowAnnual), policyAnnual: Math.round(policyAnnual) };
        }
        return null;
    }, [lifeMap, policies]);

    const lifeCoverMismatch = useMemo(() => {
        if (!hasLifeInsurance || !parseFloat(summaryLifeCover)) return null;
        const reconciliation = reconcileLifeCover(summaryLifeCover, policies);
        if (reconciliation.status === 'match' || reconciliation.status === 'empty') return null;
        return reconciliation;
    }, [hasLifeInsurance, summaryLifeCover, policies]);

    const healthCoverMismatch = useMemo(() => {
        if (!hasHealthInsurance || !parseFloat(summaryHealthCover)) return null;
        const reconciliation = reconcileHealthCover(summaryHealthCover, policies);
        if (reconciliation.status === 'match' || reconciliation.status === 'empty') return null;
        return reconciliation;
    }, [hasHealthInsurance, summaryHealthCover, policies]);

    const renderInsuranceLine = (key, label, note, showUpload = true) => (
        <div key={key} style={{ marginBottom: '1.5rem' }}>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--primary)', marginBottom: '0.75rem' }}>
                {label}
            </div>
            <div style={{ display: 'grid', gap: '0.75rem' }}>
                <CurrencyField
                    label="Premium amount"
                    value={insurance[key]?.value}
                    onChange={(v) => handleInsurancePremiumChange(key, 'value', v)}
                />
                <FrequencySelect
                    value={insurance[key]?.frequency}
                    onChange={(v) => handleInsurancePremiumChange(key, 'frequency', v)}
                />
                {showUpload && (
                    <DocumentUploadButton
                        label="Upload Policy"
                        documentName={policyDocs[key]}
                        onUploadComplete={(fileName) => handlePolicyDocChange(key, fileName)}
                        onDeleteComplete={() => handlePolicyDocChange(key, null)}
                    />
                )}
            </div>
            {note && <UserNote>{note}</UserNote>}
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
                    marginBottom: '1.25rem',
                    paddingBottom: '1.25rem',
                    borderBottom: '1px solid var(--border)',
                }}
            >
                <div style={{ fontSize: '0.92rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-main)' }}>
                    {displayName}
                    {member.relation !== 'Self' && member.relation !== 'Spouse' && (
                        <span style={{ fontWeight: 500, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                            {' '}({member.relation})
                        </span>
                    )}
                </div>

                <div style={{ marginBottom: '0.75rem' }}>
                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                        Number of policies
                    </label>
                    <input
                        type="number"
                        min="0"
                        className="conversational-input"
                        placeholder="0"
                        value={entry.policyCount || ''}
                        onChange={(e) => {
                            const raw = e.target.value;
                            if (raw === '') {
                                updateLifeMember(member, () => applyLifeEntryUpdate(entry, { policyCount: 0 }));
                                return;
                            }
                            const count = Math.max(0, parseInt(raw, 10) || 0);
                            updateLifeMember(member, () => applyLifeEntryUpdate(entry, { policyCount: count }));
                        }}
                    />
                </div>

                {entry.premiums.map((row, idx) => (
                    <div
                        key={`${memberKey}-policy-${idx}`}
                        style={{
                            marginBottom: '0.75rem',
                            padding: '0.75rem',
                            background: 'var(--bg-card)',
                            borderRadius: '8px',
                            border: '1px solid var(--border)',
                        }}
                    >
                        <div style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                            Policy {idx + 1}
                        </div>
                        <div style={{ display: 'grid', gap: '0.65rem' }}>
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
                        </div>
                    </div>
                ))}

                {monthlyTotal > 0 && (
                    <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                        Total for {displayName}: {formatInr(monthlyTotal)} / month
                    </div>
                )}
            </div>
        );
    };

    const questions = useMemo(() => {
        const list = [];

        if (!skipHealthInsuranceQuestion) {
            list.push({
                id: 'health-insurance',
                content: (
                    <div className="question-container">
                        <p className="question-narrative">Let&apos;s start with health cover.</p>
                        <h2 className="question-title">Health Insurance</h2>
                        <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto', gap: '1rem' }}>
                            {renderInsuranceLine(
                                'health',
                                'Health Insurance',
                                'Your health insurance is your family\'s first line of financial protection. Upload your policy document, and we\'ll review the coverage to help identify any gaps or improvement opportunities.',
                            )}
                            {parseFloat(summaryHealthCover) > 0 && (
                                <div style={{
                                    marginTop: '0.5rem',
                                    padding: '0.65rem 0.85rem',
                                    background: healthCoverMismatch ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.05)',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    lineHeight: 1.5,
                                }}>
                                    <div>Summary health cover: <strong>{formatInr(summaryHealthCover)}</strong></div>
                                    <div>Policy details total: <strong>{formatInr(sumHealthPolicyCover(policies))}</strong></div>
                                    {healthCoverMismatch ? (
                                        <div style={{ marginTop: '0.35rem', color: '#b91c1c' }}>
                                            <ReconciliationStatus
                                                reconciliation={healthCoverMismatch}
                                                matchLabel="Matches summary cover"
                                                underPrefix="Cover shortfall:"
                                                overPrefix="Cover exceeds summary by"
                                            />
                                        </div>
                                    ) : (
                                        <div style={{ marginTop: '0.35rem', color: 'var(--success)', fontWeight: 600 }}>Matches summary cover</div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ),
            });
        }

        list.push({
            id: 'life-insurance',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        {skipHealthInsuranceQuestion
                            ? 'Let\'s capture your life insurance premiums.'
                            : 'Now tell us about life insurance premiums for your family.'}
                    </p>
                    <h2 className="question-title">Life Insurance Premium</h2>
                    <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1rem', textAlign: 'left' }}>
                        {adultLifeMembers.map(renderLifeMemberBlock)}
                        {childLifeMembers.length > 0 && (
                            <div style={{ marginTop: '0.5rem' }}>
                                <div
                                    style={{
                                        fontSize: '0.9rem',
                                        fontWeight: 600,
                                        color: 'var(--primary)',
                                        marginBottom: '0.75rem',
                                        paddingTop: '0.5rem',
                                        borderTop: '1px solid var(--border)',
                                    }}
                                >
                                    Children&apos;s life insurance
                                </div>
                                {childLifeMembers.map(renderLifeMemberBlock)}
                            </div>
                        )}

                        <UserNote>
                            For accurate financial planning provide complete details of each policy.
                        </UserNote>

                        <button
                            type="button"
                            className="btn btn-secondary"
                            style={{
                                width: '100%',
                                marginTop: '1rem',
                                borderStyle: 'dashed',
                                borderColor: 'var(--primary)',
                                color: 'var(--primary)',
                                fontWeight: 600,
                            }}
                            onClick={() => setShowPolicyDetailsModal(true)}
                        >
                            Fill policy details
                        </button>

                        {premiumMismatch && (
                            <div
                                style={{
                                    marginTop: '0.75rem',
                                    padding: '0.65rem 0.85rem',
                                    background: 'rgba(239, 68, 68, 0.08)',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    color: '#b91c1c',
                                    lineHeight: 1.5,
                                }}
                            >
                                Premium mismatch: cash-flow total is {formatInr(premiumMismatch.cashFlowAnnual / 12)} / month
                                vs policy details total {formatInr(premiumMismatch.policyAnnual / 12)} / month.
                                Please align amounts or update policy details.
                            </div>
                        )}

                        {parseFloat(summaryLifeCover) > 0 && (
                            <div
                                style={{
                                    marginTop: '0.75rem',
                                    padding: '0.65rem 0.85rem',
                                    background: lifeCoverMismatch ? 'rgba(239, 68, 68, 0.08)' : 'rgba(37, 99, 235, 0.05)',
                                    borderRadius: '8px',
                                    fontSize: '0.82rem',
                                    lineHeight: 1.5,
                                }}
                            >
                                <div>Summary life cover: <strong>{formatInr(summaryLifeCover)}</strong></div>
                                <div>Policy sum assured total: <strong>{formatInr(sumPolicySumAssured(policies))}</strong></div>
                                {lifeCoverMismatch ? (
                                    <div style={{ marginTop: '0.35rem', color: '#b91c1c' }}>
                                        <ReconciliationStatus
                                            reconciliation={lifeCoverMismatch}
                                            matchLabel="Matches summary cover"
                                            underPrefix="Cover shortfall:"
                                            overPrefix="Cover exceeds summary by"
                                        />
                                    </div>
                                ) : (
                                    <div style={{ marginTop: '0.35rem', color: 'var(--success)', fontWeight: 600 }}>Matches summary cover</div>
                                )}
                            </div>
                        )}

                        <UserNote>
                            Your life insurance policies play an important role in securing your family&apos;s future.
                            If you&apos;re unable to provide all the details, simply upload your policy documents
                            and we&apos;ll help extract and review the information for you.
                        </UserNote>

                        <button
                            type="button"
                            className="btn btn-primary"
                            style={{ width: '100%', marginTop: '0.75rem', fontWeight: 600 }}
                            onClick={() => setShowLifeUploadHelp(true)}
                        >
                            Upload Policies &amp; Get Assistance
                        </button>
                    </div>
                </div>
            ),
        });

        list.push({
            id: 'vehicle-other-insurance',
            content: (
                <div className="question-container">
                    <p className="question-narrative">Almost done with insurance — vehicle and other covers.</p>
                    <h2 className="question-title">Car, two-wheeler &amp; other insurance</h2>
                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto', gap: '1rem', textAlign: 'left' }}>
                        {renderInsuranceLine(
                            'car',
                            'Car Insurance',
                            'Make sure you\'re getting the right protection at the best value. Upload your existing car insurance policy, and we\'ll share competitive renewal quotes before your due date.',
                        )}
                        {renderInsuranceLine(
                            'bike',
                            'Two-wheeler Insurance',
                            'Every journey deserves the right protection. Upload your current two-wheeler insurance policy, and we\'ll help you compare renewal options before your policy expires.',
                        )}
                        {renderInsuranceLine(
                            'others',
                            'Others (Insurance)',
                            null,
                            true,
                        )}
                    </div>
                </div>
            ),
        });

        return list;
    }, [
        insurance, policyDocs, adultLifeMembers, childLifeMembers, lifeMap,
        premiumMismatch, lifeCoverMismatch, healthCoverMismatch,
        skipHealthInsuranceQuestion, summaryLifeCover, summaryHealthCover, policies,
        handleInsurancePremiumChange, handlePolicyDocChange, updateLifeMember,
    ]);

    const lifeUploadHelpModal = showLifeUploadHelp && (
        <ContextualHelpPopup
            isOpen={showLifeUploadHelp}
            onClose={() => setShowLifeUploadHelp(false)}
            title="Upload policies & get assistance"
            message="Finbrella can assist you with life insurance details. Upload your policy documents below, or reach out via call or email."
            logoSrc={logo}
            supportContacts={{
                email: 'finbrellafpd@gmail.com',
                phone: ['+91 9785895737', '+91 7046069999'],
            }}
            supportEmailContext={buildSupportEmailContextFromUser(familyMembers, user, 'Insurance')}
        >
            <div style={{ marginTop: '1rem' }}>
                <button
                    type="button"
                    className="btn btn-secondary"
                    style={{ width: '100%', marginBottom: '0.75rem' }}
                    onClick={() => setShowLifeVault((v) => !v)}
                >
                    {showLifeVault ? 'Hide document vault' : 'Open document vault'}
                </button>
                {showLifeVault && <SharedDocumentVault />}
            </div>
        </ContextualHelpPopup>
    );

    return {
        insuranceQuestions: questions,
        showPolicyDetailsModal,
        setShowPolicyDetailsModal,
        policyDetailsMembers,
        lifeUploadHelpModal,
    };
}
