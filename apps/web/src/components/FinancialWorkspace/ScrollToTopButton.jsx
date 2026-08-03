import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

/**
 * Floating back-to-top control for mobile report scrolling.
 * Uses window scroll — workspace content grows with the page (no inner overflow pane).
 */
export default function ScrollToTopButton({ enabled = true }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setVisible(false);
      return undefined;
    }

    const onScroll = () => {
      const doc = document.documentElement;
      const maxScroll = Math.max(0, doc.scrollHeight - window.innerHeight);
      if (maxScroll < 160) {
        setVisible(false);
        return;
      }
      const remaining = maxScroll - window.scrollY;
      setVisible(remaining <= 160 || window.scrollY > maxScroll * 0.45);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    onScroll();

    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [enabled]);

  if (!enabled || !visible) return null;

  return (
    <button
      type="button"
      className="fw-scroll-top-btn"
      aria-label="Scroll back to top"
      onClick={() => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }}
    >
      <ArrowUp size={18} aria-hidden="true" />
    </button>
  );
}
