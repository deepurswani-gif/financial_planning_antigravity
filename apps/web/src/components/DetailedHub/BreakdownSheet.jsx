import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import './BreakdownSheet.css';

const BreakdownSheet = ({
    isOpen,
    onClose,
    headerComponent,
    onSkip,
    onSave,
    children
}) => {
    // Prevent background scrolling when sheet is open and handle Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        if (isOpen) {
            document.body.style.overflow = 'hidden';
            window.addEventListener('keydown', handleKeyDown);
        } else {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        }
        return () => {
            document.body.style.overflow = 'unset';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="breakdown-sheet-overlay" onClick={onClose}>
            <div className="breakdown-sheet-content" onClick={(e) => e.stopPropagation()}>
                <div className="breakdown-sheet-header">
                    <div style={{ flex: 1, paddingRight: '1rem' }}>
                        {headerComponent}
                    </div>
                    <button className="breakdown-sheet-close" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                
                <div className="breakdown-sheet-body">
                    {children}
                </div>
                
                <div className="breakdown-sheet-footer">
                    <button className="breakdown-sheet-skip-btn" onClick={onSkip || onClose}>
                        Skip for now
                    </button>
                    <button className="breakdown-sheet-save-btn" onClick={onSave}>
                        Save breakdown
                    </button>
                </div>
            </div>
        </div>
    );
};

export default BreakdownSheet;
