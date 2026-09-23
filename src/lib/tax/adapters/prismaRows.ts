import {
  DEFAULT_EXPENSE_CATEGORY,
  DEFAULT_INCOME_CATEGORY,
  EXPENSE_CATEGORIES,
  INCOME_CATEGORIES,
  isExpenseCategory,
  isIncomeCategory,
  type ExpenseCategory,
  type IncomeCategory,
} from '../categories';
import type { FederalTaxInput, W2Input } from '../engine';
import { money, nonNegativeMoney, ZERO, type Money, type MoneyInput } from '../money';
import { getTaxYearParameters, isSupportedTaxYear } from '../parameters';
import type { ExpenseItem, MileageTrip } from '../scheduleC';
import { SE_RATES } from '../scheduleSE';
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
 *  - Only transactions and trips dated inside the tax year (UTC calendar
 *    year) count.
 *  - Income is classified by `Transaction.category` alone. With no category,
 *    a deposit is business income (see categories.ts for why). Descriptions
 *    are never read.
 *  - An expense is classified by `Transaction.category` alone. With no
 *    category it is personal. The legacy `taxDeductible` column is NOT read:
 *    it is derived from the category by the API and kept only for the CSV
 *    export (e2e audit 2026-09-16, F2).
 *  - Logged mileage becomes Schedule C line 9 input, priced by the engine at
 *    the rate in force on each trip's date (e2e audit 2026-09-16, F1).
 *  - Filing status and dependent status come from the User row, defaulting to
 *    single / not a dependent, and the defaults are reported as assumptions.
 *  - Several W-2s become one engine W-2 (see mergeW2Forms): per-return boxes
 *    are summed across the return, Social Security boxes only across the
 *    self-employed person's own W-2s. A spouse's W-2 counts only on a joint
 *    return. Paycheck deposits are never wages.
 *  - Estimated tax payments count by the tax year they were made for, not the
 *    date paid (the fourth quarter's is due the following January).
 */

export interface TransactionRow {
  amount: MoneyInput;
  /** "Income" | "Expense" */
  type: string;
  date: Date;
  /** Legacy column. Accepted so Prisma rows type-check; never read. */
  taxDeductible?: boolean;
  category?: string | null;
  incomeSource?: { name: string; type: string } | null;
}

export interface MileageLogRow {
  date: Date;
  miles: MoneyInput;
}

export interface UserTaxProfileRow {
  filingStatus?: string | null;
  claimedAsDependent?: boolean | null;
  /** Married filing separately: the spouse itemizes (IRC §63(c)(6)(A)). */
  spouseItemizes?: boolean | null;
  /**
   * When the user last saved their tax profile. Null means never, so the
   * stored filing status is the column default rather than a choice and is
   * reported as assumed. Left out (a caller that does not load it) means the
   * stored status is taken as chosen.
   */
  taxProfileSavedAt?: Date | null;
}

export interface Form1098TRow {
  box1: MoneyInput;
  box5: MoneyInput;
  /** Part of Box 5 earmarked by the grant for room and board or other non-qualified expenses: always taxable. */
  restrictedToNonQualifiedExpenses?: MoneyInput | null;
}

/** A `W2Form` row. Field names are the database's; the box numbers are the form's. */
export interface W2FormRow {
  taxYear: number;
  /** Box 1. */
  wages: MoneyInput;
  /** Box 2. */
  federalWithheld?: MoneyInput | null;
  /** Box 3. */
  socialSecurityWages: MoneyInput;
  /** Box 7. */
  socialSecurityTips?: MoneyInput | null;
  /** Box 5. */
  medicareWages: MoneyInput;
  /** Box 6. */
  medicareWithheld?: MoneyInput | null;
  /** False only for a spouse's W-2 on a joint return. Null or missing means the taxpayer's own. */
  ownedByTaxpayer?: boolean | null;
}

/** An `EstimatedTaxPayment` row. */
export interface EstimatedPaymentRow {
  taxYear: number;
  amount: MoneyInput;
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
  /** Logged business trips. Optional so callers that have not loaded them still work; the estimate then has no line 9 mileage. */
  mileageLogs?: readonly MileageLogRow[] | null;
  user?: UserTaxProfileRow | null;
  form1098T?: Form1098TRow | null;
  form1098E?: Form1098ERow | null;
  homeOffice?: HomeOfficeRow | null;
  /** Every W-2 on file for the year, the spouse's included on a joint return. */
  w2Forms?: readonly W2FormRow[] | null;
  /** Form 1040-ES payments made for the year. */
  estimatedPayments?: readonly EstimatedPaymentRow[] | null;
}

export interface SourceBucket {
  /** Deposits counted as income (business or other taxable). */
  income: Money;
  /**
   * Expenses entered under a Schedule C category. A display figure: the 50%
   * meals limit and the de minimis equipment cap are applied by the engine
   * per category, not per source, so this is "entered", not "allowed".
   * `estimateFromRows` does remove `vehicleExpenses` from it when the engine
   * applied the standard mileage rate instead of actual vehicle costs.
   */
  deductibleExpenses: Money;
  /** Amounts entered under `car_and_truck`, so the figure above can be corrected after the engine's method choice. */
  vehicleExpenses: Money;
}

/** Income counted on the return, for one hustle. */
export interface HustleIncome {
  /** The IncomeSource name, or null for income with no hustle chosen. */
  name: string | null;
  /** The IncomeSource type ("Freelance", "Delivery", "Other"), or null. */
  type: string | null;
  income: Money;
  /** Deposits counted. */
  count: number;
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
  /** Mileage logs dated in / outside the tax year. */
  mileage: { included: number; outsideTaxYear: number };
  /**
   * W-2s: `included` on the return (the spouse's among them on a joint
   * return), of which `spouse`; `excludedSpouse` were a spouse's on a return
   * that is not joint; `outsideTaxYear` belonged to another year.
   */
  w2: { included: number; spouse: number; excludedSpouse: number; outsideTaxYear: number };
  /** Estimated payments counted for the year. */
  estimatedPayments: { count: number; total: Money };
  bySource: { freelance: SourceBucket; delivery: SourceBucket; other: SourceBucket };
  /** Income counted on the return, per hustle (IncomeSource), largest first. Display only. */
  incomeByHustle: HustleIncome[];
  /** Every in-year Expense transaction, deductible or not. Used for the "safe to spend" figure. */
  cashExpensesTotal: Money;
  /** Every in-year deposit that was counted as income. */
  cashIncomeTotal: Money;
  excludedIncome: ExcludedIncome[];
  uncategorised: { incomeCount: number; incomeTotal: Money; expenseCount: number; expenseTotal: Money };
  warnings: Warning[];
  assumptions: string[];
}

function emptyBucket(): SourceBucket {
  return { income: ZERO, deductibleExpenses: ZERO, vehicleExpenses: ZERO };
}

/** Sum of optional amounts; missing and null are zero. */
function sumOf(rows: readonly W2FormRow[], pick: (row: W2FormRow) => MoneyInput | null | undefined, field: string): Money {
  return rows.reduce<Money>((total, row, index) => {
    const value = pick(row);
    return value === null || value === undefined ? total : total.plus(nonNegativeMoney(value, `w2Forms[${index}].${field}`));
  }, ZERO);
}

/**
 * Several W-2s become the engine's single `W2Input`.
 *
 * Boxes 1, 2, 5 and 6 are per return. Form 1040 lines 1a and 25a add every
 * W-2, and Form 8959 (Additional Medicare Tax) says "If you have more than one
 * Form W-2, enter the total" for box 5 on line 1 and box 6 on line 19, both
 * spouses' on a joint return.
 *
 * Boxes 3 and 7 are per person. Schedule SE line 8a is the self-employed
 * individual's own Social Security wages and tips, so only `own` W-2s count
 * there, and the merged input is marked as the taxpayer's because it already
 * is.
 */
function mergeW2Forms(all: readonly W2FormRow[], own: readonly W2FormRow[]): W2Input {
  return {
    wages: sumOf(all, (r) => r.wages, 'wages'),
    federalIncomeTaxWithheld: sumOf(all, (r) => r.federalWithheld, 'federalWithheld'),
    medicareWages: sumOf(all, (r) => r.medicareWages, 'medicareWages'),
    medicareTaxWithheld: sumOf(all, (r) => r.medicareWithheld, 'medicareWithheld'),
    socialSecurityWages: sumOf(own, (r) => r.socialSecurityWages, 'socialSecurityWages'),
    socialSecurityTips: sumOf(own, (r) => r.socialSecurityTips, 'socialSecurityTips'),
    ownedByTaxpayer: true,
  };
}

/**
 * Each employer withholds 6.2% Social Security tax on wages up to the wage
 * base, so two employers together can withhold on more than the base. The
 * excess comes back as a credit (Form 1040 Schedule 3 line 11), which the
 * engine does not compute, so the estimate overstates what is owed. Per
 * person: spouses' wages are never combined for this.
 */
function excessSocialSecurityWarning(rows: readonly W2FormRow[], taxYear: number, whose: 'your' | "your spouse's"): Warning | null {
  if (rows.length < 2 || !isSupportedTaxYear(taxYear)) return null;
  const base = money(getTaxYearParameters(taxYear).selfEmployment.socialSecurityWageBase);
  const ssWages = sumOf(rows, (r) => r.socialSecurityWages, 'socialSecurityWages').plus(sumOf(rows, (r) => r.socialSecurityTips, 'socialSecurityTips'));
  if (!ssWages.greaterThan(base)) return null;
  const excess = ssWages.minus(base).times(SE_RATES.socialSecurityEmployee).toDecimalPlaces(2);
  return {
    code: 'excess_social_security_withheld',
    message: `Across ${rows.length} of ${whose} W-2s, Social Security tax was withheld on $${ssWages.toFixed(2)} of wages, more than the $${base.toFixed(0)} wage base for ${taxYear}. The excess withholding, about $${excess.toFixed(2)}, is refunded as a credit on Schedule 3 line 11, which this estimate does not include, so it overstates what you owe. Box 4 of each W-2 gives the exact figure.`,
    amount: excess.toFixed(2),
  };
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
  const stored = args.user?.taxProfileSavedAt === null ? null : args.user?.filingStatus;
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
  const byHustle = new Map<string, HustleIncome>();
  const addHustleIncome = (source: TransactionRow['incomeSource'], amount: Money) => {
    const key = source ? `${source.type}\u0000${source.name}` : '';
    const entry = byHustle.get(key) ?? { name: source?.name ?? null, type: source?.type ?? null, income: ZERO, count: 0 };
    entry.income = entry.income.plus(amount);
    entry.count++;
    byHustle.set(key, entry);
  };
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
  let uncategorisedExpenseTotal: Money = ZERO;
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
            message: isExpenseCategory(row.category)
              ? `An income transaction is tagged with the expense category ${JSON.stringify(row.category)}; it was treated as uncategorised.`
              : `An income transaction is tagged ${JSON.stringify(row.category)}, which is not a known income category; it was treated as uncategorised. Re-categorise it.`,
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
          addHustleIncome(row.incomeSource, amount);
          businessSources.add(row.incomeSource ? `${row.incomeSource.type}:${row.incomeSource.name}` : '(no source)');
          break;
        case 'other_income':
          otherIncome = otherIncome.plus(amount);
          cashIncome = cashIncome.plus(amount);
          bucket.income = bucket.income.plus(amount);
          addHustleIncome(row.incomeSource, amount);
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
            message: isIncomeCategory(row.category)
              ? `An expense transaction is tagged with the income category ${JSON.stringify(row.category)}; it was treated as uncategorised (personal).`
              : `An expense transaction is tagged ${JSON.stringify(row.category)}, which is not a known expense category; it was treated as uncategorised (personal). Re-categorise it.`,
            amount: amount.toFixed(2),
          });
        }
        // No category means no evidence of a business purpose. The legacy
        // taxDeductible flag is deliberately not consulted (F2).
        category = DEFAULT_EXPENSE_CATEGORY;
        uncategorisedExpenseCount++;
        uncategorisedExpenseTotal = uncategorisedExpenseTotal.plus(amount);
      }
      expenses.push({ category, amount });
      const treatment = EXPENSE_CATEGORIES[category].treatment;
      if (treatment === 'schedule_c_expense' || treatment === 'schedule_c_de_minimis_equipment') {
        bucket.deductibleExpenses = bucket.deductibleExpenses.plus(amount);
        if (category === 'car_and_truck') bucket.vehicleExpenses = bucket.vehicleExpenses.plus(amount);
      }
    } else {
      warnings.push({ code: 'unknown_transaction_type', message: `Transaction type ${JSON.stringify(row.type)} is not Income or Expense and was ignored.`, amount: amount.toFixed(2) });
    }
  }

  // Mileage: only trips in the tax year, handed to the engine as dated trips
  // so it prices each at the rate in force that day.
  const mileage: MileageTrip[] = [];
  let mileageOutsideTaxYear = 0;
  for (const log of args.mileageLogs ?? []) {
    if (log.date.getUTCFullYear() !== args.taxYear) {
      mileageOutsideTaxYear++;
      continue;
    }
    mileage.push({ date: log.date.toISOString().slice(0, 10), miles: log.miles });
  }

  // W-2s. A spouse's W-2 belongs only on a joint return; on any other status
  // it is not part of this return at all.
  const jointReturn = filingStatus === 'married_filing_jointly';
  const inYearW2s: W2FormRow[] = [];
  let w2OutsideTaxYear = 0;
  for (const row of args.w2Forms ?? []) {
    if (row.taxYear !== args.taxYear) {
      w2OutsideTaxYear++;
      continue;
    }
    inYearW2s.push(row);
  }
  const ownW2s = inYearW2s.filter((row) => row.ownedByTaxpayer !== false);
  const spouseW2s = inYearW2s.filter((row) => row.ownedByTaxpayer === false);
  const returnW2s = jointReturn ? inYearW2s : ownW2s;
  if (!jointReturn && spouseW2s.length > 0) {
    warnings.push({
      code: 'spouse_w2_not_on_this_return',
      message: `${spouseW2s.length} W-2(s) marked as your spouse's were left out: a spouse's wages are only on your return when you file jointly. Change your filing status, or mark the W-2 as yours if it is.`,
      amount: sumOf(spouseW2s, (r) => r.wages, 'wages').toFixed(2),
    });
  }
  for (const warning of [
    excessSocialSecurityWarning(ownW2s, args.taxYear, 'your'),
    jointReturn ? excessSocialSecurityWarning(spouseW2s, args.taxYear, "your spouse's") : null,
  ]) {
    if (warning) warnings.push(warning);
  }

  // Estimated payments, by the year they were made for.
  let estimatedPaymentsTotal: Money = ZERO;
  let estimatedPaymentsCount = 0;
  for (const [index, row] of (args.estimatedPayments ?? []).entries()) {
    if (row.taxYear !== args.taxYear) continue;
    estimatedPaymentsTotal = estimatedPaymentsTotal.plus(nonNegativeMoney(row.amount, `estimatedPayments[${index}].amount`));
    estimatedPaymentsCount++;
  }

  if (uncategorisedIncomeCount > 0) {
    warnings.push({
      code: 'uncategorised_income',
      message: `${uncategorisedIncomeCount} deposit(s) have no tax category and were counted as business income subject to self-employment tax. If any are loans, transfers, refunds, paychecks or investment sales, categorise them: the estimate will fall.`,
      amount: uncategorisedIncomeTotal.toFixed(2),
    });
  }
  if (uncategorisedExpenseCount > 0) {
    warnings.push({
      code: 'uncategorised_expenses',
      message: `${uncategorisedExpenseCount} expense(s) have no tax category and were treated as personal, so nothing was deducted for them. Categorise any that are business costs: the estimate will fall.`,
      amount: uncategorisedExpenseTotal.toFixed(2),
    });
  }
  for (const entry of excluded.values()) {
    const def = INCOME_CATEGORIES[entry.category];
    if (entry.category === 'w2_paycheck' && returnW2s.length > 0) {
      // Expected and correct once the W-2 is on file: the deposits are left
      // out because the W-2's boxes already carry those wages.
      assumptions.push(`${entry.count} paycheck deposit(s) were left out of income on purpose; wages come from the ${returnW2s.length} W-2(s) entered.`);
      continue;
    }
    if (entry.category === 'w2_paycheck') {
      warnings.push({
        code: 'paychecks_without_w2',
        message: `${entry.count} deposit(s) are paychecks, but no W-2 is entered for ${args.taxYear}, so those wages and the tax already withheld from them are missing from the estimate. Add the W-2, or your latest pay stub's year-to-date figures.`,
        amount: entry.total.toFixed(2),
      });
      continue;
    }
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
      mileage,
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
    w2: returnW2s.length > 0 ? mergeW2Forms(returnW2s, ownW2s) : null,
    estimatedTaxPaymentsMade: estimatedPaymentsCount > 0 ? estimatedPaymentsTotal : undefined,
  };

  if (args.homeOffice) {
    assumptions.push('Home office rent and utilities are monthly figures and the office was used for all 12 months of the year.');
  }

  return {
    input,
    filingStatusSource,
    included,
    outsideTaxYear,
    mileage: { included: mileage.length, outsideTaxYear: mileageOutsideTaxYear },
    w2: {
      included: returnW2s.length,
      spouse: jointReturn ? spouseW2s.length : 0,
      excludedSpouse: jointReturn ? 0 : spouseW2s.length,
      outsideTaxYear: w2OutsideTaxYear,
    },
    estimatedPayments: { count: estimatedPaymentsCount, total: estimatedPaymentsTotal },
    bySource,
    incomeByHustle: [...byHustle.values()].sort((a, b) => b.income.comparedTo(a.income) || (a.name ?? '').localeCompare(b.name ?? '')),
    cashExpensesTotal: cashExpenses,
    cashIncomeTotal: cashIncome,
    excludedIncome: [...excluded.values()],
    uncategorised: {
      incomeCount: uncategorisedIncomeCount,
      incomeTotal: uncategorisedIncomeTotal,
      expenseCount: uncategorisedExpenseCount,
      expenseTotal: uncategorisedExpenseTotal,
    },
    warnings,
    assumptions,
  };
}
