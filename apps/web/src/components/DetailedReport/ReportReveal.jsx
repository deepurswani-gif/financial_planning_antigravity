import React, { useEffect, useState, useRef } from 'react';

const ReportReveal = ({ children, className = '', delay = 0 }) => {
    const [visible, setVisible] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => setVisible(true), delay);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 },
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [delay]);

    return (
        <div ref={ref} className={`dr-reveal ${visible ? 'dr-visible' : ''} ${className}`}>
            {children}
        </div>
    );
};

export default ReportReveal;
