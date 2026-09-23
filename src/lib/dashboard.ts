import {
  estimateFromRows,
  isAboveZero,
  money,
  notBelowZero,
  ZERO,
  toNumber,
  toPlain,
  type BuildInputArgs,
  type EstimatedPaymentRow,
  type MoneyInput,
  type SourceBucket,
  type W2FormRow,
  type Warning,
} from '@/lib/tax';

/**
 * The two dashboard responses, built from rows. Pure: no database, no auth.
 *
 * The routes load rows with `loadEstimateRows` (src/lib/estimateRows.ts) and
 * return what these functions build; the dev-only preview page feeds them
 * fixture rows, so what it renders is real engine output. All tax arithmetic
 * stays in src/lib/tax; this file only shapes results, except for the chart's
 * even spread of W-2 amounts, which is a display rule and is labelled as one.
 */

/** Rows for one tax year. Payments carry the date paid so the chart can place them. */
export interface EstimateInputRows extends BuildInputArgs {
  estimatedPayments?: readonly (EstimatedPaymentRow & { paidOn: Date })[] | null;
}

/**
 * GET /api/dashboard/summary.
 *
 *   summary.gross         Form 1040 line 9, total income
 *   summary.taxLiability  Form 1040 line 24, total tax
 *   summary.paid          Form 1040 line 33, withholding plus estimated payments
 *   summary.balanceDue    Form 1040 line 37 (negative: line 34, overpaid)
 *   summary.leftToPay     the balance due, never below zero
 *   summary.refund        the overpayment, never below zero
 *   summary.paidShare     paid / total tax, 0 to 1, for a progress bar; null with no tax
 *   summary.net           "safe to spend", see estimateFromRows
 *   summary.hustleIncome  deposits counted as income; summary.spent, every expense
 *   incomeBySource        income counted, per hustle, with each one's share
 *   counts                what is on file, for the setup checklist
 *   estimate              the engine's full result, every Money as a number
 *
 * `disclaimer`, `warnings`, `assumptions` and `notModeled` must be shown
 * wherever a figure from this response is.
 */
export function summaryPayload(rows: EstimateInputRows, routeWarnings: readonly Warning[] = []) {
  const { built, estimate, safeToSpend } = estimateFromRows(rows);
  // Display ratios, computed here so no page divides money. Rounded to four
  // places: they only size bars.
  const ratio = (part: ReturnType<typeof money>, whole: ReturnType<typeof money>) =>
    isAboveZero(whole) ? Number(part.dividedBy(whole).toDecimalPlaces(4).toString()) : null;
  const paidShare = ratio(estimate.payments.total.greaterThan(estimate.totalTax) ? estimate.totalTax : estimate.payments.total, estimate.totalTax);
  const hustleTotal = built.incomeByHustle.reduce((sum, h) => sum.plus(h.income), ZERO);
  const bucket = (b: SourceBucket) => ({
    income: toNumber(b.income),
    deductions: toNumber(b.deductibleExpenses),
  });

  return {
    taxYear: rows.taxYear,
    filingStatus: estimate.filingStatus,
    filingStatusSource: built.filingStatusSource,
    disclaimer: estimate.disclaimer,
    summary: {
      gross: toNumber(estimate.income.totalIncome),
      net: toNumber(safeToSpend),
      taxLiability: toNumber(estimate.totalTax),
      paid: toNumber(estimate.payments.total),
      balanceDue: toNumber(estimate.balanceDue),
      leftToPay: toNumber(notBelowZero(estimate.balanceDue)),
      refund: toNumber(notBelowZero(estimate.balanceDue.negated())),
      paidShare,
      /** Deposits counted as income: the cash the hustles brought in. */
      hustleIncome: toNumber(built.cashIncomeTotal),
      /** Every expense, deductible or not. */
      spent: toNumber(built.cashExpensesTotal),
    },
    sources: {
      freelance: {
        ...bucket(built.bySource.freelance),
        homeOfficeDeduction: toNumber(estimate.scheduleC.homeOfficeDeduction),
      },
      delivery: {
        ...bucket(built.bySource.delivery),
        // Read back from the estimate, so what is displayed is what was deducted.
        mileage: toNumber(estimate.scheduleC.mileage.totalMiles),
        mileageDeduction: toNumber(estimate.scheduleC.mileage.deduction),
        vehicleMethod: estimate.scheduleC.mileage.methodApplied,
      },
      other: bucket(built.bySource.other),
      scholarships: {
        taxable: toNumber(estimate.income.taxableScholarships),
        textbookSavings: estimate.scholarships ? toNumber(estimate.scholarships.requiredCourseMaterials) : 0,
        loanInterestDeduction: estimate.adjustments.studentLoanInterest ? toNumber(estimate.adjustments.studentLoanInterest.deduction) : 0,
      },
    },
    incomeBySource: built.incomeByHustle.map((h) => ({
      name: h.name,
      type: h.type,
      income: toNumber(h.income),
      count: h.count,
      share: ratio(h.income, hustleTotal) ?? 0,
    })),
    transactions: {
      included: built.included,
      excludedIncome: built.excludedIncome.map((x) => ({ category: x.category, count: x.count, total: toNumber(x.total) })),
      uncategorised: {
        incomeCount: built.uncategorised.incomeCount,
        incomeTotal: toNumber(built.uncategorised.incomeTotal),
        expenseCount: built.uncategorised.expenseCount,
        expenseTotal: toNumber(built.uncategorised.expenseTotal),
      },
      mileageLogs: built.mileage,
    },
    counts: {
      transactions: built.included,
      mileageTrips: built.mileage.included,
      /** On file for the year, whether or not this filing status puts them on the return. */
      w2Forms: built.w2.included + built.w2.excludedSpouse,
      estimatedPayments: built.estimatedPayments.count,
      has1098T: Boolean(rows.form1098T),
      has1098E: Boolean(rows.form1098E),
      hasHomeOffice: Boolean(rows.homeOffice),
    },
    estimate: toPlain(estimate),
    warnings: [...routeWarnings, ...built.warnings, ...estimate.warnings],
    assumptions: [...built.assumptions, ...estimate.assumptions],
    notModeled: estimate.notModeled,
  };
}

export type SummaryPayload = ReturnType<typeof summaryPayload>;

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;

export interface ChartPoint {
  month: (typeof MONTH_NAMES)[number];
  /** Form 1040 line 9 through the end of the month. */
  gross: number;
  /** Safe to spend through the end of the month. */
  net: number;
}

/** A W-2 amount for `months` of `of` months, spread evenly: a W-2 covers a period and carries no dates. */
function spread(value: MoneyInput | null | undefined, months: number, of: number): MoneyInput | null | undefined {
  return value === null || value === undefined ? value : money(value).times(months).dividedBy(of).toDecimalPlaces(2);
}

function w2Through(rows: readonly W2FormRow[], months: number, of: number): W2FormRow[] {
  return rows.map((row) => ({
    ...row,
    wages: spread(row.wages, months, of)!,
    federalWithheld: spread(row.federalWithheld, months, of),
    socialSecurityWages: spread(row.socialSecurityWages, months, of)!,
    socialSecurityTips: spread(row.socialSecurityTips, months, of),
    medicareWages: spread(row.medicareWages, months, of)!,
    medicareWithheld: spread(row.medicareWithheld, months, of),
  }));
}

/**
 * GET /api/dashboard/chart: cumulative income and safe-to-spend by month.
 *
 * Each point runs the same estimateFromRows as the summary over what had
 * happened by the end of that month: transactions and trips by date, payments
 * by the date paid, and W-2 amounts spread evenly over the months shown
 * (`w2Spread` tells the page to say so). The current year stops at the
 * current month, since a W-2 entered mid-year holds year-to-date figures and
 * later months have not happened. The last point takes everything, a payment
 * made the following January included, so it is by construction the
 * summary's figure.
 */
export function chartPayload(rows: EstimateInputRows, today: Date = new Date()) {
  const w2Forms = rows.w2Forms ?? [];
  const payments = rows.estimatedPayments ?? [];
  const thisYear = today.getUTCFullYear();
  const lastMonth = rows.taxYear < thisYear ? 11 : rows.taxYear === thisYear ? today.getUTCMonth() : 0;
  const points: ChartPoint[] = MONTH_NAMES.slice(0, lastMonth + 1).map((month, monthIndex) => {
    const last = monthIndex === lastMonth;
    const monthEndExclusive = new Date(Date.UTC(rows.taxYear, monthIndex + 1, 1));
    const { estimate, safeToSpend } = estimateFromRows({
      ...rows,
      transactions: last ? rows.transactions : rows.transactions.filter((tx) => tx.date < monthEndExclusive),
      mileageLogs: last ? rows.mileageLogs : (rows.mileageLogs ?? []).filter((log) => log.date < monthEndExclusive),
      w2Forms: last ? w2Forms : w2Through(w2Forms, monthIndex + 1, lastMonth + 1),
      estimatedPayments: last ? payments : payments.filter((p) => p.paidOn < monthEndExclusive),
    });
    return { month, gross: toNumber(estimate.income.totalIncome), net: toNumber(safeToSpend) };
  });
  return { taxYear: rows.taxYear, points, w2Spread: w2Forms.length > 0 };
}

export type ChartPayload = ReturnType<typeof chartPayload>;
