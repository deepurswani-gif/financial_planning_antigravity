import React, { useEffect, useState } from 'react';
import { ChevronDown, Calendar } from 'lucide-react';
import { formatCurrency } from '../CashFlowModule/CashFlowLogic';
import ReportReveal from './ReportReveal';
import AllocationStudioStickyBar from './AllocationStudioStickyBar';
import { isCategoryDirty, sumCategoryDraft } from './allocationStudioUiState';
import { InstrumentAmountSlider, LifeInsuranceSavingForm, AVENUE_ICONS } from './AllocateSurplusPanel';
import { LISP_INSTRUMENT_TYPE, isLispDraft, createEmptyLispDraft, getLispDraftMonthly } from './instrumentAnalysisLogic';

const ProtectionAccordionCard = ({
    instrument,
    category,
    draftAmount,
    maxAmount,
    onDraftChange,
    onLispDraftChange,
    familyMembers = [],
    displayName,
    note,
    currentPlanKey = null,
    isOpen = false,
    onToggle,
    isSaved = false,
}) => {
    const Icon = AVENUE_ICONS[instrument.type] || AVENUE_ICONS.SIP;
    const isPolicy = instrument.type === 'Term Insurance' || instrument.type === LISP_INSTRUMENT_TYPE || instrument.type === 'Life Insurance';
    const draftValue = isLispDraft(draftAmount) ? draftAmount : (isPolicy ? createEmptyLispDraft(instrument.type) : draftAmount);
    const monthlyAmount = isPolicy ? getLispDraftMonthly(draftValue) : Math.round(draftAmount || 0);

    const [validationErrors, setValidationErrors] = useState({});

    const checkValidation = () => {
        if (!isPolicy || monthlyAmount <= 0) return { isValid: true, errors: {} };
        const errors = {};
        if (!draftValue?.insuredMember || !String(draftValue.insuredMember).trim()) {
            errors.memberError = 'Please select who this policy covers.';
        }
        if (!draftValue?.duration || parseInt(draftValue.duration, 10) <= 0) {
            errors.durationError = 'Please enter premium payment term.';
        }
        return { isValid: Object.keys(errors).length === 0, errors };
    };

    const handleDoneClick = () => {
        const { isValid, errors } = checkValidation();
        setValidationErrors(errors);
        if (isValid) {
            onToggle();
        }
    };

    const handleToggleClick = () => {
        if (isOpen) {
            const { isValid, errors } = checkValidation();
            setValidationErrors(errors);
            if (isValid) {
                onToggle();
            }
        } else {
            setValidationErrors({});
            onToggle();
        }
    };

    const { isValid: currentlyValid } = checkValidation();
    const isIncomplete = isPolicy && monthlyAmount > 0 && !currentlyValid;

    const statusColor = monthlyAmount === 0
        ? '#cbd5e1'
        : isIncomplete
            ? '#f59e0b'
            : isSaved
                ? '#10b981'
                : '#3b82f6';

    return (
        <div
            className="pymtw-accordion-card"
            style={{
                border: '1px solid var(--border)',
                borderLeft: `5px solid ${statusColor}`,
                borderRadius: '12px',
                background: 'var(--card-bg, #fff)',
                marginBottom: '0.75rem',
                overflow: 'hidden',
                transition: 'all 0.2s ease',
            }}
        >
            <div
                className="pymtw-accordion-header"
                onClick={handleToggleClick}
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.9rem 1.25rem',
                    minHeight: '64px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    background: isOpen ? 'rgba(15, 118, 110, 0.03)' : 'transparent',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '2.2rem',
                        height: '2.2rem',
                        borderRadius: '10px',
                        background: 'rgba(15, 118, 110, 0.08)',
                        color: 'var(--primary, #0f766e)',
                    }}>
                        <Icon size={20} />
                    </div>
                    <div>
                        <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>
                            {displayName || instrument.type}
                        </h4>
                        {note && <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{note}</span>}
                    </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                    {isIncomplete ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{
                                background: 'rgba(245, 158, 11, 0.15)',
                                color: '#b45309',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                padding: '0.2rem 0.6rem',
                                borderRadius: '999px',
                            }}>
                                ⚠️ Incomplete
                            </span>
                            <strong style={{ fontSize: '0.9rem', color: '#b45309' }}>
                                {formatCurrency(monthlyAmount)}/mo
                            </strong>
                        </div>
                    ) : monthlyAmount > 0 ? (
                        <strong style={{
                            background: 'rgba(15, 118, 110, 0.1)',
                            color: 'var(--primary, #0f766e)',
                            fontSize: '0.88rem',
                            fontWeight: 700,
                            padding: '0.25rem 0.75rem',
                            borderRadius: '999px',
                        }}>
                            {formatCurrency(monthlyAmount)}/mo
                        </strong>
                    ) : (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                            Not set
                        </span>
                    )}

                    <ChevronDown
                        size={18}
                        style={{
                            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                            transition: 'transform 0.2s ease',
                            color: 'var(--text-muted)',
                        }}
                    />
                </div>
            </div>

            {isOpen && (
                <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border)', background: '#ffffff' }}>
                    {isPolicy ? (
                        <LifeInsuranceSavingForm
                            instrumentType={instrument.type}
                            draft={draftAmount}
                            maxMonthly={maxAmount}
                            familyMembers={familyMembers}
                            onChange={(next) => {
                                setValidationErrors({});
                                if (onLispDraftChange) {
                                    onLispDraftChange(next, instrument.type);
                                } else {
                                    onDraftChange(instrument.type, next);
                                }
                            }}
                            monthHistory={instrument.monthHistory}
                            currentPlanKey={currentPlanKey}
                            validationErrors={validationErrors}
                            onDone={handleDoneClick}
                        />
                    ) : (
                        <InstrumentAmountSlider
                            instrumentType={instrument.type}
                            displayName={displayName || instrument.type}
                            draftAmount={draftAmount}
                            maxAmount={maxAmount}
                            onDraftChange={onDraftChange}
                            monthHistory={instrument.monthHistory}
                            currentPlanKey={currentPlanKey}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

const InstrumentCard = ({
    instrument,
    category,
    draftAmount,
    maxAmount,
    onDraftChange,
    onLispDraftChange,
    familyMembers = [],
    displayName,
    note,
    currentPlanKey = null,
}) => {
    const Icon = AVENUE_ICONS[instrument.type] || AVENUE_ICONS.SIP;
    const isPolicy = instrument.type === LISP_INSTRUMENT_TYPE || instrument.type === 'Term Insurance';

    return (
        <div className="pymtw-instrument-card pymtw-instrument-active">
            <div className="pymtw-instrument-header">
                <div className="pymtw-instrument-title-row">
                    <Icon size={18} />
                    <h4>{displayName || instrument.type}</h4>
                </div>
            </div>

            {note && <p className="pymtw-instrument-note">{note}</p>}

            <div className="pymtw-instrument-tags">
                {category.goalTags.map((tag) => (
                    <span key={tag} className="pymtw-goal-tag">{tag}</span>
                ))}
            </div>

            {isPolicy ? (
                <LifeInsuranceSavingForm
                    instrumentType={instrument.type}
                    draft={draftAmount}
                    maxMonthly={maxAmount}
                    familyMembers={familyMembers}
                    onChange={(next) => {
                        if (onLispDraftChange) {
                            onLispDraftChange(next, instrument.type);
                        } else {
                            onDraftChange(instrument.type, next);
                        }
                    }}
                    monthHistory={instrument.monthHistory}
                    currentPlanKey={currentPlanKey}
                />
            ) : (
                <InstrumentAmountSlider
                    instrumentType={instrument.type}
                    displayName={displayName || instrument.type}
                    draftAmount={draftAmount}
                    maxAmount={maxAmount}
                    onDraftChange={onDraftChange}
                    monthHistory={instrument.monthHistory}
                    currentPlanKey={currentPlanKey}
                />
            )}
        </div>
    );
};

const getInstrumentDisplayName = (category, instrument) => (
    category.instrumentLabels?.[instrument.type] || instrument.type
);

const InstrumentCardGrid = ({
    instrumentCategories,
    draftAllocations,
    headerAllocations = null,
    baselineAllocations = null,
    remainingSurplus,
    getMaxAmountForInstrument,
    onDraftChange,
    onLispDraftChange = null,
    familyMembers = [],
    onApplyManualAllocations,
    canApplyManual = false,
    applyError = '',
    selectableMonths = [],
    selectedMonthIndex,
    onMonthChange,
    calendarYear,
    isDirty = false,
    showStickyBar = true,
    editingMonthLabel = '',
    totalMonthlyAllocation = 0,
    saveLabel = 'Save Plan',
    statusHint = '',
    saveSuccessMessage = '',
    onDiscardChanges,
    showUnsavedBanner = false,
    replaceConfirm = null,
    monthSwitchConfirm = null,
    showMonthPicker = true,
    currentPlanKey = null,
}) => {
    const [expandedId, setExpandedId] = useState(
        () => (instrumentCategories?.length === 1 ? instrumentCategories[0].id : null),
    );
    const [openAvenueType, setOpenAvenueType] = useState(null);
    const headerDraft = headerAllocations || draftAllocations;
    const baseline = baselineAllocations || headerDraft;

    useEffect(() => {
        if (instrumentCategories?.length === 1) {
            setExpandedId(instrumentCategories[0].id);
        }
    }, [instrumentCategories]);

    const toggleCategory = (id) => {
        setExpandedId((prev) => (prev === id ? null : id));
    };

    const isProtectionMode = instrumentCategories.some((c) => c.id === 'protection');

    return (
        <ReportReveal className="pymtw-zone-c">
            {!isProtectionMode && (
                <div className="pymtw-allocate-header">
                    <div>
                        <h3 className="pymtw-zone-title">Allocate your surplus</h3>
                        <p className="pymtw-zone-sub">
                            Open one category at a time to set amounts with the slider or by typing. Remaining:{' '}
                            <strong className="pymtw-remaining-surplus">
                                {formatCurrency(Math.max(0, remainingSurplus))}
                            </strong>
                        </p>
                    </div>
                    {showMonthPicker && selectableMonths.length > 0 && onMonthChange && (
                        <div className="pymtw-month-picker">
                            <Calendar size={16} />
                            <select
                                value={selectedMonthIndex}
                                onChange={(e) => onMonthChange(parseInt(e.target.value, 10))}
                                aria-label="Select month"
                            >
                                {selectableMonths.map((m) => (
                                    <option key={m.monthIndex} value={m.monthIndex}>
                                        {m.label} {calendarYear}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>
            )}

            {showUnsavedBanner && (
                <div className="pymtw-unsaved-banner" role="status">
                    <strong>You have unsaved changes.</strong>
                    <span>Save Plan to update your monthly allocation.</span>
                </div>
            )}

            {monthSwitchConfirm}

            {replaceConfirm}

            {instrumentCategories.map((category) => {
                const isOpen = expandedId === category.id;
                const allocatedInCategory = sumCategoryDraft(category, headerDraft);
                const categoryDirty = isCategoryDirty(category, headerDraft, baseline);

                if (isProtectionMode || category.id === 'protection') {
                    return (
                        <div key={category.id} className="pymtw-protection-accordion-list" style={{ margin: '1rem 0' }}>
                            {category.instruments.map((instrument) => (
                                <ProtectionAccordionCard
                                    key={instrument.type}
                                    instrument={instrument}
                                    category={category}
                                    displayName={getInstrumentDisplayName(category, instrument)}
                                    note={category.instrumentNotes?.[instrument.type]}
                                    draftAmount={draftAllocations[instrument.type]}
                                    maxAmount={getMaxAmountForInstrument
                                        ? getMaxAmountForInstrument(instrument.type)
                                        : (draftAllocations[instrument.type] || 0) + Math.max(0, remainingSurplus)}
                                    onDraftChange={onDraftChange}
                                    onLispDraftChange={onLispDraftChange}
                                    familyMembers={familyMembers}
                                    currentPlanKey={currentPlanKey}
                                    isOpen={openAvenueType === instrument.type}
                                    onToggle={() => setOpenAvenueType((prev) => (prev === instrument.type ? null : instrument.type))}
                                    isSaved={!isDirty}
                                />
                            ))}
                        </div>
                    );
                }

                return (
                    <div key={category.id} className={`pymtw-category-block ${isOpen ? 'pymtw-category-open' : ''}`}>
                        <button
                            type="button"
                            className="pymtw-category-toggle"
                            aria-expanded={isOpen}
                            aria-controls={`pymtw-category-panel-${category.id}`}
                            id={`pymtw-category-trigger-${category.id}`}
                            onClick={() => toggleCategory(category.id)}
                        >
                            <div className="pymtw-category-toggle-main">
                                <h4 className="pymtw-category-label">{category.label}</h4>
                                <div className="pymtw-category-avenue-chips">
                                    {category.instruments.map((instrument) => (
                                        <span
                                            key={instrument.type}
                                            className="pymtw-avenue-chip"
                                        >
                                            {getInstrumentDisplayName(category, instrument)}
                                        </span>
                                    ))}
                                </div>
                                <div className="pymtw-category-status-row">
                                    <span className="pymtw-category-meta">
                                        {formatCurrency(allocatedInCategory)}/month allocated
                                    </span>
                                    <span
                                        className={`pymtw-category-save-chip ${categoryDirty ? 'pymtw-category-save-chip-dirty' : 'pymtw-category-save-chip-saved'}`}
                                    >
                                        {categoryDirty ? '● Unsaved' : '✓ Saved'}
                                    </span>
                                </div>
                            </div>
                            <span className={`pymtw-category-action ${isOpen ? 'pymtw-category-action-open' : ''}`}>
                                <span className="pymtw-category-action-label">
                                    {isOpen ? 'Hide avenues' : 'Show avenues'}
                                </span>
                                <ChevronDown
                                    size={18}
                                    className={`pymtw-category-chevron ${isOpen ? 'pymtw-category-chevron-open' : ''}`}
                                    aria-hidden="true"
                                />
                            </span>
                        </button>
                        {isOpen && (
                            <div
                                className="pymtw-instrument-grid"
                                id={`pymtw-category-panel-${category.id}`}
                                role="region"
                                aria-labelledby={`pymtw-category-trigger-${category.id}`}
                            >
                                {category.instruments.map((instrument) => (
                                    <InstrumentCard
                                        key={instrument.type}
                                        instrument={instrument}
                                        category={category}
                                        displayName={getInstrumentDisplayName(category, instrument)}
                                        note={category.instrumentNotes?.[instrument.type]}
                                        draftAmount={draftAllocations[instrument.type] || 0}
                                        maxAmount={getMaxAmountForInstrument
                                            ? getMaxAmountForInstrument(instrument.type)
                                            : (draftAllocations[instrument.type] || 0) + Math.max(0, remainingSurplus)}
                                        onDraftChange={onDraftChange}
                                        onLispDraftChange={onLispDraftChange}
                                        familyMembers={familyMembers}
                                        currentPlanKey={currentPlanKey}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}

            {showStickyBar && (
                <AllocationStudioStickyBar
                    editingMonthLabel={editingMonthLabel}
                    remainingSurplus={remainingSurplus}
                    totalMonthlyAllocation={totalMonthlyAllocation}
                    isDirty={isDirty}
                    canSave={canApplyManual && isDirty}
                    saveLabel={saveLabel}
                    statusHint={statusHint}
                    applyError={applyError}
                    saveSuccessMessage={saveSuccessMessage}
                    onDiscard={onDiscardChanges}
                    onSave={onApplyManualAllocations}
                    discardDisabled={!isDirty}
                    isGaps={isProtectionMode}
                />
            )}
        </ReportReveal>
    );
};

export default InstrumentCardGrid;
