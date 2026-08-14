import React, { useEffect } from 'react';
import { X, Wallet, ArrowRightLeft, Users, Target, Shield, Landmark, TrendingUp } from 'lucide-react';
import SubCard from './SubCard';
import './BreakdownModal.css';

const BreakdownModal = ({ isOpen, onClose, activeCategory, onOpenSheet, completedStates = {} }) => {
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

    const renderSubCards = () => {
        switch (activeCategory) {
            case 'money':
                return (
                    <>
                        <SubCard 
                            id="income"
                            title="Income & Taxes"
                            description="Self and spouse income combined"
                            icon={<ArrowRightLeft size={18} />}
                            status={completedStates.income ? "Done" : "Not started"}
                            onClick={() => onOpenSheet('income')}
                        />
                        <SubCard 
                            id="expenses"
                            title="Household & Lifestyle Expenses"
                            description="Monthly household spends"
                            icon={<Wallet size={18} />}
                            status={completedStates.expenses ? "Done" : "Not started"}
                            onClick={() => onOpenSheet('expenses')}
                        />
                        <SubCard 
                            id="debt"
                            title="Debt & EMIs"
                            description="Loans and monthly EMI obligations"
                            icon={<Landmark size={18} />}
                            status={completedStates.debt ? "Done" : "Not started"}
                            onClick={() => onOpenSheet('debt')}
                        />
                        <SubCard 
                            id="insurance"
                            title="Insurance Premiums"
                            description="Monthly insurance premiums"
                            icon={<Shield size={18} />}
                            status={completedStates.insurance ? "Done" : "Not started"}
                            onClick={() => onOpenSheet('insurance')}
                        />
                        <SubCard 
                            id="savings"
                            title="Savings & Investments"
                            description="SIPs, PPF, NPS, Deposits"
                            icon={<TrendingUp size={18} />}
                            status={completedStates.savings ? "Done" : "Not started"}
                            onClick={() => onOpenSheet('savings')}
                        />
                    </>
                );
            case 'family':
                return (
                    <SubCard 
                        id="family-details"
                        title="Family & Dependents"
                        description="Self, spouse, and children details"
                        icon={<Users size={18} />}
                        status={completedStates['family-details'] ? "Done" : "Not started"}
                        onClick={() => onOpenSheet('family-details')}
                    />
                );
            case 'wealth':
                return (
                    <>
                        <SubCard 
                            id="assets"
                            title="Assets"
                            description="Real estate, equity, bank balances"
                            icon={<Wallet size={18} />}
                            status={completedStates.assets ? "Done" : "Not started"}
                            onClick={() => onOpenSheet('assets')}
                        />
                        <SubCard 
                            id="liabilities"
                            title="Liabilities"
                            description="Outstanding principal on loans"
                            icon={<Landmark size={18} />}
                            status={completedStates.liabilities ? "Done" : "Not started"}
                            onClick={() => onOpenSheet('liabilities')}
                        />
                    </>
                );
            default:
                return null;
        }
    };

    const getTitle = () => {
        switch (activeCategory) {
            case 'money': return 'Money In & Money Out';
            case 'family': return 'Family Information';
            case 'wealth': return 'My Wealth Snapshot';
            default: return '';
        }
    };

    const getDescription = () => {
        switch (activeCategory) {
            case 'money': return 'Income, expenses, debt and insurance';
            case 'family': return 'Household members and personal details';
            case 'wealth': return 'Investments, cash and real estate';
            default: return '';
        }
    };

    return (
        <div className="breakdown-modal-overlay" onClick={onClose}>
            <div className="breakdown-modal-content" onClick={e => e.stopPropagation()}>
                <button className="breakdown-modal-close" onClick={onClose}>
                    <X size={20} />
                </button>
                
                <div className="breakdown-modal-header">
                    <h2>{getTitle()}</h2>
                    <p>{getDescription()}</p>
                </div>

                <div className="breakdown-modal-grid">
                    {renderSubCards()}
                </div>
            </div>
        </div>
    );
};

export default BreakdownModal;
