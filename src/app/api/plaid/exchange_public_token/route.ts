import { NextResponse } from 'next/server';
import { plaidClient, describePlaidError } from '@/lib/plaid';
import { institutionOf } from '@/lib/plaidSync';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';
import { encryptSecret } from '@/lib/crypto';

/**
 * Finishes connecting a bank: swaps Link's public token for an access token,
 * learns from Plaid which bank it is, and stores the connection. A user may
 * connect several banks (D52), but not the same bank twice: a second Item for
 * a bank already connected would bring its whole history in again as new
 * rows, and count that income twice. The new Item is then removed at Plaid
 * straight away, so nothing is left sharing data.
 */
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

    // From Plaid, never from the browser. Best effort: without it the
    // connection still works, it just cannot be checked for a twin.
    let institution: { id: string | null; name: string | null } = { id: null, name: null };
    try {
      institution = await institutionOf(accessToken);
    } catch (error) {
      console.error('Could not read the institution of a new Plaid item:', describePlaidError(error));
    }

    if (institution.id) {
      const twin = await prisma.plaidConnection.findFirst({
        where: { userId, institutionId: institution.id, NOT: { itemId } },
        select: { id: true },
      });
      if (twin) {
        await plaidClient.itemRemove({ access_token: accessToken }).catch((error) => {
          console.error('Could not remove a duplicate Plaid item:', describePlaidError(error));
        });
        return NextResponse.json(
          {
            error: `${institution.name ?? 'That bank'} is already connected. Sync it to bring in new transactions; every account you shared there comes in together.`,
            code: 'already_connected',
          },
          { status: 409 },
        );
      }
    }

    // Upsert on itemId so re-linking the same Item updates the existing row
    // instead of accumulating duplicate connections.
    const existing = await prisma.plaidConnection.findFirst({
      where: { userId, itemId },
      select: { id: true },
    });

    const bank = { institutionId: institution.id, institutionName: institution.name };
    if (existing) {
      await prisma.plaidConnection.update({
        where: { id: existing.id },
        // Cursor is reset: a new access token starts a fresh sync stream.
        data: { accessToken: encryptSecret(accessToken), cursor: null, ...bank },
      });
    } else {
      await prisma.plaidConnection.create({
        data: { userId, accessToken: encryptSecret(accessToken), itemId, ...bank },
      });
    }

    return NextResponse.json({ success: true, institutionName: institution.name, message: 'Bank linked successfully!' });
  } catch (error) {
    console.error('Error exchanging public token:', describePlaidError(error));
    return NextResponse.json({ error: 'Failed to exchange token' }, { status: 500 });
  }
}
