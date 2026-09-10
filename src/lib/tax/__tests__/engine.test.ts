import { describe, expect, it } from 'vitest';
import { estimateFederalTax, toPlain, type FederalTaxInput } from '../engine';
import { Money, TaxInputError } from '../money';
import { expectMoney } from './helpers';

/**
 * End-to-end scenarios worked by hand in Form 1040 order. Every intermediate
 * figure is asserted, not just the total, so a failure points at the line.
 */
describe('estimateFederalTax', () => {
  it('gig worker, 2025, single: $50,000 receipts, $5,000 expenses, 200 sq ft simplified home office', () => {
    const input: FederalTaxInput = {
      taxYear: 2025,
      filingStatus: 'single',
      scheduleC: {
        grossReceipts: '50000',
        expenses: [{ category: 'other_business_expense', amount: '5000' }],
        homeOffice: { totalSquareFeet: '1000', officeSquareFeet: '200', monthlyRent: '0', monthlyUtilities: '0' },
      },
    };
    const e = estimateFederalTax(input);

    // Schedule C: 50,000 - 5,000 = 45,000 (line 29); home office 200 x $5 = 1,000 (line 30); net 44,000 (line 31)
    expectMoney(e.scheduleC.tentativeProfit, '45000.00');
    expectMoney(e.scheduleC.homeOfficeDeduction, '1000.00');
    expectMoney(e.scheduleC.netProfit, '44000.00');

    // Schedule SE: 44,000 x 0.9235 = 40,634.00; 12.4% = 5,038.616 -> 5,038.62; 2.9% = 1,178.386 -> 1,178.39
    // line 12 = 6,217.01; line 13 = 3,108.505 -> 3,108.51
    expectMoney(e.scheduleSE.netEarnings, '40634.00');
    expectMoney(e.scheduleSE.selfEmploymentTax, '6217.01');
    expectMoney(e.adjustments.halfSelfEmploymentTax, '3108.51');

    // Form 1040: line 9 = 44,000; line 11 = 44,000 - 3,108.51 = 40,891.49; line 12 = 15,750
    expectMoney(e.income.totalIncome, '44000.00');
    expectMoney(e.adjustedGrossIncome, '40891.49');
    expectMoney(e.standardDeduction.deduction, '15750.00');

    // QBI: (44,000 - 3,108.51) x 20% = 8,178.30, limited to 20% x (40,891.49 - 15,750 = 25,141.49) = 5,028.30
    expectMoney(e.qbi.deduction, '5028.30');

    // Line 15 = 25,141.49 - 5,028.30 = 20,113.19
    // Line 16 = 1,192.50 + 12% x (20,113.19 - 11,925) = 1,192.50 + 982.58 = 2,175.08
    expectMoney(e.taxableIncome, '20113.19');
    expectMoney(e.incomeTax.tax, '2175.08');

    // Line 24 = 2,175.08 + 6,217.01 = 8,392.09; no payments -> owed
    expectMoney(e.totalTax, '8392.09');
    expectMoney(e.balanceDue, '8392.09');
    expect(e.effectiveRate?.toFixed(4)).toBe('0.1907');

    // The previous code would have said 44,000 x 15.3% + 44,000 x 12% = 12,012.
    expect(e.totalTax.lessThan(new Money('12012'))).toBe(true);

    expect(e.disclaimer).toMatch(/not tax advice/);
    expect(e.disclaimer).toMatch(/tax year 2025 as single/);
    expect(e.notModeled.length).toBeGreaterThan(5);
    expect(e.citations.map((c) => c.label)).toEqual(
      expect.arrayContaining(['IRC §1402(a)(12)', 'IRC §199A(a), (b)(2)', 'IRC §63(c)(2), (c)(7)', 'Rev. Proc. 2024-40 §3.01, Table 3 (Unmarried Individuals other than Surviving Spouses and Heads of Households)']),
    );
    // No duplicate citations.
    const keys = e.citations.map((c) => `${c.label}|${c.url}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('student, 2025, single dependent: $12,000 gig income, $20,000 scholarship against $12,500 qualified expenses, $800 loan interest', () => {
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'single',
      claimedAsDependent: true,
      scheduleC: {
        grossReceipts: '12000',
        expenses: [{ category: 'education_required_materials', amount: '500' }],
      },
      scholarships: { form1098T: { box1: '12000', box5: '20000' } },
      studentLoanInterestPaid: '800',
    });

    // Scholarship: 20,000 - (12,000 + 500 from tagged transactions) = 7,500 taxable (Schedule 1 line 8r), no SE tax on it
    expectMoney(e.scholarships!.requiredCourseMaterials, '500.00');
    expectMoney(e.income.taxableScholarships, '7500.00');
    expectMoney(e.scheduleC.netProfit, '12000.00'); // course materials are not a Schedule C expense

    // SE: 12,000 x 0.9235 = 11,082.00; 12.4% = 1,374.168 -> 1,374.17; 2.9% = 321.378 -> 321.38; total 1,695.55; half 847.775 -> 847.78
    expectMoney(e.scheduleSE.selfEmploymentTax, '1695.55');
    expectMoney(e.adjustments.halfSelfEmploymentTax, '847.78');

    // Student loan interest: barred for a dependent (§221(c))
    expectMoney(e.adjustments.studentLoanInterest!.deduction, '0.00');
    expect(e.adjustments.studentLoanInterest!.disallowedReason).toBe('claimed_as_dependent');

    // Total income 19,500; AGI 18,652.22
    expectMoney(e.income.totalIncome, '19500.00');
    expectMoney(e.adjustedGrossIncome, '18652.22');

    // Dependent standard deduction: earned income = 12,000 - 847.78 + 7,500 = 18,652.22; + 450 = 19,102.22; capped at 15,750
    expectMoney(e.standardDeduction.dependentLimit!.earnedIncome, '18652.22');
    expectMoney(e.standardDeduction.deduction, '15750.00');

    // TI before QBI 2,902.22; QBI = 11,152.22 -> 20% = 2,230.44; limit 20% x 2,902.22 = 580.444 -> 580.44
    expectMoney(e.qbi.deduction, '580.44');
    // TI = 2,321.78; 10% bracket -> 232.178 -> 232.18
    expectMoney(e.taxableIncome, '2321.78');
    expectMoney(e.incomeTax.tax, '232.18');
    // Total 232.18 + 1,695.55 = 1,927.73
    expectMoney(e.totalTax, '1927.73');

    // 7,500 of unearned scholarship income > 2 x 1,350: kiddie tax may apply
    expect(e.warnings.map((w) => w.code)).toContain('kiddie_tax_may_apply');
    expect(e.warnings.map((w) => w.code)).toContain('taxable_scholarship');
  });

  it('gig income alongside a W-2 job, 2025, single: wages shrink the SE wage base and withholding offsets the bill', () => {
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'single',
      scheduleC: { grossReceipts: '20000', expenses: [] },
      w2: { wages: '60000', socialSecurityWages: '60000', medicareWages: '60000', federalIncomeTaxWithheld: '6000' },
    });
    // SE: 20,000 x 0.9235 = 18,470; 12.4% = 2,290.28; 2.9% = 535.63; total 2,825.91; half 1,412.955 -> 1,412.96
    expectMoney(e.scheduleSE.selfEmploymentTax, '2825.91');
    expectMoney(e.adjustments.halfSelfEmploymentTax, '1412.96');
    // Total income 80,000; AGI 78,587.04; TI before QBI 62,837.04
    expectMoney(e.income.totalIncome, '80000.00');
    expectMoney(e.adjustedGrossIncome, '78587.04');
    // QBI = 20,000 - 1,412.96 = 18,587.04 -> 20% = 3,717.408 -> 3,717.41 (limit 12,567.41 not binding)
    expectMoney(e.qbi.deduction, '3717.41');
    // TI = 59,119.63; tax = 5,578.50 + 22% x (59,119.63 - 48,475 = 10,644.63) = 5,578.50 + 2,341.8186 = 7,920.3186 -> 7,920.32
    expectMoney(e.taxableIncome, '59119.63');
    expectMoney(e.incomeTax.tax, '7920.32');
    // Total 7,920.32 + 2,825.91 = 10,746.23; less 6,000 withheld = 4,746.23 owed
    expectMoney(e.totalTax, '10746.23');
    expectMoney(e.payments.total, '6000.00');
    expectMoney(e.balanceDue, '4746.23');
  });

  it('a business loss offsets nothing else, owes no SE tax, and yields zero taxable income', () => {
    const e = estimateFederalTax({
      taxYear: 2025,
      filingStatus: 'single',
      scheduleC: { grossReceipts: '1000', expenses: [{ category: 'supplies', amount: '5000' }] },
    });
    expectMoney(e.scheduleC.netProfit, '-4000.00');
    expectMoney(e.scheduleSE.selfEmploymentTax, '0.00');
    expectMoney(e.income.totalIncome, '-4000.00');
    expectMoney(e.taxableIncome, '0.00');
    expectMoney(e.qbi.deduction, '0.00');
    expectMoney(e.totalTax, '0.00');
    expect(e.warnings.map((w) => w.code)).toEqual(expect.arrayContaining(['schedule_c_loss', 'qbi_loss_carryforward']));
  });

  it('no income at all is all zeros with a warning, not an error', () => {
    const e = estimateFederalTax({ taxYear: 2026, filingStatus: 'head_of_household', scheduleC: { grossReceipts: '0', expenses: [] } });
    expectMoney(e.totalTax, '0.00');
    expect(e.effectiveRate).toBeNull();
    expect(e.warnings.map((w) => w.code)).toContain('no_income');
  });

  it('refuses unsupported years and unknown filing statuses', () => {
    expect(() => estimateFederalTax({ taxYear: 2019, filingStatus: 'single', scheduleC: { grossReceipts: '1', expenses: [] } })).toThrow(TaxInputError);
    expect(() => estimateFederalTax({ taxYear: 2025, filingStatus: 'widowed' as never, scheduleC: { grossReceipts: '1', expenses: [] } })).toThrow(/filing status/);
  });

  it('the same income is taxed differently in 2024 and 2026 because the parameters differ', () => {
    const base = { filingStatus: 'single' as const, scheduleC: { grossReceipts: '60000', expenses: [] } };
    const t24 = estimateFederalTax({ ...base, taxYear: 2024 }).totalTax;
    const t26 = estimateFederalTax({ ...base, taxYear: 2026 }).totalTax;
    expect(t24.greaterThan(t26)).toBe(true); // wider brackets and a larger standard deduction in 2026
  });

  it('toPlain() turns every Money into a JSON-safe number and leaves everything else alone', () => {
    const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', scheduleC: { grossReceipts: '50000', expenses: [] } });
    const plain = toPlain(e);
    expect(typeof plain.totalTax).toBe('number');
    expect(plain.totalTax).toBe(Number(e.totalTax.toFixed(2)));
    expect(plain.scheduleC.lines[0].value).toBe(50000);
    expect(plain.filingStatus).toBe('single');
    expect(plain.scholarships).toBeNull();
    expect(typeof plain.effectiveRate).toBe('number');
    expect(() => JSON.stringify(plain)).not.toThrow();
    // Every form line value is a number, not a Decimal or a string.
    expect(plain.lines.every((l) => typeof l.value === 'number')).toBe(true);
    expect(plain.scheduleSE.lines.every((l) => typeof l.value === 'number')).toBe(true);
    // A quiet scenario: no warnings at all.
    expect(plain.warnings).toEqual([]);
  });

  it('never uses decimal.js isPositive(), which is true for zero', () => {
    // Zero amounts must not trigger "positive amount" warnings or citations.
    const e = estimateFederalTax({ taxYear: 2025, filingStatus: 'single', scheduleC: { grossReceipts: '50000', expenses: [] } });
    expect(e.warnings).toEqual([]);
    expect(e.citations.map((c) => c.label)).not.toContain('IRC §3101(b)(2); Form 8959 Part I');
    expect(e.qbi.warnings).toEqual([]);
  });
});
