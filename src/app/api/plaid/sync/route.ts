import { NextResponse } from 'next/server';
import { describePlaidError } from '@/lib/plaid';
import { syncConnection, type ConnectionSyncResult } from '@/lib/plaidSync';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';

/**
 * Syncs every bank the user has connected, one after another (D52). A bank
 * that fails (a changed password, an outage) is reported by name and does not
 * stop the others; the request fails only when none could be synced.
 * `count`, `removed` and `adopted` are totals across banks.
 */
export async function POST() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const connections = await prisma.plaidConnection.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      select: { id: true, accessToken: true, cursor: true, institutionId: true, institutionName: true },
    });

    if (connections.length === 0) {
      return NextResponse.json({ error: 'No Plaid connection found. Please link a bank account first.' }, { status: 404 });
    }

    // A new deposit joins a hustle only when its description names one the
    // user created ("Uber" matches "Uber 072515 SF**POOL**"); otherwise it
    // stays unassigned for the user to choose (D31).
    const hustles = await prisma.incomeSource.findMany({
      where: { userId },
      select: { id: true, name: true },
    });

    const banks: (ConnectionSyncResult & { error?: string })[] = [];
    for (const connection of connections) {
      try {
        banks.push(await syncConnection(userId, connection, hustles));
      } catch (error) {
        console.error(`Error syncing Plaid connection ${connection.id}:`, describePlaidError(error));
        banks.push({
          connectionId: connection.id,
          institutionName: connection.institutionName,
          upserted: 0,
          removed: 0,
          adopted: 0,
          error: 'Could not sync this bank',
        });
      }
    }

    const synced = banks.filter((b) => !b.error);
    if (synced.length === 0) {
      return NextResponse.json({ error: 'Failed to sync transactions', banks }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      count: synced.reduce((n, b) => n + b.upserted, 0),
      removed: synced.reduce((n, b) => n + b.removed, 0),
      adopted: synced.reduce((n, b) => n + b.adopted, 0),
      failed: banks.length - synced.length,
      banks,
    });
  } catch (error) {
    console.error('Error syncing Plaid transactions:', describePlaidError(error));
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}
