import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { chartPayload } from '@/lib/dashboard';
import { loadEstimateRows } from '@/lib/estimateRows';
import { TaxInputError } from '@/lib/tax';
import { resolveTaxYear } from '@/lib/taxYear';

/**
 * GET /api/dashboard/chart[?taxYear=YYYY]
 *
 * Cumulative income and safe-to-spend for each month of the tax year. Each
 * point is a full run of the estimate over what had happened by that month's
 * end (see `chartPayload`); the engine is pure, so twelve runs are cheap and
 * the curve is real rather than an invented ratio. December equals the
 * summary for the same rows.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

  try {
    const rows = await loadEstimateRows(userId, resolved.taxYear);
    return NextResponse.json(chartPayload(rows));
  } catch (error) {
    if (error instanceof TaxInputError) {
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Failed to aggregate chart data:', error);
    return NextResponse.json({ error: 'Failed to fetch chart data' }, { status: 500 });
  }
}
