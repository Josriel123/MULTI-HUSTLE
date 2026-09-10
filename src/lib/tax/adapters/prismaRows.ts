import {
  DEFAULT_DEDUCTIBLE_EXPENSE_CATEGORY,
  DEFAULT_INCOME_CATEGORY,
  DEFAULT_NONDEDUCTIBLE_EXPENSE_CATEGORY,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isExpenseCategory,
  isIncomeCategory,
  type ExpenseCategory,
  type IncomeCategory,
} from '../categories';
import type { FederalTaxInput } from '../engine';
import { money, nonNegativeMoney, ZERO, type Money, type MoneyInput } from '../money';
import type { ExpenseItem } from '../scheduleC';
import { isFilingStatus, type FilingStatus, type Warning } from '../types';

/**
 * Turns database rows into a `FederalTaxInput`.
 *
 * This is the only place the engine meets the shape of the Prisma models, and
 * it is still pure: it takes plain objects with the same field names as the
 * Prisma rows (structural types below, no Prisma import) and returns data.
 * The route handler does the querying; tests can hand this function literal
 * rows.
 *
 * Rules applied here, and nowhere else:
 *  - Only transactions dated inside the tax year (UTC calendar year) count.
 *  - Income is classified by `Transaction.category` alone. With no category,
 *    a deposit is business income (see categories.ts for why). Descriptions
 *    are never read.
 *  - An expense with no category is deductible only if the user marked it
 *    `taxDeductible`.
 *  - Filing status and dependent status come from the User row, defaulting to
 *    single / not a dependent, and the defaults are reported as assumptions.
 */

export interface TransactionRow {
  amount: MoneyInput;
  /** "Income" | "Expense" */
  type: string;
  date: Date;
  taxDeductible: boolean;
  category?: string | null;
  incomeSource?: { name: string; type: string } | null;
}

export interface UserTaxProfileRow {
  filingStatus?: string | null;
  claimedAsDependent?: boolean | null;
  /** Married filing separately: the spouse itemizes (IRC §63(c)(6)(A)). Not yet a database column; passes through when present. */
  spouseItemizes?: boolean | null;
}

export interface Form1098TRow {
  box1: MoneyInput;
  box5: MoneyInput;
  /** Part of Box 5 earmarked by the grant for room and board or other non-qualified expenses. Not yet a database column; passes through when present. */
  restrictedToNonQualifiedExpenses?: MoneyInput | null;
}

export interface Form1098ERow {
  box1: MoneyInput;
}

export interface HomeOfficeRow {
  totalSqFt: MoneyInput;
  officeSqFt: MoneyInput;
  /** Monthly, as labelled on the Home Office form ("Housing Overhead (Monthly)"). */
  rentAmount: MoneyInput;
  /** Monthly. */
  utilitiesAmount: MoneyInput;
}

export interface BuildInputArgs {
  taxYear: number;
  transactions: readonly TransactionRow[];
  user?: UserTaxProfileRow | null;
  form1098T?: Form1098TRow | null;
  form1098E?: Form1098ERow | null;
  homeOffice?: HomeOfficeRow | null;
}

export interface SourceBucket {
  /** Deposits counted as income (business or other taxable). */
  income: Money;
  /** Expenses entered under a Schedule C category, before any limit. */
  deductibleExpenses: Money;
}

export interface ExcludedIncome {
  category: IncomeCategory;
  count: number;
  total: Money;
}

export interface BuiltInput {
  input: FederalTaxInput;
  filingStatusSource: 'profile' | 'default';
  /** Transactions dated in the tax year. */
  included: number;
  /** Transactions dated outside the tax year, ignored. */
  outsideTaxYear: number;
  bySource: { freelance: SourceBucket; delivery: SourceBucket; other: SourceBucket };
  /** Every in-year Expense transaction, deductible or not. Used for the "safe to spend" figure. */
  cashExpensesTotal: Money;
  /** Every in-year deposit that was counted as income. */
  cashIncomeTotal: Money;
  excludedIncome: ExcludedIncome[];
  uncategorised: { incomeCount: number; incomeTotal: Money; expenseCount: number };
  warnings: Warning[];
  assumptions: string[];
}

function emptyBucket(): SourceBucket {
  return { income: ZERO, deductibleExpenses: ZERO };
}

/** Display grouping only. Uses the IncomeSource `type` column, never the name. */
function bucketFor(source: TransactionRow['incomeSource']): 'freelance' | 'delivery' | 'other' {
  const type = source?.type?.toLowerCase();
  if (type === 'freelance') return 'freelance';
  if (type === 'delivery') return 'delivery';
  return 'other';
}

export function buildFederalTaxInput(args: BuildInputArgs): BuiltInput {
  const warnings: Warning[] = [];
  const assumptions: string[] = [];

  // Filing status.
  let filingStatus: FilingStatus = 'single';
  let filingStatusSource: BuiltInput['filingStatusSource'] = 'default';
  const stored = args.user?.filingStatus;
  if (isFilingStatus(stored)) {
    filingStatus = stored;
    filingStatusSource = 'profile';
  } else if (stored) {
    warnings.push({ code: 'invalid_filing_status', message: `Stored filing status ${JSON.stringify(stored)} is not recognised; single was used.` });
  }
  if (filingStatusSource === 'default') {
    assumptions.push('No filing status is saved on this account, so the estimate assumes single. Set it in your tax profile.');
  }
  const claimedAsDependent = args.user?.claimedAsDependent ?? false;
  const spouseItemizes = args.user?.spouseItemizes ?? false;

  const bySource = { freelance: emptyBucket(), delivery: emptyBucket(), other: emptyBucket() };
  const excluded = new Map<IncomeCategory, ExcludedIncome>();
  /** Distinct income sources that produced business receipts; more than one with a home office triggers the per-business-limit warning. */
  const businessSources = new Set<string>();
  const expenses: ExpenseItem[] = [];
  let grossReceipts: Money = ZERO;
  let otherIncome: Money = ZERO;
  let cashIncome: Money = ZERO;
  let cashExpenses: Money = ZERO;
  let uncategorisedIncomeCount = 0;
  let uncategorisedIncomeTotal: Money = ZERO;
  let uncategorisedExpenseCount = 0;
  let included = 0;
  let outsideTaxYear = 0;

  for (const [index, row] of args.transactions.entries()) {
    if (row.date.getUTCFullYear() !== args.taxYear) {
      outsideTaxYear++;
      continue;
    }
    included++;
    // Amounts are stored unsigned (the routes apply Math.abs); the sign of a stray negative is meaningless here.
    const amount = money(row.amount, `transactions[${index}].amount`).abs();
    const bucket = bySource[bucketFor(row.incomeSource)];

    if (row.type === 'Income') {
      let category: IncomeCategory;
      if (isIncomeCategory(row.category)) {
        category = row.category;
      } else {
        if (row.category) {
          warnings.push({
            code: 'category_mismatch',
            message: `An income transaction is tagged with the expense category ${JSON.stringify(row.category)}; it was treated as uncategorised.`,
            amount: amount.toFixed(2),
          });
        }
        category = DEFAULT_INCOME_CATEGORY;
        uncategorisedIncomeCount++;
        uncategorisedIncomeTotal = uncategorisedIncomeTotal.plus(amount);
      }

      switch (INCOME_CATEGORIES[category].treatment) {
        case 'schedule_c_gross_receipts':
          grossReceipts = grossReceipts.plus(amount);
          cashIncome = cashIncome.plus(amount);
          bucket.income = bucket.income.plus(amount);
          businessSources.add(row.incomeSource ? `${row.incomeSource.type}:${row.incomeSource.name}` : '(no source)');
          break;
        case 'other_income':
          otherIncome = otherIncome.plus(amount);
          cashIncome = cashIncome.plus(amount);
          bucket.income = bucket.income.plus(amount);
          break;
        case 'excluded':
        case 'excluded_not_modeled': {
          const entry = excluded.get(category) ?? { category, count: 0, total: ZERO };
          entry.count++;
          entry.total = entry.total.plus(amount);
          excluded.set(category, entry);
          break;
        }
      }
    } else if (row.type === 'Expense') {
      cashExpenses = cashExpenses.plus(amount);
      let category: ExpenseCategory;
      if (isExpenseCategory(row.category)) {
        category = row.category;
      } else {
        if (row.category) {
          warnings.push({
            code: 'category_mismatch',
            message: `An expense transaction is tagged with the income category ${JSON.stringify(row.category)}; the taxDeductible flag was used instead.`,
            amount: amount.toFixed(2),
          });
        }
        category = row.taxDeductible ? DEFAULT_DEDUCTIBLE_EXPENSE_CATEGORY : DEFAULT_NONDEDUCTIBLE_EXPENSE_CATEGORY;
        uncategorisedExpenseCount++;
      }
      expenses.push({ category, amount });
      const treatment = EXPENSE_CATEGORIES[category].treatment;
      if (treatment === 'schedule_c_expense' || treatment === 'schedule_c_de_minimis_equipment') {
        bucket.deductibleExpenses = bucket.deductibleExpenses.plus(amount);
      }
    } else {
      warnings.push({ code: 'unknown_transaction_type', message: `Transaction type ${JSON.stringify(row.type)} is not Income or Expense and was ignored.`, amount: amount.toFixed(2) });
    }
  }

  if (uncategorisedIncomeCount > 0) {
    warnings.push({
      code: 'uncategorised_income',
      message: `${uncategorisedIncomeCount} deposit(s) have no tax category and were counted as business income subject to self-employment tax. If any are loans, transfers, refunds, paychecks or investment sales, categorise them: the estimate will fall.`,
      amount: uncategorisedIncomeTotal.toFixed(2),
    });
  }
  for (const entry of excluded.values()) {
    const def = INCOME_CATEGORIES[entry.category];
    if (def.treatment === 'excluded_not_modeled') {
      warnings.push({
        code: `excluded_not_modeled_${entry.category}`,
        message: `${entry.count} deposit(s) categorised as "${def.label}" were left out. ${def.citation.note ?? ''}`.trim(),
        amount: entry.total.toFixed(2),
      });
    }
    if (entry.category === 'refund') {
      // Pub. 525, "Recovery and expense in same year": a refund of a deducted
      // expense reduces that deduction. Nothing links a refund row to a purchase
      // row, so the deduction is left as entered and the user is told.
      warnings.push({
        code: 'refund_not_netted',
        message: `${entry.count} refund deposit(s) were excluded from income but did not reduce any deducted expense. If a refund reverses a business purchase deducted here, reduce that expense; otherwise the deduction is overstated (Pub. 525, recovery in the same year).`,
        amount: entry.total.toFixed(2),
      });
    }
  }
  if (args.homeOffice && businessSources.size > 1) {
    // Pub. 587, "More Than One Trade or Business": the §280A(c)(5) income limit
    // is measured by the business that uses the office, not the combined profit.
    warnings.push({
      code: 'home_office_multiple_businesses',
      message: `Business income comes from ${businessSources.size} sources but the home office deduction is capped at their combined profit. If the office serves only one of them, the real cap is that business's own profit and the deduction may be overstated (Pub. 587, More Than One Trade or Business).`,
    });
  }

  const input: FederalTaxInput = {
    taxYear: args.taxYear,
    filingStatus,
    claimedAsDependent,
    scheduleC: {
      grossReceipts,
      expenses,
      homeOffice: args.homeOffice
        ? {
            totalSquareFeet: nonNegativeMoney(args.homeOffice.totalSqFt, 'homeOffice.totalSqFt'),
            officeSquareFeet: nonNegativeMoney(args.homeOffice.officeSqFt, 'homeOffice.officeSqFt'),
            monthlyRent: nonNegativeMoney(args.homeOffice.rentAmount, 'homeOffice.rentAmount'),
            monthlyUtilities: nonNegativeMoney(args.homeOffice.utilitiesAmount, 'homeOffice.utilitiesAmount'),
          }
        : null,
    },
    otherIncome,
    scholarships: args.form1098T
      ? {
          form1098T: { box1: args.form1098T.box1, box5: args.form1098T.box5 },
          restrictedToNonQualifiedExpenses: args.form1098T.restrictedToNonQualifiedExpenses ?? undefined,
        }
      : null,
    studentLoanInterestPaid: args.form1098E ? args.form1098E.box1 : undefined,
    spouseItemizes,
  };

  if (args.homeOffice) {
    assumptions.push('Home office rent and utilities are monthly figures and the office was used for all 12 months of the year.');
  }

  return {
    input,
    filingStatusSource,
    included,
    outsideTaxYear,
    bySource,
    cashExpensesTotal: cashExpenses,
    cashIncomeTotal: cashIncome,
    excludedIncome: [...excluded.values()],
    uncategorised: { incomeCount: uncategorisedIncomeCount, incomeTotal: uncategorisedIncomeTotal, expenseCount: uncategorisedExpenseCount },
    warnings,
    assumptions,
  };
}
