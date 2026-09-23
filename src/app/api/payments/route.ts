import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';
import { parsePaymentInput } from '@/lib/formInput';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';
import { serializePayment } from './serialize';

/**
 * Estimated tax payments (Form 1040-ES), Form 1040 line 26.
 *
 * Filed under the tax year they were paid FOR, which the body states: the
 * fourth-quarter payment for 2025 is made in January 2026, and an overpayment
 * applied from last year's return counts here too.
 *
 * GET  /api/payments?taxYear=YYYY   { taxYear, payments, total }
 * POST /api/payments                { taxYear, paidOn, amount, note? }
 */

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });

  try {
    const payments = await prisma.estimatedTaxPayment.findMany({
      where: { userId, taxYear: resolved.taxYear },
      orderBy: { paidOn: 'asc' },
    });
    // Summed here, as a Decimal, so the page never adds money itself.
    const total = payments.reduce((sum, p) => sum.plus(p.amount), new Prisma.Decimal(0));
    return NextResponse.json({
      taxYear: resolved.taxYear,
      payments: payments.map(serializePayment),
      total: total.toFixed(2),
      warnings: resolved.warnings,
    });
  } catch (error) {
    console.error('Failed to read estimated payments:', error);
    return NextResponse.json({ error: 'Failed to read estimated payments' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  const resolved = resolveTaxYearFromRequest(request.nextUrl.searchParams.get('taxYear'), body?.taxYear);
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const parsed = parsePaymentInput(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const payment = await prisma.estimatedTaxPayment.create({ data: { userId, taxYear: resolved.taxYear, ...parsed.values } });
    return NextResponse.json(serializePayment(payment), { status: 201 });
  } catch (error) {
    console.error('Failed to save estimated payment:', error);
    return NextResponse.json({ error: 'Failed to save estimated payment' }, { status: 500 });
  }
}
