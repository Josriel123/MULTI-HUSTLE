import { NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { agreementStatus } from '@/lib/agreement';
import { prisma } from '@/lib/prisma';
import { deleteUserData } from '@/lib/userData';

/**
 * GET    /api/account  whether the user still has to agree to the Terms (and
 *                      confirm their age) before using the app
 * DELETE /api/account  deletes the account and every row the app holds about
 *                      it, revokes any bank connection, then removes the
 *                      sign-in account at Clerk. Nothing is kept.
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { agreementVersion: true, agreementAcceptedAt: true, adultConfirmedAt: true },
    });
    return NextResponse.json({ agreement: agreementStatus(user) });
  } catch (error) {
    console.error('Failed to read account status:', error);
    return NextResponse.json({ error: 'Failed to read your account' }, { status: 500 });
  }
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // The app's data first: if Clerk then fails, the sign-in account is left
  // with nothing behind it, and the user is told to try again or write in.
  let plaid: Awaited<ReturnType<typeof deleteUserData>>;
  try {
    plaid = await deleteUserData(userId);
  } catch (error) {
    console.error('Failed to delete account data:', error);
    return NextResponse.json({ error: 'Your data could not be deleted. Nothing was removed; please try again.' }, { status: 500 });
  }

  try {
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);
  } catch (error) {
    console.error('Deleted account data but not the Clerk user:', error);
    return NextResponse.json(
      {
        error: 'Your data was deleted, but your sign-in account could not be removed. Try again, or ask us to remove it (see the Privacy Policy).',
        dataDeleted: true,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ deleted: true, bankConnectionsRevoked: plaid.plaidItemsRevoked, bankRevocationErrors: plaid.plaidErrors.length });
}
