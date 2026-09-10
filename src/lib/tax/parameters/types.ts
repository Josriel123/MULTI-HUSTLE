import type { Citation, FilingStatus } from '../types';

/**
 * Year-specific numbers, kept apart from the rules that use them.
 *
 * Amounts are decimal strings exactly as printed in the cited source
 * ("197300", not 197_300) so a reviewer can grep the Rev. Proc. for the same
 * digits. Rates are decimal strings too ("0.22"). Nothing here is a JS number.
 */
export type MoneyString = string;
export type RateString = string;

/**
 * One row of a §1(j)(2) rate table: `rate` applies to taxable income above the
 * previous row's `upTo`, up to this row's `upTo` (null = no ceiling).
 *
 * `taxAtLowerBoundAsPrinted` is the "$B" in the Rev. Proc.'s "Over $L ... $B
 * plus R% of the excess over $L". It is redundant with the brackets, and that
 * is the point: the tests recompute it from the brackets and fail if the
 * transcription of either disagrees with the other. Omitted for the first row.
 */
export interface BracketRow {
  upTo: MoneyString | null;
  rate: RateString;
  taxAtLowerBoundAsPrinted?: MoneyString;
}

/**
 * The four tables in each Rev. Proc. §3.01. `joint` is "Married Individuals
 * Filing Joint Returns and Surviving Spouses", so qualifying surviving spouse
 * maps to it (see `bracketTableFor`).
 */
export type BracketTableKey = 'joint' | 'head_of_household' | 'single' | 'married_filing_separately';

export interface RateTable {
  rows: readonly BracketRow[];
  citation: Citation;
}

export interface StandardDeductionParameters {
  /** §63(c)(2)/(c)(7) basic standard deduction by filing status. */
  amounts: Record<FilingStatus, MoneyString>;
  /** §63(c)(5)(A) as adjusted: floor for an individual who can be claimed as a dependent. */
  dependentFloor: MoneyString;
  /** §63(c)(5)(B) as adjusted: the add-on to earned income. */
  dependentEarnedIncomeAddOn: MoneyString;
  citation: Citation;
}

export interface SelfEmploymentParameters {
  /** Social Security contribution and benefit base (§1402(b)(1); Schedule SE line 7). */
  socialSecurityWageBase: MoneyString;
  citation: Citation;
}

/** The three rows of the Rev. Proc. §199A table: joint returns, separate returns, and "all other returns" (which includes surviving spouses). */
export interface QbiAmounts {
  joint: MoneyString;
  marriedFilingSeparately: MoneyString;
  other: MoneyString;
}

export interface QbiParameters {
  /** §199A(e)(2) threshold amount, inflation-adjusted. */
  threshold: QbiAmounts;
  /** §199A(b)(3)(B)(ii) phase-in range: $50,000 ($100,000 joint) through 2025; $75,000 ($150,000 joint) from 2026. */
  phaseInRange: QbiAmounts;
  /** §199A(i), added by Pub. L. 119-21 for tax years beginning after 2025: minimum deduction for taxpayers with at least `qbiFloor` of QBI. */
  minimumDeduction: { amount: MoneyString; qbiFloor: MoneyString; citation: Citation } | null;
  citation: Citation;
}

export interface StudentLoanInterestParameters {
  /** §221(b)(2) MAGI where the phaseout begins and where the deduction is fully phased out. */
  phaseout: { joint: { start: MoneyString; end: MoneyString }; other: { start: MoneyString; end: MoneyString } };
  citation: Citation;
}

export interface KiddieTaxParameters {
  /** §1(g)(4)(A)(ii)(I) amount. Form 8615 is required when unearned income exceeds twice this amount. */
  baseAmount: MoneyString;
  citation: Citation;
}

export interface MileageRatePeriod {
  /** Inclusive ISO dates (YYYY-MM-DD) the rate applies to. */
  from: string;
  to: string;
  /** Cents per business mile, e.g. "70" or "72.5". */
  centsPerMile: string;
  citation: Citation;
}

export interface TaxYearParameters {
  taxYear: number;
  /** The primary documents every number in this file came from. */
  sources: readonly Citation[];
  incomeTaxBrackets: Record<BracketTableKey, RateTable>;
  standardDeduction: StandardDeductionParameters;
  selfEmployment: SelfEmploymentParameters;
  qbi: QbiParameters;
  studentLoanInterest: StudentLoanInterestParameters;
  kiddieTax: KiddieTaxParameters;
  standardMileage: readonly MileageRatePeriod[];
}

/** Which §3.01 table a filing status uses. */
export function bracketTableFor(status: FilingStatus): BracketTableKey {
  switch (status) {
    case 'married_filing_jointly':
    case 'qualifying_surviving_spouse':
      return 'joint';
    case 'head_of_household':
      return 'head_of_household';
    case 'married_filing_separately':
      return 'married_filing_separately';
    case 'single':
      return 'single';
  }
}

/** Whether a rule phrased "in the case of a joint return" applies. Surviving spouses do not file joint returns. */
export function isJointReturn(status: FilingStatus): boolean {
  return status === 'married_filing_jointly';
}

/** Pick the §199A table row for a filing status. */
export function qbiAmountFor(amounts: QbiAmounts, status: FilingStatus): MoneyString {
  if (status === 'married_filing_jointly') return amounts.joint;
  if (status === 'married_filing_separately') return amounts.marriedFilingSeparately;
  return amounts.other;
}
