import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import {
  estimateFromRows,
  isSupportedTaxYear,
  latestSupportedTaxYear,
  SUPPORTED_TAX_YEARS,
  TaxInputError,
  toNumber,
  toPlain,
  type SourceBucket,
  type Warning,
} from '@/lib/tax';

/**
 * GET /api/dashboard/summary[?taxYear=YYYY]
 *
 * Runs the federal tax estimate for the signed-in user. All arithmetic lives
 * in `src/lib/tax`; this handler only loads rows, hands them to the adapter,
 * and shapes the response.
 *
 * Response (superset of the previous shape, so existing pages keep working):
 *   taxYear, filingStatus, disclaimer
 *   summary.gross          Form 1040 line 9 total income
 *   summary.taxLiability   Form 1040 line 24 total tax (income tax + SE tax + Additional Medicare)
 *   summary.net            "safe to spend": deposits counted as income - every expense - total tax
 *   sources.*              per-source display totals (grouped by IncomeSource.type, never by name)
 *   estimate               the full line-by-line computation with citations, warnings and assumptions
 *   warnings, assumptions, notModeled
 *
 * `disclaimer` must be rendered wherever `summary.taxLiability` (or any other
 * liability figure) is shown. It is returned on every successful response so
 * the UI never has to invent or omit it.
 *
 * Money arrives from Prisma as `Prisma.Decimal` (the columns are DECIMAL(12,2))
 * and is only converted to JS numbers at the very end, by `toNumber`/`toPlain`.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Tax year: explicit query parameter, else the current calendar year, else
  // the latest year we have parameters for (flagged, never silent).
  const routeWarnings: Warning[] = [];
  let taxYear: number;
  const requested = request.nextUrl.searchParams.get('taxYear');
  if (requested !== null) {
    const parsed = Number(requested);
    if (!isSupportedTaxYear(parsed)) {
      return NextResponse.json({ error: `taxYear must be one of ${SUPPORTED_TAX_YEARS.join(', ')}` }, { status: 400 });
    }
    taxYear = parsed;
  } else {
    const currentYear = new Date().getUTCFullYear();
    if (isSupportedTaxYear(currentYear)) {
      taxYear = currentYear;
    } else {
      taxYear = latestSupportedTaxYear();
      routeWarnings.push({
        code: 'tax_year_fallback',
        message: `Tax parameters for ${currentYear} are not loaded yet, so ${taxYear} rules were applied to ${currentYear} transactions.`,
      });
    }
  }

  try {
    const [userRecord, transactions, mileageLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        // Year-scoped: these tables hold one row per user per year, so an
        // unfiltered include would apply another year's 1098-T to this
        // estimate.
        include: {
          form1098T: { where: { taxYear } },
          form1098E: { where: { taxYear } },
          homeOffice: { where: { taxYear } },
        },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          date: { gte: new Date(Date.UTC(taxYear, 0, 1)), lt: new Date(Date.UTC(taxYear + 1, 0, 1)) },
        },
        include: { incomeSource: { select: { name: true, type: true } } },
      }),
      prisma.mileageLog.findMany({
        where: {
          userId,
          date: { gte: new Date(Date.UTC(taxYear, 0, 1)), lt: new Date(Date.UTC(taxYear + 1, 0, 1)) },
        },
      }),
    ]);

    // One shared call with the chart route, so the two can never disagree about
    // what feeds the engine. Mileage goes in here and is priced on Schedule C
    // line 9 by the engine (e2e audit 2026-09-16, F1); nothing is priced after
    // the fact. `safeToSpend` is the cash view for the "safe to spend" card.
    const { built, estimate, safeToSpend: net } = estimateFromRows({
      taxYear,
      transactions,
      mileageLogs,
      user: userRecord,
      // The compound unique on (userId, taxYear) means at most one row each.
      form1098T: userRecord?.form1098T[0] ?? null,
      form1098E: userRecord?.form1098E[0] ?? null,
      homeOffice: userRecord?.homeOffice[0] ?? null,
    });

    const bucket = (b: SourceBucket) => ({
      income: toNumber(b.income),
      deductions: toNumber(b.deductibleExpenses),
    });

    return NextResponse.json({
      taxYear,
      filingStatus: estimate.filingStatus,
      filingStatusSource: built.filingStatusSource,
      disclaimer: estimate.disclaimer,
      summary: {
        gross: toNumber(estimate.income.totalIncome),
        net: toNumber(net),
        taxLiability: toNumber(estimate.totalTax),
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
      estimate: toPlain(estimate),
      warnings: [...routeWarnings, ...built.warnings, ...estimate.warnings],
      assumptions: [...built.assumptions, ...estimate.assumptions],
      notModeled: estimate.notModeled,
    });
  } catch (error) {
    if (error instanceof TaxInputError) {
      // Bad stored data (a negative box amount, an office larger than the home). Say what, not just that.
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Failed to compute dashboard summary:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
