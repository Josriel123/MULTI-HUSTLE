import { cents, isAboveZero, isBelowZero, max, min, money, notBelowZero, times, ZERO, type Money, type MoneyInput } from './money';
import { qbiAmountFor, type TaxYearParameters } from './parameters/types';
import type { Citation, FilingStatus, Line, Warning } from './types';

/**
 * Qualified business income deduction: IRC §199A; Form 8995; Form 1040 line 13.
 *
 *   QBI        = Schedule C net profit - deductible half of SE tax
 *                (Form 8995 instructions: QBI is reduced by the "deductible part
 *                of self-employment tax, self-employment health insurance
 *                deduction, and contributions to qualified retirement plans")
 *   tentative  = 20% x QBI                                            §199A(b)(2)(A)
 *   TI limit   = 20% x (taxable income before this deduction - net capital gain)  §199A(a)(2)
 *   deduction  = min(tentative after phase-in, TI limit)
 *
 * Above the threshold amount (§199A(e)(2), indexed), the W-2 wage / UBIA
 * limitation of §199A(b)(2)(B) phases in over the §199A(b)(3)(B) range. This
 * engine assumes a sole proprietor with no employees and no depreciable
 * property, so that limitation is zero and the deduction is reduced in
 * proportion to how far taxable income sits into the range, reaching zero at
 * the top. A specified service trade or business (consulting, for example)
 * phases out faster under §199A(d)(3); SSTB status is unknown, so a warning
 * is raised whenever taxable income exceeds the threshold.
 *
 * Negative QBI is carried forward to offset future QBI (§199A(c)(2)) and
 * produces no deduction this year; carryforwards are not tracked.
 *
 * From 2026, §199A(i) (Pub. L. 119-21) sets the deduction at the greater of the
 * ordinary amount or $400 for a taxpayer with at least $1,000 of QBI from
 * businesses in which they materially participate. The $400 is not capped at
 * taxable income (an earlier version of this module capped it; the 2026-09-09
 * audit read the statute correctly and the cap was removed).
 */

export const QBI_RATE = '0.20';

export const QBI_CITATIONS: Record<string, Citation> = {
  statute: {
    label: 'IRC §199A(a), (b)(2)',
    url: 'https://www.law.cornell.edu/uscode/text/26/199A',
    note: 'Deduction equals the lesser of the combined QBI amount (20% of QBI, subject to limits) or 20% of taxable income in excess of net capital gain.',
  },
  phaseIn: {
    label: 'IRC §199A(b)(3)(B)',
    url: 'https://www.law.cornell.edu/uscode/text/26/199A',
    note: 'Wage/UBIA limit phased in for taxable income above the threshold amount over $50,000 ($100,000 joint) for years through 2025; $75,000 ($150,000 joint) for taxable years beginning after December 31, 2025.',
  },
  form8995: {
    label: '2025 Instructions for Form 8995',
    url: 'https://www.irs.gov/instructions/i8995',
    note: 'QBI is reduced by the deductible part of self-employment tax, the self-employed health insurance deduction and qualified retirement contributions. "Your total QBI deduction is limited to 20% of your taxable income, calculated before the QBI deduction, minus net capital gain."',
  },
  minimum: {
    label: 'IRC §199A(i) (added by Pub. L. 119-21 §70105); draft 2026 Form 8995 lines 15-17',
    url: 'https://www.law.cornell.edu/uscode/text/26/199A',
    note: '"In the case of an applicable taxpayer for any taxable year, the deduction allowed under subsection (a) for the taxable year shall be equal to the greater of (A) the amount of such deduction determined without regard to this subsection, or (B) $400." Applicable taxpayer: aggregate QBI from active (materially participated, §469(h)) trades or businesses of at least $1,000. No taxable-income cap; the draft form takes "the greater of line 15 or line 16".',
  },
  lossCarryforward: {
    label: 'IRC §199A(c)(2)',
    url: 'https://www.law.cornell.edu/uscode/text/26/199A',
    note: 'A net QBI loss is treated as a loss from a qualified trade or business in the succeeding taxable year.',
  },
};

export interface QbiInput {
  /** Schedule C line 31. */
  netProfit: MoneyInput;
  /** Schedule 1 line 15 (deductible half of SE tax). */
  deductibleHalfSelfEmploymentTax: MoneyInput;
  /** Form 1040 line 11 minus line 12 (AGI minus standard deduction), before this deduction. */
  taxableIncomeBeforeQbi: MoneyInput;
  /** Net capital gain (§1(h)); zero in this engine. */
  netCapitalGain?: MoneyInput;
  filingStatus: FilingStatus;
}

export interface QbiResult {
  qualifiedBusinessIncome: Money;
  /** 20% x QBI, before limits. */
  tentative: Money;
  phaseIn: {
    threshold: Money;
    range: Money;
    excessOverThreshold: Money;
    /** Fraction of the wage/UBIA limitation applied, 0-1. */
    ratio: Money;
    /** Tentative after the phase-in reduction (assuming zero W-2 wages and UBIA). */
    afterPhaseIn: Money;
  };
  taxableIncomeLimit: Money;
  minimumDeductionApplied: boolean;
  /** Form 1040 line 13. */
  deduction: Money;
  lines: Line[];
  warnings: Warning[];
  citations: Citation[];
}

export function computeQbiDeduction(input: QbiInput, params: TaxYearParameters): QbiResult {
  const netProfit = money(input.netProfit, 'qbi.netProfit');
  const halfSe = money(input.deductibleHalfSelfEmploymentTax, 'qbi.deductibleHalfSelfEmploymentTax');
  const tiBefore = notBelowZero(money(input.taxableIncomeBeforeQbi, 'qbi.taxableIncomeBeforeQbi'));
  const netCapGain = input.netCapitalGain === undefined ? ZERO : money(input.netCapitalGain, 'qbi.netCapitalGain');
  const threshold = money(qbiAmountFor(params.qbi.threshold, input.filingStatus));
  const range = money(qbiAmountFor(params.qbi.phaseInRange, input.filingStatus));
  const warnings: Warning[] = [];
  const citations = [QBI_CITATIONS.statute, QBI_CITATIONS.form8995, params.qbi.citation];

  const qbi = netProfit.minus(halfSe);
  const positiveQbi = notBelowZero(qbi);
  const tentative = cents(times(positiveQbi, QBI_RATE));

  // §199A(b)(3)(B): phase in the (zero) wage/UBIA limit above the threshold.
  const excess = notBelowZero(tiBefore.minus(threshold));
  const ratio = excess.isZero() ? ZERO : min(excess.dividedBy(range), money('1'));
  const afterPhaseIn = cents(tentative.times(money('1').minus(ratio)));
  if (isAboveZero(excess)) {
    citations.push(QBI_CITATIONS.phaseIn);
    warnings.push({
      code: 'qbi_above_threshold',
      message: `Taxable income exceeds the §199A threshold ($${threshold.toFixed(0)}). The deduction was reduced assuming no W-2 wages or depreciable property; a specified service business would be reduced further (IRC §199A(d)(3)).`,
    });
  }

  // §199A(a)(2): overall limit.
  const tiLimit = cents(times(notBelowZero(tiBefore.minus(netCapGain)), QBI_RATE));
  let deduction = min(afterPhaseIn, tiLimit);

  // §199A(i) (tax years after 2025): "the deduction allowed under subsection (a)
  // for the taxable year shall be equal to the greater of (A) the amount of such
  // deduction determined without regard to this subsection, or (B) $400."
  // Subsection (a) applies "except as provided in subsection (i)", so the
  // taxable-income limitation in (a)(2) does not cap the minimum, and neither
  // does anything else in the statute. Draft 2026 Form 8995 agrees: line 17 is
  // "the greater of line 15 or line 16". Taxable income floors at zero downstream.
  let minimumApplied = false;
  const minimumRule = params.qbi.minimumDeduction;
  if (minimumRule && positiveQbi.greaterThanOrEqualTo(money(minimumRule.qbiFloor))) {
    const floor = money(minimumRule.amount);
    if (floor.greaterThan(deduction)) {
      deduction = floor;
      minimumApplied = true;
      citations.push(minimumRule.citation, QBI_CITATIONS.minimum);
    }
  }

  if (isBelowZero(qbi)) {
    citations.push(QBI_CITATIONS.lossCarryforward);
    warnings.push({
      code: 'qbi_loss_carryforward',
      message: 'Qualified business income is negative. No deduction this year; the loss would carry forward against future QBI (IRC §199A(c)(2)), which this estimate does not track.',
      amount: qbi.abs().toFixed(2),
    });
  }

  const lines: Line[] = [
    { ref: 'Form 8995 line 1(c)', label: 'Qualified business income (net profit less 1/2 SE tax deduction)', value: qbi },
    { ref: 'Form 8995 line 5', label: 'QBI component: 20% of QBI', value: tentative },
    { ref: '§199A(b)(3)(B) threshold', label: 'Threshold amount', value: threshold },
    { ref: '§199A(b)(3)(B) phase-in', label: 'Phase-in ratio (excess / range)', value: ratio },
    { ref: 'Form 8995 line 10', label: 'QBI component after phase-in', value: afterPhaseIn },
    { ref: 'Form 8995 line 11', label: 'Taxable income before QBI deduction', value: tiBefore },
    { ref: 'Form 8995 line 12', label: 'Net capital gain', value: netCapGain },
    { ref: 'Form 8995 line 14', label: 'Income limitation: 20% of (line 11 - line 12)', value: tiLimit },
    { ref: 'Form 8995 line 15, to Form 1040 line 13', label: `Qualified business income deduction${minimumApplied ? ' (§199A(i) minimum)' : ''}`, value: deduction },
  ];

  return {
    qualifiedBusinessIncome: qbi,
    tentative,
    phaseIn: { threshold, range, excessOverThreshold: excess, ratio, afterPhaseIn },
    taxableIncomeLimit: tiLimit,
    minimumDeductionApplied: minimumApplied,
    deduction: max(deduction, ZERO),
    lines,
    warnings,
    citations,
  };
}
