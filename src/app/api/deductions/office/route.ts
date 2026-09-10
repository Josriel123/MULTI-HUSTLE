import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';

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

    const tSqFt = parseFloat(body.totalSqFt);
    const oSqFt = parseFloat(body.officeSqFt);
    const rent = parseFloat(body.rentAmount);
    const utils = parseFloat(body.utilitiesAmount);

    if ([tSqFt, oSqFt, rent, utils].some(Number.isNaN)) {
      return NextResponse.json({ error: 'Invalid numbers provided' }, { status: 400 });
    }

    const values = {
      totalSqFt: Math.max(0, tSqFt),
      officeSqFt: Math.max(0, oSqFt),
      rentAmount: Math.max(0, rent),
      utilitiesAmount: Math.max(0, utils),
    };

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
