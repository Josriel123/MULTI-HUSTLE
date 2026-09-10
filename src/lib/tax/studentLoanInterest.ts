import { cents, isAboveZero, min, money, nonNegativeMoney, notBelowZero, ZERO, type Money, type MoneyInput } from './money';
import { isJointReturn, type TaxYearParameters } from './parameters/types';
import type { Citation, FilingStatus, Line, Warning } from './types';

/**
 * Student loan interest deduction: IRC §221; Schedule 1 line 21; Pub. 970 ch. 4.
 *
 *   deduction = min(interest paid, $2,500)                          §221(b)(1)
 *   reduced by deduction x (MAGI - start) / (end - start)           §221(b)(2)(B)
 *   where start/end are the inflation-adjusted §221(b)(2) amounts for the year.
 *
 * Not allowed at all when:
 *  - filing status is married filing separately                    §221(e)(2)
 *  - the taxpayer can be claimed as a dependent by someone else    §221(c)
 *
 * MAGI here is adjusted gross income computed without this deduction
 * (§221(b)(2)(C)). The other MAGI add-backs (§911 foreign earned income
 * exclusion etc.) do not arise in this engine.
 *
 * Pub. 970's Worksheet 4-1 rounds the phaseout ratio to three decimals; this
 * module keeps the exact ratio and rounds the reduction to cents, which can
 * differ from the worksheet by at most a few cents.
 */

export const STUDENT_LOAN_INTEREST_MAX = '2500';

export const STUDENT_LOAN_CITATIONS: Record<string, Citation> = {
  max: {
    label: 'IRC §221(b)(1)',
    url: 'https://www.law.cornell.edu/uscode/text/26/221',
    note: '"the deduction allowed by subsection (a) for the taxable year shall not exceed $2,500."',
  },
  phaseout: {
    label: 'IRC §221(b)(2)',
    url: 'https://www.law.cornell.edu/uscode/text/26/221',
    note: 'Reduced by the amount which bears the same ratio to the deduction as the excess of MAGI over the threshold bears to $15,000 ($30,000 joint); thresholds indexed under §221(f).',
  },
  separate: {
    label: 'IRC §221(e)(2)',
    url: 'https://www.law.cornell.edu/uscode/text/26/221',
    note: "If the taxpayer is married, the deduction applies \"only if the taxpayer and the taxpayer's spouse file a joint return.\"",
  },
  dependent: {
    label: 'IRC §221(c)',
    url: 'https://www.law.cornell.edu/uscode/text/26/221',
    note: 'No deduction for an individual for whom a dependency deduction is allowed to another taxpayer.',
  },
  pub970: {
    label: 'Pub. 970 (2025) ch. 4, Student Loan Interest Deduction',
    url: 'https://www.irs.gov/publications/p970',
    note: 'Maximum $2,500; 2025 phaseout $85,000-$100,000 ($170,000-$200,000 joint); not available to married filing separately.',
  },
};

export interface StudentLoanInterestInput {
  /** Form 1098-E Box 1. */
  interestPaid: MoneyInput;
  /** Adjusted gross income before this deduction (§221(b)(2)(C)). */
  modifiedAgi: MoneyInput;
  filingStatus: FilingStatus;
  claimedAsDependent: boolean;
}

export interface StudentLoanInterestResult {
  interestPaid: Money;
  /** min(paid, $2,500) before the income phaseout. */
  tentative: Money;
  phaseout: { start: Money; end: Money; modifiedAgi: Money; ratio: Money };
  reduction: Money;
  /** Schedule 1 line 21. */
  deduction: Money;
  disallowedReason: 'married_filing_separately' | 'claimed_as_dependent' | null;
  lines: Line[];
  warnings: Warning[];
  citations: Citation[];
}

export function computeStudentLoanInterestDeduction(input: StudentLoanInterestInput, params: TaxYearParameters): StudentLoanInterestResult {
  const paid = nonNegativeMoney(input.interestPaid, 'studentLoanInterest.interestPaid');
  const magi = money(input.modifiedAgi, 'studentLoanInterest.modifiedAgi');
  const range = isJointReturn(input.filingStatus) ? params.studentLoanInterest.phaseout.joint : params.studentLoanInterest.phaseout.other;
  const start = money(range.start);
  const end = money(range.end);
  const warnings: Warning[] = [];

  const tentative = min(paid, money(STUDENT_LOAN_INTEREST_MAX));

  let disallowedReason: StudentLoanInterestResult['disallowedReason'] = null;
  if (input.filingStatus === 'married_filing_separately') disallowedReason = 'married_filing_separately';
  else if (input.claimedAsDependent) disallowedReason = 'claimed_as_dependent';

  // §221(b)(2): ratio of the excess MAGI to the width of the phaseout range, clamped to [0, 1].
  const excess = notBelowZero(magi.minus(start));
  const width = end.minus(start);
  const ratio = excess.isZero() ? ZERO : min(excess.dividedBy(width), money('1'));
  const reduction = disallowedReason ? ZERO : cents(tentative.times(ratio));
  const deduction = disallowedReason ? ZERO : notBelowZero(tentative.minus(reduction));

  if (disallowedReason === 'married_filing_separately' && isAboveZero(paid)) {
    warnings.push({ code: 'student_loan_interest_mfs', message: 'Student loan interest cannot be deducted when married filing separately (IRC §221(e)(2)).', amount: paid.toFixed(2) });
  }
  if (disallowedReason === 'claimed_as_dependent' && isAboveZero(paid)) {
    warnings.push({ code: 'student_loan_interest_dependent', message: 'Student loan interest cannot be deducted by someone who can be claimed as a dependent (IRC §221(c)).', amount: paid.toFixed(2) });
  }
  if (!disallowedReason && isAboveZero(reduction)) {
    warnings.push({
      code: 'student_loan_interest_phased_out',
      message: `The student loan interest deduction was reduced because modified AGI exceeds $${start.toFixed(0)} (IRC §221(b)(2)).`,
      amount: reduction.toFixed(2),
    });
  }

  const lines: Line[] = [
    { ref: 'Form 1098-E Box 1', label: 'Student loan interest received by lender', value: paid },
    { ref: 'Pub. 970 Worksheet 4-1 line 1', label: 'Smaller of interest paid or $2,500', value: tentative },
    { ref: 'Pub. 970 Worksheet 4-1 line 4', label: 'Modified adjusted gross income', value: magi },
    { ref: 'Pub. 970 Worksheet 4-1 line 5', label: 'Phaseout begins at', value: start },
    { ref: 'Pub. 970 Worksheet 4-1 line 6', label: 'Excess MAGI / phaseout width (ratio)', value: ratio },
    { ref: 'Pub. 970 Worksheet 4-1 line 7', label: 'Reduction', value: reduction },
    { ref: 'Schedule 1 line 21', label: 'Student loan interest deduction', value: deduction },
  ];

  return {
    interestPaid: paid,
    tentative,
    phaseout: { start, end, modifiedAgi: magi, ratio },
    reduction,
    deduction,
    disallowedReason,
    lines,
    warnings,
    citations: [
      STUDENT_LOAN_CITATIONS.max,
      STUDENT_LOAN_CITATIONS.phaseout,
      STUDENT_LOAN_CITATIONS.separate,
      STUDENT_LOAN_CITATIONS.dependent,
      STUDENT_LOAN_CITATIONS.pub970,
      params.studentLoanInterest.citation,
    ],
  };
}
