import React, { useEffect } from 'react';
import { X, TrendingUp, GraduationCap, Check } from 'lucide-react';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';
import PercentageInput from '../common/PercentageInput';

const RATE_FIELDS = [
    {
        key: 'incomeIncrement',
        label: 'Income Growth (%)',
        placeholder: 'e.g. 10',
        icon: TrendingUp,
    },
    {
        key: 'householdInflation',
        label: 'Household Expense Growth (%)',
        placeholder: 'e.g. 6',
        icon: TrendingUp,
    },
    {
        key: 'educationInflation',
        label: 'Education Cost Growth (%)',
        placeholder: 'e.g. 8',
        icon: GraduationCap,
    },
];

const GrowthAssumptionsModal = ({ isOpen, onClose }) => {
    const { inflationRates, setInflationRates, savePlanData } = useFinancialPlan();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    const handleRateChange = (name, value) => {
        setInflationRates({
            ...inflationRates,
            [name]: value,
        });
    };

    const handleSaveAndClose = async () => {
        if (savePlanData) {
            try {
                await savePlanData();
            } catch (e) {
                console.error('Failed to save growth assumptions', e);
            }
        }
        onClose();
    };

    return (
        <div className="ga-modal-overlay" onClick={onClose}>
            <div className="ga-modal-content" onClick={e => e.stopPropagation()}>
                <button className="ga-modal-close" onClick={onClose} aria-label="Close">
                    <X size={20} />
                </button>
                
                <div className="ga-modal-header">
                    <h2>Growth Assumptions</h2>
                    <p>Adjust annual growth expectations for your financial journey.</p>
                </div>

                <div className="ga-modal-body">
                    {RATE_FIELDS.map(({ key, label, placeholder, icon: Icon }) => (
                        <div key={key} className="ga-modal-field">
                            <label className="ga-modal-label">
                                <Icon size={16} className="ga-icon-muted" />
                                {label}
                            </label>
                            <PercentageInput
                                className="conversational-input"
                                value={inflationRates?.[key] ?? ''}
                                onValueChange={(v) => handleRateChange(key, v)}
                                placeholder={placeholder}
                                min={0}
                            />
                        </div>
                    ))}
                </div>

                <div className="ga-modal-footer">
                    <button className="ga-btn-primary" onClick={handleSaveAndClose}>
                        <Check size={16} /> Save & Close
                    </button>
                </div>
            </div>

            <style>{`
                .ga-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(4px);
                    z-index: 1000;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 1rem;
                    animation: ga-fade-in 0.2s ease-out;
                }

                .ga-modal-content {
                    background: var(--bg-card, #ffffff);
                    border-radius: 16px;
                    width: 100%;
                    max-width: 480px;
                    position: relative;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
                    animation: ga-slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                    border: 1px solid var(--border, #e2e8f0);
                    display: flex;
                    flex-direction: column;
                }

                .ga-modal-close {
                    position: absolute;
                    top: 1rem;
                    right: 1rem;
                    background: transparent;
                    border: none;
                    color: var(--text-muted, #64748b);
                    cursor: pointer;
                    padding: 0.25rem;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.2s;
                }

                .ga-modal-close:hover {
                    background: var(--bg-main, #f8fafc);
                    color: var(--text-main, #0f172a);
                }

                .ga-modal-header {
                    padding: 1.5rem 1.5rem 1rem;
                    border-bottom: 1px solid var(--border, #e2e8f0);
                }

                .ga-modal-header h2 {
                    margin: 0 0 0.5rem;
                    font-size: 1.25rem;
                    color: var(--text-main, #0f172a);
                }

                .ga-modal-header p {
                    margin: 0;
                    color: var(--text-muted, #64748b);
                    font-size: 0.9rem;
                    line-height: 1.5;
                }

                .ga-modal-body {
                    padding: 1.5rem;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                }

                .ga-modal-field {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .ga-modal-label {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: var(--text-main, #0f172a);
                }

                .ga-icon-muted {
                    color: var(--text-muted, #64748b);
                }

                .ga-modal-footer {
                    padding: 1rem 1.5rem;
                    border-top: 1px solid var(--border, #e2e8f0);
                    display: flex;
                    justify-content: flex-end;
                    background: var(--bg-main, #f8fafc);
                    border-bottom-left-radius: 16px;
                    border-bottom-right-radius: 16px;
                }

                .ga-btn-primary {
                    display: inline-flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: var(--primary, #2563eb);
                    color: white;
                    border: none;
                    padding: 0.6rem 1.25rem;
                    border-radius: 8px;
                    font-size: 0.9rem;
                    font-weight: 600;
                    cursor: pointer;
                    transition: background 0.2s;
                }

                .ga-btn-primary:hover {
                    background: var(--primary-dark, #1d4ed8);
                }

                @keyframes ga-fade-in {
                    from { opacity: 0; }
                    to { opacity: 1; }
                }

                @keyframes ga-slide-up {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default GrowthAssumptionsModal;
