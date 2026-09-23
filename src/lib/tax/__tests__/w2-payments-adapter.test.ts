import { describe, expect, it } from 'vitest';
import { buildFederalTaxInput, type EstimatedPaymentRow, type TransactionRow, type W2FormRow } from '../adapters/prismaRows';
import { estimateFromRows } from '../adapters/estimateFromRows';
import { estimateFederalTax } from '../engine';
import { money, TaxInputError } from '../money';
import { expectMoney } from './helpers';

/**
 * W-2s and estimated payments, from database rows to the engine.
 *
 * The engine takes one W-2; people have several, and on a joint return some
 * are the spouse's. What is summed where follows the forms:
 *  - Form 1040 lines 1a (wages) and 25a (withholding): every W-2 on the return.
 *  - Form 8959 lines 1 and 19 (Medicare wages and Medicare tax withheld): "If
 *    you have more than one Form W-2, enter the total", both spouses on a
 *    joint return.
 *  - Schedule SE line 8a (Social Security wages and tips): the self-employed
 *    person's own W-2s only; SE tax is per individual.
 */

const d = (iso: string) => new Date(iso + 'T00:00:00Z');
const business = (amount: string, date = '2025-03-01'): TransactionRow => ({ amount, type: 'Income', date: d(date), category: 'business_income', incomeSource: null });
const paycheck = (amount: string, date = '2025-03-15'): TransactionRow => ({ amount, type: 'Income', date: d(date), category: 'w2_paycheck', incomeSource: null });

function w2(overrides: Partial<W2FormRow> & Pick<W2FormRow, 'wages'>): W2FormRow {
  return {
    taxYear: 2025,
    socialSecurityWages: overrides.wages,
    medicareWages: overrides.wages,
    ...overrides,
  };
}

function lineValue(lines: { ref: string; value: { toFixed(n: number): string } }[], ref: string): string | undefined {
  return lines.find((l) => l.ref === ref)?.value.toFixed(2);
}

describe('W-2 rows into the engine', () => {
  it('sums every box across two jobs on a single return', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      user: { filingStatus: 'single' },
      w2Forms: [
        w2({ wages: '40000.00', federalWithheld: '3000.00', medicareWithheld: '580.00' }),
        w2({ wages: '12500.50', federalWithheld: '800.25', socialSecurityTips: '250.00', medicareWages: '12750.50', medicareWithheld: '184.88' }),
      ],
    });
    expect(built.w2).toEqual({ included: 2, spouse: 0, excludedSpouse: 0, outsideTaxYear: 0 });
    const input = built.input.w2!;
    expectMoney(money(input.wages), '52500.50');
    expectMoney(money(input.federalIncomeTaxWithheld!), '3800.25');
    expectMoney(money(input.socialSecurityWages), '52500.50');
    expectMoney(money(input.socialSecurityTips!), '250.00');
    expectMoney(money(input.medicareWages), '52750.50');
    expectMoney(money(input.medicareTaxWithheld!), '764.88');

    const estimate = estimateFederalTax(built.input);
    expectMoney(estimate.income.wages, '52500.50');
    expectMoney(estimate.payments.withholding, '3800.25');
    // Schedule SE line 8a is boxes 3 and 7 together.
    expect(lineValue(estimate.scheduleSE.lines, 'Schedule SE line 8a')).toBe('52750.50');
  });

  it('on a joint return, counts both spouses\' wages but only the self-employed spouse\'s Social Security wages', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [business('20000.00')],
      user: { filingStatus: 'married_filing_jointly' },
      w2Forms: [
        w2({ wages: '170000.00' }),
        w2({ wages: '100000.00', ownedByTaxpayer: false }),
      ],
    });
    expect(built.w2).toEqual({ included: 2, spouse: 1, excludedSpouse: 0, outsideTaxYear: 0 });
    const estimate = estimateFederalTax(built.input);

    expectMoney(estimate.income.wages, '270000.00');
    // Line 8a is the taxpayer's own 170,000; the 2025 wage base is 176,100, so
    // 6,100 of base remains and the Social Security part is 6,100 x 12.4%.
    // Counting the spouse's wages too would have left no base and no tax.
    expect(lineValue(estimate.scheduleSE.lines, 'Schedule SE line 8a')).toBe('170000.00');
    expectMoney(estimate.scheduleSE.socialSecurityBaseRemaining, '6100.00');
    expectMoney(estimate.scheduleSE.socialSecurityTax, '756.40');
    // Form 8959 is per return: combined Medicare wages of 270,000 are 20,000
    // over the 250,000 joint threshold (180.00), and all 18,470 of net SE
    // earnings are then over it too (166.23).
    expectMoney(estimate.otherTaxes.additionalMedicareTax, '346.23');
    // Ownership is recorded per W-2, so the engine's "unconfirmed owner" fallback never fires.
    expect(estimate.warnings.map((w) => w.code)).not.toContain('w2_owner_unconfirmed_joint');
  });

  it('leaves a spouse\'s W-2 off a return that is not joint, and says so', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      user: { filingStatus: 'married_filing_separately' },
      w2Forms: [w2({ wages: '30000.00' }), w2({ wages: '50000.00', ownedByTaxpayer: false })],
    });
    expect(built.w2).toEqual({ included: 1, spouse: 0, excludedSpouse: 1, outsideTaxYear: 0 });
    expectMoney(money(built.input.w2!.wages), '30000.00');
    const warning = built.warnings.find((w) => w.code === 'spouse_w2_not_on_this_return');
    expect(warning?.amount).toBe('50000.00');
  });

  it('treats a W-2 with no owner recorded as the taxpayer\'s own', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      user: { filingStatus: 'married_filing_jointly' },
      w2Forms: [w2({ wages: '1000.00', ownedByTaxpayer: null })],
    });
    expect(built.w2.spouse).toBe(0);
    expectMoney(money(built.input.w2!.socialSecurityWages), '1000.00');
  });

  it('ignores a W-2 for another tax year', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      w2Forms: [w2({ wages: '1000.00', taxYear: 2024 })],
    });
    expect(built.input.w2).toBeNull();
    expect(built.w2.outsideTaxYear).toBe(1);
  });

  it('with no W-2s the engine gets none, exactly as before', () => {
    expect(buildFederalTaxInput({ taxYear: 2025, transactions: [] }).input.w2).toBeNull();
    expect(buildFederalTaxInput({ taxYear: 2025, transactions: [], w2Forms: [] }).input.w2).toBeNull();
  });

  it('refuses a negative box rather than netting it', () => {
    expect(() => buildFederalTaxInput({ taxYear: 2025, transactions: [], w2Forms: [w2({ wages: '-5.00' })] })).toThrow(TaxInputError);
  });
});

describe('excess Social Security withholding (two employers)', () => {
  it('warns with the approximate credit when one person\'s W-2s together pass the wage base', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      w2Forms: [w2({ wages: '100000.00' }), w2({ wages: '90000.00' })],
    });
    // 190,000 - 176,100 = 13,900 withheld on above the base, at 6.2%.
    const warning = built.warnings.find((w) => w.code === 'excess_social_security_withheld');
    expect(warning?.amount).toBe('861.80');
    expect(warning?.message).toContain('Schedule 3 line 11');
  });

  it('never combines spouses: each stays under the base, so no warning', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      user: { filingStatus: 'married_filing_jointly' },
      w2Forms: [w2({ wages: '100000.00' }), w2({ wages: '100000.00', ownedByTaxpayer: false })],
    });
    expect(built.warnings.map((w) => w.code)).not.toContain('excess_social_security_withheld');
  });

  it('checks the spouse on their own on a joint return', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      user: { filingStatus: 'married_filing_jointly' },
      w2Forms: [w2({ wages: '100000.00', ownedByTaxpayer: false }), w2({ wages: '90000.00', ownedByTaxpayer: false })],
    });
    const warning = built.warnings.find((w) => w.code === 'excess_social_security_withheld');
    expect(warning?.message).toContain("your spouse's W-2s");
  });

  it('one W-2 cannot pass the base (the employer stops withholding), so no warning', () => {
    const built = buildFederalTaxInput({ taxYear: 2025, transactions: [], w2Forms: [w2({ wages: '300000.00', socialSecurityWages: '176100.00' })] });
    expect(built.warnings.map((w) => w.code)).not.toContain('excess_social_security_withheld');
  });
});

describe('paycheck deposits and W-2s', () => {
  it('warns that wages are missing when paychecks arrive but no W-2 is entered', () => {
    const built = buildFederalTaxInput({ taxYear: 2025, transactions: [paycheck('1500.00'), paycheck('1500.00')] });
    const codes = built.warnings.map((w) => w.code);
    expect(codes).toContain('paychecks_without_w2');
    expect(codes).not.toContain('excluded_not_modeled_w2_paycheck');
    expect(built.warnings.find((w) => w.code === 'paychecks_without_w2')?.amount).toBe('3000.00');
  });

  it('once the W-2 is on file, leaving the deposits out is expected: an assumption, not a warning', () => {
    const built = buildFederalTaxInput({ taxYear: 2025, transactions: [paycheck('1500.00')], w2Forms: [w2({ wages: '36000.00' })] });
    const codes = built.warnings.map((w) => w.code);
    expect(codes).not.toContain('paychecks_without_w2');
    expect(codes).not.toContain('excluded_not_modeled_w2_paycheck');
    expect(built.assumptions.join(' ')).toContain('1 paycheck deposit was left out of income on purpose');
    // The deposit itself is still not income.
    expectMoney(money(built.input.scheduleC.grossReceipts), '0.00');
  });
});

describe('estimated tax payments', () => {
  const payments: EstimatedPaymentRow[] = [
    { taxYear: 2025, amount: '1000.00' },
    { taxYear: 2025, amount: '1250.50' },
    // Paid for another year: never counted here, whatever its date.
    { taxYear: 2026, amount: '999.00' },
  ];

  it('adds the year\'s payments to Form 1040 line 26 and lowers the balance due', () => {
    const args = { taxYear: 2025, transactions: [business('30000.00')], estimatedPayments: payments };
    const built = buildFederalTaxInput(args);
    expect(built.estimatedPayments.count).toBe(2);
    expectMoney(built.estimatedPayments.total, '2250.50');

    const withPayments = estimateFederalTax(built.input);
    const without = estimateFederalTax(buildFederalTaxInput({ ...args, estimatedPayments: [] }).input);
    expectMoney(withPayments.payments.estimatedPayments, '2250.50');
    expectMoney(withPayments.totalTax, without.totalTax.toFixed(2));
    expectMoney(without.balanceDue.minus(withPayments.balanceDue), '2250.50');
  });

  it('passes nothing to the engine when there are no payments for the year', () => {
    expect(buildFederalTaxInput({ taxYear: 2025, transactions: [], estimatedPayments: [{ taxYear: 2024, amount: '10' }] }).input.estimatedTaxPaymentsMade).toBeUndefined();
  });
});

describe('safe to spend with W-2s and payments', () => {
  const hustle = [business('10000.00')];

  it('is unchanged by making an estimated payment: cash and the balance due fall together', () => {
    const before = estimateFromRows({ taxYear: 2025, transactions: hustle });
    const after = estimateFromRows({ taxYear: 2025, transactions: hustle, estimatedPayments: [{ taxYear: 2025, amount: '500.00' }] });
    expectMoney(after.safeToSpend, before.safeToSpend.toFixed(2));
    // And with nothing but hustle income it is still income - expenses - total tax.
    expectMoney(before.safeToSpend, money('10000').minus(before.estimate.totalTax).toFixed(2));
  });

  it('does not charge tax already withheld from a paycheck against the hustle money', () => {
    const job = [w2({ wages: '50000.00', federalWithheld: '9000.00', medicareWithheld: '725.00' })];
    const { estimate, safeToSpend } = estimateFromRows({ taxYear: 2025, transactions: hustle, w2Forms: job });
    const due = estimate.balanceDue;
    // Withholding exceeds the tax on this return, so nothing is left to set aside, and the refund is not spendable yet.
    expect(due.isNegative()).toBe(true);
    expectMoney(safeToSpend, '10000.00');
  });

  it('sets aside whatever the withholding does not cover', () => {
    const job = [w2({ wages: '50000.00', federalWithheld: '1000.00' })];
    const { estimate, safeToSpend } = estimateFromRows({ taxYear: 2025, transactions: hustle, w2Forms: job });
    expect(estimate.balanceDue.isPositive()).toBe(true);
    expectMoney(safeToSpend, money('10000').minus(estimate.balanceDue).toFixed(2));
  });
});

describe('income by hustle', () => {
  it('groups counted income by the hustle it was recorded against, largest first, and leaves out excluded deposits', () => {
    const uber = { name: 'Uber', type: 'Delivery' };
    const design = { name: 'Logo design', type: 'Freelance' };
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [
        { ...business('300.00'), incomeSource: uber },
        { ...business('450.00'), incomeSource: uber },
        { ...business('1200.00'), incomeSource: design },
        { amount: '80.00', type: 'Income', date: d('2025-04-01'), category: 'other_taxable_income', incomeSource: null },
        { amount: '5000.00', type: 'Income', date: d('2025-04-01'), category: 'loan_proceeds', incomeSource: uber },
        { amount: '99.00', type: 'Expense', date: d('2025-04-01'), category: 'supplies', incomeSource: design },
      ],
    });
    expect(built.incomeByHustle.map((h) => [h.name, h.type, h.income.toFixed(2), h.count])).toEqual([
      ['Logo design', 'Freelance', '1200.00', 1],
      ['Uber', 'Delivery', '750.00', 2],
      [null, null, '80.00', 1],
    ]);
  });
});

describe('a tax profile that was never saved', () => {
  it('treats the stored status as the column default, not a choice, and says the estimate assumed single', () => {
    const built = buildFederalTaxInput({ taxYear: 2025, transactions: [], user: { filingStatus: 'married_filing_jointly', taxProfileSavedAt: null } });
    expect(built.input.filingStatus).toBe('single');
    expect(built.filingStatusSource).toBe('default');
    expect(built.assumptions.join(' ')).toContain('assumes single');
  });

  it('uses the saved status once the profile has been saved', () => {
    const built = buildFederalTaxInput({ taxYear: 2025, transactions: [], user: { filingStatus: 'head_of_household', taxProfileSavedAt: new Date() } });
    expect(built.input.filingStatus).toBe('head_of_household');
    expect(built.filingStatusSource).toBe('profile');
  });
});
