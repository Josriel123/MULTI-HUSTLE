/**
 * Hustles: the user's income sources ("Uber", "Logo design", "Etsy shop").
 *
 * Stored as `IncomeSource` rows. A hustle is a label for grouping, never a tax
 * control: how a transaction is taxed is decided by its category alone
 * (docs/decision-log.md, D17). All business activity is one Schedule C either
 * way; the engine's assumptions say so.
 *
 * Pure: safe to import from client components. Database access is in
 * `hustleStore.ts`.
 */

/** The `IncomeSource.type` values, with what the UI calls them. */
export const HUSTLE_KINDS = {
  Delivery: { label: 'Driving & delivery', example: 'Uber, DoorDash, Instacart' },
  Freelance: { label: 'Freelance & services', example: 'Design, tutoring, consulting' },
  Other: { label: 'Selling & other', example: 'Etsy, resale, odd jobs' },
} as const;

export type HustleKind = keyof typeof HUSTLE_KINDS;

export const HUSTLE_KIND_KEYS = Object.keys(HUSTLE_KINDS) as HustleKind[];

export function isHustleKind(value: unknown): value is HustleKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(HUSTLE_KINDS, value);
}

export const HUSTLE_NAME_MAX = 60;

export type ParsedHustleName = { ok: true; name: string } | { ok: false; error: string };

/** Trims and collapses spaces; refuses an empty or over-long name rather than cutting it. */
export function parseHustleName(value: unknown): ParsedHustleName {
  if (typeof value !== 'string') return { ok: false, error: 'Hustle name is required.' };
  const name = value.trim().replace(/\s+/g, ' ');
  if (name === '') return { ok: false, error: 'Hustle name is required.' };
  if (name.length > HUSTLE_NAME_MAX) return { ok: false, error: `Hustle name must be ${HUSTLE_NAME_MAX} characters or fewer.` };
  return { ok: true, name };
}

function words(text: string): string {
  return ` ${text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()} `;
}

/**
 * The hustle a bank deposit belongs to, by name: the hustle whose name appears
 * as whole words in the deposit's description, ignoring case and punctuation,
 * the longest name winning ("Uber Eats" over "Uber"). Null when none does.
 *
 * Deliberately narrow. Plaid sync used to create a new hustle for every
 * distinct deposit description ("Uber 063015 SF**POOL**", "Uber 072515
 * SF**POOL**", ...), which filled the hustle list with bank strings. Now a
 * deposit joins a hustle only if the user has named one that it matches, and
 * otherwise waits, unassigned, for the user to choose.
 */
export function matchHustle<T extends { name: string }>(description: string | null | undefined, hustles: readonly T[]): T | null {
  if (!description) return null;
  const haystack = words(description);
  let best: T | null = null;
  for (const hustle of hustles) {
    const needle = words(hustle.name);
    if (needle.trim() === '') continue;
    if (haystack.includes(needle) && (best === null || hustle.name.length > best.name.length)) best = hustle;
  }
  return best;
}
