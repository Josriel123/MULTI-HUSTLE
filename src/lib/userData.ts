import type { Prisma } from '@prisma/client';
import { decryptSecret } from './crypto';
import { describePlaidError, plaidClient } from './plaid';
import { prisma } from './prisma';

/**
 * Everything the app holds about one user: erased by `deleteUserData`,
 * copied out by `exportUserData`. Both routes that delete an account (the
 * in-app "Delete my account" and the Clerk user.deleted webhook) call the same
 * function, so a table cannot be deleted by one and forgotten by the other.
 * src/lib/__tests__/user-data.test.ts reads schema.prisma and fails if a model
 * with a userId is missing here (MileageLog once was, and every account
 * deletion failed on its foreign key).
 */

/**
 * Tells Plaid to stop accessing each bank the user connected (Plaid's
 * `/item/remove`). Best effort: a bank that cannot be reached must never keep
 * the user's data, or the access token, on file. Failures are returned so the
 * caller can say so; the caller deletes the rows regardless.
 */
async function revokePlaidItems(userId: string): Promise<{ plaidItemsRevoked: number; plaidErrors: string[] }> {
  const connections = await prisma.plaidConnection.findMany({ where: { userId }, select: { accessToken: true } });
  let plaidItemsRevoked = 0;
  const plaidErrors: string[] = [];
  for (const connection of connections) {
    try {
      await plaidClient.itemRemove({ access_token: decryptSecret(connection.accessToken) });
      plaidItemsRevoked++;
    } catch (error) {
      plaidErrors.push(describePlaidError(error));
    }
  }
  return { plaidItemsRevoked, plaidErrors };
}

/**
 * "Disconnect bank": revoke each connection at Plaid, then forget the access
 * tokens. The transactions already brought in are the user's records and
 * stay; they can delete them like any other row.
 */
export async function disconnectBanks(
  userId: string,
): Promise<{ plaidItemsRevoked: number; plaidErrors: string[]; connectionsRemoved: number }> {
  const revoked = await revokePlaidItems(userId);
  const { count } = await prisma.plaidConnection.deleteMany({ where: { userId } });
  return { ...revoked, connectionsRemoved: count };
}

/**
 * Revokes the user's bank connections at Plaid (see `revokePlaidItems`), then
 * deletes every row, children first: every relation is ON DELETE RESTRICT,
 * and transactions and trips point at income sources.
 */
export async function deleteUserData(userId: string): Promise<{ plaidItemsRevoked: number; plaidErrors: string[] }> {
  const { plaidItemsRevoked, plaidErrors } = await revokePlaidItems(userId);

  await prisma.$transaction([
    prisma.transaction.deleteMany({ where: { userId } }),
    prisma.mileageLog.deleteMany({ where: { userId } }),
    prisma.incomeSource.deleteMany({ where: { userId } }),
    prisma.plaidConnection.deleteMany({ where: { userId } }),
    prisma.form1098T.deleteMany({ where: { userId } }),
    prisma.form1098E.deleteMany({ where: { userId } }),
    prisma.homeOfficeDeduction.deleteMany({ where: { userId } }),
    prisma.w2Form.deleteMany({ where: { userId } }),
    prisma.estimatedTaxPayment.deleteMany({ where: { userId } }),
    prisma.user.deleteMany({ where: { id: userId } }),
  ]);

  return { plaidItemsRevoked, plaidErrors };
}

/** JSON-safe copy of a row: Decimals become strings, Dates ISO strings. */
function plain(value: unknown): unknown {
  if (value === null || value === undefined) return value ?? null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && value !== null && 'toFixed' in value && typeof (value as Prisma.Decimal).toFixed === 'function') {
    return (value as Prisma.Decimal).toString();
  }
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, plain(v)]));
  return value;
}

/**
 * A complete copy of what the app stores for the user, for the right to
 * access and to take your data elsewhere (CCPA "right to know", GDPR Art. 15
 * and 20). The one thing withheld is the Plaid access token: it is a
 * credential, not information about the user, and the export file will sit in
 * a downloads folder.
 */
export async function exportUserData(userId: string) {
  const [user, incomeSources, transactions, mileageLogs, w2Forms, estimatedPayments, form1098T, form1098E, homeOffice, plaidConnections] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId } }),
    prisma.incomeSource.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    prisma.transaction.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.mileageLog.findMany({ where: { userId }, orderBy: { date: 'asc' } }),
    prisma.w2Form.findMany({ where: { userId }, orderBy: [{ taxYear: 'asc' }, { createdAt: 'asc' }] }),
    prisma.estimatedTaxPayment.findMany({ where: { userId }, orderBy: { paidOn: 'asc' } }),
    prisma.form1098T.findMany({ where: { userId }, orderBy: { taxYear: 'asc' } }),
    prisma.form1098E.findMany({ where: { userId }, orderBy: { taxYear: 'asc' } }),
    prisma.homeOfficeDeduction.findMany({ where: { userId }, orderBy: { taxYear: 'asc' } }),
    prisma.plaidConnection.findMany({ where: { userId }, select: { id: true, itemId: true, createdAt: true } }),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    about:
      'Everything Multi-Hustle stores about your account. Amounts are exact decimal strings. The bank access token is left out on purpose: it is a credential, not information about you. Your sign-in details are held by Clerk.',
    account: plain(user),
    hustles: plain(incomeSources),
    transactions: plain(transactions),
    mileageLogs: plain(mileageLogs),
    w2Forms: plain(w2Forms),
    estimatedTaxPayments: plain(estimatedPayments),
    form1098T: plain(form1098T),
    form1098E: plain(form1098E),
    homeOffice: plain(homeOffice),
    bankConnections: plain(plaidConnections),
  };
}
