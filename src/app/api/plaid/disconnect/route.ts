import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { disconnectBanks } from '@/lib/userData';

/**
 * Disconnects a bank: Plaid is told to stop sharing its data (`/item/remove`)
 * and the stored access token is deleted. `{ connectionId }` in the body
 * disconnects that bank only (D52); no body disconnects every bank.
 * Transactions already brought in stay. If Plaid cannot be reached the token
 * is still deleted, so the app can no longer read the bank either way, and
 * the response says the user may also want to revoke access at my.plaid.com.
 */
export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let connectionId: string | undefined;
  const raw = await req.text().catch(() => '');
  if (raw.trim() !== '') {
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'The request body must be JSON.' }, { status: 400 });
    }
    const id = (body as { connectionId?: unknown } | null)?.connectionId;
    if (id !== undefined) {
      if (typeof id !== 'string' || id.trim() === '' || id.length > 64) {
        return NextResponse.json({ error: 'connectionId must be a connection id.' }, { status: 400 });
      }
      connectionId = id;
    }
  }

  try {
    const result = await disconnectBanks(userId, connectionId);
    if (connectionId && result.connectionsRemoved === 0) {
      return NextResponse.json({ error: 'That bank is not connected.' }, { status: 404 });
    }
    if (result.plaidErrors.length > 0) {
      console.error('Plaid item removal failed while disconnecting a bank:', result.plaidErrors);
    }
    return NextResponse.json({
      disconnected: true,
      connectionsRemoved: result.connectionsRemoved,
      revokedAtPlaid: result.plaidErrors.length === 0,
    });
  } catch (error) {
    console.error('Failed to disconnect bank:', error);
    return NextResponse.json({ error: 'Could not disconnect the bank. Try again.' }, { status: 500 });
  }
}
