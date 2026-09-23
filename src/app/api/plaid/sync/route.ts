import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { RemovedTransaction, Transaction as PlaidTransaction } from 'plaid';
import { plaidClient, describePlaidError } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';
import { decryptSecret, encryptSecret, isEncrypted } from '@/lib/crypto';

export async function POST() {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const connection = await prisma.plaidConnection.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!connection) {
      return NextResponse.json(
        { error: 'No Plaid connection found. Please link a bank account first.' },
        { status: 404 }
      );
    }

    const accessToken = decryptSecret(connection.accessToken);

    // Upgrade any token stored before encryption existed.
    if (!isEncrypted(connection.accessToken)) {
      await prisma.plaidConnection.update({
        where: { id: connection.id },
        data: { accessToken: encryptSecret(accessToken) },
      });
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

    // Cache income sources so we don't re-query per transaction.
    const sourceCache = new Map<string, string>();
    // `owner` is passed rather than closed over: TypeScript drops the
    // non-null narrowing of `userId` inside a nested function body.
    async function resolveSourceId(owner: string, name: string): Promise<string> {
      const cached = sourceCache.get(name);
      if (cached) return cached;

      let source = await prisma.incomeSource.findFirst({
        where: { userId: owner, name },
        select: { id: true },
      });
      source ??= await prisma.incomeSource.create({
        data: { userId: owner, name, type: 'Delivery' },
        select: { id: true },
      });
      sourceCache.set(name, source.id);
      return source.id;
    }

    let upserted = 0;
    /** Pre-plaidTransactionId rows reclaimed rather than duplicated. */
    let adopted = 0;

    for (const txn of [...added, ...modified]) {
      // Plaid sign convention: negative amount means money INTO the account.
      const isIncome = txn.amount < 0;
      const sourceId = isIncome
        ? await resolveSourceId(userId, txn.name || 'Unknown Bank Deposit')
        : undefined;

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
        incomeSourceId: sourceId,
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
          // Defaults to false. The previous heuristic marked anything in
          // "Food and Drink" or "Shops" as tax-deductible, which flags
          // groceries as a business expense and understates tax owed.
          // Real categorisation lands with the tax engine (Phase 2); until
          // then the user marks deductions explicitly in /deductions.
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

    return NextResponse.json({
      success: true,
      count: upserted,
      removed: removed.length,
      adopted,
    });
  } catch (error) {
    console.error('Error syncing Plaid transactions:', describePlaidError(error));
    return NextResponse.json({ error: 'Failed to sync transactions' }, { status: 500 });
  }
}
