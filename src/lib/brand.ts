/**
 * The few brand values the browser needs as literal strings: the theme-color
 * meta tag, the web app manifest and the generated icons cannot read CSS
 * custom properties. They must equal the tokens in src/app/globals.css
 * (`--c-page` light and dark, `--c-accent` light, `--c-on-accent`);
 * src/app/__tests__/contrast.test.ts fails if they drift.
 */
export const BRAND = {
  name: 'Multi-Hustle',
  shortName: 'Multi-Hustle',
  tagline: 'Side-hustle tax estimator',
  description:
    'See what your side hustles owe in federal tax, what is already paid, and what is safe to spend. A planning estimate, not tax advice.',
  pageLight: '#f5f6f8',
  pageDark: '#0a0a0b',
  accent: '#047857',
  onAccent: '#ffffff',
} as const;
