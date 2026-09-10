import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

/**
 * Whether this user has a linked bank.
 *
 * Replaces the previous approach of trusting `localStorage.plaid_linked_state`,
 * which survived on the device after the connection was gone server-side — the
 * UI claimed "Bank Account Connected" and every sync then 404'd.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const connection = await prisma.plaidConnection.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true, cursor: true },
    });

    return NextResponse.json({
      linked: connection !== null,
      linkedAt: connection?.createdAt ?? null,
      hasSynced: Boolean(connection?.cursor),
    });
  } catch (error) {
    console.error('Failed to read Plaid connection status:', error);
    return NextResponse.json({ error: 'Failed to read status' }, { status: 500 });
  }
}
