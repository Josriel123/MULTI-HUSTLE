import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/** DELETE /api/payments/[id]. Another user's payment is 404. */
export async function DELETE(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  try {
    const existing = await prisma.estimatedTaxPayment.findFirst({ where: { id, userId } });
    if (!existing) return NextResponse.json({ error: 'Payment not found' }, { status: 404 });
    await prisma.estimatedTaxPayment.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete estimated payment:', error);
    return NextResponse.json({ error: 'Failed to delete estimated payment' }, { status: 500 });
  }
}
