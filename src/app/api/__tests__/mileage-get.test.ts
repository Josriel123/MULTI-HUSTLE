import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/user', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  prisma: { mileageLog: { findMany: vi.fn() } },
}));

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { getTaxYearParameters } from '@/lib/tax';
import { GET } from '../mileage/route';

type AuthReturn = Awaited<ReturnType<typeof auth>>;

const get = (qs = '') => GET(new NextRequest(`http://localhost/api/mileage${qs}`));

describe('GET /api/mileage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(auth).mockResolvedValue({ userId: 'user_test' } as unknown as AuthReturn);
    vi.mocked(prisma.mileageLog.findMany).mockResolvedValue([]);
  });

  it('always scopes the query to a year, even when the parameter is omitted', async () => {
    // A plain page visit sends no ?taxYear= (useTaxYear drops it at the
    // default year). This route used to apply no date filter at all then, so
    // the Mileage section summed every year's trips.
    const res = await get();
    expect(res.status).toBe(200);
    const where = vi.mocked(prisma.mileageLog.findMany).mock.calls[0][0]!.where as { date?: { gte: Date; lt: Date } };
    expect(where.date).toBeDefined();
    const body = await res.json();
    expect(where.date!.gte.toISOString()).toBe(`${body.taxYear}-01-01T00:00:00.000Z`);
    expect(where.date!.lt.toISOString()).toBe(`${body.taxYear + 1}-01-01T00:00:00.000Z`);
  });

  it('applies the requested year', async () => {
    await get('?taxYear=2025');
    const where = vi.mocked(prisma.mileageLog.findMany).mock.calls[0][0]!.where as { date: { gte: Date; lt: Date } };
    expect(where.date.gte.toISOString()).toBe('2025-01-01T00:00:00.000Z');
    expect(where.date.lt.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });

  it('rejects an unsupported year like the other routes, instead of returning an empty year', async () => {
    const res = await get('?taxYear=1999');
    expect(res.status).toBe(400);
    expect(prisma.mileageLog.findMany).not.toHaveBeenCalled();
  });

  it('returns the year and its rate periods from the engine, with no trips logged', async () => {
    // The S2 scenario: after the last trip is deleted there is no trip to
    // copy a rate from, and the card must still show the right one.
    const res = await get('?taxYear=2026');
    const body = await res.json();
    expect(body.taxYear).toBe(2026);
    expect(body.logs).toEqual([]);
    const expected = getTaxYearParameters(2026).standardMileage.map((p) => p.centsPerMile);
    expect(body.ratePeriods.map((p: { centsPerMile: string }) => p.centsPerMile)).toEqual(expected);
    expect(body.ratePeriods[0].citation).toBeTruthy();
  });

  it('rejects anonymous requests', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as AuthReturn);
    expect((await get()).status).toBe(401);
  });
});
