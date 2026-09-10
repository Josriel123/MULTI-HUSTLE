import { disclaimerFor, NOT_MODELED } from './disclaimer';
import { computeIncomeTax, type IncomeTaxResult } from './incomeTax';
import { cents, isAboveZero, isBelowZero, Money, money, nonNegativeMoney, notBelowZero, times, ZERO, type MoneyInput } from './money';
import { getTaxYearParameters } from './parameters';
import { computeQbiDeduction, type QbiResult } from './qbi';
import { computeScheduleC, type ScheduleCInput, type ScheduleCResult } from './scheduleC';
import { ADDITIONAL_MEDICARE_THRESHOLDS, computeScheduleSE, SE_RATES, type ScheduleSEResult } from './scheduleSE';
import { computeTaxableScholarships, type ScholarshipInput, type ScholarshipResult } from './scholarships';
import { computeStandardDeduction, type StandardDeductionResult } from './standardDeduction';
import { computeStudentLoanInterestDeduction, type StudentLoanInterestResult } from './studentLoanInterest';
import { isFilingStatus, type Citation, type FilingStatus, type Line, type Warning } from './types';

/**
 * Federal income tax estimate for a self-employed individual, in Form 1040
 * order. Each step is a pure function in its own module; this file only wires
 * them together in the sequence the form prescribes and collects the lines,
 * warnings and citations so the whole computation can be read top to bottom.
 *
 *   Schedule C           net profit (line 31)
 *   Schedule SE          self-employment tax; deductible half
 *   Schedule 1 line 8r   taxable scholarships
 *   Form 1040 line 9     total income
 *   Schedule 1 Part II   adjustments: half SE tax (15), student loan interest (21)
 *   Form 1040 line 11    adjusted gross income
 *   Form 1040 line 12    standard deduction
 *   Form 1040 line 13    qualified business income deduction
 *   Form 1040 line 15    taxable income
 *   Form 1040 line 16    tax (rate tables)
 *   Schedule 2           self-employment tax (4), Additional Medicare Tax (11)
 *   Form 1040 line 24    total tax
 *   Form 1040 line 33    payments (withholding, estimated payments)
 *   Form 1040 line 37/34 amount owed or overpaid
 */

export interface W2Input {
  /** Box 1. */
  wages: MoneyInput;
  /** Box 3. */
  socialSecurityWages: MoneyInput;
  /** Box 5. */
  medicareWages: MoneyInput;
  /** Box 2. */
  federalIncomeTaxWithheld?: MoneyInput;
}

export interface FederalTaxInput {
  taxYear: number;
  filingStatus: FilingStatus;
  /** Someone else can claim this taxpayer as a dependent (IRC §63(c)(5), §221(c)). Default false. */
  claimedAsDependent?: boolean;
  scheduleC: ScheduleCInput;
  /** Schedule 1 line 8z: taxable income that is neither wages nor business income. */
  otherIncome?: MoneyInput;
  scholarships?: ScholarshipInput | null;
  /** Form 1098-E box 1. */
  studentLoanInterestPaid?: MoneyInput;
  w2?: W2Input | null;
  estimatedTaxPaymentsMade?: MoneyInput;
}

export interface FederalTaxEstimate {
  taxYear: number;
  filingStatus: FilingStatus;
  claimedAsDependent: boolean;

  scheduleC: ScheduleCResult;
  scheduleSE: ScheduleSEResult;
  scholarships: ScholarshipResult | null;

  income: {
    /** Form 1040 line 1a. */
    wages: Money;
    /** Schedule 1 line 3. */
    businessNetProfit: Money;
    /** Schedule 1 line 8r. */
    taxableScholarships: Money;
    /** Schedule 1 line 8z. */
    otherIncome: Money;
    /** Form 1040 line 9. */
    totalIncome: Money;
  };
  adjustments: {
    /** Schedule 1 line 15. */
    halfSelfEmploymentTax: Money;
    studentLoanInterest: StudentLoanInterestResult | null;
    /** Schedule 1 line 26 = Form 1040 line 10. */
    total: Money;
  };
  /** Form 1040 line 11. */
  adjustedGrossIncome: Money;
  standardDeduction: StandardDeductionResult;
  qbi: QbiResult;
  /** Form 1040 line 15. */
  taxableIncome: Money;
  incomeTax: IncomeTaxResult;
  otherTaxes: {
    /** Schedule 2 line 4. */
    selfEmploymentTax: Money;
    /** Schedule 2 line 11 (Form 8959 line 18): SE part plus wage part. */
    additionalMedicareTax: Money;
    /** Schedule 2 line 21 = Form 1040 line 23. */
    total: Money;
  };
  /** Form 1040 line 24. */
  totalTax: Money;
  payments: {
    withholding: Money;
    estimatedPayments: Money;
    /** Form 1040 line 33. */
    total: Money;
  };
  /** Form 1040 line 37 when positive (amount you owe); negative means line 34 (overpaid). */
  balanceDue: Money;
  /** totalTax / totalIncome, as a decimal fraction, when total income is positive. */
  effectiveRate: Money | null;

  lines: Line[];
  warnings: Warning[];
  assumptions: string[];
  notModeled: readonly string[];
  citations: Citation[];
  disclaimer: string;
}

const ENGINE_CITATIONS: Record<string, Citation> = {
  form1040: {
    label: '2025 Form 1040 and instructions',
    url: 'https://www.irs.gov/instructions/i1040gi',
    note: 'Line 9 total income; line 10 adjustments from Schedule 1 line 26; line 11 AGI; line 12 standard deduction; line 13 QBI deduction; line 15 taxable income; line 16 tax; line 23 other taxes from Schedule 2; line 24 total tax.',
  },
  earnedIncomeForDependents: {
    label: '2025 Form 1040 instructions, Standard Deduction Worksheet for Dependents (footnote)',
    url: 'https://www.irs.gov/instructions/i1040gi',
    note: 'Footnote to the worksheet: "Earned income includes wages, salaries, tips, professional fees, and other compensation received for personal services you performed. It also includes any taxable scholarship or fellowship grant. Generally, your earned income is the total of the amount(s) you reported on Form 1040 or 1040-SR, line 1z, and Schedule 1, lines 3, 6, 8r, 8t, and 8u minus the amount, if any, on Schedule 1, line 15."',
  },
  additionalMedicareWages: {
    label: 'IRC §3101(b)(2); Form 8959 Part I',
    url: 'https://www.irs.gov/instructions/i8959',
    note: '0.9% of Medicare wages over the filing-status threshold ($250,000 joint, $125,000 separate, $200,000 other).',
  },
  kiddie: {
    label: 'IRC §1(g); Form 8615',
    url: 'https://www.irs.gov/instructions/i8615',
    note: 'Tax on a child\'s unearned income above twice the §1(g)(4)(A)(ii)(I) amount may be computed at the parent\'s rate. Taxable scholarships not reported on a W-2 are unearned income for this purpose.',
  },
};

export function estimateFederalTax(input: FederalTaxInput): FederalTaxEstimate {
  if (!isFilingStatus(input.filingStatus)) {
    throw new Error(`estimateFederalTax: unknown filing status ${JSON.stringify(input.filingStatus)}`);
  }
  const params = getTaxYearParameters(input.taxYear);
  const filingStatus = input.filingStatus;
  const claimedAsDependent = input.claimedAsDependent ?? false;
  const warnings: Warning[] = [];
  const citations: Citation[] = [ENGINE_CITATIONS.form1040, ...params.sources];
  const assumptions: string[] = [
    `Filing status ${filingStatus.replace(/_/g, ' ')} and tax year ${params.taxYear} parameters are applied to the full year.`,
    'All business activity is treated as one Schedule C sole proprietorship (the totals are the same as filing several).',
    'Tax is computed with the exact §1(j)(2) bracket formula. The Tax Table used for taxable income under $100,000 rounds income to $50 bands and can differ by up to about $5.',
    'Amounts are rounded to the cent at each form line; the IRS permits rounding to whole dollars, so a filed return may differ by cents.',
    'No tax credits are claimed (see "not modeled").',
  ];

  // W-2 (optional).
  const w2 = input.w2 ?? null;
  const wages = w2 ? nonNegativeMoney(w2.wages, 'w2.wages') : ZERO;
  const medicareWages = w2 ? nonNegativeMoney(w2.medicareWages, 'w2.medicareWages') : ZERO;
  const withholding = w2?.federalIncomeTaxWithheld === undefined ? ZERO : nonNegativeMoney(w2.federalIncomeTaxWithheld, 'w2.federalIncomeTaxWithheld');

  // Schedule C.
  const scheduleC = computeScheduleC(input.scheduleC);
  warnings.push(...scheduleC.warnings);
  citations.push(...scheduleC.citations);

  // Schedule SE.
  const scheduleSE = computeScheduleSE(
    {
      netProfit: scheduleC.netProfit,
      filingStatus,
      w2SocialSecurityWages: w2?.socialSecurityWages,
      w2MedicareWages: w2?.medicareWages,
    },
    params,
  );
  warnings.push(...scheduleSE.warnings);
  citations.push(...scheduleSE.citations);

  // Schedule 1 line 8r: taxable scholarships. Required course materials
  // tagged on transactions flow in from Schedule C's category pass.
  let scholarships: ScholarshipResult | null = null;
  if (input.scholarships) {
    const explicitMaterials = input.scholarships.requiredCourseMaterials === undefined ? ZERO : nonNegativeMoney(input.scholarships.requiredCourseMaterials, 'scholarships.requiredCourseMaterials');
    scholarships = computeTaxableScholarships({
      form1098T: input.scholarships.form1098T,
      requiredCourseMaterials: explicitMaterials.plus(scheduleC.qualifiedEducationExpenses),
    });
    warnings.push(...scholarships.warnings);
    assumptions.push(...scholarships.assumptions);
    citations.push(...scholarships.citations);
  } else if (isAboveZero(scheduleC.qualifiedEducationExpenses)) {
    warnings.push({
      code: 'education_expenses_without_1098t',
      message: 'Expenses were tagged as required course materials but no Form 1098-T is on file, so they had no effect. They offset taxable scholarships only.',
      amount: scheduleC.qualifiedEducationExpenses.toFixed(2),
    });
  }
  const taxableScholarships = scholarships?.taxable ?? ZERO;
  const otherIncome = input.otherIncome === undefined ? ZERO : nonNegativeMoney(input.otherIncome, 'otherIncome');

  // Form 1040 line 9.
  const totalIncome = wages.plus(scheduleC.netProfit).plus(taxableScholarships).plus(otherIncome);

  // Schedule 1 Part II.
  const halfSE = scheduleSE.deductibleHalf;
  const agiBeforeStudentLoan = totalIncome.minus(halfSE);
  let studentLoan: StudentLoanInterestResult | null = null;
  if (input.studentLoanInterestPaid !== undefined) {
    studentLoan = computeStudentLoanInterestDeduction(
      { interestPaid: input.studentLoanInterestPaid, modifiedAgi: agiBeforeStudentLoan, filingStatus, claimedAsDependent },
      params,
    );
    warnings.push(...studentLoan.warnings);
    citations.push(...studentLoan.citations);
  }
  const adjustmentsTotal = halfSE.plus(studentLoan?.deduction ?? ZERO);

  // Form 1040 line 11.
  const agi = totalIncome.minus(adjustmentsTotal);

  // Form 1040 line 12. Earned income for the dependents worksheet (2025 Form 1040
  // instructions footnote): line 1z + Schedule 1 lines 3, 6, 8r, 8t, 8u - Schedule 1 line 15.
  // Here that is wages + business net profit + taxable scholarships - half SE tax.
  const earnedIncomeForDependents = wages.plus(scheduleC.netProfit).minus(halfSE).plus(taxableScholarships);
  const standardDeduction = computeStandardDeduction({ filingStatus, claimedAsDependent, earnedIncome: earnedIncomeForDependents }, params);
  citations.push(...standardDeduction.citations);
  if (claimedAsDependent) citations.push(ENGINE_CITATIONS.earnedIncomeForDependents);

  // Form 1040 line 13.
  const taxableIncomeBeforeQbi = notBelowZero(agi.minus(standardDeduction.deduction));
  const qbi = computeQbiDeduction(
    { netProfit: scheduleC.netProfit, deductibleHalfSelfEmploymentTax: halfSE, taxableIncomeBeforeQbi, filingStatus },
    params,
  );
  warnings.push(...qbi.warnings);
  citations.push(...qbi.citations);

  // Form 1040 line 15.
  const taxableIncome = notBelowZero(taxableIncomeBeforeQbi.minus(qbi.deduction));

  // Form 1040 line 16.
  const incomeTax = computeIncomeTax(taxableIncome, filingStatus, params);
  citations.push(...incomeTax.citations);

  // Schedule 2. Additional Medicare Tax on wages (Form 8959 Part I) plus on SE income (Part II).
  const amtThreshold = money(ADDITIONAL_MEDICARE_THRESHOLDS[filingStatus]);
  const additionalMedicareOnWages = cents(times(notBelowZero(medicareWages.minus(amtThreshold)), SE_RATES.additionalMedicare));
  if (isAboveZero(additionalMedicareOnWages)) citations.push(ENGINE_CITATIONS.additionalMedicareWages);
  const additionalMedicareTax = scheduleSE.additionalMedicare.tax.plus(additionalMedicareOnWages);
  const otherTaxesTotal = scheduleSE.selfEmploymentTax.plus(additionalMedicareTax);

  // Form 1040 line 24. Lines 17-21 (AMT, credits) are zero: not modeled.
  const totalTax = incomeTax.tax.plus(otherTaxesTotal);

  // Payments.
  const estimatedPayments = input.estimatedTaxPaymentsMade === undefined ? ZERO : nonNegativeMoney(input.estimatedTaxPaymentsMade, 'estimatedTaxPaymentsMade');
  const paymentsTotal = withholding.plus(estimatedPayments);
  const balanceDue = totalTax.minus(paymentsTotal);

  // Kiddie tax warning: dependents with taxable scholarships above the Form 8615 threshold.
  const kiddieThreshold = money(params.kiddieTax.baseAmount).times(2);
  if (claimedAsDependent && taxableScholarships.greaterThan(kiddieThreshold)) {
    citations.push(ENGINE_CITATIONS.kiddie, params.kiddieTax.citation);
    warnings.push({
      code: 'kiddie_tax_may_apply',
      message: `Taxable scholarships exceed $${kiddieThreshold.toFixed(0)}. If the taxpayer is under 24 and a full-time student, Form 8615 may tax the excess at the parents\' rate, which this estimate does not compute.`,
      amount: taxableScholarships.minus(kiddieThreshold).toFixed(2),
    });
  }
  if (scheduleC.grossReceipts.isZero() && wages.isZero() && taxableScholarships.isZero() && otherIncome.isZero()) {
    warnings.push({ code: 'no_income', message: 'No income was found for this tax year, so every figure is zero.' });
  }

  const effectiveRate = isAboveZero(totalIncome) ? totalTax.dividedBy(totalIncome) : null;

  const lines: Line[] = [
    ...scheduleC.lines,
    ...scheduleSE.lines,
    ...(scholarships?.lines ?? []),
    { ref: 'Form 1040 line 1a', label: 'Wages (Form W-2 box 1)', value: wages },
    { ref: 'Schedule 1 line 3', label: 'Business income or (loss)', value: scheduleC.netProfit },
    { ref: 'Schedule 1 line 8r', label: 'Scholarship and fellowship grants not reported on W-2', value: taxableScholarships },
    { ref: 'Schedule 1 line 8z', label: 'Other income', value: otherIncome },
    { ref: 'Form 1040 line 9', label: 'Total income', value: totalIncome },
    { ref: 'Schedule 1 line 15', label: 'Deductible part of self-employment tax', value: halfSE },
    ...(studentLoan?.lines ?? []),
    { ref: 'Form 1040 line 10', label: 'Adjustments to income (Schedule 1 line 26)', value: adjustmentsTotal },
    { ref: 'Form 1040 line 11', label: 'Adjusted gross income', value: agi },
    ...standardDeduction.lines,
    ...qbi.lines,
    { ref: 'Form 1040 line 15', label: 'Taxable income', value: taxableIncome },
    ...incomeTax.lines.slice(1),
    { ref: 'Schedule 2 line 4', label: 'Self-employment tax', value: scheduleSE.selfEmploymentTax },
    { ref: 'Form 8959 line 7', label: 'Additional Medicare Tax on wages', value: additionalMedicareOnWages },
    { ref: 'Schedule 2 line 11', label: 'Additional Medicare Tax (Form 8959 line 18)', value: additionalMedicareTax },
    { ref: 'Form 1040 line 23', label: 'Other taxes (Schedule 2 line 21)', value: otherTaxesTotal },
    { ref: 'Form 1040 line 24', label: 'Total tax', value: totalTax },
    { ref: 'Form 1040 line 25d', label: 'Federal income tax withheld', value: withholding },
    { ref: 'Form 1040 line 26', label: 'Estimated tax payments', value: estimatedPayments },
    { ref: 'Form 1040 line 33', label: 'Total payments', value: paymentsTotal },
    { ref: isBelowZero(balanceDue) ? 'Form 1040 line 34' : 'Form 1040 line 37', label: isBelowZero(balanceDue) ? 'Overpaid' : 'Amount you owe', value: balanceDue.abs() },
  ];

  return {
    taxYear: params.taxYear,
    filingStatus,
    claimedAsDependent,
    scheduleC,
    scheduleSE,
    scholarships,
    income: { wages, businessNetProfit: scheduleC.netProfit, taxableScholarships, otherIncome, totalIncome },
    adjustments: { halfSelfEmploymentTax: halfSE, studentLoanInterest: studentLoan, total: adjustmentsTotal },
    adjustedGrossIncome: agi,
    standardDeduction,
    qbi,
    taxableIncome,
    incomeTax,
    otherTaxes: { selfEmploymentTax: scheduleSE.selfEmploymentTax, additionalMedicareTax, total: otherTaxesTotal },
    totalTax,
    payments: { withholding, estimatedPayments, total: paymentsTotal },
    balanceDue,
    effectiveRate,
    lines,
    warnings,
    assumptions,
    notModeled: NOT_MODELED,
    citations: dedupeCitations(citations),
    disclaimer: disclaimerFor(params.taxYear, filingStatus),
  };
}

function dedupeCitations(list: Citation[]): Citation[] {
  const seen = new Set<string>();
  const out: Citation[] = [];
  for (const c of list) {
    const key = `${c.label}|${c.url ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(c);
  }
  return out;
}

/**
 * JSON-safe form of any engine result: every `Money` becomes a JS number with
 * at most four decimals (two are enough for dollar amounts; ratios such as a
 * business-use percentage keep four). Everything else passes through.
 */
export type Serialized<T> = T extends Money
  ? number
  : T extends readonly (infer U)[]
    ? Serialized<U>[]
    : T extends object
      ? { [K in keyof T]: Serialized<T[K]> }
      : T;

export function toPlain<T>(value: T): Serialized<T> {
  if (value instanceof Money) {
    return Number(value.toDecimalPlaces(4, Money.ROUND_HALF_UP).toString()) as Serialized<T>;
  }
  if (Array.isArray(value)) {
    return value.map((v) => toPlain(v)) as Serialized<T>;
  }
  if (value !== null && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[k] = toPlain(v);
    return out as Serialized<T>;
  }
  return value as Serialized<T>;
}
