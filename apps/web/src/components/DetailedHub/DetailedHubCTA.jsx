import React from 'react';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function DetailedHubCTA({ message, buttonText = "Update Now" }) {
    return (
        <div style={{
            background: 'var(--color-primary-light, #f0f7ff)',
            border: '1px solid var(--color-primary, #0056b3)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap'
        }}>
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#333', flex: 1 }}>
                {message}
            </p>
            <Link 
                to="/financial-workspace/full_profile"
                style={{
                    background: 'var(--color-primary, #0056b3)',
                    color: '#fff',
                    padding: '0.5rem 1rem',
                    borderRadius: '4px',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    whiteSpace: 'nowrap'
                }}
            >
                {buttonText} <ArrowRight size={16} />
            </Link>
        </div>
    );
}
