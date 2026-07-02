import React, { useEffect, useState, useRef } from 'react';

const ReportAnimatedCounter = ({ value, prefix = '₹', duration = 1400 }) => {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);
    const hasAnimated = useRef(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    const end = Math.abs(value || 0);
                    const startTime = performance.now();

                    const animate = (currentTime) => {
                        const progress = Math.min((currentTime - startTime) / duration, 1);
                        const eased = 1 - (1 - progress) ** 3;
                        setDisplay(Math.round(end * eased));
                        if (progress < 1) requestAnimationFrame(animate);
                    };
                    requestAnimationFrame(animate);
                }
            },
            { threshold: 0.3 },
        );
        if (ref.current) observer.observe(ref.current);
        return () => observer.disconnect();
    }, [value, duration]);

    const formatted = new Intl.NumberFormat('en-IN').format(display);
    return (
        <span ref={ref} className="dr-animated-counter">
            {value < 0 && '−'}{prefix}{formatted}
        </span>
    );
};

export default ReportAnimatedCounter;
