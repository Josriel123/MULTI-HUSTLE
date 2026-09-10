import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';

/**
 * Form 1098-E, scoped to a tax year.
 *
 * The §221 student loan interest deduction is annual, so Box 1 belongs to one
 * year. One row per user per year; both handlers take `?taxYear=YYYY` and
 * default to the current year.
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

    const parsedBox1 = parseFloat(body.box1);
    if (Number.isNaN(parsedBox1)) {
      return NextResponse.json({ error: 'Invalid numbers provided' }, { status: 400 });
    }
    const box1 = Math.max(0, parsedBox1);

    const form = await prisma.form1098E.upsert({
      where: { userId_taxYear: { userId, taxYear } },
      update: { box1 },
      create: { userId, taxYear, box1 },
    });

    return NextResponse.json({ success: true, form, taxYear });
  } catch (error) {
    console.error('Failed to save 1098-E:', error);
    return NextResponse.json({ error: 'Failed to process tax form' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const { taxYear } = resolved;

  try {
    const form = await prisma.form1098E.findUnique({
      where: { userId_taxYear: { userId, taxYear } },
    });
    return NextResponse.json({ form, taxYear, warnings: resolved.warnings });
  } catch (error) {
    console.error('Failed to fetch 1098-E:', error);
    return NextResponse.json({ error: 'Failed to fetch tax form', form: null }, { status: 500 });
  }
}
