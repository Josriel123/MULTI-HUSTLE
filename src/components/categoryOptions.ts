import {
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  type ExpenseCategory,
  type IncomeCategory,
} from '@/lib/tax/categories';

/**
 * The category picker's groups, built from the engine's own treatments so the
 * UI can never file a category under the wrong heading. The engine decides
 * what a category does; this file only words it for a person choosing one.
 */

export interface CategoryOption {
  value: string;
  label: string;
}

export interface CategoryGroup {
  label: string;
  options: CategoryOption[];
}

/** Why a category that is not deducted here is still worth choosing: where the amount is counted instead. */
const EXPENSE_NOTE: Partial<Record<ExpenseCategory, string>> = {
  home_office_expense: 'counted on the Home office page',
  education_tuition_fees: 'counted from your 1098-T',
  student_loan_payment: 'interest counted from your 1098-E',
  health_insurance_premiums: 'not estimated here',
  retirement_contribution: 'not estimated here',
};

const INCOME_NOTE: Partial<Record<IncomeCategory, string>> = {
  w2_paycheck: 'wages come from your W-2',
  investment_proceeds: 'not estimated here',
  scholarship_refund: 'counted from your 1098-T',
};

const byLabel = (a: CategoryOption, b: CategoryOption) => a.label.localeCompare(b.label);

export function expenseCategoryGroups(): CategoryGroup[] {
  const business: CategoryOption[] = [];
  const school: CategoryOption[] = [];
  const notHere: CategoryOption[] = [];
  let other: CategoryOption | null = null;
  let personal: CategoryOption | null = null;

  for (const key of Object.keys(EXPENSE_CATEGORIES) as ExpenseCategory[]) {
    const def = EXPENSE_CATEGORIES[key];
    const note = EXPENSE_NOTE[key];
    const option = { value: key, label: note ? `${def.label} (${note})` : def.label };
    if (key === 'other_business_expense') other = option;
    else if (key === 'personal') personal = option;
    else if (def.treatment === 'schedule_c_expense' || def.treatment === 'schedule_c_de_minimis_equipment') business.push(option);
    else if (def.treatment === 'qualified_education_expense') school.push(option);
    else notHere.push(option);
  }

  return [
    { label: 'Business costs (deductible)', options: [...business.sort(byLabel), ...(other ? [other] : [])] },
    { label: 'School costs (lower taxable scholarships)', options: school.sort(byLabel) },
    { label: 'Not deducted here', options: [...(personal ? [personal] : []), ...notHere.sort(byLabel)] },
  ].filter((g) => g.options.length > 0);
}

export function incomeCategoryGroups(): CategoryGroup[] {
  const taxable: CategoryOption[] = [];
  const notIncome: CategoryOption[] = [];
  const elsewhere: CategoryOption[] = [];

  for (const key of Object.keys(INCOME_CATEGORIES) as IncomeCategory[]) {
    const def = INCOME_CATEGORIES[key];
    const note = INCOME_NOTE[key];
    const option = { value: key, label: note ? `${def.label} (${note})` : def.label };
    if (def.treatment === 'schedule_c_gross_receipts' || def.treatment === 'other_income') taxable.push(option);
    else if (note) elsewhere.push(option);
    else notIncome.push(option);
  }

  return [
    { label: 'Taxable income', options: taxable },
    { label: 'Not income (left out)', options: notIncome.sort(byLabel) },
    { label: 'Counted elsewhere', options: elsewhere.sort(byLabel) },
  ].filter((g) => g.options.length > 0);
}

export type Treatment = 'deductible' | 'half' | 'school' | 'not_deducted' | 'taxable' | 'not_income' | 'elsewhere' | 'uncategorised';

/**
 * A short plain-English tag for a transaction's treatment, for the ledger.
 * Read from the category definition; never guessed from the description.
 */
export function treatmentOf(type: string, category: string | null | undefined): { kind: Treatment; label: string } {
  if (!category) return { kind: 'uncategorised', label: 'Needs a category' };
  if (type === 'Income') {
    const def = (INCOME_CATEGORIES as Record<string, (typeof INCOME_CATEGORIES)[IncomeCategory]>)[category];
    if (!def) return { kind: 'uncategorised', label: 'Needs a category' };
    if (def.treatment === 'schedule_c_gross_receipts' || def.treatment === 'other_income') return { kind: 'taxable', label: 'Taxable' };
    if (INCOME_NOTE[category as IncomeCategory]) return { kind: 'elsewhere', label: 'Counted elsewhere' };
    return { kind: 'not_income', label: 'Not income' };
  }
  const def = (EXPENSE_CATEGORIES as Record<string, (typeof EXPENSE_CATEGORIES)[ExpenseCategory]>)[category];
  if (!def) return { kind: 'uncategorised', label: 'Needs a category' };
  if (def.treatment === 'schedule_c_expense' || def.treatment === 'schedule_c_de_minimis_equipment') {
    // The share comes from the category's own deductibleFraction, never typed here.
    const fraction: string | undefined = 'deductibleFraction' in def ? def.deductibleFraction : undefined;
    if (fraction !== undefined && fraction !== '1') {
      return { kind: 'half', label: `${Number(fraction) * 100}% deductible` };
    }
    return { kind: 'deductible', label: 'Deductible' };
  }
  if (def.treatment === 'qualified_education_expense') return { kind: 'school', label: 'Offsets scholarships' };
  return { kind: 'not_deducted', label: 'Not deducted' };
}
