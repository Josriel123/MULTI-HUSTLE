import { max, min, money, type Money, type MoneyInput } from './money';
import type { TaxYearParameters } from './parameters/types';
import type { Citation, FilingStatus, Line } from './types';

/**
 * Standard deduction: IRC §63(c); Form 1040 line 12.
 *
 * Regular amount by filing status from the year's parameters (§63(c)(7) as
 * amended by Pub. L. 119-21, inflation-adjusted per the Rev. Proc.).
 *
 * Dependents (§63(c)(5)): someone who can be claimed as a dependent by another
 * taxpayer gets the LESSER of the regular amount and the GREATER of
 *   (a) the floor ($1,300 for 2024; $1,350 for 2025 and 2026), or
 *   (b) earned income + the add-on ($450).
 * For this purpose earned income includes taxable scholarships (Pub. 501,
 * "Earned income ... also includes any part of a taxable scholarship") and
 * net earnings from self-employment less the deductible half of SE tax
 * (Form 1040 instructions, Standard Deduction Worksheet for Dependents).
 *
 * The additional amounts for age 65+ or blindness (§63(f)) and the OBBBA
 * senior deduction are not modeled; ages are unknown.
 */

export const STANDARD_DEDUCTION_CITATIONS: Record<string, Citation> = {
  statute: {
    label: 'IRC §63(c)(2), (c)(7)',
    url: 'https://www.law.cornell.edu/uscode/text/26/63',
    note: 'Basic standard deduction of $15,750 (single / separate), $23,625 (head of household), $31,500 (joint) for taxable years beginning after 2024, indexed with a 2024 base year (Pub. L. 119-21 §70102).',
  },
  dependents: {
    label: 'IRC §63(c)(5)',
    url: 'https://www.law.cornell.edu/uscode/text/26/63',
    note: "For an individual who can be claimed as a dependent, the basic standard deduction \"shall not exceed the greater of (A) $500, or (B) the sum of $250 and such individual's earned income\", both amounts inflation-adjusted.",
  },
  earnedIncome: {
    label: 'Pub. 501 (2025), Standard Deduction for Dependents; Form 1040 instructions, Standard Deduction Worksheet for Dependents',
    url: 'https://www.irs.gov/publications/p501',
    note: '"Earned income (only for purposes of filing requirements and the standard deduction) also includes any part of a taxable scholarship."',
  },
};

export interface StandardDeductionInput {
  filingStatus: FilingStatus;
  claimedAsDependent: boolean;
  /** Earned income as defined for the dependents worksheet. Ignored unless `claimedAsDependent`. */
  earnedIncome: MoneyInput;
}

export interface StandardDeductionResult {
  regularAmount: Money;
  dependentLimit: { floor: Money; earnedIncomeAddOn: Money; earnedIncome: Money; limit: Money } | null;
  /** Form 1040 line 12. */
  deduction: Money;
  lines: Line[];
  citations: Citation[];
}

export function computeStandardDeduction(input: StandardDeductionInput, params: TaxYearParameters): StandardDeductionResult {
  const regular = money(params.standardDeduction.amounts[input.filingStatus]);
  const citations = [STANDARD_DEDUCTION_CITATIONS.statute, params.standardDeduction.citation];
  const lines: Line[] = [{ ref: 'Form 1040 line 12 (chart)', label: `Standard deduction, ${input.filingStatus.replace(/_/g, ' ')}`, value: regular }];

  if (!input.claimedAsDependent) {
    return { regularAmount: regular, dependentLimit: null, deduction: regular, lines, citations };
  }

  const floor = money(params.standardDeduction.dependentFloor);
  const addOn = money(params.standardDeduction.dependentEarnedIncomeAddOn);
  const earned = money(input.earnedIncome, 'standardDeduction.earnedIncome');
  // Worksheet: line 1 earned income + $450; line 3 greater of line 2 and the floor; line 5 smaller of line 3 and the regular amount.
  const limit = max(floor, earned.plus(addOn));
  const deduction = min(regular, limit);

  lines.push(
    { ref: 'Dependents worksheet line 1', label: 'Earned income (incl. taxable scholarships, SE net earnings less 1/2 SE tax)', value: earned },
    { ref: 'Dependents worksheet line 2', label: `Line 1 + $${addOn.toFixed(0)}`, value: earned.plus(addOn) },
    { ref: 'Dependents worksheet line 3', label: `Greater of line 2 or $${floor.toFixed(0)}`, value: limit },
    { ref: 'Form 1040 line 12', label: 'Standard deduction (smaller of line 3 or regular amount)', value: deduction },
  );
  citations.push(STANDARD_DEDUCTION_CITATIONS.dependents, STANDARD_DEDUCTION_CITATIONS.earnedIncome);

  return {
    regularAmount: regular,
    dependentLimit: { floor, earnedIncomeAddOn: addOn, earnedIncome: earned, limit },
    deduction,
    lines,
    citations,
  };
}
