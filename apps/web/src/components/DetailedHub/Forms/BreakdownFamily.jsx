import React, { useCallback, useEffect } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useFinancialPlan } from '../../../contexts/FinancialPlanContext';
import { calculateAge } from '../../ProfileModule/ProfileLogic';
import {
    EMPLOYMENT_TYPES,
    syncOccupationFromEmploymentType,
    guessEmploymentTypeFromSummaryOccupation,
    createEmptySpouseMember,
    createEmptyChildMember,
    applyChildOccupationFields,
} from '../../DetailedFlow/employmentTypeSync';
import { EDUCATION_STANDARDS } from '../../JourneyModule/ProjectionLogic';
import { applyHouseholdEducationFromChildren } from '../../DetailedFlow/educationExpenseSync';
import YearsInput from '../../common/YearsInput';
import IntegerInput from '../../common/IntegerInput';
import CurrencyInput from '../../common/CurrencyInput';
import DateInput from '../../common/DateInput';

const BreakdownFamily = () => {
    const { familyMembers, setFamilyMembers, setHasSpouseIncome, setExpenseCategories } = useFinancialPlan();

    useEffect(() => {
        setFamilyMembers(prev => {
            let changed = false;
            const hasSpouse = prev.some(m => m.relation === 'Spouse');
            const hasChildren = prev.some(m => m.relation === 'Child');
            const next = prev.map(m => {
                if (m.relation === 'Self') {
                    const updates = { ...m };
                    if (m.isMarried === undefined && (hasSpouse || hasChildren)) {
                        updates.isMarried = true;
                        changed = true;
                    }
                    if (!m.employmentType && m.occupation) {
                        const guessed = guessEmploymentTypeFromSummaryOccupation(m.occupation);
                        if (guessed) {
                            updates.employmentType = guessed;
                            changed = true;
                        }
                    }
                    return updates;
                }
                if (m.relation === 'Spouse' && m.isSpouseWorking === undefined) {
                    changed = true;
                    return {
                        ...m,
                        isSpouseWorking: m.occupation?.toLowerCase() !== 'housewife',
                        employmentType: m.employmentType || guessEmploymentTypeFromSummaryOccupation(m.occupation),
                    };
                }
                return m;
            });
            return changed ? next : prev;
        });
    }, [setFamilyMembers]);

    const selfMember = familyMembers.find(m => m.relation === 'Self') || {
        name: '', dob: '', occupation: 'Salaried', retirementAge: 60, relation: 'Self', mobile: '',
    };
    const spouseMember = familyMembers.find(m => m.relation === 'Spouse');
    const childMembers = familyMembers.filter(m => m.relation === 'Child');

    const isMarried = selfMember.isMarried === true;
    const isMarriedExplicitNo = selfMember.isMarried === false;
    const isSpouseWorking = spouseMember?.isSpouseWorking === true;
    const isSpouseWorkingExplicitNo = spouseMember?.isSpouseWorking === false;

    const setMembers = useCallback((updater) => {
        setFamilyMembers(typeof updater === 'function' ? updater : updater);
    }, [setFamilyMembers]);

    const updateSelf = useCallback((field, value) => {
        setMembers(prev => prev.map(m => {
            if (m.relation !== 'Self') return m;
            const updated = { ...m, [field]: value };
            if (field === 'employmentType') {
                updated.occupation = syncOccupationFromEmploymentType(value);
            }
            return updated;
        }));
    }, [setMembers]);

    const updateSpouse = useCallback((field, value) => {
        setMembers(prev => {
            const hasSpouse = prev.some(m => m.relation === 'Spouse');
            let next = hasSpouse ? [...prev] : [...prev, createEmptySpouseMember()];
            next = next.map(m => {
                if (m.relation !== 'Spouse') return m;
                const updated = { ...m, [field]: value };
                if (field === 'employmentType') {
                    updated.occupation = syncOccupationFromEmploymentType(value);
                }
                if (field === 'isSpouseWorking' && value === false) {
                    updated.occupation = 'Housewife';
                    updated.employmentType = '';
                }
                if (field === 'isSpouseWorking' && value === true) {
                    updated.occupation = updated.employmentType
                        ? syncOccupationFromEmploymentType(updated.employmentType)
                        : 'Salaried';
                }
                return updated;
            });
            return next;
        });
    }, [setMembers]);

    const setMarried = useCallback((married) => {
        updateSelf('isMarried', married);
        if (!married) {
            setHasSpouseIncome(false);
            setMembers(prev => prev.filter(m => m.relation !== 'Spouse' && m.relation !== 'Child'));
        } else if (!familyMembers.some(m => m.relation === 'Spouse')) {
            setMembers(prev => [...prev, createEmptySpouseMember()]);
        }
    }, [updateSelf, setMembers, setHasSpouseIncome, familyMembers]);

    const updateChild = useCallback((index, field, value) => {
        setMembers(prev => {
            const children = prev.filter(m => m.relation === 'Child');
            const others = prev.filter(m => m.relation !== 'Child');
            const updatedChildren = children.map((c, i) => (i === index ? { ...c, [field]: value } : c));
            return [...others, ...updatedChildren];
        });
    }, [setMembers]);

    const updateChildOccupation = useCallback((index, occupation) => {
        setMembers(prev => {
            const children = prev.filter(m => m.relation === 'Child');
            const others = prev.filter(m => m.relation !== 'Child');
            const updatedChildren = children.map((c, i) => (
                i === index ? applyChildOccupationFields(c, occupation) : c
            ));
            const next = [...others, ...updatedChildren];
            setExpenseCategories((ec) => applyHouseholdEducationFromChildren(ec, next));
            return next;
        });
    }, [setMembers, setExpenseCategories]);

    const applySemYearHelper = useCallback((index, kind) => {
        const child = childMembers[index];
        if (!child) return;
        const val = (child.currentSemYear || '').trim();
        if (!val) {
            updateChild(index, 'currentSemYear', kind === 'semester' ? '1st Semester' : '1st Year');
        } else if (!/semester|year/i.test(val)) {
            updateChild(index, 'currentSemYear', `${val} ${kind === 'semester' ? 'Semester' : 'Year'}`);
        }
    }, [childMembers, updateChild]);

    const addChild = useCallback(() => {
        setMembers(prev => [...prev, createEmptyChildMember()]);
    }, [setMembers]);

    const removeChild = useCallback((index) => {
        setMembers(prev => {
            const children = prev.filter(m => m.relation === 'Child');
            const others = prev.filter(m => m.relation !== 'Child');
            return [...others, ...children.filter((_, i) => i !== index)];
        });
    }, [setMembers]);

    const selfEmploymentType = selfMember.employmentType
        || guessEmploymentTypeFromSummaryOccupation(selfMember.occupation);

    const yesNoToggle = (value, onYes, onNo) => (
        <div style={{ display: 'flex', gap: '0.5rem', background: '#f8fafc', padding: '0.35rem', borderRadius: '8px', border: '1px solid #e2e8f0', width: 'fit-content' }}>
            <button
                type="button"
                onClick={onYes}
                style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: value === true ? '#fff' : 'transparent',
                    color: value === true ? '#0f172a' : '#64748b',
                    boxShadow: value === true ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s',
                }}
            >
                Yes
            </button>
            <button
                type="button"
                onClick={onNo}
                style={{
                    padding: '0.5rem 1rem',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    background: value === false ? '#fff' : 'transparent',
                    color: value === false ? '#0f172a' : '#64748b',
                    boxShadow: value === false ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                    transition: 'all 0.2s',
                }}
            >
                No
            </button>
        </div>
    );

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
            
            {/* SELF SECTION */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <h3 style={{ fontSize: '1.1rem', color: '#111', marginBottom: '1.5rem' }}>Your details</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                    <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name</label>
                        <input type="text" className="conversational-input" value={selfMember.name || ''} onChange={(e) => updateSelf('name', e.target.value)} />
                    </div>
                    <div>
                        <DateInput
                            label="Date of birth"
                            className="conversational-input"
                            value={selfMember.dob || ''}
                            onChange={(iso) => updateSelf('dob', iso)}
                        />
                    </div>
                    <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Employment type</label>
                        <select className="conversational-input" value={selfEmploymentType || ''} onChange={(e) => updateSelf('employmentType', e.target.value)}>
                            <option value="">Select employment type</option>
                            {EMPLOYMENT_TYPES.map(type => (
                                <option key={type} value={type}>{type}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Retirement age</label>
                        <YearsInput
                            className="conversational-input"
                            min={40}
                            max={70}
                            value={selfMember.retirementAge ?? 60}
                            onValueChange={(v) => updateSelf('retirementAge', v)}
                        />
                    </div>
                </div>
                <div style={{ marginTop: '1.5rem' }}>
                    <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>Are you married?</label>
                    {yesNoToggle(
                        isMarried ? true : isMarriedExplicitNo ? false : null,
                        () => setMarried(true),
                        () => setMarried(false),
                    )}
                </div>
            </section>

            {/* SPOUSE SECTION */}
            {isMarried && (
                <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#111', marginBottom: '1.5rem' }}>Spouse details</h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                        <div>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name</label>
                            <input type="text" className="conversational-input" value={spouseMember?.name || ''} onChange={(e) => updateSpouse('name', e.target.value)} />
                        </div>
                        <div>
                            <DateInput
                                label="Date of birth"
                                className="conversational-input"
                                value={spouseMember?.dob || ''}
                                onChange={(iso) => updateSpouse('dob', iso)}
                            />
                        </div>
                    </div>
                    
                    <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
                        <label style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>Is your spouse working?</label>
                        {yesNoToggle(
                            isSpouseWorking ? true : isSpouseWorkingExplicitNo ? false : null,
                            () => {
                                updateSpouse('isSpouseWorking', true);
                                setHasSpouseIncome(true);
                            },
                            () => {
                                updateSpouse('isSpouseWorking', false);
                                setHasSpouseIncome(false);
                            },
                        )}
                    </div>
                    
                    {isSpouseWorking && (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', paddingTop: '1.5rem', borderTop: '1px solid #eaeaea' }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Employment type</label>
                                <select className="conversational-input" value={spouseMember?.employmentType || ''} onChange={(e) => updateSpouse('employmentType', e.target.value)}>
                                    <option value="">Select employment type</option>
                                    {EMPLOYMENT_TYPES.map(type => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Retirement age</label>
                                <YearsInput
                                    className="conversational-input"
                                    min={40}
                                    max={70}
                                    value={spouseMember?.retirementAge ?? 60}
                                    onValueChange={(v) => updateSpouse('retirementAge', v)}
                                />
                            </div>
                        </div>
                    )}
                </section>
            )}

            {/* CHILDREN SECTION */}
            <section style={{ background: '#fff', borderRadius: '12px', padding: '1.5rem', border: '1px solid #eaeaea' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                    <h3 style={{ fontSize: '1.1rem', color: '#111', margin: 0 }}>Children</h3>
                    <button type="button" className="btn btn-secondary" onClick={addChild} style={{ fontSize: '0.85rem', padding: '0.4rem 0.75rem' }}>
                        <Plus size={14} style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} /> Add Child
                    </button>
                </div>

                {childMembers.length === 0 && (
                    <p style={{ fontSize: '0.85rem', color: '#666', textAlign: 'center', padding: '2rem 0' }}>No children added yet.</p>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    {childMembers.map((child, index) => (
                        <div key={index} style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', position: 'relative' }}>
                            <button
                                type="button"
                                onClick={() => removeChild(index)}
                                style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer' }}
                                aria-label="Remove child"
                            >
                                <Trash2 size={16} />
                            </button>
                            
                            <h4 style={{ margin: '0 0 1rem 0', fontSize: '0.95rem', color: 'var(--primary)' }}>Child {index + 1}</h4>
                            
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name</label>
                                    <input type="text" className="conversational-input" value={child.name || ''} onChange={(e) => updateChild(index, 'name', e.target.value)} />
                                </div>
                                <div>
                                    <DateInput
                                        label="Date of birth"
                                        className="conversational-input"
                                        value={child.dob || ''}
                                        onChange={(iso) => updateChild(index, 'dob', iso)}
                                    />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Studying at</label>
                                    <select className="conversational-input" value={child.occupation || ''} onChange={(e) => updateChildOccupation(index, e.target.value)}>
                                        <option value="">Select option</option>
                                        <option value="School">School</option>
                                        <option value="College">College</option>
                                    </select>
                                </div>
                                
                                {child.occupation === 'School' && (
                                    <div>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Standard</label>
                                        <select className="conversational-input" value={child.standard || ''} onChange={(e) => updateChild(index, 'standard', e.target.value)}>
                                            <option value="">Select Standard</option>
                                            {EDUCATION_STANDARDS.map((std) => (
                                                <option key={std} value={std}>{std}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {child.occupation === 'College' && (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '1rem' }}>
                                    <div>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name of course</label>
                                        <input type="text" className="conversational-input" value={child.courseName || ''} onChange={(e) => updateChild(index, 'courseName', e.target.value)} placeholder="e.g. B.Tech" />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Current Semester / Year</label>
                                        <input type="text" className="conversational-input" value={child.currentSemYear || ''} onChange={(e) => updateChild(index, 'currentSemYear', e.target.value)} placeholder="e.g. 2nd Year" />
                                        <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                                            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => applySemYearHelper(index, 'semester')}>Semester</button>
                                            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }} onClick={() => applySemYearHelper(index, 'year')}>Year</button>
                                        </div>
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Duration of course (Years)</label>
                                        <IntegerInput
                                            className="conversational-input"
                                            value={child.courseDuration || ''}
                                            onValueChange={(v) => updateChild(index, 'courseDuration', v == null ? '' : String(v))}
                                            placeholder="e.g. 4"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Years of fee yet to pay</label>
                                        <IntegerInput
                                            className="conversational-input"
                                            value={child.remainingTime || ''}
                                            onValueChange={(v) => updateChild(index, 'remainingTime', v == null ? '' : String(v))}
                                            placeholder="e.g. 2"
                                            min={0}
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Cost of complete course</label>
                                        <CurrencyInput
                                            className="conversational-input"
                                            value={child.costOfCompleteCourse || ''}
                                            onValueChange={(v) => updateChild(index, 'costOfCompleteCourse', v == null ? '' : String(v))}
                                            placeholder="0"
                                        />
                                    </div>
                                    <div>
                                        <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Is {child.currentSemYear || 'current year'} fee paid?</label>
                                        <select className="conversational-input" value={child.isFeePaid || ''} onChange={(e) => updateChild(index, 'isFeePaid', e.target.value)}>
                                            <option value="">Select Option</option>
                                            <option value="YES">YES</option>
                                            <option value="NO">NO</option>
                                        </select>
                                    </div>
                                </div>
                            )}

                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
};

export default BreakdownFamily;
