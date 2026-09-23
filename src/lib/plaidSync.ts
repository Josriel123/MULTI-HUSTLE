import { Prisma } from '@prisma/client';
import type { RemovedTransaction, Transaction as PlaidTransaction } from 'plaid';
import { decryptSecret, encryptSecret, isEncrypted } from './crypto';
import { matchHustle } from './hustles';
import { plaidClient } from './plaid';
import { prisma } from './prisma';

/** A PlaidConnection row, as sync needs it. */
export interface SyncableConnection {
  id: string;
  accessToken: string;
  cursor: string | null;
  institutionId: string | null;
  institutionName: string | null;
}

export interface ConnectionSyncResult {
  connectionId: string;
  institutionName: string | null;
  /** Rows created or updated, adopted ones included. */
  upserted: number;
  removed: number;
  /** Pre-plaidTransactionId rows reclaimed rather than duplicated (D22). */
  adopted: number;
}

/**
 * Which bank an Item belongs to, from Plaid itself (/item/get), never from the
 * browser. Null when Plaid does not say.
 */
export async function institutionOf(accessToken: string): Promise<{ id: string | null; name: string | null }> {
  const { data } = await plaidClient.itemGet({ access_token: accessToken });
  return { id: data.item.institution_id ?? null, name: data.item.institution_name ?? null };
}

/**
 * Brings one bank connection up to date: every added, modified and removed
 * transaction since its cursor, for every account the person shared.
 *
 * Moved out of the sync route when a user could connect several banks (D52);
 * the behaviour for one connection is unchanged.
 */
export async function syncConnection(
  userId: string,
  connection: SyncableConnection,
  hustles: readonly { id: string; name: string }[],
): Promise<ConnectionSyncResult> {
  const accessToken = decryptSecret(connection.accessToken);

  // Upgrade any token stored before encryption existed.
  if (!isEncrypted(connection.accessToken)) {
    await prisma.plaidConnection.update({
      where: { id: connection.id },
      data: { accessToken: encryptSecret(accessToken) },
    });
  }

  // Connections made before banks were recorded learn theirs now, so the
  // "same bank twice" check and the bank list cover them too. Best effort.
  let institutionName = connection.institutionName;
  if (!connection.institutionId) {
    try {
      const institution = await institutionOf(accessToken);
      if (institution.id) {
        await prisma.plaidConnection.update({
          where: { id: connection.id },
          data: { institutionId: institution.id, institutionName: institution.name },
        });
        institutionName = institution.name;
      }
    } catch {
      // The list shows "Your bank" until a later sync succeeds.
    }
  }

  let cursor = connection.cursor ?? undefined;
  const added: PlaidTransaction[] = [];
  const modified: PlaidTransaction[] = [];
  const removed: RemovedTransaction[] = [];
  let hasMore = true;

  while (hasMore) {
    const { data } = await plaidClient.transactionsSync({
      access_token: accessToken,
      cursor,
    });
    // `modified` and `removed` were previously discarded, so edited or
    // reversed transactions never updated locally.
    added.push(...data.added);
    modified.push(...data.modified);
    removed.push(...data.removed);
    hasMore = data.has_more;
    cursor = data.next_cursor;
  }

  let upserted = 0;
  let adopted = 0;

  for (const txn of [...added, ...modified]) {
    // Plaid sign convention: negative amount means money INTO the account.
    const isIncome = txn.amount < 0;

    const fields = {
      userId,
      // A Decimal built from exactly two decimals, never Plaid's raw JS
      // number. Writes were fine either way — the DECIMAL(12,2) column
      // rounds on insert — but the adoption lookup below compares for
      // equality, where nothing rounds. Checked read-only against the 15
      // legacy bank rows on 2026-09-23: as a JS number the lookup found
      // only 12; all three SparkFun rows at $89.40 silently missed, and
      // would have been duplicated instead of adopted. From a toFixed(2)
      // string it found all 15.
      amount: new Prisma.Decimal(Math.abs(txn.amount).toFixed(2)),
      type: isIncome ? 'Income' : 'Expense',
      date: new Date(txn.date),
      description: txn.name || 'Bank Transaction',
      // Facts from the bank, not choices, so a re-sync may refresh them. Used
      // only to suggest "a transfer between your accounts" (src/lib/transfers.ts).
      plaidAccountId: txn.account_id ?? null,
      plaidCategory: txn.personal_finance_category?.primary ?? null,
    };

    // Keyed on Plaid's transaction_id, so a repeated sync updates in place.
    // Without this the old code re-inserted every row on every sync.
    // `taxDeductible` is deliberately only set on create: it's a user
    // decision, and re-syncing must not silently undo it.
    const claimed = await prisma.transaction.findUnique({
      where: { plaidTransactionId: txn.transaction_id },
      select: { id: true },
    });

    if (claimed) {
      await prisma.transaction.update({ where: { id: claimed.id }, data: fields });
      upserted++;
      continue;
    }

    // Rows imported before plaidTransactionId existed carry no id to match
    // on. Re-linking a bank resets the cursor, Plaid replays its history,
    // and every one of those rows would otherwise be inserted a second
    // time. Adopt the existing row instead of creating a duplicate.
    //
    // The natural key is deliberately strict — same owner, date, signed
    // amount and description. A manual row that matches a bank row on all
    // four is a duplicate of it in every sense that matters here, so
    // adopting it is the right outcome rather than a risk.
    const adoptable = await prisma.transaction.findFirst({
      where: {
        userId,
        plaidTransactionId: null,
        date: fields.date,
        amount: fields.amount,
        type: fields.type,
        description: fields.description,
      },
      select: { id: true },
    });

    if (adoptable) {
      await prisma.transaction.update({
        where: { id: adoptable.id },
        // Keeps whatever category the user had already applied to it.
        data: { ...fields, plaidTransactionId: txn.transaction_id },
      });
      adopted++;
      upserted++;
      continue;
    }

    await prisma.transaction.create({
      data: {
        ...fields,
        plaidTransactionId: txn.transaction_id,
        // Only on create: after that the hustle is the user's to change.
        incomeSourceId: isIncome ? matchHustle(txn.name, hustles)?.id : undefined,
        // Defaults to false. The previous heuristic marked anything in
        // "Food and Drink" or "Shops" as tax-deductible, which flags
        // groceries as a business expense and understates tax owed.
        // The user categorises each row on /transactions.
        taxDeductible: false,
      },
    });
    upserted++;
  }

  if (removed.length > 0) {
    await prisma.transaction.deleteMany({
      where: {
        userId,
        plaidTransactionId: { in: removed.map((r) => r.transaction_id) },
      },
    });
  }

  // Cursor is saved only after the writes succeed. The old code saved it
  // first, so a failure part-way through advanced the cursor past
  // transactions that were never stored — losing them permanently.
  await prisma.plaidConnection.update({
    where: { id: connection.id },
    data: { cursor },
  });

  return { connectionId: connection.id, institutionName, upserted, removed: removed.length, adopted };
}
