/**
 * The guided tour: one short speech bubble per tab, pointing at it, in the
 * order a newcomer meets them. `target` names a `data-tour` attribute in the
 * app frame (SidebarNav, the bottom tabs, the header). A step with no target
 * is shown in the middle of the screen. `drawer` marks tabs that live in the
 * slide-out menu on phones, which the tour opens for them.
 *
 * Plain English only: this is the first thing a new user reads.
 * src/components/__tests__/tour-steps.test.ts checks every target exists.
 */
export interface TourStep {
  id: string;
  target?: string;
  drawer?: boolean;
  title: string;
  body: string;
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    id: 'welcome',
    title: "Hi! I'm Sprout.",
    body: "I'll show you around in under a minute. Multi-Hustle estimates the federal tax on your side hustles, so you always know how much to set aside.",
  },
  {
    id: 'overview',
    target: 'nav-/',
    title: 'Overview',
    body: "Your tax picture at a glance: what you'd owe this year, what's already paid, and how much of your hustle money is safe to spend.",
  },
  {
    id: 'transactions',
    target: 'nav-/transactions',
    title: 'Income & expenses',
    body: 'Add the money your hustles earn and spend, or connect a bank to bring it in. The category you give each one decides how it is taxed.',
  },
  {
    id: 'mileage',
    target: 'nav-/mileage',
    drawer: true,
    title: 'Mileage',
    body: 'Drive for a gig or to meet clients? Log each trip here. Every business mile lowers your tax.',
  },
  {
    id: 'jobs',
    target: 'nav-/jobs',
    drawer: true,
    title: 'W-2 jobs',
    body: 'Have a regular job too? Add its W-2, so the estimate counts your wages and the tax your employer already took out.',
  },
  {
    id: 'payments',
    target: 'nav-/payments',
    drawer: true,
    title: 'Tax payments',
    body: 'Sent money to the IRS during the year? Record it here and it counts as already paid.',
  },
  {
    id: 'office',
    target: 'nav-/office',
    drawer: true,
    title: 'Home office',
    body: 'Work on your hustle from a room at home? Part of your rent and utilities can come off your profit.',
  },
  {
    id: 'education',
    target: 'nav-/education',
    drawer: true,
    title: 'Education',
    body: 'Student? Add the 1098-T from your school and the 1098-E from your loan servicer.',
  },
  {
    id: 'report',
    target: 'nav-/report',
    title: 'Tax report',
    body: 'Everything behind your estimate on one page. Print it or save a PDF for your records or a tax preparer.',
  },
  {
    id: 'profile',
    target: 'nav-/profile',
    drawer: true,
    title: 'Tax profile',
    body: 'Tell us how you file: single, married, head of household. It changes your tax brackets, so start here.',
  },
  {
    id: 'account',
    target: 'nav-/account',
    drawer: true,
    title: 'Account & privacy',
    body: 'Download everything we store about you, or delete your account and all of your data, any time.',
  },
  {
    id: 'year',
    target: 'tax-year',
    title: 'Tax year',
    body: 'Switch between tax years here. Every page follows the year you pick.',
  },
  {
    id: 'terms',
    title: 'Words with a dotted underline',
    body: 'Tap any word with a dotted underline, like "self-employment tax", for a plain-English explanation. No tax jargon required.',
  },
  {
    id: 'done',
    title: "You're all set!",
    body: 'Start with your tax profile, then add your first income. You can replay this tour any time from Account & privacy.',
  },
];

export const TOUR_STORAGE_KEY = 'multi-hustle:tour';
/** Fired on window to start the tour from a button anywhere. */
export const START_TOUR_EVENT = 'multi-hustle:start-tour';
/** Fired on window to ask AppShell to open or close the phone menu. */
export const TOUR_DRAWER_EVENT = 'multi-hustle:tour-drawer';
