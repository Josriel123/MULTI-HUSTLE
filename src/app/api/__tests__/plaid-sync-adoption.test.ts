import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/user', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/crypto', () => ({
  decryptSecret: (v: string) => v,
  encryptSecret: (v: string) => v,
  isEncrypted: () => true,
}));
vi.mock('@/lib/plaid', () => ({
  plaidClient: { transactionsSync: vi.fn() },
  describePlaidError: (e: unknown) => String(e),
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    plaidConnection: { findFirst: vi.fn(), update: vi.fn() },
    incomeSource: { findFirst: vi.fn(), create: vi.fn() },
    transaction: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { requireUser } from '@/lib/user';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import { POST } from '../plaid/sync/route';

/**
 * Transactions imported before `plaidTransactionId` existed carry no id to
 * match on. Re-linking a bank resets the cursor, Plaid replays its history,
 * and each of those rows would be inserted a second time. Sync adopts the
 * existing row instead.
 */

const TXN = {
  transaction_id: 'plaid-txn-1',
  amount: 12.0, // positive: money out, an expense
  date: '2026-02-10',
  name: "McDonald's",
};

function arrangeSync() {
  vi.mocked(requireUser).mockResolvedValue('user_test');
  vi.mocked(prisma.plaidConnection.findFirst).mockResolvedValue({
    id: 'conn1', accessToken: 'access-sandbox-x', cursor: 'abc',
  } as never);
  vi.mocked(plaidClient.transactionsSync).mockResolvedValue({
    data: { added: [TXN], modified: [], removed: [], has_more: false, next_cursor: 'def' },
  } as never);
}

describe('Plaid sync adopts pre-plaidTransactionId rows', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arrangeSync();
  });

  it('adopts a matching legacy row instead of creating a duplicate', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null); // not claimed
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 'legacy-row' } as never);

    const res = await POST();
    const json = await res.json();

    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'legacy-row' },
        data: expect.objectContaining({ plaidTransactionId: 'plaid-txn-1' }),
      }),
    );
    expect(json.adopted).toBe(1);
  });

  it('only adopts an unclaimed row belonging to this user', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue({ id: 'legacy-row' } as never);

    await POST();

    expect(prisma.transaction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user_test', plaidTransactionId: null }),
      }),
    );
  });

  it('creates a row when nothing matches', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);

    const res = await POST();
    const json = await res.json();

    expect(prisma.transaction.create).toHaveBeenCalledOnce();
    expect(json.adopted).toBe(0);
    expect(json.count).toBe(1);
  });

  it('updates in place when the row already carries the Plaid id', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({ id: 'claimed-row' } as never);

    const res = await POST();
    const json = await res.json();

    // No adoption lookup is needed once a row is already claimed.
    expect(prisma.transaction.findFirst).not.toHaveBeenCalled();
    expect(prisma.transaction.create).not.toHaveBeenCalled();
    expect(json.adopted).toBe(0);
  });
});
