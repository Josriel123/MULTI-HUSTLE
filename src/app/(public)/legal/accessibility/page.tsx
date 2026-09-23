import type { Metadata } from 'next';
import { LegalDocument, PolicyList } from '@/components/legal/LegalDocument';
import { LEGAL } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Accessibility',
  description: `How ${LEGAL.appName} works to be usable by everyone, and how to tell us when it is not.`,
};

/** The accessibility statement (W3C WAI's recommended contents: commitment, standard, measures, known limits, contact, date). */
export default function AccessibilityPage() {
  const email = (
    <a href={`mailto:${LEGAL.contactEmail}`} className="font-medium text-accent underline underline-offset-2 hover:no-underline">
      {LEGAL.contactEmail}
    </a>
  );
  return (
    <LegalDocument
      title="Accessibility"
      shortVersion={[
        `We want ${LEGAL.appName} to work for everyone, including people who use a keyboard, a screen reader, zoom or high contrast.`,
        'We aim for the Web Content Accessibility Guidelines (WCAG) 2.2 at level AA.',
        `If something gets in your way, write to ${LEGAL.contactEmail}; we reply within five business days.`,
      ]}
      sections={[
        {
          id: 'standard',
          title: 'Our standard',
          body: (
            <p>
              We aim to meet the Web Content Accessibility Guidelines (WCAG) 2.2, level AA, published by the W3C. We treat an accessibility problem as a bug
              to fix, not a feature to add later.
            </p>
          ),
        },
        {
          id: 'measures',
          title: 'What we do',
          body: (
            <PolicyList
              items={[
                'Every page works with a keyboard alone. A "Skip to main content" link comes first, focus is always visible, and dialogs and menus keep focus inside them and close with Escape.',
                'Text and controls meet WCAG contrast ratios in both the light and the dark theme. An automated test checks the colour pairs on every change.',
                'Icons are labelled or hidden from screen readers, buttons and links have names, forms have labels and error messages, and the chart has a text alternative with the same figures.',
                'Pages use headings and landmarks in order, and the language of the page is set.',
                'Layouts reflow on small screens and at 200% zoom, touch targets are large, and motion is switched off when your device asks for reduced motion.',
                'The guided tour can be skipped at any moment and replayed later.',
              ]}
            />
          ),
        },
        {
          id: 'limits',
          title: 'Known limitations',
          body: (
            <PolicyList
              items={[
                'The sign-in forms are provided by Clerk, and the bank connection window by Plaid. We choose providers that work on accessibility, but we cannot change their screens; tell us about any problem and we will raise it with them.',
                'The printed tax report is produced by your browser’s print function; its structure follows the page, but some print dialogs are not fully accessible.',
              ]}
            />
          ),
        },
        {
          id: 'feedback',
          title: 'Tell us',
          body: (
            <p>
              If you find something hard or impossible to use, email {email} with the page and what happened. We reply within five business days, and if
              we cannot fix it quickly we will help you get what you needed another way.
            </p>
          ),
        },
      ]}
    />
  );
}
