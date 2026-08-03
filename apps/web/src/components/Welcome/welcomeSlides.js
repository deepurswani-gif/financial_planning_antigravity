import screen1 from '../../assets/welcome/screen_1.png';
import screen2 from '../../assets/welcome/screen_2.png';
import screen3 from '../../assets/welcome/screen_3.png';

/**
 * Finbrella welcome onboarding — Connect → Protect → Grow.
 * Copy is the source of truth; hero images provide illustration only
 * (full mockups are cropped to the hero region in CSS).
 */
export const WELCOME_SLIDES = [
  {
    id: 'connect',
    heroSrc: screen1,
    heroAlt:
      'A person at the center of their connected financial life — income, expenses, insurance, goals, savings, and investments linked in one WealthMap',
    headline: ['Your Complete Financial Life.', 'Finally Connected.'],
    emphasisIndex: 1,
    body: [
      "Money isn't just about investments.",
      'Finbrella connects your income, expenses, insurance, goals, savings, and investments into one personalized WealthMap—helping every financial decision work together.',
    ],
    emphasizeWealthMap: true,
    outcomes: null,
    primaryCta: 'Create My WealthMap',
    primaryAction: 'next',
    secondaryCta: 'Sign In',
    secondaryAction: 'login',
  },
  {
    id: 'protect',

    heroSrc: screen2,
    heroAlt:
      'The same person understanding their financial picture clearly — protection and gaps visible before they become problems',
    headline: ['See Your Money Clearly.', 'Protect What Matters.'],
    emphasisIndex: 1,
    body: [
      'Understand your complete financial picture and discover the gaps before they become problems.',
    ],
    emphasizeWealthMap: false,
    outcomes: [
      'Complete Financial Visibility',
      'Smarter Protection',
      'Better Financial Decisions',
    ],
    primaryCta: 'Continue',
    primaryAction: 'next',
    secondaryCta: null,
    secondaryAction: null,
  },
  {
    id: 'grow',
    heroSrc: screen3,
    heroAlt:
      'The same person walking a path toward financial freedom — growing confidently with goals across every stage of life',
    headline: ['Grow With', 'Confidence'],
    emphasisIndex: 1,
    body: [
      "Turn today's surplus into a personalized financial plan that grows with your goals and every stage of life.",
    ],
    emphasizeWealthMap: false,
    outcomes: [
      'Personalized Recommendations',
      'Goal-Based Planning',
      'Long-Term Wealth Growth',
    ],
    primaryCta: 'Start My Journey',
    primaryAction: 'signup',
    secondaryCta: null,
    secondaryAction: null,
  },
];
