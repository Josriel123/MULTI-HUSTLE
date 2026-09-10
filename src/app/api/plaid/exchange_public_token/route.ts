import { NextResponse } from 'next/server';
import { plaidClient, describePlaidError } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';
import { encryptSecret } from '@/lib/crypto';

export async function POST(req: Request) {
  // requireUser (not auth) — this writes a PlaidConnection row, which has a
  // foreign key to User. Previously this failed for anyone who hadn't first
  // created a transaction.
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { public_token } = await req.json();
    if (!public_token || typeof public_token !== 'string') {
      return NextResponse.json({ error: 'public_token is required' }, { status: 400 });
    }

    const exchangeResponse = await plaidClient.itemPublicTokenExchange({ public_token });
    const { access_token: accessToken, item_id: itemId } = exchangeResponse.data;

    // Upsert on itemId so re-linking the same institution updates the existing
    // row instead of accumulating duplicate connections (the old code always
    // created, and `sync` then picked whichever was newest).
    const existing = await prisma.plaidConnection.findFirst({
      where: { userId, itemId },
      select: { id: true },
    });

    if (existing) {
      await prisma.plaidConnection.update({
        where: { id: existing.id },
        // Cursor is reset: a new access token starts a fresh sync stream.
        data: { accessToken: encryptSecret(accessToken), cursor: null },
      });
    } else {
      await prisma.plaidConnection.create({
        data: { userId, accessToken: encryptSecret(accessToken), itemId },
      });
    }

    return NextResponse.json({ success: true, message: 'Bank linked successfully!' });
  } catch (error) {
    console.error('Error exchanging public token:', describePlaidError(error));
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
