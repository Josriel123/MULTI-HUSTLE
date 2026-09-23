import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { summaryPayload } from '@/lib/dashboard';
import { loadEstimateRows } from '@/lib/estimateRows';
import { TaxInputError } from '@/lib/tax';
import { resolveTaxYear } from '@/lib/taxYear';

/**
 * GET /api/dashboard/summary[?taxYear=YYYY]
 *
 * Runs the federal tax estimate for the signed-in user. All arithmetic lives
 * in `src/lib/tax`; this handler loads the year's rows and returns what
 * `summaryPayload` (src/lib/dashboard.ts, where the response is documented)
 * builds from them.
 *
 * `disclaimer` must be rendered wherever a liability figure is shown. It is
 * returned on every successful response so the UI never has to invent or omit
 * it.
 */
export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Explicit query parameter, else the current calendar year, else the latest
  // year with parameters (flagged in the warnings, never silent).
  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

  try {
    const rows = await loadEstimateRows(userId, resolved.taxYear);
    return NextResponse.json(summaryPayload(rows, resolved.warnings));
  } catch (error) {
    if (error instanceof TaxInputError) {
      // Bad stored data (a negative box amount, an office larger than the home). Say what, not just that.
      return NextResponse.json({ error: error.message }, { status: 422 });
    }
    console.error('Failed to compute dashboard summary:', error);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
