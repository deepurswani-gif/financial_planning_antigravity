import React, { useState } from 'react';
import './DetailedHub.css';

const HubCard = ({ id, title, icon, status = 'Not Started', summaryValue, children }) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleExpand = () => setIsExpanded(!isExpanded);

    const getStatusClass = () => {
        if (status === 'Done') return 'status-done';
        if (status === 'In Progress') return 'status-in-progress';
        return 'status-not-started';
    };

    return (
        <div className="hub-card">
            <div className="hub-card-header" onClick={toggleExpand}>
                <div className="hub-card-header-left">
                    <div className="icon-container">
                        {icon}
                    </div>
                    <div>
                        <h3 className="hub-card-title">{title}</h3>
                        <span className={`status-badge ${getStatusClass()}`}>{status}</span>
                    </div>
                </div>
                <div className="hub-card-header-right">
                    {summaryValue && <div className="hub-card-summary">{summaryValue}</div>}
                    <div className="hub-card-action">
                        {isExpanded ? 'Close' : 'Add Breakdown'}
                    </div>
                </div>
            </div>
            
            {isExpanded && (
                <div className="hub-card-body">
                    {children}
                </div>
            )}
        </div>
    );
};

export default HubCard;
