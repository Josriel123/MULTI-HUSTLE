import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { disconnectBanks } from '@/lib/userData';

/**
 * Disconnects the user's bank: Plaid is told to stop sharing the account's
 * data (`/item/remove`) and the stored access tokens are deleted. Transactions
 * already brought in stay. If Plaid cannot be reached the tokens are still
 * deleted, so the app can no longer read the bank either way, and the
 * response says the user may also want to revoke access at my.plaid.com.
 */
export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const result = await disconnectBanks(userId);
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
