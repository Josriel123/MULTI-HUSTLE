import { cents, isAboveZero, min, money, nonNegativeMoney, notBelowZero, times, ZERO, type Money, type MoneyInput } from './money';
import type { TaxYearParameters } from './parameters/types';
import type { Citation, FilingStatus, Line, Warning } from './types';

/**
 * Schedule SE (Form 1040), Self-Employment Tax, plus the Additional Medicare
 * Tax on self-employment income (Form 8959 Part II).
 *
 * Line map (2025 Schedule SE, Part I; no optional methods):
 *   2   Net profit from Schedule C line 31
 *   3   Same (no farm or partnership income)
 *   4a  Line 3 x 92.35%                          §1402(a)(12)
 *   4c  = 4a. If less than $400, no SE tax       §1402(b)(2)
 *   7   Social Security wage base for the year   §1402(b)(1)
 *   8a  W-2 Social Security wages and tips (boxes 3 and 7); 8b-8c (Forms 4137/8919) not modeled
 *   9   Line 7 - 8d, not below zero
 *   10  Smaller of 4c or 9, x 12.4%              §1401(a)
 *   11  Line 4c x 2.9%                           §1401(b)(1)
 *   12  Line 10 + 11, to Schedule 2 line 4
 *   13  Line 12 x 50%, to Schedule 1 line 15     §164(f)
 *
 * Why 92.35%: an employee's 7.65% share of FICA is withheld from wages the
 * employee is taxed on, while the employer's 7.65% is not wages at all.
 * §1402(a)(12) puts the self-employed on the same footing by taxing only
 * (100% - 7.65%) = 92.35% of net profit. Applying 15.3% to the full net
 * profit, as the previous code did, overstated SE tax by about 8.3%.
 *
 * Rounding: each line is rounded to cents when it is "written down", so
 * lines 10 and 11 are rounded separately before being summed, as they would
 * be on the form.
 */

export const SE_RATES = {
  netEarningsFactor: '0.9235', // 1 - 0.0765; §1402(a)(12)
  socialSecurity: '0.124', // §1401(a)
  medicare: '0.029', // §1401(b)(1)
  additionalMedicare: '0.009', // §1401(b)(2)(A)
  halfDeduction: '0.5', // §164(f)(1)
  /** Employee share of Medicare tax withheld from wages (§3101(b)(1)); Form 8959 line 21 multiplies Medicare wages by it. */
  medicareEmployee: '0.0145',
  /** Employee share of Social Security tax withheld from wages (§3101(a)), up to the wage base per employer. */
  socialSecurityEmployee: '0.062',
} as const;

/** §1402(b)(2): no self-employment income (and no tax) when net earnings are under $400. */
export const SE_MINIMUM_NET_EARNINGS = '400';

/** §1401(b)(2)(A) / §3101(b)(2): statutory, not indexed. */
export const ADDITIONAL_MEDICARE_THRESHOLDS: Record<FilingStatus, string> = {
  married_filing_jointly: '250000',
  married_filing_separately: '125000',
  single: '200000',
  head_of_household: '200000',
  qualifying_surviving_spouse: '200000',
};

export const SCHEDULE_SE_CITATIONS: Record<string, Citation> = {
  form: {
    label: '2025 Schedule SE (Form 1040) and instructions',
    url: 'https://www.irs.gov/instructions/i1040sse',
    note: '"You must file Schedule SE if: The amount on line 4c of Schedule SE is $400 or more." Line 8a: "Total social security wages and tips (total of boxes 3 and 7 on Form(s) W-2) and railroad retirement (tier 1) compensation." Line 9: "Subtract line 8d from line 7." Maximum self-employment income subject to Social Security tax for 2025 is $176,100.',
  },
  netEarnings: {
    label: 'IRC §1402(a)(12)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1402',
    note: "Net earnings are reduced by \"the product of (A) the taxpayer's net earnings from self-employment ... and (B) one-half of the sum of the rates imposed by subsections (a) and (b) of section 1401\", i.e. 7.65%, leaving 92.35%.",
  },
  threshold: {
    label: 'IRC §1402(b)(2)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1402',
    note: 'Self-employment income does not include net earnings "if such net earnings for the taxable year are less than $400."',
  },
  wageBase: {
    label: 'IRC §1402(b)(1)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1402',
    note: 'Excludes net earnings "in excess of ... the contribution and benefit base (as determined under section 230 of the Social Security Act)" less wages already subject to Social Security tax.',
  },
  rates: {
    label: 'IRC §1401(a), (b)(1)',
    url: 'https://www.law.cornell.edu/uscode/text/26/1401',
    note: '"12.4 percent of the amount of the self-employment income" and "2.9 percent of the amount of the self-employment income."',
  },
  additionalMedicare: {
    label: 'IRC §1401(b)(2); Form 8959 Part II',
    url: 'https://www.irs.gov/instructions/i8959',
    note: '0.9% on self-employment income above $250,000 (joint) / $125,000 (separate) / $200,000 (other), with the threshold "reduced (but not below zero) by the amount of wages taken into account."',
  },
  halfDeduction: {
    label: 'IRC §164(f); Schedule 1 line 15',
    url: 'https://www.law.cornell.edu/uscode/text/26/164',
    note: 'Deduction "equal to one-half of the taxes imposed by section 1401" (the 0.9% additional tax excluded, §164(f)(1)).',
  },
};

export interface ScheduleSEInput {
  /** Schedule C line 31. */
  netProfit: MoneyInput;
  filingStatus: FilingStatus;
  /** W-2 box 3. With box 7, reduces the Social Security base available to SE income (line 8a). */
  w2SocialSecurityWages?: MoneyInput;
  /** W-2 box 7 (Social Security tips). Line 8a is "total of boxes 3 and 7 on Form(s) W-2". */
  w2SocialSecurityTips?: MoneyInput;
  /** W-2 box 5. Reduces the Additional Medicare threshold (Form 8959 line 10). */
  w2MedicareWages?: MoneyInput;
}

export interface ScheduleSEResult {
  /** Line 4c. Zero when net profit is not positive or is under the $400 floor. */
  netEarnings: Money;
  /** Whether net earnings reached the $400 floor. */
  subjectToSelfEmploymentTax: boolean;
  socialSecurityWageBase: Money;
  /** Line 9: wage base remaining after W-2 Social Security wages. */
  socialSecurityBaseRemaining: Money;
  /** Line 10. */
  socialSecurityTax: Money;
  /** Line 11. */
  medicareTax: Money;
  /** Line 12, to Schedule 2 line 4. */
  selfEmploymentTax: Money;
  /** Line 13, to Schedule 1 line 15. */
  deductibleHalf: Money;
  additionalMedicare: {
    threshold: Money;
    /** Form 8959 line 11: threshold less Medicare wages, not below zero. */
    thresholdAfterWages: Money;
    /** Form 8959 line 12: SE income over the remaining threshold. */
    selfEmploymentIncomeOverThreshold: Money;
    /** Form 8959 line 13 (the SE part only; the wage part is computed in the engine). */
    tax: Money;
  };
  lines: Line[];
  warnings: Warning[];
  citations: Citation[];
}

export function computeScheduleSE(input: ScheduleSEInput, params: TaxYearParameters): ScheduleSEResult {
  const netProfit = money(input.netProfit, 'scheduleSE.netProfit');
  const ssWagesOnly = input.w2SocialSecurityWages === undefined ? ZERO : nonNegativeMoney(input.w2SocialSecurityWages, 'w2.socialSecurityWages');
  const ssTips = input.w2SocialSecurityTips === undefined ? ZERO : nonNegativeMoney(input.w2SocialSecurityTips, 'w2.socialSecurityTips');
  // Line 8a: "Total social security wages and tips (total of boxes 3 and 7 on Form(s) W-2)".
  const ssWages = ssWagesOnly.plus(ssTips);
  const medicareWages = input.w2MedicareWages === undefined ? ZERO : nonNegativeMoney(input.w2MedicareWages, 'w2.medicareWages');
  const wageBase = money(params.selfEmployment.socialSecurityWageBase);
  const warnings: Warning[] = [];

  // Line 4a/4c. A loss produces no net earnings (and no negative tax).
  const netEarningsRaw = isAboveZero(netProfit) ? cents(times(netProfit, SE_RATES.netEarningsFactor)) : ZERO;
  const subject = netEarningsRaw.greaterThanOrEqualTo(money(SE_MINIMUM_NET_EARNINGS));
  // Below $400 there is no "self-employment income" at all (§1402(b)(2)), so every downstream line is zero.
  const netEarnings = subject ? netEarningsRaw : ZERO;

  // Lines 7-9.
  const baseRemaining = notBelowZero(wageBase.minus(ssWages));
  // Line 10.
  const socialSecurityTax = cents(times(min(netEarnings, baseRemaining), SE_RATES.socialSecurity));
  // Line 11.
  const medicareTax = cents(times(netEarnings, SE_RATES.medicare));
  // Line 12.
  const selfEmploymentTax = socialSecurityTax.plus(medicareTax);
  // Line 13.
  const deductibleHalf = cents(times(selfEmploymentTax, SE_RATES.halfDeduction));

  // Form 8959 Part II.
  const threshold = money(ADDITIONAL_MEDICARE_THRESHOLDS[input.filingStatus]);
  const thresholdAfterWages = notBelowZero(threshold.minus(medicareWages));
  const seOverThreshold = notBelowZero(netEarnings.minus(thresholdAfterWages));
  const additionalMedicareTax = cents(times(seOverThreshold, SE_RATES.additionalMedicare));

  if (isAboveZero(netEarningsRaw) && !subject) {
    warnings.push({
      code: 'se_below_400',
      message: 'Net earnings from self-employment are under $400, so no self-employment tax is due (IRC §1402(b)(2)).',
      amount: netEarningsRaw.toFixed(2),
    });
  }
  if (netEarnings.greaterThan(baseRemaining)) {
    warnings.push({
      code: 'se_social_security_capped',
      message: `Only the first $${wageBase.toFixed(0)} of combined wages and net earnings is subject to the 12.4% Social Security part (IRC §1402(b)(1)).`,
    });
  }

  const lines: Line[] = [
    { ref: 'Schedule SE line 2', label: 'Net profit from Schedule C line 31', value: netProfit },
    { ref: 'Schedule SE line 3', label: 'Combine lines 1a, 1b, and 2', value: netProfit },
    { ref: 'Schedule SE line 4a', label: 'Line 3 x 92.35%', value: netEarningsRaw },
    { ref: 'Schedule SE line 4c', label: 'Net earnings from self-employment (zero if under $400)', value: netEarnings },
    { ref: 'Schedule SE line 7', label: `Maximum earnings subject to Social Security (${params.taxYear})`, value: wageBase },
    { ref: 'Schedule SE line 8a', label: 'Total Social Security wages and tips (W-2 boxes 3 and 7)', value: ssWages },
    { ref: 'Schedule SE line 9', label: 'Line 7 minus line 8d', value: baseRemaining },
    { ref: 'Schedule SE line 10', label: 'Smaller of line 4c or 9, x 12.4%', value: socialSecurityTax },
    { ref: 'Schedule SE line 11', label: 'Line 4c x 2.9%', value: medicareTax },
    { ref: 'Schedule SE line 12', label: 'Self-employment tax, to Schedule 2 line 4', value: selfEmploymentTax },
    { ref: 'Schedule SE line 13', label: 'Deduction for one-half of SE tax, to Schedule 1 line 15', value: deductibleHalf },
    { ref: 'Form 8959 line 9', label: 'Additional Medicare threshold', value: threshold },
    { ref: 'Form 8959 line 11', label: 'Threshold less Medicare wages', value: thresholdAfterWages },
    { ref: 'Form 8959 line 12', label: 'SE income over threshold', value: seOverThreshold },
    { ref: 'Form 8959 line 13', label: 'Additional Medicare Tax on SE income (0.9%)', value: additionalMedicareTax },
  ];

  return {
    netEarnings,
    subjectToSelfEmploymentTax: subject,
    socialSecurityWageBase: wageBase,
    socialSecurityBaseRemaining: baseRemaining,
    socialSecurityTax,
    medicareTax,
    selfEmploymentTax,
    deductibleHalf,
    additionalMedicare: {
      threshold,
      thresholdAfterWages,
      selfEmploymentIncomeOverThreshold: seOverThreshold,
      tax: additionalMedicareTax,
    },
    lines,
    warnings,
    citations: [
      SCHEDULE_SE_CITATIONS.form,
      SCHEDULE_SE_CITATIONS.netEarnings,
      SCHEDULE_SE_CITATIONS.threshold,
      SCHEDULE_SE_CITATIONS.wageBase,
      SCHEDULE_SE_CITATIONS.rates,
      SCHEDULE_SE_CITATIONS.additionalMedicare,
      SCHEDULE_SE_CITATIONS.halfDeduction,
      params.selfEmployment.citation,
    ],
  };
}
