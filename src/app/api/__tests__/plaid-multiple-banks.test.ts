import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Several banks per user (D52): every connection syncs, one failing bank
 * does not stop the others, the same bank cannot be connected twice, and the
 * status lists each bank.
 */

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/user', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ decryptSecret: (v: string) => v, encryptSecret: (v: string) => `enc:${v}`, isEncrypted: () => true }));
vi.mock('@/lib/plaid', () => ({
  plaidClient: { transactionsSync: vi.fn(), itemGet: vi.fn(), itemRemove: vi.fn(), itemPublicTokenExchange: vi.fn() },
  describePlaidError: (e: unknown) => String(e),
  plaidEnv: 'sandbox',
}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    plaidConnection: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn() },
    incomeSource: { findMany: vi.fn().mockResolvedValue([]) },
    transaction: { findUnique: vi.fn(), findFirst: vi.fn(), update: vi.fn(), create: vi.fn(), deleteMany: vi.fn() },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import { POST as sync } from '../plaid/sync/route';
import { POST as exchangeRoute } from '../plaid/exchange_public_token/route';
import { GET as status } from '../plaid/status/route';

type AuthReturn = Awaited<ReturnType<typeof auth>>;
const exchange = () =>
  exchangeRoute(new Request('http://localhost/api/plaid/exchange_public_token', { method: 'POST', body: JSON.stringify({ public_token: 'public-x' }) }));

const CHASE = { id: 'c_chase', accessToken: 'tok_chase', cursor: 'a', institutionId: 'ins_chase', institutionName: 'Chase' };
const CHIME = { id: 'c_chime', accessToken: 'tok_chime', cursor: null, institutionId: 'ins_chime', institutionName: 'Chime' };
const page = (added: unknown[]) => ({ data: { added, modified: [], removed: [], has_more: false, next_cursor: 'next' } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(requireUser).mockResolvedValue('user_me');
  vi.mocked(auth).mockResolvedValue({ userId: 'user_me' } as unknown as AuthReturn);
  vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);
  vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
  vi.mocked(prisma.incomeSource.findMany).mockResolvedValue([]);
});

describe('POST /api/plaid/sync with several banks', () => {
  it('syncs every connected bank and adds up what came in', async () => {
    vi.mocked(prisma.plaidConnection.findMany).mockResolvedValue([CHASE, CHIME] as never);
    vi.mocked(plaidClient.transactionsSync)
      .mockResolvedValueOnce(page([{ transaction_id: 'x1', amount: -100, date: '2026-03-01', name: 'Payout', account_id: 'acc_chase' }]) as never)
      .mockResolvedValueOnce(page([{ transaction_id: 'x2', amount: 20, date: '2026-03-02', name: 'Gas', account_id: 'acc_chime' }]) as never);
    const body = await (await sync()).json();
    expect(plaidClient.transactionsSync).toHaveBeenCalledWith({ access_token: 'tok_chase', cursor: 'a' });
    expect(plaidClient.transactionsSync).toHaveBeenCalledWith({ access_token: 'tok_chime', cursor: undefined });
    expect(body).toMatchObject({ success: true, count: 2, failed: 0 });
    expect(body.banks.map((b: { institutionName: string }) => b.institutionName)).toEqual(['Chase', 'Chime']);
  });

  it('keeps going when one bank fails, and names the one that did', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(prisma.plaidConnection.findMany).mockResolvedValue([CHASE, CHIME] as never);
    vi.mocked(plaidClient.transactionsSync)
      .mockRejectedValueOnce(new Error('ITEM_LOGIN_REQUIRED'))
      .mockResolvedValueOnce(page([{ transaction_id: 'x2', amount: 20, date: '2026-03-02', name: 'Gas', account_id: 'acc_chime' }]) as never);
    const res = await sync();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ count: 1, failed: 1 });
    expect(body.banks[0]).toMatchObject({ institutionName: 'Chase', error: expect.any(String) });
    // The failed bank's cursor is not moved, so nothing is skipped next time.
    expect(prisma.plaidConnection.update).not.toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'c_chase' } }));
  });

  it('fails only when no bank could be synced', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(prisma.plaidConnection.findMany).mockResolvedValue([CHASE] as never);
    vi.mocked(plaidClient.transactionsSync).mockRejectedValue(new Error('down'));
    expect((await sync()).status).toBe(500);
  });

  it("stores which account each row is in and Plaid's category for it", async () => {
    vi.mocked(prisma.plaidConnection.findMany).mockResolvedValue([CHASE] as never);
    vi.mocked(plaidClient.transactionsSync).mockResolvedValue(
      page([{ transaction_id: 'x1', amount: -500, date: '2026-03-01', name: 'Transfer from savings', account_id: 'acc_1', personal_finance_category: { primary: 'TRANSFER_IN', detailed: 'TRANSFER_IN_ACCOUNT_TRANSFER' } }]) as never,
    );
    await sync();
    const data = vi.mocked(prisma.transaction.create).mock.calls[0][0].data;
    expect(data).toMatchObject({ plaidAccountId: 'acc_1', plaidCategory: 'TRANSFER_IN' });
    // Plaid's label is kept as a fact; it never becomes the row's category.
    expect(data).not.toHaveProperty('category');
  });

  it('learns the bank of a connection made before banks were recorded', async () => {
    vi.mocked(prisma.plaidConnection.findMany).mockResolvedValue([{ ...CHASE, institutionId: null, institutionName: null }] as never);
    vi.mocked(plaidClient.itemGet).mockResolvedValue({ data: { item: { institution_id: 'ins_chase', institution_name: 'Chase' } } } as never);
    vi.mocked(plaidClient.transactionsSync).mockResolvedValue(page([]) as never);
    const body = await (await sync()).json();
    expect(prisma.plaidConnection.update).toHaveBeenCalledWith({ where: { id: 'c_chase' }, data: { institutionId: 'ins_chase', institutionName: 'Chase' } });
    expect(body.banks[0].institutionName).toBe('Chase');
  });
});

describe('POST /api/plaid/exchange_public_token', () => {
  beforeEach(() => {
    vi.mocked(plaidClient.itemPublicTokenExchange).mockResolvedValue({ data: { access_token: 'tok_new', item_id: 'item_new' } } as never);
  });

  it('records which bank a new connection is, from Plaid', async () => {
    vi.mocked(plaidClient.itemGet).mockResolvedValue({ data: { item: { institution_id: 'ins_chime', institution_name: 'Chime' } } } as never);
    vi.mocked(prisma.plaidConnection.findFirst).mockResolvedValue(null);
    const res = await exchange();
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.plaidConnection.create).mock.calls[0][0].data).toMatchObject({
      userId: 'user_me',
      itemId: 'item_new',
      institutionId: 'ins_chime',
      institutionName: 'Chime',
      accessToken: 'enc:tok_new',
    });
  });

  it('refuses the same bank twice, and removes the new connection at Plaid', async () => {
    vi.mocked(plaidClient.itemGet).mockResolvedValue({ data: { item: { institution_id: 'ins_chase', institution_name: 'Chase' } } } as never);
    vi.mocked(prisma.plaidConnection.findFirst).mockResolvedValueOnce({ id: 'c_chase' } as never);
    vi.mocked(plaidClient.itemRemove).mockResolvedValue({} as never);
    const res = await exchange();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('already_connected');
    expect(plaidClient.itemRemove).toHaveBeenCalledWith({ access_token: 'tok_new' });
    expect(prisma.plaidConnection.create).not.toHaveBeenCalled();
  });
});

describe('GET /api/plaid/status', () => {
  it('lists each connected bank, oldest first', async () => {
    const at = new Date('2026-03-01T00:00:00Z');
    vi.mocked(prisma.plaidConnection.findMany).mockResolvedValue([
      { id: 'c_chase', institutionName: 'Chase', createdAt: at, cursor: 'a' },
      { id: 'c_chime', institutionName: null, createdAt: at, cursor: null },
    ] as never);
    const body = await (await status()).json();
    expect(body.linked).toBe(true);
    expect(body.hasSynced).toBe(true);
    expect(body.connections).toEqual([
      { id: 'c_chase', institutionName: 'Chase', linkedAt: at.toISOString(), hasSynced: true },
      { id: 'c_chime', institutionName: null, linkedAt: at.toISOString(), hasSynced: false },
    ]);
  });
});
