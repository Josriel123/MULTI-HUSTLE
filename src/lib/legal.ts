/**
 * Who runs Multi-Hustle, and the facts every policy page quotes. One place, so
 * the Privacy Policy, the Terms and the footer can never disagree about the
 * operator, the contact address or the effective date.
 *
 * Changing the Terms or the Privacy Policy materially: update the text, set
 * `effectiveDate` and bump `agreementVersion`. Every signed-in user is then
 * asked to agree again (AgreementGate), and the new acceptance is recorded.
 */
export const LEGAL = {
  appName: 'Multi-Hustle',
  /** The person responsible for the service and for the data in it (the "controller"). */
  operatorName: 'Joel Bueno',
  operatorKind: 'an individual developer',
  contactEmail: 'joelbueno09@hotmail.com',
  country: 'United States',
  /**
   * The state whose law governs the Terms. Null words the clause without
   * naming one; set it (e.g. 'New York') to name the operator's state.
   */
  governingState: null as string | null,
  /** YYYY-MM-DD. Shown on every policy. */
  effectiveDate: '2026-09-23',
  /** Stored with each user's acceptance. Bump it when the Terms or the Privacy Policy change materially. */
  agreementVersion: '2026-09-23',
  /** Nobody younger may use the service (see the Terms and the Privacy Policy, "Children"). */
  minimumAge: 18,
  /** How quickly privacy requests are answered. Shorter than the CCPA's 45 days and GDPR's one month. */
  responseDays: 30,
  /** The longest the database host keeps point-in-time backups, after which deleted data is gone from them too. */
  backupRetentionDays: 30,
  /**
   * A postal address for legal notices. Null until the operator has one to
   * publish (a PO box is fine); the policies then say it is available on
   * request. Required before any marketing email is ever sent (CAN-SPAM).
   */
  mailingAddress: null as string | null,
} as const;

/** "September 23, 2026". */
export function formatLegalDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

/**
 * The companies that process personal data for the service, what for, and
 * their own policies. Kept in step with the code: a new SDK or service that
 * receives user data is added here, and to the Privacy Policy's list, in the
 * same change (AGENTS.md).
 */
export const SERVICE_PROVIDERS = [
  {
    name: 'Clerk',
    purpose: 'Sign-in and account security: your name, email address, sign-in method and session.',
    policy: 'https://clerk.com/legal/privacy',
  },
  {
    name: 'Plaid',
    purpose: 'Only if you connect a bank: Plaid connects to your bank and passes this app your transactions.',
    policy: 'https://plaid.com/legal/#end-user-privacy-policy',
  },
  {
    name: 'Neon (part of Databricks)',
    purpose: 'Hosts the database that stores what you enter, in the United States, encrypted at rest.',
    policy: 'https://www.databricks.com/legal/privacynotice',
  },
  {
    name: 'Vercel',
    purpose: 'Hosts the website; like any web host it receives your IP address and browser details when you visit, and keeps short-lived request logs.',
    policy: 'https://vercel.com/legal/privacy-policy',
  },
] as const;

/** Every policy page, for the footer and the /legal index. */
export const LEGAL_PAGES = [
  { href: '/legal/privacy', title: 'Privacy Policy', summary: 'What we collect, why, who helps us, and your rights.' },
  { href: '/legal/terms', title: 'Terms of Service', summary: 'The rules for using Multi-Hustle, and its limits.' },
  { href: '/legal/cookies', title: 'Cookie Policy', summary: 'The few cookies and browser storage the app uses.' },
  { href: '/legal/refunds', title: 'Refund Policy', summary: 'Multi-Hustle is free, so there is nothing to refund.' },
  { href: '/legal/data-deletion', title: 'Delete or download your data', summary: 'How to get a copy of your data or erase it.' },
  { href: '/legal/accessibility', title: 'Accessibility', summary: 'What we do to make the app usable by everyone.' },
  { href: '/legal/licenses', title: 'Licenses and credits', summary: 'The open-source software and fonts the app uses.' },
] as const;
