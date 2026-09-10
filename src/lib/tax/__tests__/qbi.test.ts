import { describe, expect, it } from 'vitest';
import { getTaxYearParameters } from '../parameters';
import { computeQbiDeduction } from '../qbi';
import { expectMoney } from './helpers';

const P2025 = getTaxYearParameters(2025);
const P2026 = getTaxYearParameters(2026);

describe('computeQbiDeduction', () => {
  it('QBI is net profit less the deductible half of SE tax; deduction is 20% of it, limited to 20% of taxable income', () => {
    // QBI = 44,000 - 3,108.51 = 40,891.49; 20% = 8,178.298 -> 8,178.30
    // TI limit = 20% x 25,141.49 = 5,028.298 -> 5,028.30  (binding)
    const r = computeQbiDeduction({ netProfit: '44000', deductibleHalfSelfEmploymentTax: '3108.51', taxableIncomeBeforeQbi: '25141.49', filingStatus: 'single' }, P2025);
    expectMoney(r.qualifiedBusinessIncome, '40891.49');
    expectMoney(r.tentative, '8178.30');
    expectMoney(r.taxableIncomeLimit, '5028.30');
    expectMoney(r.deduction, '5028.30');
    expectMoney(r.phaseIn.ratio, '0.00');
    expect(r.warnings).toHaveLength(0);
  });

  it('gives the full 20% when taxable income is comfortably above QBI and below the threshold', () => {
    // QBI = 50,000 - 3,532.39 = 46,467.61; 20% = 9,293.522 -> 9,293.52; TI limit 20,000
    const r = computeQbiDeduction({ netProfit: '50000', deductibleHalfSelfEmploymentTax: '3532.39', taxableIncomeBeforeQbi: '100000', filingStatus: 'single' }, P2025);
    expectMoney(r.deduction, '9293.52');
  });

  it('phases the deduction down to zero across the §199A(b)(3)(B) range above the threshold (no W-2 wages, no UBIA)', () => {
    // 2025 single threshold 197,300, range 50,000. TI 222,300 -> excess 25,000 -> ratio 0.5
    const half = computeQbiDeduction({ netProfit: '300000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '222300', filingStatus: 'single' }, P2025);
    expectMoney(half.tentative, '60000.00');
    expectMoney(half.phaseIn.ratio, '0.50');
    expectMoney(half.phaseIn.afterPhaseIn, '30000.00');
    expectMoney(half.deduction, '30000.00'); // TI limit 44,460 is not binding
    expect(half.warnings.map((w) => w.code)).toContain('qbi_above_threshold');
    // At or past the top of the range: zero
    expectMoney(computeQbiDeduction({ netProfit: '300000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '247300', filingStatus: 'single' }, P2025).deduction, '0.00');
    expectMoney(computeQbiDeduction({ netProfit: '300000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '500000', filingStatus: 'single' }, P2025).deduction, '0.00');
    // Exactly at the threshold: untouched
    expectMoney(computeQbiDeduction({ netProfit: '300000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '197300', filingStatus: 'single' }, P2025).phaseIn.ratio, '0.00');
  });

  it('joint returns use the joint threshold and range ($394,600 / $100,000 for 2025)', () => {
    // TI 400,000 -> excess 5,400 / 100,000 = 0.054; 60,000 x (1 - 0.054) = 56,760
    const r = computeQbiDeduction({ netProfit: '300000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '400000', filingStatus: 'married_filing_jointly' }, P2025);
    expectMoney(r.phaseIn.threshold, '394600.00');
    expectMoney(r.phaseIn.afterPhaseIn, '56760.00');
  });

  it('a negative QBI yields no deduction and a carryforward warning (§199A(c)(2))', () => {
    const r = computeQbiDeduction({ netProfit: '-4000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '10000', filingStatus: 'single' }, P2025);
    expectMoney(r.deduction, '0.00');
    expect(r.warnings.map((w) => w.code)).toContain('qbi_loss_carryforward');
  });

  it('2026: the §199A(i) minimum is the greater of the ordinary deduction or $400, with at least $1,000 of QBI and no taxable-income cap', () => {
    // QBI 1,000 -> 20% = 200 -> lifted to 400
    const min = computeQbiDeduction({ netProfit: '1000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '5000', filingStatus: 'single' }, P2026);
    expectMoney(min.deduction, '400.00');
    expect(min.minimumDeductionApplied).toBe(true);
    // QBI 999.99: below the $1,000 floor, ordinary 20% = 200.00
    const under = computeQbiDeduction({ netProfit: '999.99', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '5000', filingStatus: 'single' }, P2026);
    expectMoney(under.deduction, '200.00');
    expect(under.minimumDeductionApplied).toBe(false);
    // Taxable income only 300, or even 0: the statute says "the greater of ... or $400" with no cap
    // (§199A(i)(1); draft 2026 Form 8995 line 17). Taxable income floors at zero in the engine instead.
    expectMoney(computeQbiDeduction({ netProfit: '1000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '300', filingStatus: 'single' }, P2026).deduction, '400.00');
    expectMoney(computeQbiDeduction({ netProfit: '1000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '0', filingStatus: 'single' }, P2026).deduction, '400.00');
    // The ordinary deduction wins when it is larger
    expectMoney(computeQbiDeduction({ netProfit: '5000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '50000', filingStatus: 'single' }, P2026).deduction, '1000.00');
    // 2025 has no minimum
    expectMoney(computeQbiDeduction({ netProfit: '1000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '5000', filingStatus: 'single' }, P2025).deduction, '200.00');
  });

  it('2026: married filing separately has its own threshold ($201,775) and the wider $75,000 range', () => {
    const mfs = computeQbiDeduction({ netProfit: '300000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '201760', filingStatus: 'married_filing_separately' }, P2026);
    expectMoney(mfs.phaseIn.threshold, '201775.00');
    expectMoney(mfs.phaseIn.ratio, '0.00');
    const single = computeQbiDeduction({ netProfit: '300000', deductibleHalfSelfEmploymentTax: '0', taxableIncomeBeforeQbi: '201760', filingStatus: 'single' }, P2026);
    expectMoney(single.phaseIn.threshold, '201750.00');
    expect(single.phaseIn.ratio.greaterThan(0)).toBe(true);
    expectMoney(single.phaseIn.range, '75000.00');
  });
});
