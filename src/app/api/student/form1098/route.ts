import { NextResponse, type NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';
import { parseMoneyInput, parseOptionalMoneyInput } from '@/lib/validation';

/**
 * Form 1098-T, scoped to a tax year.
 *
 * Box 1 and Box 5 describe one year's tuition and scholarships, so there is one
 * row per user per year. `restrictedToNonQualifiedExpenses` is the part of Box
 * 5 that the grant's own terms reserve for room, board or travel: taxable
 * whatever tuition was paid, so it cannot exceed Box 5. Both handlers accept `?taxYear=YYYY` and default to
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

    // Refused, not corrected: this used Math.max(0, Number(x) || 0), which
    // stored a typo such as "4,000" or "-4000" as 0 without a word.
    const box1 = parseMoneyInput(body.box1, 'Box 1 (payments for qualified tuition)');
    if (!box1.ok) return NextResponse.json({ error: box1.error }, { status: 400 });
    const box5 = parseMoneyInput(body.box5, 'Box 5 (scholarships or grants)');
    if (!box5.ok) return NextResponse.json({ error: box5.error }, { status: 400 });
    const restricted = parseOptionalMoneyInput(body.restrictedToNonQualifiedExpenses, 'Grant money reserved for room and board');
    if (!restricted.ok) return NextResponse.json({ error: restricted.error }, { status: 400 });
    if (restricted.value.greaterThan(box5.value)) {
      return NextResponse.json(
        { error: `Grant money reserved for room and board (${restricted.value.toFixed(2)}) can't be more than Box 5 (${box5.value.toFixed(2)}).` },
        { status: 400 },
      );
    }

    const values = { box1: box1.value, box5: box5.value, restrictedToNonQualifiedExpenses: restricted.value };
    const form = await prisma.form1098T.upsert({
      where: { userId_taxYear: { userId, taxYear } },
      update: values,
      create: { userId, taxYear, ...values },
    });

    return NextResponse.json({ success: true, form, taxYear });
  } catch (error) {
    console.error('1098-T error:', error);
    return NextResponse.json({ error: 'Failed to save Form 1098-T' }, { status: 500 });
  }
}
