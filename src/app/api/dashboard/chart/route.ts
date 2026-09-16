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
} from '@/lib/tax';

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
] as const;

export interface ChartMonthPoint {
  month: string;
  gross: number;
  net: number;
}

/**
 * GET /api/dashboard/chart[?taxYear=YYYY]
 *
 * Computes a real cumulative gross income and net income curve across all 12
 * months for the requested tax year.
 *
 * For each month (Jan through Dec), this handler runs the same
 * `estimateFromRows` the summary route uses, over the transactions and mileage
 * logs dated through the end of that month. Because the tax engine is pure
 * functions with zero I/O, twelve evaluations are fast and give a genuine
 * cumulative net curve rather than an invented ratio. The December point is,
 * by construction, the summary route's figure for the same rows.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let taxYear: number;
  const requested = request.nextUrl.searchParams.get('taxYear');
  if (requested !== null) {
    const parsed = Number(requested);
    if (!isSupportedTaxYear(parsed)) {
      return NextResponse.json(
        { error: `taxYear must be one of ${SUPPORTED_TAX_YEARS.join(', ')}` },
        { status: 400 }
      );
    }
    taxYear = parsed;
  } else {
    const currentYear = new Date().getUTCFullYear();
    if (isSupportedTaxYear(currentYear)) {
      taxYear = currentYear;
    } else {
      taxYear = latestSupportedTaxYear();
    }
  }

  try {
    const yearRange = {
      gte: new Date(Date.UTC(taxYear, 0, 1)),
      lt: new Date(Date.UTC(taxYear + 1, 0, 1)),
    };
    const [userRecord, transactions, mileageLogs] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        // Year-scoped: one row per user per year, so an unfiltered include
        // would pull another year's forms into this year's curve.
        include: {
          form1098T: { where: { taxYear } },
          form1098E: { where: { taxYear } },
          homeOffice: { where: { taxYear } },
        },
      }),
      prisma.transaction.findMany({
        where: { userId, date: yearRange },
        include: { incomeSource: { select: { name: true, type: true } } },
        orderBy: { date: 'asc' },
      }),
      prisma.mileageLog.findMany({
        where: { userId, date: yearRange },
        orderBy: { date: 'asc' },
      }),
    ]);

    const chartData: ChartMonthPoint[] = [];

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthEndExclusive = new Date(Date.UTC(taxYear, monthIndex + 1, 1));

      // Same inputs as the summary route, cut off at the month end. Mileage
      // rides along so a logged trip moves the curve (e2e audit 2026-09-16, F1).
      const { estimate, safeToSpend } = estimateFromRows({
        taxYear,
        transactions: transactions.filter((tx) => tx.date < monthEndExclusive),
        mileageLogs: mileageLogs.filter((log) => log.date < monthEndExclusive),
        user: userRecord,
        // The compound unique on (userId, taxYear) means at most one row each.
        form1098T: userRecord?.form1098T[0] ?? null,
        form1098E: userRecord?.form1098E[0] ?? null,
        homeOffice: userRecord?.homeOffice[0] ?? null,
      });

      chartData.push({
        month: MONTH_NAMES[monthIndex],
        gross: toNumber(estimate.income.totalIncome),
        net: toNumber(safeToSpend),
      });
    }

    return NextResponse.json(chartData);
  } catch (error) {
    if (error instanceof TaxInputError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Failed to aggregate chart data:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
