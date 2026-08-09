import React from 'react';
import { Link } from 'react-router-dom';

const GlobalFooter = () => {
  return (
    <footer style={{
      textAlign: 'center',
      padding: '1rem',
      marginTop: 'auto',
      borderTop: '1px solid #eaeaea',
      fontSize: '0.875rem',
      color: '#666',
      backgroundColor: '#f9f9f9',
      width: '100%',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      gap: '1.5rem',
      flexWrap: 'wrap'
    }}>
      <Link to="/about_legal_support" style={{ color: '#0070f3', textDecoration: 'none', fontWeight: '500' }}>
        About, Legal and Support
      </Link>
      <span>&copy; 2026 Finbrella. Building better financial futures.</span>
    </footer>
  );
};

export default GlobalFooter;
