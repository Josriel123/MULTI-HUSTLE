import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '@prisma/client';

/**
 * Deleting and exporting a user's data. Every relation is ON DELETE RESTRICT,
 * so one table left out of the deletion makes the whole deletion fail
 * (MileageLog once was); and a table left out of the export is data the user
 * asked for and did not get. Both lists are checked against schema.prisma.
 */

const calls: string[] = [];

vi.mock('@/lib/prisma', () => {
  // Inside the factory: vi.mock is hoisted above every top-level declaration.
  const NAMES = [
    'transaction', 'mileageLog', 'incomeSource', 'plaidConnection', 'form1098T', 'form1098E',
    'homeOfficeDeduction', 'w2Form', 'estimatedTaxPayment', 'user',
  ];
  const model = (name: string) => ({
    deleteMany: vi.fn(() => {
      calls.push(`delete:${name}`);
      return { model: name };
    }),
    findMany: vi.fn(async () => {
      calls.push(`read:${name}`);
      return [];
    }),
    findUnique: vi.fn(async () => {
      calls.push(`read:${name}`);
      return null;
    }),
  });
  const prisma: Record<string, unknown> = Object.fromEntries(NAMES.map((n) => [n, model(n)]));
  prisma.$transaction = vi.fn(async (ops: unknown[]) => ops);
  return { prisma };
});
vi.mock('@/lib/plaid', () => ({ plaidClient: { itemRemove: vi.fn() }, describePlaidError: (e: unknown) => String(e) }));
vi.mock('@/lib/crypto', () => ({ decryptSecret: (v: string) => `plain:${v}` }));

import { prisma } from '@/lib/prisma';
import { plaidClient } from '@/lib/plaid';
import { deleteUserData, disconnectBanks, exportUserData } from '../userData';

type Mocked = Record<string, { findMany: ReturnType<typeof vi.fn>; findUnique: ReturnType<typeof vi.fn> }>;

/** Prisma client property names of every model with a `userId` column. */
function modelsOwnedByUser(): string[] {
  const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
  const owned: string[] = [];
  for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    if (/^\s+userId\s+String/m.test(match[2])) owned.push(match[1][0].toLowerCase() + match[1].slice(1));
  }
  return owned;
}

beforeEach(() => {
  calls.length = 0;
  vi.clearAllMocks();
  (prisma as unknown as Mocked).plaidConnection.findMany.mockResolvedValue([]);
});

describe('deleteUserData', () => {
  it('deletes from every table that has a userId, then the user, in one transaction', async () => {
    await deleteUserData('user_gone');
    const deleted = calls.filter((c) => c.startsWith('delete:')).map((c) => c.slice(7));
    const owned = modelsOwnedByUser();
    expect(owned.length).toBeGreaterThanOrEqual(9);
    expect([...deleted].sort()).toEqual([...owned, 'user'].sort());
    expect(deleted.at(-1)).toBe('user');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('deletes rows that point at an income source before the income sources', async () => {
    await deleteUserData('user_gone');
    const order = calls.filter((c) => c.startsWith('delete:'));
    expect(order.indexOf('delete:transaction')).toBeLessThan(order.indexOf('delete:incomeSource'));
    expect(order.indexOf('delete:mileageLog')).toBeLessThan(order.indexOf('delete:incomeSource'));
  });

  it('revokes each bank connection at Plaid before deleting the token', async () => {
    (prisma as unknown as Mocked).plaidConnection.findMany.mockResolvedValue([{ accessToken: 'enc_a' }, { accessToken: 'enc_b' }]);
    const result = await deleteUserData('user_gone');
    expect(plaidClient.itemRemove).toHaveBeenCalledTimes(2);
    expect(plaidClient.itemRemove).toHaveBeenCalledWith({ access_token: 'plain:enc_a' });
    expect(result).toEqual({ plaidItemsRevoked: 2, plaidErrors: [] });
  });

  it('still deletes everything when Plaid cannot be reached, and says so', async () => {
    (prisma as unknown as Mocked).plaidConnection.findMany.mockResolvedValue([{ accessToken: 'enc_a' }]);
    vi.mocked(plaidClient.itemRemove).mockRejectedValueOnce(new Error('ITEM_NOT_FOUND'));
    const result = await deleteUserData('user_gone');
    expect(result.plaidItemsRevoked).toBe(0);
    expect(result.plaidErrors).toHaveLength(1);
    expect(calls).toContain('delete:user');
  });
});

describe('disconnectBanks', () => {
  it('revokes each connection at Plaid, then deletes only the connections', async () => {
    const m = prisma as unknown as Record<string, { findMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> }>;
    m.plaidConnection.findMany.mockResolvedValue([{ accessToken: 'enc_a' }, { accessToken: 'enc_b' }]);
    m.plaidConnection.deleteMany.mockImplementationOnce(() => (calls.push('delete:plaidConnection'), { count: 2 }));
    const result = await disconnectBanks('user_me');
    expect(plaidClient.itemRemove).toHaveBeenCalledWith({ access_token: 'plain:enc_b' });
    expect(m.plaidConnection.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user_me' } });
    // The transactions already brought in are the user's records: they stay.
    expect(calls.filter((c) => c.startsWith('delete:'))).toEqual(['delete:plaidConnection']);
    expect(result).toEqual({ plaidItemsRevoked: 2, plaidErrors: [], connectionsRemoved: 2 });
  });

  it('forgets the token even when Plaid cannot be reached, and says so', async () => {
    const m = prisma as unknown as Record<string, { findMany: ReturnType<typeof vi.fn>; deleteMany: ReturnType<typeof vi.fn> }>;
    m.plaidConnection.findMany.mockResolvedValue([{ accessToken: 'enc_a' }]);
    m.plaidConnection.deleteMany.mockImplementationOnce(() => (calls.push('delete:plaidConnection'), { count: 1 }));
    vi.mocked(plaidClient.itemRemove).mockRejectedValueOnce(new Error('INTERNAL_SERVER_ERROR'));
    const result = await disconnectBanks('user_me');
    expect(result.plaidErrors).toHaveLength(1);
    expect(result.connectionsRemoved).toBe(1);
    expect(calls).toContain('delete:plaidConnection');
  });
});

describe('exportUserData', () => {
  it('reads every table that has a userId', async () => {
    await exportUserData('user_me');
    const m = prisma as unknown as Mocked;
    for (const model of modelsOwnedByUser()) expect(m[model].findMany.mock.calls.length, model).toBeGreaterThan(0);
    expect(m.user.findUnique).toHaveBeenCalledWith({ where: { id: 'user_me' } });
  });

  it('never includes the Plaid access token, and writes money as exact strings', async () => {
    const m = prisma as unknown as Mocked;
    m.plaidConnection.findMany.mockResolvedValue([{ id: 'c1', itemId: 'item_1', createdAt: new Date('2026-01-02T00:00:00Z') }]);
    m.transaction.findMany.mockResolvedValue([{ id: 't1', amount: new Prisma.Decimal('0.30'), date: new Date('2026-03-04T00:00:00Z') }]);
    const out = await exportUserData('user_me');
    // The query selects only safe columns, so a token could not come back even by mistake.
    const select = m.plaidConnection.findMany.mock.calls[0][0].select;
    expect(select).toEqual({ id: true, itemId: true, institutionName: true, createdAt: true });
    expect(JSON.stringify(out)).not.toMatch(/accessToken/);
    expect(out.transactions).toEqual([{ id: 't1', amount: '0.3', date: '2026-03-04T00:00:00.000Z' }]);
  });
});
