import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * Deleting a Clerk user deletes every row that hangs off it, in an order the
 * foreign keys allow. Every relation is ON DELETE RESTRICT, so one table left
 * out makes the whole deletion fail; MileageLog was left out when it was
 * added, and this test exists so the next table cannot be.
 */

vi.mock('@clerk/nextjs/webhooks', () => ({ verifyWebhook: vi.fn() }));
vi.mock('@/lib/user', () => ({ upsertUser: vi.fn() }));

const calls: string[] = [];
vi.mock('@/lib/prisma', () => {
  const model = (name: string) => ({
    deleteMany: vi.fn(() => {
      calls.push(name);
      return { model: name };
    }),
  });
  const names = [
    'transaction', 'mileageLog', 'incomeSource', 'plaidConnection', 'form1098T', 'form1098E',
    'homeOfficeDeduction', 'w2Form', 'estimatedTaxPayment', 'user',
  ];
  const prisma: Record<string, unknown> = Object.fromEntries(names.map((n) => [n, model(n)]));
  prisma.$transaction = vi.fn(async (ops: unknown[]) => ops);
  return { prisma };
});

import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { prisma } from '@/lib/prisma';
import { POST } from '../webhooks/clerk/route';

/** Prisma client property names of every model with a `userId` column. */
function modelsOwnedByUser(): string[] {
  const schema = readFileSync(join(process.cwd(), 'prisma', 'schema.prisma'), 'utf8');
  const owned: string[] = [];
  for (const match of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
    if (/^\s+userId\s+String/m.test(match[2])) owned.push(match[1][0].toLowerCase() + match[1].slice(1));
  }
  return owned;
}

describe('POST /api/webhooks/clerk, user.deleted', () => {
  beforeEach(() => {
    calls.length = 0;
    vi.mocked(verifyWebhook).mockResolvedValue({ type: 'user.deleted', data: { id: 'user_gone' } } as never);
  });

  it('deletes from every table that has a userId, then the user', async () => {
    const res = await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }));
    expect(res.status).toBe(200);
    const owned = modelsOwnedByUser();
    expect(owned.length).toBeGreaterThanOrEqual(9);
    expect([...calls].sort()).toEqual([...owned, 'user'].sort());
    expect(calls.at(-1)).toBe('user');
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it('deletes rows that point at an income source before the income sources', async () => {
    await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }));
    const at = (name: string) => calls.indexOf(name);
    expect(at('transaction')).toBeLessThan(at('incomeSource'));
    expect(at('mileageLog')).toBeLessThan(at('incomeSource'));
  });
});
