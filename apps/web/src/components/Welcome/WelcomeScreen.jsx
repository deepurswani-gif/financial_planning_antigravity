import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Check } from 'lucide-react';
import { markWelcomeSeen } from '../../lib/welcomeStorage';
import { WELCOME_SLIDES } from './welcomeSlides';
import './welcome.css';

const SWIPE_THRESHOLD = 48;

function renderBodyParagraph(text, emphasizeWealthMap) {
  if (!emphasizeWealthMap || !text.includes('WealthMap')) {
    return text;
  }
  const parts = text.split(/(WealthMap)/g);
  return parts.map((part, index) =>
    part === 'WealthMap' ? (
      <span key={index} className="welcome-wealthmap">
        {part}
      </span>
    ) : (
      part
    ),
  );
}

/**
 * Pre-auth onboarding: Connect → Protect → Grow.
 * CTAs hand off to signup / login via onNavigate(view).
 */
const WelcomeScreen = ({ onNavigate }) => {
  const reduceMotion = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const touchStartX = useRef(null);
  const slide = WELCOME_SLIDES[index];

  const goToAuth = useCallback(
    (view) => {
      markWelcomeSeen();
      onNavigate?.(view);
    },
    [onNavigate],
  );

  const goTo = useCallback(
    (nextIndex, dir) => {
      if (nextIndex < 0 || nextIndex >= WELCOME_SLIDES.length || nextIndex === index) return;
      setDirection(dir);
      setIndex(nextIndex);
    },
    [index],
  );

  const handlePrimary = () => {
    if (slide.primaryAction === 'next') {
      goTo(index + 1, 1);
      return;
    }
    goToAuth(slide.primaryAction === 'login' ? 'login' : 'signup');
  };

  const handleSecondary = () => {
    if (slide.secondaryAction === 'login') {
      goToAuth('login');
    }
  };

  useEffect(() => {
    const onKeyDown = (event) => {
      if (event.key === 'ArrowRight') goTo(Math.min(index + 1, WELCOME_SLIDES.length - 1), 1);
      if (event.key === 'ArrowLeft') goTo(Math.max(index - 1, 0), -1);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [goTo, index]);

  const onTouchStart = (event) => {
    touchStartX.current = event.changedTouches[0]?.clientX ?? null;
  };

  const onTouchEnd = (event) => {
    if (touchStartX.current == null) return;
    const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(delta) < SWIPE_THRESHOLD) return;
    if (delta < 0) goTo(Math.min(index + 1, WELCOME_SLIDES.length - 1), 1);
    else goTo(Math.max(index - 1, 0), -1);
  };

  const variants = reduceMotion
    ? {
        enter: { opacity: 0 },
        center: { opacity: 1 },
        exit: { opacity: 0 },
      }
    : {
        enter: (dir) => ({ x: dir >= 0 ? 48 : -48, opacity: 0 }),
        center: { x: 0, opacity: 1 },
        exit: (dir) => ({ x: dir >= 0 ? -48 : 48, opacity: 0 }),
      };

  return (
    <div className="welcome-root">
      <div className="welcome-shell">
        <button
          type="button"
          className="welcome-skip"
          onClick={() => goToAuth('login')}
        >
          Skip
        </button>

        <div
          className="welcome-stage"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={slide.id}
              className="welcome-slide"
              role="group"
              aria-roledescription="slide"
              aria-label={`Welcome ${index + 1} of ${WELCOME_SLIDES.length}`}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: reduceMotion ? 0.15 : 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="welcome-hero">
                <img src={slide.heroSrc} alt={slide.heroAlt} />
              </div>

              <div className="welcome-body">
                <h1 className="welcome-headline">
                  {slide.headline.map((line, lineIndex) => {
                    const isEmphasis = lineIndex === slide.emphasisIndex;
                    return (
                      <span key={lineIndex}>
                        {lineIndex > 0 ? ' ' : null}
                        {isEmphasis ? (
                          <span className="welcome-headline-emphasis">{line}</span>
                        ) : (
                          line
                        )}
                      </span>
                    );
                  })}
                </h1>

                <div className="welcome-rule" aria-hidden="true" />

                {slide.body.map((paragraph) => (
                  <p key={paragraph} className="welcome-copy">
                    {renderBodyParagraph(paragraph, slide.emphasizeWealthMap)}
                  </p>
                ))}

                {slide.outcomes ? (
                  <ul className="welcome-outcomes">
                    {slide.outcomes.map((item) => (
                      <li key={item}>
                        <span className="welcome-outcomes-icon" aria-hidden="true">
                          <Check size={14} strokeWidth={3} />
                        </span>
                        {item}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="welcome-footer">
          <button type="button" className="welcome-cta" onClick={handlePrimary}>
            {slide.primaryCta}
          </button>

          {slide.secondaryCta ? (
            <button type="button" className="welcome-secondary" onClick={handleSecondary}>
              {slide.secondaryCta}
            </button>
          ) : null}

          <div className="welcome-dots" role="tablist" aria-label="Welcome steps">
            {WELCOME_SLIDES.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                className="welcome-dot"
                role="tab"
                aria-label={`Go to ${item.id} screen`}
                aria-current={dotIndex === index ? 'true' : undefined}
                onClick={() => goTo(dotIndex, dotIndex > index ? 1 : -1)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WelcomeScreen;
