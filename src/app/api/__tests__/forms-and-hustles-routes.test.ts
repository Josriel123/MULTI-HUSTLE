import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

/**
 * The routes added for the tax profile, W-2s, estimated payments and hustles,
 * plus the hustle handling in the transaction and Plaid sync routes. Prisma
 * is mocked; what is checked is what each route asks the database to do.
 */

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/user', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/crypto', () => ({ decryptSecret: (v: string) => v, encryptSecret: (v: string) => v, isEncrypted: () => true }));
vi.mock('@/lib/plaid', () => ({ plaidClient: { transactionsSync: vi.fn() }, describePlaidError: (e: unknown) => String(e) }));
vi.mock('@/lib/prisma', () => {
  const crud = () => ({
    findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn(),
    updateMany: vi.fn(), delete: vi.fn(), deleteMany: vi.fn(),
  });
  return {
    prisma: {
      user: crud(), w2Form: crud(), estimatedTaxPayment: crud(), incomeSource: crud(), transaction: crud(),
      mileageLog: crud(), plaidConnection: crud(),
      $transaction: vi.fn(async (ops: unknown[]) => Promise.all(ops)),
    },
  };
});

import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { plaidClient } from '@/lib/plaid';
import { prisma } from '@/lib/prisma';
import * as profile from '../profile/route';
import * as w2 from '../w2/route';
import * as w2Id from '../w2/[id]/route';
import * as payments from '../payments/route';
import * as paymentId from '../payments/[id]/route';
import * as sourceId from '../sources/[id]/route';
import * as transactionId from '../transactions/[id]/route';
import * as sync from '../plaid/sync/route';

type AuthReturn = Awaited<ReturnType<typeof auth>>;
const USER = 'user_me';
const json = (url: string, method: string, body?: unknown) =>
  new NextRequest(`http://localhost${url}`, { method, body: body === undefined ? undefined : JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const dec = (v: string) => new Prisma.Decimal(v);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: USER } as unknown as AuthReturn);
  vi.mocked(requireUser).mockResolvedValue(USER);
});

describe('/api/profile', () => {
  it('saves the profile and stamps when it was saved, so the default stops being reported as assumed', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ filingStatus: 'head_of_household', claimedAsDependent: false, spouseItemizes: false, taxProfileSavedAt: new Date() } as never);
    const res = await profile.PUT(json('/api/profile', 'PUT', { filingStatus: 'head_of_household', claimedAsDependent: false }));
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.user.update).mock.calls[0][0];
    expect(call.where).toEqual({ id: USER });
    expect(call.data).toMatchObject({ filingStatus: 'head_of_household', claimedAsDependent: false, spouseItemizes: false });
    expect((call.data as { taxProfileSavedAt: unknown }).taxProfileSavedAt).toBeInstanceOf(Date);
    expect((await res.json()).saved).toBe(true);
  });

  it('refuses a bad body without writing', async () => {
    const res = await profile.PUT(json('/api/profile', 'PUT', { filingStatus: 'single', spouseItemizes: true }));
    expect(res.status).toBe(400);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('reports a never-saved profile as not saved', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ filingStatus: 'single', claimedAsDependent: false, spouseItemizes: false, taxProfileSavedAt: null } as never);
    const body = await (await profile.GET()).json();
    expect(body).toEqual({ filingStatus: 'single', claimedAsDependent: false, spouseItemizes: false, saved: false });
  });
});

const W2_ROW = {
  id: 'w2_1', userId: USER, taxYear: 2025, employer: 'Cafe', wages: dec('31000.5'), federalWithheld: dec('0'), socialSecurityWages: dec('31000.5'),
  socialSecurityTips: dec('0'), medicareWages: dec('31000.5'), medicareWithheld: dec('0'), ownedByTaxpayer: true, createdAt: new Date(),
};

describe('/api/w2', () => {
  it('creates a W-2 for the year in the body, storing Decimals and returning strings', async () => {
    vi.mocked(prisma.w2Form.create).mockResolvedValue(W2_ROW as never);
    const res = await w2.POST(json('/api/w2', 'POST', { taxYear: 2025, employer: 'Cafe', wages: '31000.50', socialSecurityWages: '31000.50', medicareWages: '31000.50' }));
    expect(res.status).toBe(201);
    const data = vi.mocked(prisma.w2Form.create).mock.calls[0][0].data as Record<string, unknown>;
    expect(data).toMatchObject({ userId: USER, taxYear: 2025, employer: 'Cafe', ownedByTaxpayer: true });
    expect(data.wages).toBeInstanceOf(Prisma.Decimal);
    expect((await res.json()).wages).toBe('31000.50');
  });

  it('refuses boxes 3 and 7 above the wage base', async () => {
    const res = await w2.POST(json('/api/w2', 'POST', { taxYear: 2025, employer: 'Cafe', wages: '300000', socialSecurityWages: '200000', medicareWages: '300000' }));
    expect(res.status).toBe(400);
    expect(prisma.w2Form.create).not.toHaveBeenCalled();
  });

  it('lists only the requested year', async () => {
    vi.mocked(prisma.w2Form.findMany).mockResolvedValue([W2_ROW] as never);
    const body = await (await w2.GET(json('/api/w2?taxYear=2025', 'GET'))).json();
    expect(vi.mocked(prisma.w2Form.findMany).mock.calls[0][0]!.where).toEqual({ userId: USER, taxYear: 2025 });
    expect(body.forms).toHaveLength(1);
  });

  it('treats another user\'s W-2 as not found, for edit and delete', async () => {
    vi.mocked(prisma.w2Form.findFirst).mockResolvedValue(null);
    expect((await w2Id.PATCH(json('/api/w2/x', 'PATCH', { employer: 'x', wages: '1', socialSecurityWages: '1', medicareWages: '1' }), ctx('x'))).status).toBe(404);
    expect((await w2Id.DELETE(json('/api/w2/x', 'DELETE'), ctx('x'))).status).toBe(404);
    expect(vi.mocked(prisma.w2Form.findFirst).mock.calls[0][0]!.where).toEqual({ id: 'x', userId: USER });
    expect(prisma.w2Form.update).not.toHaveBeenCalled();
    expect(prisma.w2Form.delete).not.toHaveBeenCalled();
  });

  it('validates an edit against the form\'s own year', async () => {
    vi.mocked(prisma.w2Form.findFirst).mockResolvedValue({ ...W2_ROW, taxYear: 2024 } as never);
    // 170,000 is under the 2025 base (176,100) but over 2024's (168,600).
    const res = await w2Id.PATCH(json('/api/w2/w2_1', 'PATCH', { employer: 'Cafe', wages: '170000', socialSecurityWages: '170000', medicareWages: '170000' }), ctx('w2_1'));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain('2024');
  });
});

describe('/api/payments', () => {
  it('records a payment for the year it was made for, whatever the date paid', async () => {
    vi.mocked(prisma.estimatedTaxPayment.create).mockResolvedValue({ id: 'p1', userId: USER, taxYear: 2025, paidOn: new Date('2026-01-15T00:00:00Z'), amount: dec('900'), note: null, createdAt: new Date() } as never);
    const res = await payments.POST(json('/api/payments', 'POST', { taxYear: 2025, paidOn: '2026-01-15', amount: '900' }));
    expect(res.status).toBe(201);
    expect(vi.mocked(prisma.estimatedTaxPayment.create).mock.calls[0][0].data).toMatchObject({ userId: USER, taxYear: 2025 });
    expect(await res.json()).toMatchObject({ paidOn: '2026-01-15', amount: '900.00' });
  });

  it('returns the year\'s total, summed as a Decimal on the server', async () => {
    vi.mocked(prisma.estimatedTaxPayment.findMany).mockResolvedValue([
      { id: 'a', taxYear: 2025, paidOn: new Date('2025-04-15T00:00:00Z'), amount: dec('0.10'), note: null },
      { id: 'b', taxYear: 2025, paidOn: new Date('2025-06-16T00:00:00Z'), amount: dec('0.20'), note: null },
    ] as never);
    const body = await (await payments.GET(json('/api/payments?taxYear=2025', 'GET'))).json();
    expect(body.total).toBe('0.30');
  });

  it('will not delete another user\'s payment', async () => {
    vi.mocked(prisma.estimatedTaxPayment.findFirst).mockResolvedValue(null);
    expect((await paymentId.DELETE(json('/api/payments/p', 'DELETE'), ctx('p'))).status).toBe(404);
    expect(prisma.estimatedTaxPayment.delete).not.toHaveBeenCalled();
  });
});

describe('/api/sources/[id]', () => {
  it('renaming to an existing hustle\'s name merges: rows move, the old hustle goes', async () => {
    vi.mocked(prisma.incomeSource.findFirst)
      .mockResolvedValueOnce({ id: 'old', userId: USER, name: 'Uber 063015 SF**POOL**', type: 'Delivery' } as never) // ownership
      .mockResolvedValueOnce({ id: 'uber', userId: USER, name: 'Uber', type: 'Delivery' } as never); // twin
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 3 } as never);
    vi.mocked(prisma.mileageLog.updateMany).mockResolvedValue({ count: 1 } as never);
    vi.mocked(prisma.incomeSource.delete).mockResolvedValue({} as never);

    const res = await sourceId.PATCH(json('/api/sources/old', 'PATCH', { name: 'uber' }), ctx('old'));
    const body = await res.json();
    expect(body).toMatchObject({ merged: true, into: { id: 'uber', name: 'Uber' }, moved: 3, movedTrips: 1 });
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where: { userId: USER, incomeSourceId: 'old' }, data: { incomeSourceId: 'uber' } });
    expect(prisma.incomeSource.delete).toHaveBeenCalledWith({ where: { id: 'old' } });
    expect(prisma.incomeSource.update).not.toHaveBeenCalled();
  });

  it('a plain rename updates in place', async () => {
    vi.mocked(prisma.incomeSource.findFirst)
      .mockResolvedValueOnce({ id: 's', userId: USER, name: 'Uber', type: 'Delivery' } as never)
      .mockResolvedValueOnce(null);
    vi.mocked(prisma.incomeSource.update).mockResolvedValue({ id: 's', name: 'Uber rides', type: 'Delivery' } as never);
    const body = await (await sourceId.PATCH(json('/api/sources/s', 'PATCH', { name: 'Uber rides' }), ctx('s'))).json();
    expect(body).toEqual({ merged: false, source: { id: 's', name: 'Uber rides', type: 'Delivery' } });
  });

  it('deleting a hustle keeps its transactions, unassigned', async () => {
    vi.mocked(prisma.incomeSource.findFirst).mockResolvedValueOnce({ id: 's', userId: USER } as never);
    vi.mocked(prisma.transaction.updateMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.mileageLog.updateMany).mockResolvedValue({ count: 0 } as never);
    const body = await (await sourceId.DELETE(json('/api/sources/s', 'DELETE'), ctx('s'))).json();
    expect(prisma.transaction.updateMany).toHaveBeenCalledWith({ where: { userId: USER, incomeSourceId: 's' }, data: { incomeSourceId: null } });
    expect(body).toMatchObject({ success: true, unassigned: 2 });
  });
});

describe('PATCH /api/transactions/[id] and hustles', () => {
  const plaidRow = { id: 't1', userId: USER, type: 'Income', amount: dec('45.10'), date: new Date('2025-05-01T00:00:00Z'), plaidTransactionId: 'plaid_1' };

  it('lets a bank-synced deposit be moved to a hustle by name, found ignoring case or created', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(plaidRow as never);
    vi.mocked(prisma.incomeSource.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.incomeSource.create).mockResolvedValue({ id: 'new_hustle', name: 'DoorDash', type: 'Delivery' } as never);
    vi.mocked(prisma.transaction.update).mockResolvedValue({ ...plaidRow, amount: dec('45.10'), incomeSource: null } as never);

    const res = await transactionId.PATCH(json('/api/transactions/t1', 'PATCH', { sourceName: ' DoorDash ', sourceType: 'Delivery' }), ctx('t1'));
    expect(res.status).toBe(200);
    expect(vi.mocked(prisma.incomeSource.findFirst).mock.calls[0][0]!.where).toEqual({ userId: USER, name: { equals: 'DoorDash', mode: 'insensitive' } });
    expect(prisma.incomeSource.create).toHaveBeenCalledWith({ data: { userId: USER, name: 'DoorDash', type: 'Delivery' } });
    expect(vi.mocked(prisma.transaction.update).mock.calls[0][0].data).toMatchObject({ incomeSource: { connect: { id: 'new_hustle' } } });
  });

  it('still refuses to change a bank-synced amount', async () => {
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(plaidRow as never);
    const res = await transactionId.PATCH(json('/api/transactions/t1', 'PATCH', { amount: '99.00', sourceName: 'DoorDash' }), ctx('t1'));
    expect(res.status).toBe(400);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});

describe('Plaid sync and hustles', () => {
  function arrange(txn: Record<string, unknown>, claimed: boolean) {
    vi.mocked(prisma.plaidConnection.findFirst).mockResolvedValue({ id: 'c', accessToken: 'a', cursor: null } as never);
    vi.mocked(plaidClient.transactionsSync).mockResolvedValue({ data: { added: [txn], modified: [], removed: [], has_more: false, next_cursor: 'n' } } as never);
    vi.mocked(prisma.incomeSource.findMany).mockResolvedValue([{ id: 'uber', name: 'Uber' }] as never);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(claimed ? ({ id: 'row' } as never) : null);
    vi.mocked(prisma.transaction.findFirst).mockResolvedValue(null);
  }
  const deposit = { transaction_id: 'p1', amount: -6.33, date: '2025-07-25', name: 'Uber 072515 SF**POOL**' };

  it('files a new deposit under the hustle its description names, and creates no hustles', async () => {
    arrange(deposit, false);
    await sync.POST();
    expect(vi.mocked(prisma.transaction.create).mock.calls[0][0].data).toMatchObject({ incomeSourceId: 'uber', type: 'Income' });
    expect(prisma.incomeSource.create).not.toHaveBeenCalled();
  });

  it('leaves a deposit that names no hustle unassigned', async () => {
    arrange({ ...deposit, name: 'INTRST PYMNT' }, false);
    await sync.POST();
    expect((vi.mocked(prisma.transaction.create).mock.calls[0][0].data as { incomeSourceId?: string }).incomeSourceId).toBeUndefined();
  });

  it('never touches the hustle of a row it already has: that is the user\'s choice now', async () => {
    arrange(deposit, true);
    await sync.POST();
    expect(vi.mocked(prisma.transaction.update).mock.calls[0][0].data).not.toHaveProperty('incomeSourceId');
  });
});
