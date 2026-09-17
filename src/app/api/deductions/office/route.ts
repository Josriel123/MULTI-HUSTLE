import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';
import { parseHomeOfficeInput } from '@/lib/validation';

/**
 * Home office deduction inputs, scoped to a tax year.
 *
 * Rent, utilities and the space itself change between years, and the simplified
 * method's rate is set per year. One row per user per year; both handlers take
 * `?taxYear=YYYY` and default to the current year.
 */

export async function POST(request: NextRequest) {
  // requireUser, not auth: this upserts a row with a User foreign key.
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await request.json();
    const resolved = resolveTaxYearFromRequest(
      request.nextUrl.searchParams.get('taxYear'),
      body.taxYear
    );
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
    const { taxYear } = resolved;

    // Validate the record as a whole before persisting it. This used to check
    // only for NaN and clamp negatives to zero with Math.max, so an office
    // larger than the home was stored and the engine rejected it on every
    // later estimate — which blanked the dashboard and the student forms too.
    // Refuse it here, while the previous valid record is still intact.
    const parsed = parseHomeOfficeInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const values = parsed.values;

    const homeOffice = await prisma.homeOfficeDeduction.upsert({
      where: { userId_taxYear: { userId, taxYear } },
      update: values,
      create: { userId, taxYear, ...values },
    });

    return NextResponse.json({ success: true, form: homeOffice, taxYear });
  } catch (error) {
    console.error('Failed to save Home Office Deduction:', error);
    return NextResponse.json({ error: 'Failed to process deduction form' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const { taxYear } = resolved;

  try {
    const form = await prisma.homeOfficeDeduction.findUnique({
      where: { userId_taxYear: { userId, taxYear } },
    });
    return NextResponse.json({ form, taxYear, warnings: resolved.warnings });
  } catch (error) {
    console.error('Failed to fetch Home Office Deduction:', error);
    return NextResponse.json({ error: 'Failed to fetch deduction form', form: null }, { status: 500 });
  }
}
