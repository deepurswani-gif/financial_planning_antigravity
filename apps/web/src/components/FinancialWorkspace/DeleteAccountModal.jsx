import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from '../../services/authService';
import { useAuth } from '../../contexts/AuthContext';
import { useFinancialPlan } from '../../contexts/FinancialPlanContext';

export default function DeleteAccountModal({ open, onClose }) {
  const [inputValue, setInputValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { handleLogoutCleanup } = useFinancialPlan();

  if (!open) return null;

  const targetText = 'Delete My account';
  const isMatch = inputValue === targetText;

  const handleDelete = async () => {
    if (!isMatch || isDeleting) return;
    setIsDeleting(true);
    
    try {
      // In a real application, you would call your backend API here to mark the account for deletion.
      // await deleteAccountApiCall(user.id);
      
      // Clear session and navigate to login
      await signOut();
      handleLogoutCleanup?.();
      navigate('/', { replace: true });
    } catch (error) {
      console.error('Failed to delete account:', error);
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)', zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '1rem'
    }}>
      <div className="modal-content" style={{
        backgroundColor: 'var(--color-surface, #fff)', 
        borderRadius: '8px',
        padding: '2rem',
        maxWidth: '500px',
        width: '100%',
        boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
      }}>
        <h2 style={{ marginTop: 0, color: 'var(--color-danger, #d32f2f)' }}>Delete Account</h2>
        <p>
          Deleting your account will place it into a deactivated state, and after a reasonable period, it will be permanently deleted.
        </p>
        <p><strong>You will lose access to:</strong></p>
        <ul style={{ marginBottom: '1.5rem' }}>
          <li>All historical financial records and progress tracking.</li>
          <li>All uploaded documents (insurance policies, statements).</li>
          <li>All generated financial outputs and reports.</li>
        </ul>
        <div style={{ marginBottom: '1.5rem' }}>
          <label htmlFor="delete-account-input" style={{ display: 'block', marginBottom: '0.5rem', fontWeight: 600 }}>
            To verify, type <i>{targetText}</i> below:
          </label>
          <input
            id="delete-account-input"
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '4px',
              border: '1px solid var(--color-border, #ccc)',
              fontSize: '1rem'
            }}
            placeholder={targetText}
            autoComplete="off"
          />
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2rem' }}>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!isMatch || isDeleting}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              border: '1px solid',
              backgroundColor: 'transparent',
              color: isMatch ? 'var(--color-danger, #d32f2f)' : 'var(--color-text-muted, #999)',
              borderColor: isMatch ? 'var(--color-danger, #d32f2f)' : 'var(--color-border, #ccc)',
              cursor: isMatch ? 'pointer' : 'not-allowed',
              fontWeight: 600,
              opacity: isDeleting ? 0.7 : 1
            }}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            style={{
              padding: '0.75rem 1.5rem',
              borderRadius: '4px',
              border: 'none',
              backgroundColor: 'var(--color-primary, #0052cc)',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600
            }}
          >
            Keep my account
          </button>
        </div>
      </div>
    </div>
  );
}
