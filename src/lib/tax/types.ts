import type { Money } from './money';

/**
 * Filing status as defined for Form 1040 (IRC §1(a)–(d), §2).
 *
 * `qualifying_surviving_spouse` uses the married-filing-jointly rate table and
 * standard deduction (the Rev. Proc. rate table is titled "Married Individuals
 * Filing Joint Returns and Surviving Spouses"), but is *not* a joint return for
 * rules that say "in the case of a joint return" (§199A(e)(2), §221(b)(2)).
 */
export type FilingStatus =
  | 'single'
  | 'married_filing_jointly'
  | 'married_filing_separately'
  | 'head_of_household'
  | 'qualifying_surviving_spouse';

export const FILING_STATUSES: readonly FilingStatus[] = [
  'single',
  'married_filing_jointly',
  'married_filing_separately',
  'head_of_household',
  'qualifying_surviving_spouse',
] as const;

export function isFilingStatus(value: unknown): value is FilingStatus {
  return typeof value === 'string' && (FILING_STATUSES as readonly string[]).includes(value);
}

/** A pointer to the authority a number or rule comes from. Every parameter and every step carries at least one. */
export interface Citation {
  /** Human-readable label, e.g. "IRC §1402(a)(12)" or "Rev. Proc. 2024-40 §3.01, Table 3". */
  label: string;
  /** Where the auditor can read it. */
  url?: string;
  /** Short verbatim quote or paraphrase of the operative text. */
  note?: string;
}

/** Something the estimate could not account for. Surfaced to the UI next to the number. */
export interface Warning {
  code: string;
  message: string;
  /** Dollar amount involved, as a fixed two-decimal string, when relevant. */
  amount?: string;
}

/** One line of a form or worksheet, so a reviewer can follow the arithmetic line by line. */
export interface Line {
  /** e.g. "Schedule SE line 4a" */
  ref: string;
  label: string;
  value: Money;
  /**
   * What `value` measures, when it is not dollars: square feet, a fraction
   * (0.12 for 12%), miles, or dollars per mile. Absent means dollars. Lets a
   * line-by-line display format every line correctly without guessing from
   * the label.
   */
  unit?: LineUnit;
}

export type LineUnit = 'usd' | 'fraction' | 'sqft' | 'miles' | 'usd_per_mile';
