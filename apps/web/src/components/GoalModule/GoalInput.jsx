import React from 'react';
import { Trash2, Plus, HelpCircle } from 'lucide-react';
import CurrencyInput from '../common/CurrencyInput';
import YearsInput from '../common/YearsInput';
import PercentageInput from '../common/PercentageInput';

const toStored = (v) => (v == null ? '' : String(v));

const GoalInput = ({ goals, setGoals, onCalculate }) => {

    const handleGoalChange = (id, field, value) => {
        setGoals(prev => prev.map(goal =>
            goal.id === id ? { ...goal, [field]: value } : goal
        ));
    };

    const addCustomGoal = () => {
        const newGoal = {
            id: `custom_${Date.now()}`,
            name: '',
            isPredefined: false,
            placeholder: 'Enter your goal name',
            yearsToGoal: '',
            presentValue: '',
            inflationRate: 6
        };
        setGoals(prev => [...prev, newGoal]);
    };

    const deleteGoal = (id) => {
        setGoals(prev => prev.filter(goal => goal.id !== id));
    };

    const clearGoal = (id) => {
        setGoals(prev => prev.map(goal => 
            goal.id === id ? {
                ...goal,
                yearsToGoal: '',
                presentValue: '',
                inflationRate: 6,
                profession: '',
                courseDuration: '',
                totalCourseCost: ''
            } : goal
        ));
    };

    return (
        <div className="goal-input">
            <div className="goals-table-container" style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                    <thead>
                        <tr style={{ textAlign: 'left', borderBottom: '2px solid var(--border)' }}>
                            <th style={{ padding: '1rem' }}>Life Goal Name</th>
                            <th style={{ padding: '1rem' }}>Years remaining to goal</th>
                            <th style={{ padding: '1rem' }}>Year</th>
                            <th style={{ padding: '1rem' }}>Present Value (₹)</th>
                            <th style={{ padding: '1rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                    Inflation (%)
                                    <span className="tooltip-wrapper" data-tooltip="The expected annual rate at which the objective's cost will grow.">
                                        <HelpCircle size={14} />
                                    </span>
                                </div>
                            </th>
                            <th style={{ padding: '1rem', width: '50px' }}></th>
                        </tr>
                    </thead>
                    <tbody>
                        {goals.map((goal) => {
                            const isEducation = goal.name?.toLowerCase().includes('higher education');
                            
                            return (
                                <tr key={goal.id} style={{ borderBottom: '1px solid var(--border)' }}>
                                    <td style={{ padding: '0.75rem' }}>
                                        {goal.isPredefined ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontWeight: 500 }}>{goal.name}</span>
                                                {isEducation && (
                                                    <div className="education-extras" style={{ display: 'grid', gap: '8px', marginTop: '4px' }}>
                                                        <input
                                                            type="text"
                                                            value={goal.profession || ''}
                                                            onChange={(e) => handleGoalChange(goal.id, 'profession', e.target.value)}
                                                            placeholder="What your child will become"
                                                            className="input-minimal"
                                                            style={{ fontSize: '0.8rem' }}
                                                        />
                                                        <div style={{ display: 'flex', gap: '8px' }}>
                                                            <YearsInput
                                                                value={goal.courseDuration || ''}
                                                                onValueChange={(v) => handleGoalChange(goal.id, 'courseDuration', toStored(v))}
                                                                placeholder="Duration (Years)"
                                                                className="input-minimal"
                                                                style={{ fontSize: '0.8rem', width: '120px' }}
                                                            />
                                                            <CurrencyInput
                                                                name="totalCourseCost"
                                                                value={goal.totalCourseCost || ''}
                                                                onValueChange={(v) => {
                                                                    const val = toStored(v);
                                                                    handleGoalChange(goal.id, 'totalCourseCost', val);
                                                                    handleGoalChange(goal.id, 'presentValue', val);
                                                                }}
                                                                placeholder="Total Cost"
                                                                className="input-minimal"
                                                            />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <input
                                                type="text"
                                                value={goal.name}
                                                onChange={(e) => handleGoalChange(goal.id, 'name', e.target.value)}
                                                placeholder={goal.placeholder}
                                                className="input-minimal"
                                            />
                                        )}
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <YearsInput
                                            value={goal.yearsToGoal || ''}
                                            onValueChange={(v) => handleGoalChange(goal.id, 'yearsToGoal', toStored(v))}
                                            placeholder="Years"
                                            className="input-minimal"
                                            style={{ width: '80px' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <input
                                            type="text"
                                            value={goal.yearsToGoal ? new Date().getFullYear() + parseInt(goal.yearsToGoal, 10) : ''}
                                            readOnly
                                            placeholder="Year"
                                            className="input-minimal"
                                            style={{ width: '80px', background: 'var(--bg-main)', cursor: 'not-allowed' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <CurrencyInput
                                            name="presentValue"
                                            value={goal.presentValue || ''}
                                            onValueChange={(v) => handleGoalChange(goal.id, 'presentValue', toStored(v))}
                                            placeholder="0"
                                            className="input-minimal"
                                            readOnly={isEducation}
                                            style={isEducation ? { background: 'var(--bg-main)', cursor: 'not-allowed' } : undefined}
                                        />
                                    </td>
                                    <td style={{ padding: '0.75rem' }}>
                                        <PercentageInput
                                            value={goal.inflationRate || ''}
                                            onValueChange={(v) => handleGoalChange(goal.id, 'inflationRate', toStored(v))}
                                            placeholder="6%"
                                            className="input-minimal"
                                            style={{ width: '80px' }}
                                        />
                                    </td>
                                    <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                                        <button 
                                            onClick={() => goal.isPredefined ? clearGoal(goal.id) : deleteGoal(goal.id)}
                                            style={{ 
                                                background: 'transparent', 
                                                border: 'none', 
                                                color: '#ff4d4f', 
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                padding: '4px'
                                            }}
                                            title={goal.isPredefined ? "Clear goal" : "Delete goal"}
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2rem' }}>
                <button 
                    className="btn btn-secondary" 
                    onClick={addCustomGoal}
                    style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '0.5rem',
                        padding: '0.75rem 1.5rem',
                        fontSize: '0.9rem'
                    }}
                >
                    <Plus size={18} /> Add Goals
                </button>

                <button className="btn btn-primary" onClick={onCalculate} style={{ padding: '1rem 4rem' }}>
                    Project Future Costs
                </button>
            </div>

            <style jsx>{`
        .input-minimal {
          background: transparent;
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 6px 10px;
          color: var(--text-main);
          width: 100%;
          font-size: 0.9rem;
        }
        .input-minimal:focus {
          border-color: var(--primary);
          outline: none;
        }
        th {
          font-size: 0.85rem;
          color: var(--text-muted);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
      `}</style>
        </div>
    );
};

export default GoalInput;
