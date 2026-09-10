import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import {
  buildFederalTaxInput,
  estimateFederalTax,
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
 * For each month (Jan through Dec), this handler runs `estimateFederalTax`
 * over the set of transactions dated through the end of that month. Because the
 * tax engine is pure functions with zero I/O, twelve evaluations are fast and
 * give a genuine cumulative net curve rather than an invented ratio.
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
    const [userRecord, transactions] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { form1098T: true, form1098E: true, homeOffice: true },
      }),
      prisma.transaction.findMany({
        where: {
          userId,
          date: {
            gte: new Date(Date.UTC(taxYear, 0, 1)),
            lt: new Date(Date.UTC(taxYear + 1, 0, 1)),
          },
        },
        include: { incomeSource: { select: { name: true, type: true } } },
        orderBy: { date: 'asc' },
      }),
    ]);

    const chartData: ChartMonthPoint[] = [];

    for (let monthIndex = 0; monthIndex < 12; monthIndex++) {
      const monthEndExclusive = new Date(Date.UTC(taxYear, monthIndex + 1, 1));
      const transactionsThroughMonth = transactions.filter(
        (tx) => tx.date < monthEndExclusive
      );

      const built = buildFederalTaxInput({
        taxYear,
        transactions: transactionsThroughMonth,
        user: userRecord,
        form1098T: userRecord?.form1098T,
        form1098E: userRecord?.form1098E,
        homeOffice: userRecord?.homeOffice,
      });

      const estimate = estimateFederalTax(built.input);
      const net = built.cashIncomeTotal
        .minus(built.cashExpensesTotal)
        .minus(estimate.totalTax);

      chartData.push({
        month: MONTH_NAMES[monthIndex],
        gross: toNumber(estimate.income.totalIncome),
        net: toNumber(net),
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
