import { describe, expect, it } from 'vitest';
import { buildFederalTaxInput, type TransactionRow } from '../adapters/prismaRows';
import { isDeductibleExpenseCategory } from '../categories';
import { estimateFederalTax } from '../engine';
import { expectMoney } from './helpers';

/**
 * E2E audit 2026-09-16, F2: the UI offered a "tax-deductible" checkbox and a
 * category for the same fact, and the checkbox silently lost. The decision
 * (TRIAGE.md) is that `Transaction.category` is the single source of truth:
 * the adapter never reads `taxDeductible`, `personal` is how a user marks an
 * expense non-deductible, and legacy rows are migrated (see
 * migrations.test.ts). These tests pin the adapter's side of that contract.
 */

const d = (iso: string) => new Date(iso + 'T00:00:00Z');
const INCOME: TransactionRow = { amount: '10000', type: 'Income', date: d('2026-03-01'), category: 'business_income', incomeSource: null };

describe('F2: category is the only thing that decides an expense\'s tax treatment', () => {
  it('an expense categorised personal never reduces business income, whatever the legacy flag says', () => {
    const e = estimateFederalTax(
      buildFederalTaxInput({
        taxYear: 2026,
        transactions: [INCOME, { amount: '123.45', type: 'Expense', date: d('2026-06-15'), category: 'personal', taxDeductible: true, incomeSource: null }],
      }).input,
    );
    expectMoney(e.scheduleC.totalExpenses, '0.00');
    expectMoney(e.scheduleC.netProfit, '10000.00');
    expectMoney(e.income.totalIncome, '10000.00');
  });

  it('a deductible category is deducted even if the legacy flag is false (legacy rows like this are migrated to personal)', () => {
    const e = estimateFederalTax(
      buildFederalTaxInput({
        taxYear: 2026,
        transactions: [INCOME, { amount: '100', type: 'Expense', date: d('2026-06-15'), category: 'office_expense', taxDeductible: false, incomeSource: null }],
      }).input,
    );
    expectMoney(e.scheduleC.totalExpenses, '100.00');
  });

  it('an expense with no category is treated as personal and reported as uncategorised, never deducted on the strength of the flag', () => {
    const built = buildFederalTaxInput({
      taxYear: 2026,
      transactions: [INCOME, { amount: '250', type: 'Expense', date: d('2026-06-15'), category: null, taxDeductible: true, incomeSource: null }],
    });
    const e = estimateFederalTax(built.input);
    expectMoney(e.scheduleC.totalExpenses, '0.00');
    expect(built.uncategorised.expenseCount).toBe(1);
    expectMoney(built.uncategorised.expenseTotal, '250.00');
    expect(built.warnings.map((w) => w.code)).toContain('uncategorised_expenses');
    // It still counts as cash out the door.
    expectMoney(built.cashExpensesTotal, '250.00');
  });

  it('rows without the legacy field at all are accepted', () => {
    const built = buildFederalTaxInput({
      taxYear: 2026,
      transactions: [{ amount: '40', type: 'Expense', date: d('2026-06-15'), category: 'supplies', incomeSource: null }],
    });
    expect(built.input.scheduleC.expenses).toEqual([{ category: 'supplies', amount: expect.anything() }]);
  });

  it('the display bucket counts deductible expenses by category, not by flag', () => {
    const built = buildFederalTaxInput({
      taxYear: 2026,
      transactions: [
        { amount: '100', type: 'Expense', date: d('2026-06-15'), category: 'supplies', taxDeductible: false, incomeSource: { name: 'Dev', type: 'Freelance' } },
        { amount: '900', type: 'Expense', date: d('2026-06-16'), category: 'personal', taxDeductible: true, incomeSource: { name: 'Dev', type: 'Freelance' } },
      ],
    });
    expectMoney(built.bySource.freelance.deductibleExpenses, '100.00');
  });
});

describe('isDeductibleExpenseCategory', () => {
  it('is true only for Schedule C expense categories', () => {
    expect(isDeductibleExpenseCategory('supplies')).toBe(true);
    expect(isDeductibleExpenseCategory('meals')).toBe(true);
    expect(isDeductibleExpenseCategory('equipment')).toBe(true);
    expect(isDeductibleExpenseCategory('personal')).toBe(false);
    expect(isDeductibleExpenseCategory('education_required_materials')).toBe(false);
    expect(isDeductibleExpenseCategory('health_insurance_premiums')).toBe(false);
    expect(isDeductibleExpenseCategory('home_office_expense')).toBe(false);
    expect(isDeductibleExpenseCategory('business_income')).toBe(false);
    expect(isDeductibleExpenseCategory(null)).toBe(false);
    expect(isDeductibleExpenseCategory(undefined)).toBe(false);
  });
});
