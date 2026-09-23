import { describe, expect, it } from 'vitest';
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/tax/categories';
import { expenseCategoryGroups, incomeCategoryGroups, treatmentOf } from '../categoryOptions';

/**
 * The category picker is built from the engine's vocabulary. If a category is
 * added to the engine it must appear in the picker, under the heading its
 * treatment implies, and nowhere twice.
 */
describe('category picker groups', () => {
  it('offers every expense category exactly once', () => {
    const offered = expenseCategoryGroups().flatMap((g) => g.options.map((o) => o.value));
    expect([...offered].sort()).toEqual(Object.keys(EXPENSE_CATEGORIES).sort());
  });

  it('offers every income category exactly once', () => {
    const offered = incomeCategoryGroups().flatMap((g) => g.options.map((o) => o.value));
    expect([...offered].sort()).toEqual(Object.keys(INCOME_CATEGORIES).sort());
  });

  it('files deductible categories under business costs, and personal first under not deducted', () => {
    const [business, , notHere] = expenseCategoryGroups();
    expect(business.label).toMatch(/deductible/i);
    expect(business.options.map((o) => o.value)).toContain('supplies');
    expect(business.options.at(-1)?.value).toBe('other_business_expense');
    expect(notHere.options[0].value).toBe('personal');
  });

  it('keeps taxable income first, and paychecks where the note says they are counted', () => {
    const groups = incomeCategoryGroups();
    expect(groups[0].options.map((o) => o.value)).toEqual(['business_income', 'other_taxable_income']);
    const paycheck = groups.flatMap((g) => g.options).find((o) => o.value === 'w2_paycheck');
    expect(paycheck?.label).toContain('W-2');
  });
});

describe('treatmentOf', () => {
  it('reads the partial share from the category, never a typed number', () => {
    expect(treatmentOf('Expense', 'meals')).toEqual({ kind: 'half', label: '50% deductible' });
    expect(treatmentOf('Expense', 'supplies')).toEqual({ kind: 'deductible', label: 'Deductible' });
  });

  it('names what a row does to the estimate', () => {
    expect(treatmentOf('Expense', 'personal').kind).toBe('not_deducted');
    expect(treatmentOf('Expense', 'education_required_materials').kind).toBe('school');
    expect(treatmentOf('Income', 'business_income').kind).toBe('taxable');
    expect(treatmentOf('Income', 'transfer').kind).toBe('not_income');
    expect(treatmentOf('Income', 'w2_paycheck').kind).toBe('elsewhere');
  });

  it('flags a missing or unknown category, on either side', () => {
    expect(treatmentOf('Income', null).kind).toBe('uncategorised');
    expect(treatmentOf('Expense', 'not_a_category').kind).toBe('uncategorised');
    // An income category on an expense row is not a valid expense category.
    expect(treatmentOf('Expense', 'business_income').kind).toBe('uncategorised');
  });
});
