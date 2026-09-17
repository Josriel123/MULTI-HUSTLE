import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

/**
 * e2e audit 2026-09-16, F2: `category` is the only input to an expense's tax
 * treatment. These tests hold the API seam to that: a `taxDeductible` value in
 * a request body is ignored, the stored flag is derived from the category, and
 * a category from the wrong side of the ledger (or not in the vocabulary) is
 * rejected instead of stored as a string.
 *
 * Every case here sends a body flag that CONTRADICTS the derived value, so
 * the test cannot pass by coincidence.
 */

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/user', () => ({
  requireUser: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
    },
    incomeSource: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { prisma } from '@/lib/prisma';
import { POST } from '../transactions/route';
import { PATCH } from '../transactions/[id]/route';

type AuthReturn = Awaited<ReturnType<typeof auth>>;
type TxFindReturn = Awaited<ReturnType<typeof prisma.transaction.findUnique>>;
type TxUpdateReturn = Awaited<ReturnType<typeof prisma.transaction.update>>;
type TxCreateReturn = Awaited<ReturnType<typeof prisma.transaction.create>>;

const echoCreate = () =>
  vi.mocked(prisma.transaction.create).mockImplementation((async (args: { data: Record<string, unknown> }) => ({
    id: 'tx_new',
    ...args.data,
    incomeSource: null,
  })) as unknown as typeof prisma.transaction.create);

const echoUpdate = () =>
  vi.mocked(prisma.transaction.update).mockImplementation((async (args: { data: Record<string, unknown> }) => ({
    id: 'tx_1',
    amount: new Prisma.Decimal('10.00'),
    ...args.data,
    incomeSource: null,
  })) as unknown as typeof prisma.transaction.update);

function post(body: unknown) {
  return POST(new Request('http://localhost/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
}

function patch(body: unknown) {
  const req = new NextRequest('http://localhost/api/transactions/tx_1', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return PATCH(req, { params: Promise.resolve({ id: 'tx_1' }) });
}

describe('POST /api/transactions derives taxDeductible from the category', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireUser).mockResolvedValue('user_alice');
    echoCreate();
  });

  it('an expense categorised personal is stored non-deductible even when the body says taxDeductible: true', async () => {
    const res = await post({ amount: '123.45', type: 'Expense', category: 'personal', date: '2026-06-15', taxDeductible: true });
    expect(res.status).toBe(201);
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'personal', taxDeductible: false }) }));
  });

  it('an expense in a Schedule C category is stored deductible even when the body says taxDeductible: false', async () => {
    const res = await post({ amount: '100', type: 'Expense', category: 'supplies', date: '2026-06-15', taxDeductible: false });
    expect(res.status).toBe(201);
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'supplies', taxDeductible: true }) }));
  });

  it('an uncategorised expense is stored with the flag false regardless of the body', async () => {
    const res = await post({ amount: '100', type: 'Expense', date: '2026-06-15', taxDeductible: true });
    expect(res.status).toBe(201);
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: null, taxDeductible: false }) }));
  });

  it('income never carries the flag, whatever the body says', async () => {
    const res = await post({ amount: '5000', type: 'Income', category: 'business_income', date: '2026-06-15', taxDeductible: true });
    expect(res.status).toBe(201);
    expect(prisma.transaction.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ category: 'business_income', taxDeductible: false }) }));
  });

  it('rejects a category that is not in the vocabulary instead of storing the string', async () => {
    const res = await post({ amount: '100', type: 'Expense', category: 'general', date: '2026-06-15' });
    expect(res.status).toBe(400);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });

  it('rejects an income category on an expense', async () => {
    const res = await post({ amount: '100', type: 'Expense', category: 'business_income', date: '2026-06-15' });
    expect(res.status).toBe(400);
    expect(prisma.transaction.create).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/transactions/[id] derives taxDeductible from the category', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user_alice' } as unknown as AuthReturn);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx_1',
      userId: 'user_alice',
      plaidTransactionId: 'plaid_abc',
      type: 'Expense',
      amount: new Prisma.Decimal('10.00'),
      date: new Date('2026-04-10T00:00:00Z'),
      category: 'supplies',
      taxDeductible: true,
    } as unknown as TxFindReturn);
    echoUpdate();
  });

  it('re-categorising to personal clears the flag even when the body says taxDeductible: true', async () => {
    const res = await patch({ category: 'personal', taxDeductible: true });
    expect(res.status).toBe(200);
    expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: { category: 'personal', taxDeductible: false } }));
  });

  it('re-categorising to a Schedule C category sets the flag even when the body says taxDeductible: false', async () => {
    const res = await patch({ category: 'office_expense', taxDeductible: false });
    expect(res.status).toBe(200);
    expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: { category: 'office_expense', taxDeductible: true } }));
  });

  it('clearing the category clears the flag', async () => {
    const res = await patch({ category: null, taxDeductible: true });
    expect(res.status).toBe(200);
    expect(prisma.transaction.update).toHaveBeenCalledWith(expect.objectContaining({ data: { category: null, taxDeductible: false } }));
  });

  it('a body with only taxDeductible changes nothing about the flag', async () => {
    const res = await patch({ taxDeductible: false });
    expect(res.status).toBe(200);
    const call = vi.mocked(prisma.transaction.update).mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data).not.toHaveProperty('taxDeductible');
    expect(call.data).not.toHaveProperty('category');
  });

  it('still rejects a category from the wrong side', async () => {
    const res = await patch({ category: 'business_income' });
    expect(res.status).toBe(400);
    expect(prisma.transaction.update).not.toHaveBeenCalled();
  });
});

// Keep the unused-type lint quiet if the harness types change shape.
export type _Unused = TxUpdateReturn | TxCreateReturn;
