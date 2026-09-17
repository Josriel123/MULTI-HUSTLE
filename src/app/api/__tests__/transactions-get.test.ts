import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
    },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { GET } from '../transactions/route';

type AuthReturn = Awaited<ReturnType<typeof auth>>;

describe('GET /api/transactions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user_test' } as unknown as AuthReturn);
  });

  it('rejects unauthenticated requests with 401', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as AuthReturn);
    const req = new NextRequest('http://localhost/api/transactions?taxYear=2025');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('rejects unsupported tax year with 400', async () => {
    const req = new NextRequest('http://localhost/api/transactions?taxYear=1999');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/taxYear must be one of/);
    expect(prisma.transaction.findMany).not.toHaveBeenCalled();
  });

  it('filters transactions by explicit taxYear', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([
      {
        id: 'tx_1',
        userId: 'user_test',
        amount: new Prisma.Decimal('150.50'),
        date: new Date('2025-06-15T00:00:00Z'),
        type: 'Expense',
        category: 'supplies',
        description: 'Office paper',
        taxDeductible: true,
        plaidTransactionId: null,
        incomeSourceId: null,
        incomeSource: null,
      },
    ] as unknown as Awaited<ReturnType<typeof prisma.transaction.findMany>>);

    const req = new NextRequest('http://localhost/api/transactions?taxYear=2025');
    const res = await GET(req);
    expect(res.status).toBe(200);

    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_test',
        date: {
          gte: new Date(Date.UTC(2025, 0, 1)),
          lt: new Date(Date.UTC(2026, 0, 1)),
        },
      },
      orderBy: { date: 'desc' },
      include: { incomeSource: true },
    });

    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].amount).toBe('150.50');
  });

  it('defaults to current calendar year when taxYear is omitted', async () => {
    vi.mocked(prisma.transaction.findMany).mockResolvedValue([]);

    const req = new NextRequest('http://localhost/api/transactions');
    const res = await GET(req);
    expect(res.status).toBe(200);

    const expectedYear = new Date().getUTCFullYear();
    expect(prisma.transaction.findMany).toHaveBeenCalledWith({
      where: {
        userId: 'user_test',
        date: {
          gte: new Date(Date.UTC(expectedYear, 0, 1)),
          lt: new Date(Date.UTC(expectedYear + 1, 0, 1)),
        },
      },
      orderBy: { date: 'desc' },
      include: { incomeSource: true },
    });
  });
});
