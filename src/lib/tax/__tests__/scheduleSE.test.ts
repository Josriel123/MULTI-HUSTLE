import { describe, expect, it } from 'vitest';
import { getTaxYearParameters } from '../parameters';
import { computeScheduleSE } from '../scheduleSE';
import { expectMoney } from './helpers';

const P2025 = getTaxYearParameters(2025);

describe('computeScheduleSE', () => {
  it('$50,000 net profit, 2025: 92.35% then 12.4% + 2.9%, half deductible', () => {
    // Line 4a: 50,000 x 0.9235 = 46,175.00
    // Line 10: 46,175 x 0.124 = 5,725.70
    // Line 11: 46,175 x 0.029 = 1,339.075 -> 1,339.08
    // Line 12: 7,064.78     Line 13: 3,532.39
    const r = computeScheduleSE({ netProfit: '50000', filingStatus: 'single' }, P2025);
    expectMoney(r.netEarnings, '46175.00');
    expectMoney(r.socialSecurityTax, '5725.70');
    expectMoney(r.medicareTax, '1339.08');
    expectMoney(r.selfEmploymentTax, '7064.78');
    expectMoney(r.deductibleHalf, '3532.39');
    expect(r.subjectToSelfEmploymentTax).toBe(true);
    expectMoney(r.additionalMedicare.tax, '0.00');
  });

  it('is not 15.3% of net profit (the previous code\'s error)', () => {
    const r = computeScheduleSE({ netProfit: '50000', filingStatus: 'single' }, P2025);
    expect(r.selfEmploymentTax.toFixed(2)).not.toBe('7650.00');
  });

  it('the $400 floor applies to net earnings after the 92.35% step (IRC §1402(b)(2); Schedule SE line 4c)', () => {
    // 433 x 0.9235 = 399.8755 -> 399.88 < 400: no tax at all
    const below = computeScheduleSE({ netProfit: '433', filingStatus: 'single' }, P2025);
    expect(below.subjectToSelfEmploymentTax).toBe(false);
    expectMoney(below.netEarnings, '0.00');
    expectMoney(below.selfEmploymentTax, '0.00');
    expectMoney(below.deductibleHalf, '0.00');
    expect(below.warnings.map((w) => w.code)).toContain('se_below_400');
    // 434 x 0.9235 = 400.799 -> 400.80 >= 400: taxed
    // Line 10: 400.80 x 0.124 = 49.6992 -> 49.70; line 11: 400.80 x 0.029 = 11.6232 -> 11.62; line 12: 61.32
    const above = computeScheduleSE({ netProfit: '434', filingStatus: 'single' }, P2025);
    expect(above.subjectToSelfEmploymentTax).toBe(true);
    expectMoney(above.netEarnings, '400.80');
    expectMoney(above.selfEmploymentTax, '61.32');
    expectMoney(above.deductibleHalf, '30.66');
  });

  it('caps the Social Security part at the 2025 wage base of $176,100 (Schedule SE lines 7-10)', () => {
    // 200,000 x 0.9235 = 184,700.00
    // Line 10: min(184,700, 176,100) x 0.124 = 21,836.40
    // Line 11: 184,700 x 0.029 = 5,356.30
    // Line 12: 27,192.70     Line 13: 13,596.35
    const r = computeScheduleSE({ netProfit: '200000', filingStatus: 'single' }, P2025);
    expectMoney(r.netEarnings, '184700.00');
    expectMoney(r.socialSecurityTax, '21836.40');
    expectMoney(r.medicareTax, '5356.30');
    expectMoney(r.selfEmploymentTax, '27192.70');
    expectMoney(r.deductibleHalf, '13596.35');
    expect(r.warnings.map((w) => w.code)).toContain('se_social_security_capped');
  });

  it('uses the 2024 wage base of $168,600 for 2024', () => {
    // 200,000 x 0.9235 = 184,700; line 10: 168,600 x 0.124 = 20,906.40
    const r = computeScheduleSE({ netProfit: '200000', filingStatus: 'single' }, getTaxYearParameters(2024));
    expectMoney(r.socialSecurityTax, '20906.40');
  });

  it('W-2 Social Security wages reduce the base left for SE income (line 8a-9)', () => {
    // Line 9: 176,100 - 100,000 = 76,100; line 10: 76,100 x 0.124 = 9,436.40; line 11 unchanged 5,356.30
    const r = computeScheduleSE({ netProfit: '200000', filingStatus: 'single', w2SocialSecurityWages: '100000' }, P2025);
    expectMoney(r.socialSecurityBaseRemaining, '76100.00');
    expectMoney(r.socialSecurityTax, '9436.40');
    expectMoney(r.selfEmploymentTax, '14792.70');
  });

  it('Additional Medicare Tax of 0.9% on SE income over $200,000 for a single filer (Form 8959 Part II)', () => {
    // 250,000 x 0.9235 = 230,875.00; over threshold: 30,875; x 0.009 = 277.875 -> 277.88
    const r = computeScheduleSE({ netProfit: '250000', filingStatus: 'single' }, P2025);
    expectMoney(r.additionalMedicare.threshold, '200000.00');
    expectMoney(r.additionalMedicare.selfEmploymentIncomeOverThreshold, '30875.00');
    expectMoney(r.additionalMedicare.tax, '277.88');
    // Joint threshold is $250,000, so the same profit owes none.
    expectMoney(computeScheduleSE({ netProfit: '250000', filingStatus: 'married_filing_jointly' }, P2025).additionalMedicare.tax, '0.00');
    // Separate threshold is $125,000.
    expectMoney(computeScheduleSE({ netProfit: '250000', filingStatus: 'married_filing_separately' }, P2025).additionalMedicare.threshold, '125000.00');
  });

  it('Medicare wages reduce the Additional Medicare threshold for SE income (Form 8959 lines 10-11)', () => {
    // Threshold 200,000 - wages 150,000 = 50,000; SE income 230,875 - 50,000 = 180,875; x 0.009 = 1,627.875 -> 1,627.88
    const r = computeScheduleSE({ netProfit: '250000', filingStatus: 'single', w2MedicareWages: '150000' }, P2025);
    expectMoney(r.additionalMedicare.thresholdAfterWages, '50000.00');
    expectMoney(r.additionalMedicare.tax, '1627.88');
  });

  it('a business loss owes no SE tax and produces no deduction', () => {
    const r = computeScheduleSE({ netProfit: '-5000', filingStatus: 'single' }, P2025);
    expect(r.subjectToSelfEmploymentTax).toBe(false);
    expectMoney(r.netEarnings, '0.00');
    expectMoney(r.selfEmploymentTax, '0.00');
    expectMoney(r.deductibleHalf, '0.00');
    expect(r.warnings).toHaveLength(0);
  });

  it('lists the form lines in order with the statutory citations', () => {
    const r = computeScheduleSE({ netProfit: '50000', filingStatus: 'single' }, P2025);
    expect(r.lines.map((l) => l.ref)).toContain('Schedule SE line 4a');
    expect(r.citations.map((c) => c.label)).toEqual(expect.arrayContaining(['IRC §1402(a)(12)', 'IRC §1402(b)(2)', 'IRC §1401(a), (b)(1)', 'IRC §164(f); Schedule 1 line 15']));
  });
});
