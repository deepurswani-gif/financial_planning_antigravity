import React from 'react';
import ProgressiveQuestionLayout from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateAge } from '../ProfileModule/ProfileLogic';
import { Briefcase } from 'lucide-react';

const SummaryProfile = () => {
    const { familyMembers, setFamilyMembers } = useFinancialPlan();

    const selfMember = familyMembers.find(m => m.relation === 'Self') || {
        name: '', dob: '', occupation: 'Salaried', retirementAge: 60, relation: 'Self', mobile: ''
    };

    const handleSelfChange = (field, value) => {
        const updated = familyMembers.map(m => {
            if (m.relation === 'Self') {
                return { ...m, [field]: value };
            }
            return m;
        });
        setFamilyMembers(updated);
    };

    // Compute slider fill percentage for retirement age
    const retireAge = selfMember.retirementAge || 60;
    const sliderPercent = ((retireAge - 40) / (60 - 40)) * 100;

    const narrative = "Good start. With your profile in place, let's now understand how money flows in and out of your household each month.";

    const questions = [
        // Q1: Name & Mobile
        {
            id: 'name-mobile',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Let's start connecting the dots of your financial journey.
                        First, I would like to know your name and Mobile Number.
                    </p>
                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <div>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Name</label>
                            <input
                                type="text"
                                className="conversational-input"
                                placeholder="e.g. Rahul Sharma"
                                value={selfMember.name || ''}
                                onChange={(e) => handleSelfChange('name', e.target.value)}
                            />
                        </div>
                        <div>
                            <label style={{ fontSize: '0.82rem', fontWeight: 600, marginBottom: '0.4rem', display: 'block' }}>Mobile</label>
                            <input
                                type="tel"
                                className="conversational-input"
                                placeholder="10-digit mobile number"
                                maxLength="10"
                                value={selfMember.mobile || ''}
                                onChange={(e) => handleSelfChange('mobile', e.target.value.replace(/\D/g, '').slice(0, 10))}
                            />
                        </div>
                    </div>
                </div>
            )
        },
        // Q2: DOB + Retirement Age
        {
            id: 'dob-retirement',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        To plan your future meaningfully, I need to know where you are in your life journey.
                    </p>
                    <h2 className="question-title">What is your Date of Birth?</h2>

                    <div className="question-fields" style={{ maxWidth: '420px', margin: '0 auto' }}>
                        <div>
                            <input
                                type="date"
                                className="conversational-input"
                                value={selfMember.dob || ''}
                                onChange={(e) => handleSelfChange('dob', e.target.value)}
                            />
                            {selfMember.dob && (
                                <div style={{ fontSize: '0.85rem', color: 'var(--primary)', marginTop: '0.5rem', fontWeight: 600 }}>
                                    Age: {calculateAge(selfMember.dob)} Years
                                </div>
                            )}
                        </div>

                        <div style={{ marginTop: '2rem' }}>
                            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                                And at what age would you ideally like to retire?
                            </p>
                            <div style={{ fontSize: '2.8rem', fontWeight: 'bold', color: 'var(--primary)', marginBottom: '1.25rem', letterSpacing: '-1px' }}>
                                {retireAge} <span style={{ fontSize: '1.1rem', fontWeight: 500, color: 'var(--text-muted)' }}>Years</span>
                            </div>
                            <input
                                type="range"
                                className="summary-slider"
                                min="40"
                                max="60"
                                value={retireAge}
                                onChange={(e) => handleSelfChange('retirementAge', parseInt(e.target.value))}
                                style={{
                                    background: `linear-gradient(90deg, var(--primary) ${sliderPercent}%, var(--border) ${sliderPercent}%)`
                                }}
                            />
                            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
                                <span>40 (Early)</span>
                                <span>60 (Standard)</span>
                            </div>
                        </div>
                    </div>
                </div>
            )
        },
        // Q3: Occupation
        {
            id: 'occupation',
            content: (
                <div className="question-container">
                    <p className="question-narrative">
                        Tell me a little about your professional journey.
                    </p>

                    <div className="option-cards" style={{ maxWidth: '500px', margin: '0 auto' }}>
                        {[
                            { value: 'Salaried', desc: 'Fixed monthly paycheck' },
                            { value: 'Business / Profession', desc: 'Entrepreneur / Freelancer' }
                        ].map((item) => {
                            const isSelected = selfMember.occupation === item.value;
                            return (
                                <div
                                    key={item.value}
                                    className={`option-card ${isSelected ? 'selected' : ''}`}
                                    onClick={() => handleSelfChange('occupation', item.value)}
                                >
                                    <div style={{ color: isSelected ? 'var(--primary)' : 'var(--text-muted)' }}>
                                        <Briefcase size={28} />
                                    </div>
                                    <div className="option-card-title">{item.value}</div>
                                    <div className="option-card-desc">{item.desc}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )
        }
    ];

    return (
        <ProgressiveQuestionLayout
            currentStepId="profile"
            questions={questions}
            narrative={narrative}
        />
    );
};

export default SummaryProfile;
