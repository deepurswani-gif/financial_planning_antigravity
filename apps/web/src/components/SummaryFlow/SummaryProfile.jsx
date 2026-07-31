import React from 'react';
import ProgressiveQuestionLayout, { useProgressiveAdvance } from './ProgressiveQuestionLayout';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import { calculateAge } from '../ProfileModule/ProfileLogic';
import { Briefcase } from 'lucide-react';

const PersonalDetailsWithAdvance = ({ selfMember, handleSelfChange, retireAge, sliderPercent }) => {
    const { advance } = useProgressiveAdvance();
    return (
        <div className="question-container">
            <p className="question-narrative">
                Let&apos;s start connecting the dots of your financial journey.
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && selfMember.name) advance();
                        }}
                        enterKeyHint="done"
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
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && selfMember.name) advance();
                        }}
                        enterKeyHint="done"
                    />
                </div>

                <div style={{ marginTop: '1.5rem' }}>
                    <h2 className="question-title" style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
                        What is your Date of Birth?
                    </h2>
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
    );
};

const OccupationWithAdvance = ({ selfMember, handleSelfChange }) => {
    const { advance } = useProgressiveAdvance();
    return (
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
                            onClick={() => {
                                handleSelfChange('occupation', item.value);
                                advance();
                            }}
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
    );
};

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

    const retireAge = selfMember.retirementAge || 60;
    const sliderPercent = ((retireAge - 40) / (60 - 40)) * 100;

    const narrative = "Great! Let's understand your monthly cash flow.";

    const questions = [
        {
            id: 'personal-details',
            content: (
                <PersonalDetailsWithAdvance
                    selfMember={selfMember}
                    handleSelfChange={handleSelfChange}
                    retireAge={retireAge}
                    sliderPercent={sliderPercent}
                />
            )
        },
        {
            id: 'occupation',
            content: (
                <OccupationWithAdvance
                    selfMember={selfMember}
                    handleSelfChange={handleSelfChange}
                />
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
