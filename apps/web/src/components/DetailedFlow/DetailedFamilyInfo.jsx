import React, { useMemo, useState, useCallback, useEffect } from 'react';
import { Plus, Trash2, Pencil, Check } from 'lucide-react';
import DetailedProgressiveLayout from './DetailedProgressiveLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateAge } from '../ProfileModule/ProfileLogic';
import {
    EMPLOYMENT_TYPES,
    syncOccupationFromEmploymentType,
    guessEmploymentTypeFromSummaryOccupation,
    createEmptySpouseMember,
    createEmptyChildMember,
    applyChildOccupationFields,
} from './employmentTypeSync';
import { EDUCATION_STANDARDS } from '../JourneyModule/ProjectionLogic';

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    } catch {
        return value;
    }
};

const DetailedFamilyInfo = () => {
    const { familyMembers, setFamilyMembers, setHasSpouseIncome } = useFinancialPlan();
    const [editingRecap, setEditingRecap] = useState(false);

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

    const retireAge = selfMember.retirementAge || 60;
    const sliderPercent = ((retireAge - 40) / (60 - 40)) * 100;

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
            return [...others, ...updatedChildren];
        });
    }, [setMembers]);

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

    const employmentSelect = (value, onChange, idPrefix) => (
        <select
            className="conversational-input"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            style={{ width: '100%' }}
        >
            <option value="">Select employment type</option>
            {EMPLOYMENT_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
            ))}
        </select>
    );

    const yesNoToggle = (value, onYes, onNo) => (
        <div className="yes-no-toggle">
            <button type="button" className={`yes-no-btn ${value === true ? 'active-yes' : ''}`} onClick={onYes}>Yes</button>
            <button type="button" className={`yes-no-btn ${value === false ? 'active-no' : ''}`} onClick={onNo}>No</button>
        </div>
    );

    const questions = useMemo(() => {
        const list = [
            {
                id: 'recap',
                content: (
                    <div className="question-container">
                        <p className="question-narrative">
                            Let&apos;s build a richer picture of your family. Here&apos;s what we already know from your summary.
                        </p>
                        <div className="card" style={{ padding: '1.25rem', marginBottom: '1rem', textAlign: 'left' }}>
                            {!editingRecap ? (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Your details</h3>
                                        <button type="button" className="btn btn-secondary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setEditingRecap(true)}>
                                            <Pencil size={14} style={{ marginRight: '0.35rem' }} /> Edit
                                        </button>
                                    </div>
                                    <div style={{ display: 'grid', gap: '0.5rem', fontSize: '0.95rem' }}>
                                        <div><strong>Name:</strong> {selfMember.name || '—'}</div>
                                        <div><strong>Mobile:</strong> {selfMember.mobile || '—'}</div>
                                        <div><strong>Date of birth:</strong> {formatDate(selfMember.dob)}{selfMember.dob ? ` (${calculateAge(selfMember.dob)} yrs)` : ''}</div>
                                        <div><strong>Retirement age:</strong> {retireAge} years</div>
                                        <div><strong>Summary occupation:</strong> {selfMember.occupation || '—'}</div>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                        <h3 style={{ margin: 0, fontSize: '1rem', color: 'var(--primary)' }}>Edit your details</h3>
                                        <button type="button" className="btn btn-primary" style={{ padding: '0.35rem 0.75rem', fontSize: '0.85rem' }} onClick={() => setEditingRecap(false)}>
                                            <Check size={14} style={{ marginRight: '0.35rem' }} /> Done
                                        </button>
                                    </div>
                                    <div className="question-fields" style={{ gap: '1rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name</label>
                                            <input type="text" className="conversational-input" value={selfMember.name || ''} onChange={(e) => updateSelf('name', e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Mobile</label>
                                            <input type="tel" className="conversational-input" maxLength="10" value={selfMember.mobile || ''} onChange={(e) => updateSelf('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Date of birth</label>
                                            <input type="date" className="conversational-input" value={selfMember.dob || ''} onChange={(e) => updateSelf('dob', e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Retirement age: {retireAge}</label>
                                            <input
                                                type="range"
                                                className="summary-slider"
                                                min="40"
                                                max="60"
                                                value={retireAge}
                                                onChange={(e) => updateSelf('retirementAge', parseInt(e.target.value, 10))}
                                                style={{ background: `linear-gradient(90deg, var(--primary) ${sliderPercent}%, var(--border) ${sliderPercent}%)` }}
                                            />
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                        <p className="question-helper">Next, a few details about your work and family.</p>
                    </div>
                ),
            },
            {
                id: 'self-profile',
                content: (
                    <div className="question-container">
                        <p className="question-narrative">Tell me about your professional background and family status.</p>
                        <h2 className="question-title">Your work &amp; family</h2>
                        <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Employment type</label>
                                {employmentSelect(selfEmploymentType, (val) => updateSelf('employmentType', val))}
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name of Department / Organization / Business</label>
                                <input type="text" className="conversational-input" placeholder="e.g. State Bank of India" value={selfMember.organizationName || ''} onChange={(e) => updateSelf('organizationName', e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Nature of Work</label>
                                <input type="text" className="conversational-input" placeholder="e.g. IT Consulting" value={selfMember.natureOfBusiness || ''} onChange={(e) => updateSelf('natureOfBusiness', e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Educational Qualification</label>
                                <input type="text" className="conversational-input" placeholder="e.g. MBA" value={selfMember.educationalQualification || ''} onChange={(e) => updateSelf('educationalQualification', e.target.value)} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>Are you married?</label>
                                {yesNoToggle(
                                    isMarried ? true : isMarriedExplicitNo ? false : null,
                                    () => setMarried(true),
                                    () => setMarried(false),
                                )}
                            </div>
                        </div>
                    </div>
                ),
            },
        ];

        if (isMarried) {
            list.push({
                id: 'spouse-details',
                content: (
                    <div className="question-container">
                        <p className="question-narrative">Let&apos;s capture your spouse&apos;s details.</p>
                        <h2 className="question-title">Spouse details</h2>
                        <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto', gap: '1rem' }}>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name</label>
                                <input type="text" className="conversational-input" value={spouseMember?.name || ''} onChange={(e) => updateSpouse('name', e.target.value)} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Date of birth</label>
                                <input type="date" className="conversational-input" value={spouseMember?.dob || ''} onChange={(e) => updateSpouse('dob', e.target.value)} />
                                {spouseMember?.dob && (
                                    <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem', fontWeight: 600 }}>
                                        Age: {calculateAge(spouseMember.dob)} Years
                                    </div>
                                )}
                            </div>
                            <div>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Mobile number</label>
                                <input type="tel" className="conversational-input" maxLength="10" value={spouseMember?.mobile || ''} onChange={(e) => updateSpouse('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))} />
                            </div>
                            <div style={{ marginTop: '0.5rem' }}>
                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.75rem', display: 'block' }}>Is your spouse working?</label>
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
                        </div>
                    </div>
                ),
            });

            if (isSpouseWorking) {
                list.push({
                    id: 'spouse-employment',
                    content: (
                        <div className="question-container">
                            <p className="question-narrative">Tell us about your spouse&apos;s professional details.</p>
                            <h2 className="question-title">Spouse employment</h2>
                            <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto', gap: '1rem' }}>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Employment type</label>
                                    {employmentSelect(spouseMember?.employmentType || '', (val) => updateSpouse('employmentType', val))}
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name of Department / Organization / Business</label>
                                    <input type="text" className="conversational-input" value={spouseMember?.organizationName || ''} onChange={(e) => updateSpouse('organizationName', e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Nature of Work</label>
                                    <input type="text" className="conversational-input" value={spouseMember?.natureOfBusiness || ''} onChange={(e) => updateSpouse('natureOfBusiness', e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Educational Qualification</label>
                                    <input type="text" className="conversational-input" value={spouseMember?.educationalQualification || ''} onChange={(e) => updateSpouse('educationalQualification', e.target.value)} />
                                </div>
                                <div>
                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Retirement age</label>
                                    <input type="number" className="conversational-input" min="40" max="70" value={spouseMember?.retirementAge ?? 60} onChange={(e) => updateSpouse('retirementAge', parseInt(e.target.value, 10) || 60)} />
                                </div>
                            </div>
                        </div>
                    ),
                });
            }

            list.push({
                id: 'children',
                content: (
                    <div className="question-container">
                        <p className="question-narrative">If you have children, add their details here. Monthly fees will be collected in Money in &amp; Money out.</p>
                        <h2 className="question-title">Children</h2>
                        <div className="question-fields" style={{ maxWidth: '480px', margin: '0 auto', gap: '1rem' }}>
                            {childMembers.length === 0 && (
                                <p className="question-helper" style={{ textAlign: 'center' }}>No children added yet. You can skip this or add a child below.</p>
                            )}
                            {childMembers.map((child, index) => (
                                <div key={index} className="card" style={{ padding: '1rem', border: '1px solid var(--border)', position: 'relative' }}>
                                    <button
                                        type="button"
                                        onClick={() => removeChild(index)}
                                        style={{ position: 'absolute', top: '0.75rem', right: '0.75rem', background: 'transparent', border: 'none', color: 'var(--negative)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.85rem' }}
                                    >
                                        <Trash2 size={14} /> Remove
                                    </button>
                                    <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: 'var(--tertiary)' }}>Child {index + 1}</div>
                                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name</label>
                                            <input type="text" className="conversational-input" value={child.name || ''} onChange={(e) => updateChild(index, 'name', e.target.value)} />
                                        </div>
                                        <div>
                                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Date of birth</label>
                                            <input type="date" className="conversational-input" value={child.dob || ''} onChange={(e) => updateChild(index, 'dob', e.target.value)} />
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
                                                <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Studying in Standard</label>
                                                <select className="conversational-input" value={child.standard || ''} onChange={(e) => updateChild(index, 'standard', e.target.value)}>
                                                    <option value="">Select Standard</option>
                                                    {EDUCATION_STANDARDS.map((std) => (
                                                        <option key={std} value={std}>{std}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                        {child.occupation === 'College' && (
                                            <>
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
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Duration of the course (Years)</label>
                                                    <input type="number" className="conversational-input" value={child.courseDuration || ''} onChange={(e) => updateChild(index, 'courseDuration', e.target.value)} placeholder="e.g. 4" />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>How many years of fee yet to pay?</label>
                                                    <input type="number" className="conversational-input" value={child.remainingTime || ''} onChange={(e) => updateChild(index, 'remainingTime', e.target.value)} placeholder="e.g. 2" min="0" />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Cost of complete course</label>
                                                    <input type="number" className="conversational-input" value={child.costOfCompleteCourse || ''} onChange={(e) => updateChild(index, 'costOfCompleteCourse', e.target.value)} placeholder="0" />
                                                </div>
                                                <div>
                                                    <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>
                                                        Is {child.currentSemYear || 'current year'} fee paid?
                                                    </label>
                                                    <select className="conversational-input" value={child.isFeePaid || ''} onChange={(e) => updateChild(index, 'isFeePaid', e.target.value)}>
                                                        <option value="">Select Option</option>
                                                        <option value="YES">YES</option>
                                                        <option value="NO">NO</option>
                                                    </select>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                            <button type="button" className="btn btn-secondary" onClick={addChild} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%' }}>
                                <Plus size={18} /> Add Child
                            </button>
                        </div>
                    </div>
                ),
            });
        }

        return list;
    }, [
        editingRecap, selfMember, spouseMember, childMembers, isMarried, isMarriedExplicitNo,
        isSpouseWorking, isSpouseWorkingExplicitNo, retireAge, sliderPercent, selfEmploymentType,
        updateSelf, updateSpouse, setMarried, updateChild, updateChildOccupation, applySemYearHelper, addChild, removeChild, setHasSpouseIncome,
    ]);

    const narrative = isMarried
        ? "Thank you. I now have a clearer picture of your family. Next we'll look at your cash flow in more detail."
        : "Thank you. I have your professional details on record. Next we'll look at your cash flow in more detail.";

    return (
        <DetailedProgressiveLayout
            currentStepId="familyinfo"
            questions={questions}
            narrative={narrative}
            lastSectionLabel="Save & Continue"
        />
    );
};

export default DetailedFamilyInfo;
