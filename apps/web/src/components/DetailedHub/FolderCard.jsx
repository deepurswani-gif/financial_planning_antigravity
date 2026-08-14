import React from 'react';
import { ArrowRight, CloudUpload, ListTodo } from 'lucide-react';
import './FolderCard.css';

const FolderCard = ({
    id,
    title,
    description,
    icon,
    completedCount = 0,
    totalCount = 0,
    isVault = false,
    onClick
}) => {
    const progressPercentage = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
    
    return (
        <div className={`folder-card folder-card-${id}`} onClick={onClick} style={{ position: 'relative' }}>
            {((!isVault && completedCount < totalCount) || (isVault && completedCount === 0)) && (
                <div style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-6px',
                    width: '12px',
                    height: '12px',
                    backgroundColor: '#ef4444',
                    borderRadius: '50%',
                    border: '2px solid white',
                    zIndex: 10
                }} title="Incomplete sections" />
            )}
            <div className="folder-card-top-row">
                <div className="folder-card-icon">
                    {icon}
                </div>
                <div className="folder-card-progress-badge">
                    {isVault ? (
                        <>
                            <CloudUpload size={14} className="badge-icon" />
                            <span>{completedCount} uploaded</span>
                        </>
                    ) : (
                        <>
                            <ListTodo size={14} className="badge-icon" />
                            <span>{completedCount} / {totalCount} completed</span>
                        </>
                    )}
                </div>
            </div>
            
            <div className="folder-card-content">
                <h3 className="folder-card-title">{title}</h3>
                <p className="folder-card-description">{description}</p>
            </div>
            
            <div className="folder-card-progress-bar-container">
                <div 
                    className="folder-card-progress-bar-fill" 
                    style={{ width: `${progressPercentage}%` }}
                ></div>
            </div>
            
            <button className="folder-card-button" onClick={(e) => {
                e.stopPropagation();
                onClick();
            }}>
                {isVault ? (
                    <>
                        <CloudUpload size={16} style={{ marginRight: '0.5rem' }} />
                        Upload policies
                    </>
                ) : (
                    <>
                        View breakdown
                        <ArrowRight size={16} style={{ marginLeft: 'auto' }} />
                    </>
                )}
            </button>
        </div>
    );
};

export default FolderCard;
