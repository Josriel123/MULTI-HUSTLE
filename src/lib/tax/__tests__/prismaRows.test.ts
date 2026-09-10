import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { buildFederalTaxInput, type TransactionRow } from '../adapters/prismaRows';
import { estimateFederalTax } from '../engine';
import { money } from '../money';
import { expectMoney } from './helpers';

const d = (iso: string) => new Date(iso + 'T00:00:00Z');
const FREELANCE = { name: 'Freelance Dev Income', type: 'Freelance' };
const DELIVERY = { name: 'Delivery Gig Income', type: 'Delivery' };
const TRADING = { name: 'Trading & Investments', type: 'Other' };

describe('buildFederalTaxInput', () => {
  it('maps rows to engine input using categories, never descriptions', () => {
    const rows: TransactionRow[] = [
      { amount: new Prisma.Decimal('18400.00'), type: 'Income', date: d('2026-05-01'), taxDeductible: false, category: 'business_income', incomeSource: FREELANCE },
      { amount: new Prisma.Decimal('5650.00'), type: 'Income', date: d('2026-06-01'), taxDeductible: false, category: null, incomeSource: DELIVERY },
      { amount: new Prisma.Decimal('11950.00'), type: 'Income', date: d('2026-07-01'), taxDeductible: false, category: 'investment_proceeds', incomeSource: TRADING },
      { amount: new Prisma.Decimal('7000.00'), type: 'Income', date: d('2026-08-15'), taxDeductible: false, category: 'loan_proceeds', incomeSource: null },
      { amount: new Prisma.Decimal('2200.00'), type: 'Expense', date: d('2026-05-05'), taxDeductible: true, category: 'equipment', incomeSource: FREELANCE },
      { amount: new Prisma.Decimal('300.00'), type: 'Expense', date: d('2026-05-06'), taxDeductible: true, category: null, incomeSource: FREELANCE },
      { amount: new Prisma.Decimal('80.00'), type: 'Expense', date: d('2026-05-07'), taxDeductible: false, category: null, incomeSource: null },
      { amount: new Prisma.Decimal('999.00'), type: 'Income', date: d('2025-12-31'), taxDeductible: false, category: 'business_income', incomeSource: FREELANCE }, // prior year
    ];
    const built = buildFederalTaxInput({ taxYear: 2026, transactions: rows, user: { filingStatus: 'head_of_household', claimedAsDependent: false } });

    expect(built.included).toBe(7);
    expect(built.outsideTaxYear).toBe(1);
    expect(built.input.taxYear).toBe(2026);
    expect(built.input.filingStatus).toBe('head_of_household');
    expect(built.filingStatusSource).toBe('profile');

    // Business receipts: 18,400 + 5,650 (uncategorised defaults to business). Investment and loan deposits excluded.
    expectMoney(money(built.input.scheduleC.grossReceipts), '24050.00');
    expectMoney(built.cashIncomeTotal, '24050.00');
    expect(built.excludedIncome.map((x) => [x.category, x.total.toFixed(2)])).toEqual([
      ['investment_proceeds', '11950.00'],
      ['loan_proceeds', '7000.00'],
    ]);

    // Expenses: equipment keeps its category; taxDeductible with no category -> other_business_expense; otherwise personal.
    expect(built.input.scheduleC.expenses.map((e) => e.category)).toEqual(['equipment', 'other_business_expense', 'personal']);
    expectMoney(built.cashExpensesTotal, '2580.00');

    // Display buckets by IncomeSource.type only.
    expectMoney(built.bySource.freelance.income, '18400.00');
    expectMoney(built.bySource.freelance.deductibleExpenses, '2500.00');
    expectMoney(built.bySource.delivery.income, '5650.00');
    expectMoney(built.bySource.other.income, '0.00'); // excluded investment proceeds are not income

    expect(built.uncategorised).toMatchObject({ incomeCount: 1, expenseCount: 2 });
    expectMoney(built.uncategorised.incomeTotal, '5650.00');
    const codes = built.warnings.map((w) => w.code);
    expect(codes).toContain('uncategorised_income');
    expect(codes).toContain('excluded_not_modeled_investment_proceeds');
    expect(codes).not.toContain('excluded_not_modeled_loan_proceeds'); // loans are simply not income; nothing to flag

    // The built input runs end to end.
    const e = estimateFederalTax(built.input);
    expectMoney(e.scheduleC.netProfit, '21550.00'); // 24,050 - 2,200 - 300
  });

  it('defaults to single / not a dependent when the profile is missing, and says so', () => {
    const built = buildFederalTaxInput({ taxYear: 2025, transactions: [], user: null });
    expect(built.input.filingStatus).toBe('single');
    expect(built.input.claimedAsDependent).toBe(false);
    expect(built.filingStatusSource).toBe('default');
    expect(built.assumptions.join(' ')).toMatch(/assumes single/);
  });

  it('flags an unrecognised stored filing status and falls back to single', () => {
    const built = buildFederalTaxInput({ taxYear: 2025, transactions: [], user: { filingStatus: 'widow' } });
    expect(built.input.filingStatus).toBe('single');
    expect(built.warnings.map((w) => w.code)).toContain('invalid_filing_status');
  });

  it('carries the 1098-T, 1098-E and home office rows through with monthly semantics', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [],
      user: { filingStatus: 'single', claimedAsDependent: true },
      form1098T: { box1: new Prisma.Decimal('12000'), box5: new Prisma.Decimal('20000') },
      form1098E: { box1: new Prisma.Decimal('800') },
      homeOffice: { totalSqFt: new Prisma.Decimal('1000'), officeSqFt: new Prisma.Decimal('150'), rentAmount: new Prisma.Decimal('1500'), utilitiesAmount: new Prisma.Decimal('200') },
    });
    expect(built.input.claimedAsDependent).toBe(true);
    expect(built.input.scholarships).toEqual({ form1098T: { box1: expect.anything(), box5: expect.anything() } });
    expect(String(built.input.studentLoanInterestPaid)).toBe('800');
    expect(built.input.scheduleC.homeOffice?.monthlyRent.toString()).toBe('1500');
    expect(built.assumptions.join(' ')).toMatch(/monthly/);
  });

  it('a category from the wrong side (income tag on an expense) is ignored with a warning', () => {
    const built = buildFederalTaxInput({
      taxYear: 2025,
      transactions: [{ amount: '50', type: 'Expense', date: d('2025-03-01'), taxDeductible: true, category: 'business_income' }],
    });
    expect(built.input.scheduleC.expenses[0].category).toBe('other_business_expense');
    expect(built.warnings.map((w) => w.code)).toContain('category_mismatch');
  });
});
