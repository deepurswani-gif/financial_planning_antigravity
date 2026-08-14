import React from 'react';
import { ArrowRight } from 'lucide-react';
import './SubCard.css';

const SubCard = ({
    id,
    title,
    description,
    icon,
    status = 'Not started',
    summaryLabel,
    summaryValue,
    buttonText = 'Add breakdown',
    extraActions,
    onClick
}) => {
    return (
        <div className="sub-card" onClick={onClick}>
            <div className="sub-card-header">
                <div className="sub-card-title-area">
                    <div className="sub-card-icon">
                        {icon}
                    </div>
                    <div>
                        <h4 className="sub-card-title">{title}</h4>
                        <p className="sub-card-description">{description}</p>
                    </div>
                </div>
                <div className="sub-card-status">
                    <div className={`status-dot ${status === 'Done' ? 'done' : 'not-started'}`}></div>
                    {status}
                </div>
            </div>

            {summaryValue && (
                <div className="sub-card-summary">
                    {summaryLabel && <span className="summary-label">{summaryLabel}</span>}
                    <div className="summary-value">{summaryValue}</div>
                </div>
            )}
            
            <div className="sub-card-actions">
                <button className="sub-card-button" onClick={(e) => {
                    e.stopPropagation();
                    onClick();
                }}>
                    {buttonText}
                    <ArrowRight size={16} />
                </button>
                {extraActions && (
                    <div className="sub-card-extra-actions" onClick={(e) => e.stopPropagation()}>
                        {extraActions}
                    </div>
                )}
            </div>
        </div>
    );
};

export default SubCard;
