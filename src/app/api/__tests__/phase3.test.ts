import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import {
  computeStandardMileageDeduction,
  getTaxYearParameters,
  buildFederalTaxInput,
  estimateFederalTax,
  type TransactionRow,
} from '@/lib/tax';

// Mock Clerk auth
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock Prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    transaction: {
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      findMany: vi.fn(),
    },
    mileageLog: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      delete: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    incomeSource: {
      findMany: vi.fn(),
    },
  },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { PATCH, DELETE } from '../transactions/[id]/route';

describe('Phase 3: Mileage Calculation & Money Wire Contract', () => {
  it('correctly calculates mileage deductions across 2025 and 2026 rates', () => {
    const p2025 = getTaxYearParameters(2025);
    const p2026 = getTaxYearParameters(2026);

    // 2025: 70 cents per mile
    const trip2025 = computeStandardMileageDeduction('100.00', '2025-06-15', p2025);
    expect(trip2025.miles.toFixed(2)).toBe('100.00');
    expect(trip2025.deduction.toFixed(2)).toBe('70.00');

    // 2026 first half: 72.5 cents per mile
    const trip2026H1 = computeStandardMileageDeduction('100.00', '2026-03-15', p2026);
    expect(trip2026H1.miles.toFixed(2)).toBe('100.00');
    expect(trip2026H1.deduction.toFixed(2)).toBe('72.50');

    // 2026 second half: 76.0 cents per mile
    const trip2026H2 = computeStandardMileageDeduction('100.00', '2026-08-15', p2026);
    expect(trip2026H2.miles.toFixed(2)).toBe('100.00');
    expect(trip2026H2.deduction.toFixed(2)).toBe('76.00');
  });

  it('rejects invalid or out-of-year dates for mileage computation', () => {
    const p2026 = getTaxYearParameters(2026);
    expect(() => computeStandardMileageDeduction('50', '2026/05/01', p2026)).toThrow(/ISO date/);
    expect(() => computeStandardMileageDeduction('-10', '2026-05-01', p2026)).toThrow(/negative/);
    expect(() => computeStandardMileageDeduction('50', '2024-05-01', p2026)).toThrow(/no standard mileage rate/);
  });
});

describe('Phase 3: Transaction Edit & Delete Contract (Plaid Immutability)', () => {
  type AuthReturn = Awaited<ReturnType<typeof auth>>;
  type TxFindReturn = Awaited<ReturnType<typeof prisma.transaction.findUnique>>;
  type TxUpdateReturn = Awaited<ReturnType<typeof prisma.transaction.update>>;
  type TxDeleteReturn = Awaited<ReturnType<typeof prisma.transaction.delete>>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when unauthenticated', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as AuthReturn);

    const req = new NextRequest('http://localhost/api/transactions/tx_123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'equipment' }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'tx_123' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when transaction does not exist or does not belong to user', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_alice' } as unknown as AuthReturn);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/transactions/tx_123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'equipment' }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'tx_123' }) });
    expect(res.status).toBe(404);
  });

  it('forbids editing amount on Plaid-sourced transactions (HTTP 400)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_alice' } as unknown as AuthReturn);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx_plaid_1',
      userId: 'user_alice',
      plaidTransactionId: 'plaid_abc_123',
      amount: new Prisma.Decimal('120.00'),
      date: new Date('2026-04-10'),
      category: 'general',
      taxDeductible: false,
    } as unknown as TxFindReturn);

    const req = new NextRequest('http://localhost/api/transactions/tx_plaid_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: 150.00 }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'tx_plaid_1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/bank sync/i);
  });

  it('forbids editing date on Plaid-sourced transactions (HTTP 400)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_alice' } as unknown as AuthReturn);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx_plaid_1',
      userId: 'user_alice',
      plaidTransactionId: 'plaid_abc_123',
      amount: new Prisma.Decimal('120.00'),
      date: new Date('2026-04-10'),
      category: 'general',
      taxDeductible: false,
    } as unknown as TxFindReturn);

    const req = new NextRequest('http://localhost/api/transactions/tx_plaid_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-04-15' }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'tx_plaid_1' }) });
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/bank sync/i);
  });

  it('allows editing category and taxDeductible on Plaid transactions', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_alice' } as unknown as AuthReturn);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx_plaid_1',
      userId: 'user_alice',
      plaidTransactionId: 'plaid_abc_123',
      amount: new Prisma.Decimal('120.00'),
      date: new Date('2026-04-10'),
      category: 'general',
      taxDeductible: false,
    } as unknown as TxFindReturn);
    vi.mocked(prisma.transaction.update).mockResolvedValue({
      id: 'tx_plaid_1',
      userId: 'user_alice',
      plaidTransactionId: 'plaid_abc_123',
      amount: new Prisma.Decimal('120.00'),
      date: new Date('2026-04-10'),
      category: 'equipment',
      taxDeductible: true,
    } as unknown as TxUpdateReturn);

    const req = new NextRequest('http://localhost/api/transactions/tx_plaid_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category: 'equipment', taxDeductible: true }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'tx_plaid_1' }) });
    expect(res.status).toBe(200);
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx_plaid_1' },
        data: { category: 'equipment', taxDeductible: true },
      })
    );
  });

  it('allows full edit on manual transactions (including amount and date)', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_alice' } as unknown as AuthReturn);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx_manual_1',
      userId: 'user_alice',
      plaidTransactionId: null,
      amount: new Prisma.Decimal('120.00'),
      date: new Date('2026-04-10'),
      category: 'general',
      taxDeductible: false,
    } as unknown as TxFindReturn);
    vi.mocked(prisma.transaction.update).mockResolvedValue({
      id: 'tx_manual_1',
      userId: 'user_alice',
      plaidTransactionId: null,
      amount: new Prisma.Decimal('150.00'),
      date: new Date('2026-04-15'),
      category: 'equipment',
      taxDeductible: true,
    } as unknown as TxUpdateReturn);

    const req = new NextRequest('http://localhost/api/transactions/tx_manual_1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 150.00,
        date: '2026-04-15',
        category: 'equipment',
        taxDeductible: true,
      }),
    });

    const res = await PATCH(req, { params: Promise.resolve({ id: 'tx_manual_1' }) });
    expect(res.status).toBe(200);
    expect(prisma.transaction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'tx_manual_1' },
        data: expect.objectContaining({
          amount: new Prisma.Decimal('150.00'),
          date: new Date('2026-04-15T00:00:00.000Z'),
          category: 'equipment',
          taxDeductible: true,
        }),
      })
    );
  });

  it('deletes transaction when user owns it', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: 'user_alice' } as unknown as AuthReturn);
    vi.mocked(prisma.transaction.findUnique).mockResolvedValue({
      id: 'tx_1',
      userId: 'user_alice',
    } as unknown as TxFindReturn);
    vi.mocked(prisma.transaction.delete).mockResolvedValue({ id: 'tx_1' } as unknown as TxDeleteReturn);

    const req = new NextRequest('http://localhost/api/transactions/tx_1', { method: 'DELETE' });
    const res = await DELETE(req, { params: Promise.resolve({ id: 'tx_1' }) });
    expect(res.status).toBe(200);
    expect(prisma.transaction.delete).toHaveBeenCalledWith({ where: { id: 'tx_1' } });
  });
});

describe('Phase 3: Chart Cumulative Aggregation Logic', () => {
  it('aggregates transactions cumulatively through each month without a fixed ratio', () => {
    const d = (iso: string) => new Date(iso + 'T00:00:00Z');
    const FREELANCE = { name: 'Freelance Dev Income', type: 'Freelance' };

    // Progressive income across months
    const rows: TransactionRow[] = [
      { amount: new Prisma.Decimal('5000.00'), type: 'Income', date: d('2026-01-15'), taxDeductible: false, category: 'business_income', incomeSource: FREELANCE },
      { amount: new Prisma.Decimal('8000.00'), type: 'Income', date: d('2026-03-10'), taxDeductible: false, category: 'business_income', incomeSource: FREELANCE },
      { amount: new Prisma.Decimal('10000.00'), type: 'Income', date: d('2026-06-20'), taxDeductible: false, category: 'business_income', incomeSource: FREELANCE },
      { amount: new Prisma.Decimal('12000.00'), type: 'Income', date: d('2026-09-05'), taxDeductible: false, category: 'business_income', incomeSource: FREELANCE },
    ];

    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const chartData = [];

    for (let m = 0; m < 12; m++) {
      const monthEnd = new Date(Date.UTC(2026, m + 1, 0, 23, 59, 59, 999));
      const txThroughMonth = rows.filter((tx) => tx.date <= monthEnd);

      const built = buildFederalTaxInput({
        taxYear: 2026,
        transactions: txThroughMonth,
        user: { filingStatus: 'single', claimedAsDependent: false },
      });

      const estimate = estimateFederalTax(built.input);
      const gross = Number(estimate.income.totalIncome.toFixed(2));
      const net = Number(built.cashIncomeTotal.minus(built.cashExpensesTotal).minus(estimate.totalTax).toFixed(2));

      chartData.push({ month: months[m], gross, net });
    }

    expect(chartData.length).toBe(12);
    // Jan: 5000 gross
    expect(chartData[0].gross).toBe(5000);
    // Feb: no new income, remains 5000
    expect(chartData[1].gross).toBe(5000);
    // Mar: +8000 -> 13000
    expect(chartData[2].gross).toBe(13000);
    // Dec: 35000 total gross
    expect(chartData[11].gross).toBe(35000);

    // Verify net is NOT a fixed ratio of gross
    const ratioJan = chartData[0].net / chartData[0].gross;
    const ratioDec = chartData[11].net / chartData[11].gross;
    // Due to progressive tax brackets, effective tax rate increases, so net/gross ratio decreases
    expect(ratioJan).not.toBe(ratioDec);
    expect(ratioJan).toBeGreaterThan(ratioDec);
  });
});
