import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';

/**
 * Form 1098-T, scoped to a tax year.
 *
 * Box 1 and Box 5 describe one year's tuition and scholarships, so there is one
 * row per user per year. Both handlers accept `?taxYear=YYYY` and default to
 * the current year; the year is echoed back so a caller can never mistake which
 * statement it is looking at.
 */

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const { taxYear } = resolved;

  try {
    const form = await prisma.form1098T.findUnique({
      where: { userId_taxYear: { userId, taxYear } },
    });
    return NextResponse.json({ form, taxYear, warnings: resolved.warnings });
  } catch (error) {
    console.error('Failed to read Form 1098-T:', error);
    return NextResponse.json({ error: 'Failed to read Form 1098-T' }, { status: 500 });
  }
}

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

    const box1 = Math.max(0, Number(body.box1) || 0);
    const box5 = Math.max(0, Number(body.box5) || 0);

    const form = await prisma.form1098T.upsert({
      where: { userId_taxYear: { userId, taxYear } },
      update: { box1, box5 },
      create: { userId, taxYear, box1, box5 },
    });

    return NextResponse.json({ success: true, form, taxYear });
  } catch (error) {
    console.error('1098-T error:', error);
    return NextResponse.json({ error: 'Failed to save Form 1098-T' }, { status: 500 });
  }
}
