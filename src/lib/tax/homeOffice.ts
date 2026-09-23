import { cents, max, min, money, nonNegativeMoney, notBelowZero, TaxInputError, times, ZERO, type Money, type MoneyInput } from './money';
import type { Citation, Line, Warning } from './types';

/**
 * Home office deduction: Schedule C line 30.
 *
 * Two methods are allowed and the taxpayer may pick either one each year:
 *
 *  - Regular method (Form 8829): the business-use percentage of the home's
 *    actual costs. For a renter that is rent and utilities, both "indirect"
 *    expenses on Form 8829 lines 18–19 column (b) apportioned by line 7.
 *  - Simplified method (Rev. Proc. 2013-13): $5 per square foot of office,
 *    up to 300 square feet, so at most $1,500. For part-year use the area is
 *    the average of the monthly allowable areas (§4.08(4)), so six qualifying
 *    months of a 300 sq ft office is 150 sq ft, or $750.
 *
 * Both are capped by the gross income limitation: the deduction cannot exceed
 * the business's gross income less its other expenses (IRC §280A(c)(5);
 * Rev. Proc. 2013-13 §4.08(2)). In Schedule C terms the cap is tentative
 * profit on line 29. Under the regular method a disallowed amount carries to
 * the next year (§280A(c)(5), last sentence; Form 8829 Part IV); under the
 * simplified method it is simply lost (Rev. Proc. 2013-13 §4.08(3)).
 *
 * This module assumes the space meets the exclusive-and-regular-use test of
 * §280A(c)(1) and was used for the months given. It cannot verify either.
 */

export interface HomeOfficeInput {
  totalSquareFeet: MoneyInput;
  officeSquareFeet: MoneyInput;
  /** Monthly rent (or mortgage interest for an owner; depreciation is not modeled). */
  monthlyRent: MoneyInput;
  /** Monthly utilities (electric, gas, water, internet, etc.). */
  monthlyUtilities: MoneyInput;
  /** Months in the tax year with 15 or more days of qualified use (Rev. Proc. 2013-13 §4.08(4)). Defaults to 12. */
  monthsUsed?: number;
}

export interface HomeOfficeResult {
  method: 'simplified' | 'regular' | 'none';
  /** Amount for Schedule C line 30. */
  deduction: Money;
  /** The cap both methods are measured against: Schedule C line 29 (tentative profit), not below zero. */
  grossIncomeLimit: Money;
  simplified: {
    /** Office area capped at 300 sq ft (Rev. Proc. 2013-13 §4.01(2)). */
    cappedSquareFeet: Money;
    /** Average monthly allowable area: capped area x monthsUsed / 12 (§4.08(4)). Equals `cappedSquareFeet` for a full year. */
    allowableSquareFeet: Money;
    ratePerSquareFoot: Money;
    beforeLimit: Money;
    allowed: Money;
    /** Disallowed by the gross income limit. Not carried over (Rev. Proc. 2013-13 §4.08(3)). */
    lost: Money;
  };
  regular: {
    businessUsePercentage: Money;
    annualRentAndUtilities: Money;
    beforeLimit: Money;
    allowed: Money;
    /** Disallowed by the gross income limit. Carries to next year on Form 8829 line 43; this engine does not track it. */
    carryover: Money;
  };
  lines: Line[];
  warnings: Warning[];
  citations: Citation[];
}

export const HOME_OFFICE_CITATIONS: Record<string, Citation> = {
  exclusiveUse: {
    label: 'IRC §280A(c)(1)',
    url: 'https://www.law.cornell.edu/uscode/text/26/280A',
    note: 'Deduction allowed only for a portion of the home "exclusively used on a regular basis" as the principal place of business (or for administrative/management activities with no other fixed location).',
  },
  grossIncomeLimit: {
    label: 'IRC §280A(c)(5)',
    url: 'https://www.law.cornell.edu/uscode/text/26/280A',
    note: 'Deductions "shall not exceed the excess of (A) the gross income derived from such use ... over (B) ... deductions allocable to such use" that are allowed regardless. Any excess "shall be taken into account as a deduction ... for the succeeding taxable year."',
  },
  form8829: {
    label: 'Form 8829 and instructions (2025)',
    url: 'https://www.irs.gov/instructions/i8829',
    note: 'Line 7 business percentage = area used for business / total area. Rent goes on line 19 column (b) (indirect). Line 8 gross income limit = Schedule C line 29 plus certain gains.',
  },
  simplifiedRate: {
    label: 'Rev. Proc. 2013-13 §4.01(2)–(3)',
    url: 'https://www.irs.gov/irb/2013-06_IRB',
    note: '"The allowable square footage is the portion of a home used in a qualified business use of the home, but not to exceed 300 square feet." "The prescribed rate is $5.00."',
  },
  simplifiedLimit: {
    label: 'Rev. Proc. 2013-13 §4.08(2)–(3)',
    url: 'https://www.irs.gov/irb/2013-06_IRB',
    note: 'Safe-harbor deduction "cannot exceed the gross income derived from the qualified business use of the home ... reduced by the business deductions" unrelated to the home; no carryover of a disallowed amount.',
  },
  simplifiedPartYear: {
    label: 'Rev. Proc. 2013-13 §4.08(4); Pub. 587, "Part-year use or area changes"',
    url: 'https://www.irs.gov/irb/2013-06_IRB',
    note: 'A taxpayer with a qualified business use "for a portion of the taxable year ... must determine the average of the monthly allowable square footage for the taxable year"; "no more than 300 square feet may be taken into account for any one month, and a taxpayer shall only be treated as having a qualified business use of a home in a month in which the taxpayer had 15 or more days of a qualified business use."',
  },
  pub587: {
    label: 'Pub. 587 (2025), Business Use of Your Home',
    url: 'https://www.irs.gov/publications/p587',
  },
};

export const SIMPLIFIED_RATE_PER_SQFT = '5';
export const SIMPLIFIED_MAX_SQFT = '300';

/**
 * @param input           the home and its costs
 * @param tentativeProfit Schedule C line 29 (gross income minus all expenses other than the home office)
 */
export function computeHomeOffice(input: HomeOfficeInput, tentativeProfit: MoneyInput): HomeOfficeResult {
  const totalSqFt = nonNegativeMoney(input.totalSquareFeet, 'homeOffice.totalSquareFeet');
  const officeSqFt = nonNegativeMoney(input.officeSquareFeet, 'homeOffice.officeSquareFeet');
  const rent = nonNegativeMoney(input.monthlyRent, 'homeOffice.monthlyRent');
  const utilities = nonNegativeMoney(input.monthlyUtilities, 'homeOffice.monthlyUtilities');
  const monthsUsed = input.monthsUsed ?? 12;
  if (!Number.isInteger(monthsUsed) || monthsUsed < 0 || monthsUsed > 12) {
    throw new TaxInputError(`homeOffice.monthsUsed: expected an integer 0-12, got ${monthsUsed}`);
  }
  if (officeSqFt.greaterThan(totalSqFt)) {
    throw new TaxInputError(`homeOffice: office (${officeSqFt}) cannot exceed total (${totalSqFt}) square feet`);
  }

  const warnings: Warning[] = [];
  const citations = [
    HOME_OFFICE_CITATIONS.exclusiveUse,
    HOME_OFFICE_CITATIONS.grossIncomeLimit,
    HOME_OFFICE_CITATIONS.form8829,
    HOME_OFFICE_CITATIONS.simplifiedRate,
    HOME_OFFICE_CITATIONS.simplifiedLimit,
  ];

  // §280A(c)(5): the cap is the business's income after its other expenses.
  const grossIncomeLimit = notBelowZero(money(tentativeProfit, 'tentativeProfit'));

  // --- Simplified method (Rev. Proc. 2013-13) ---
  // §4.01(2): allowable area is the office, capped at 300 sq ft. §4.08(4): for
  // part-year use the allowable area is the AVERAGE of the twelve monthly
  // allowable areas (each month capped at 300; a month counts only with 15 or
  // more days of qualified use). So `monthsUsed` scales the area, not the rate.
  const cappedSqFt = min(officeSqFt, money(SIMPLIFIED_MAX_SQFT));
  const allowableSqFt = cappedSqFt.times(monthsUsed).dividedBy(12);
  const simplifiedBefore = cents(times(allowableSqFt, SIMPLIFIED_RATE_PER_SQFT));
  const simplifiedAllowed = min(simplifiedBefore, grossIncomeLimit);
  if (monthsUsed < 12) citations.push(HOME_OFFICE_CITATIONS.simplifiedPartYear);

  // --- Regular method (Form 8829) ---
  // Line 7: business percentage. A home with no recorded area cannot support a percentage.
  const businessPct = totalSqFt.isZero() ? ZERO : officeSqFt.dividedBy(totalSqFt);
  // Lines 18–19 column (b): indirect expenses for the whole home over the months used.
  const annualCosts = cents(rent.plus(utilities).times(monthsUsed));
  const regularBefore = cents(annualCosts.times(businessPct));
  const regularAllowed = min(regularBefore, grossIncomeLimit);
  const regularCarryover = regularBefore.minus(regularAllowed);

  // Rev. Proc. 2013-13 §4.03: the election is made annually by using the method
  // on a timely filed return, so choosing the larger allowable amount each year is permitted.
  let method: HomeOfficeResult['method'] = 'none';
  let deduction: Money = ZERO;
  if (officeSqFt.isZero() || monthsUsed === 0) {
    method = 'none';
  } else if (simplifiedAllowed.greaterThanOrEqualTo(regularAllowed)) {
    method = simplifiedAllowed.isZero() ? 'none' : 'simplified';
    deduction = simplifiedAllowed;
  } else {
    method = 'regular';
    deduction = regularAllowed;
  }

  if (method !== 'none' && grossIncomeLimit.lessThan(max(simplifiedBefore, regularBefore))) {
    warnings.push({
      code: 'home_office_limited_by_income',
      message: "The home office deduction was capped at the business's tentative profit (IRC §280A(c)(5)). Under the regular method the excess carries to next year; under the simplified method it is lost.",
      amount: max(simplifiedBefore, regularBefore).minus(grossIncomeLimit).toFixed(2),
    });
  }
  if (method !== 'none') {
    warnings.push({
      code: 'home_office_use_test_assumed',
      message: 'Assumes the office space is used exclusively and regularly for the business as its principal place of business (IRC §280A(c)(1)). The engine cannot verify this.',
    });
  }

  const lines: Line[] = [
    { ref: 'Form 8829 line 1', label: 'Area used regularly and exclusively for business (sq ft)', value: officeSqFt, unit: 'sqft' },
    { ref: 'Form 8829 line 2', label: 'Total area of home (sq ft)', value: totalSqFt, unit: 'sqft' },
    { ref: 'Form 8829 line 7', label: 'Business percentage', value: businessPct, unit: 'fraction' },
    { ref: 'Form 8829 line 8', label: 'Gross income limit (Schedule C line 29)', value: grossIncomeLimit },
    { ref: 'Form 8829 lines 18-19 col (b)', label: `Rent and utilities, ${monthsUsed} months`, value: annualCosts },
    { ref: 'Form 8829 regular method', label: 'Business share of home costs before limit', value: regularBefore },
    { ref: 'Form 8829 line 36 (allowable)', label: 'Regular method allowed', value: regularAllowed },
    { ref: 'Form 8829 line 43', label: 'Regular method carryover to next year', value: regularCarryover },
    { ref: 'Schedule C line 30 worksheet', label: `Simplified: ${allowableSqFt.toFixed(2)} sq ft (average monthly allowable, ${monthsUsed} of 12 months) x $${SIMPLIFIED_RATE_PER_SQFT}`, value: simplifiedBefore },
    { ref: 'Schedule C line 30 worksheet', label: 'Simplified method allowed', value: simplifiedAllowed },
    { ref: 'Schedule C line 30', label: `Home office deduction (${method})`, value: deduction },
  ];

  return {
    method,
    deduction,
    grossIncomeLimit,
    simplified: {
      cappedSquareFeet: cappedSqFt,
      allowableSquareFeet: allowableSqFt,
      ratePerSquareFoot: money(SIMPLIFIED_RATE_PER_SQFT),
      beforeLimit: simplifiedBefore,
      allowed: simplifiedAllowed,
      lost: simplifiedBefore.minus(simplifiedAllowed),
    },
    regular: {
      businessUsePercentage: businessPct,
      annualRentAndUtilities: annualCosts,
      beforeLimit: regularBefore,
      allowed: regularAllowed,
      carryover: regularCarryover,
    },
    lines,
    warnings,
    citations,
  };
}
