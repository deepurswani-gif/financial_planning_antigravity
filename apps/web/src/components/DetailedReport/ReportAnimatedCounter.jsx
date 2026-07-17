import React, { useEffect, useState, useRef } from 'react';

const ReportAnimatedCounter = ({ value, prefix = '₹', duration = 1400 }) => {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);
    const hasAnimated = useRef(false);
    const rafRef = useRef(null);
    const displayRef = useRef(0);

    useEffect(() => {
        displayRef.current = display;
    }, [display]);

    useEffect(() => {
        const end = Math.abs(value || 0);

        const cancelRaf = () => {
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
        };

        const animateFromTo = (from, to) => {
            cancelRaf();
            const startTime = performance.now();
            const animate = (currentTime) => {
                const progress = Math.min((currentTime - startTime) / duration, 1);
                const eased = 1 - (1 - progress) ** 3;
                const next = Math.round(from + (to - from) * eased);
                setDisplay(next);
                if (progress < 1) {
                    rafRef.current = requestAnimationFrame(animate);
                } else {
                    rafRef.current = null;
                }
            };
            rafRef.current = requestAnimationFrame(animate);
        };

        // After the first reveal, keep the hero surplus in sync when allocations change.
        if (hasAnimated.current) {
            animateFromTo(displayRef.current, end);
            return cancelRaf;
        }

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting && !hasAnimated.current) {
                    hasAnimated.current = true;
                    animateFromTo(0, end);
                }
            },
            { threshold: 0.3 },
        );
        if (ref.current) observer.observe(ref.current);
        return () => {
            observer.disconnect();
            cancelRaf();
        };
    }, [value, duration]);

    const formatted = new Intl.NumberFormat('en-IN').format(display);
    return (
        <span ref={ref} className="dr-animated-counter">
            {value < 0 && '−'}{prefix}{formatted}
        </span>
    );
};

export default ReportAnimatedCounter;
