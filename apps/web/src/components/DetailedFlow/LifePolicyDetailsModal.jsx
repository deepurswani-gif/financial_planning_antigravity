import React from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import InsuranceInput from '../InsuranceModule/InsuranceInput';

const LifePolicyDetailsModal = ({
    isOpen,
    onClose,
    familyMembers,
    policies,
    setPolicies,
}) => {
    if (!isOpen) return null;

    const allowedMembers = familyMembers.filter((member) => {
        const memberName = member.name || member.relation;
        return policies.some(
            (p) => p.insuredName === memberName && !p.isProposed,
        ) || member.relation === 'Self' || member.relation === 'Spouse';
    });

    return createPortal(
        <div
            style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.75)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 10000,
                padding: '1.5rem',
                backdropFilter: 'blur(6px)',
            }}
            onClick={onClose}
        >
            <div
                className="card fade-in"
                style={{
                    width: '100%',
                    maxWidth: '960px',
                    maxHeight: '90vh',
                    overflow: 'auto',
                    padding: '1.5rem',
                    background: 'var(--bg-main)',
                }}
                onClick={(e) => e.stopPropagation()}
            >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h2 style={{ margin: 0, color: 'var(--primary)', fontSize: '1.25rem' }}>
                        Life insurance policy details
                    </h2>
                    <button
                        type="button"
                        onClick={onClose}
                        style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                        }}
                        aria-label="Close"
                    >
                        <X size={22} />
                    </button>
                </div>

                {allowedMembers.length > 0 ? (
                    <InsuranceInput
                        familyMembers={allowedMembers}
                        policies={policies}
                        setPolicies={setPolicies}
                        isProposed={false}
                    />
                ) : (
                    <p style={{ color: 'var(--text-muted)' }}>
                        Add policy counts and premiums above, then fill in details here.
                    </p>
                )}

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button type="button" className="btn btn-primary" onClick={onClose}>
                        Done
                    </button>
                </div>
            </div>
        </div>,
        document.body,
    );
};

export default LifePolicyDetailsModal;
