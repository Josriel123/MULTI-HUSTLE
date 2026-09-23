import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { plaidEnv } from '@/lib/plaid';

/**
 * The banks this user has connected, oldest first (D52), from the database.
 *
 * Replaces the previous approach of trusting `localStorage.plaid_linked_state`,
 * which survived on the device after the connection was gone server-side — the
 * UI claimed "Bank Account Connected" and every sync then 404'd.
 */
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const rows = await prisma.plaidConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, institutionName: true, createdAt: true, cursor: true },
    });
    const connections = rows.map((c) => ({ id: c.id, institutionName: c.institutionName, linkedAt: c.createdAt, hasSynced: Boolean(c.cursor) }));

    return NextResponse.json({
      linked: connections.length > 0,
      linkedAt: connections[0]?.linkedAt ?? null,
      hasSynced: connections.some((c) => c.hasSynced),
      connections,
      /** 'sandbox' means Plaid's test bank, which the bank card says. */
      environment: plaidEnv,
    });
  } catch (error) {
    console.error('Failed to read Plaid connection status:', error);
    return NextResponse.json({ error: 'Failed to read status' }, { status: 500 });
  }
}
