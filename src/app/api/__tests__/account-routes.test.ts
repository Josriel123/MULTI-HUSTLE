import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The account routes: the clickwrap record, the export, and deletion. The
 * agreement is a legal record, so the tests pin what makes one valid.
 */

const deleteUser = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn(), clerkClient: vi.fn(async () => ({ users: { deleteUser } })) }));
vi.mock('@/lib/user', () => ({ requireUser: vi.fn() }));
vi.mock('@/lib/userData', () => ({
  deleteUserData: vi.fn(async () => ({ plaidItemsRevoked: 1, plaidErrors: [] })),
  exportUserData: vi.fn(async () => ({ account: { id: 'user_me' }, transactions: [] })),
}));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findUnique: vi.fn(), update: vi.fn() } } }));

import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { deleteUserData, exportUserData } from '@/lib/userData';
import { prisma } from '@/lib/prisma';
import { LEGAL } from '@/lib/legal';
import * as account from '../account/route';
import * as agreement from '../account/agreement/route';
import * as exportRoute from '../account/export/route';

type AuthReturn = Awaited<ReturnType<typeof auth>>;
const post = (body: unknown) => agreement.POST(new Request('http://localhost/api/account/agreement', { method: 'POST', body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user_me' } as unknown as AuthReturn);
  vi.mocked(requireUser).mockResolvedValue('user_me');
});

describe('GET /api/account', () => {
  it('asks a user who has never agreed', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ agreementVersion: null, agreementAcceptedAt: null, adultConfirmedAt: null } as never);
    const body = await (await account.GET()).json();
    expect(body.agreement).toMatchObject({ needsAgreement: true, currentVersion: LEGAL.agreementVersion, acceptedVersion: null });
  });

  it('asks again after the terms change, even though they agreed before', async () => {
    const then = new Date('2026-01-01T00:00:00Z');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ agreementVersion: '2025-01-01', agreementAcceptedAt: then, adultConfirmedAt: then } as never);
    const body = await (await account.GET()).json();
    expect(body.agreement.needsAgreement).toBe(true);
  });

  it('lets through a user who agreed to the current version and confirmed their age', async () => {
    const then = new Date('2026-09-23T10:00:00Z');
    vi.mocked(prisma.user.findUnique).mockResolvedValue({ agreementVersion: LEGAL.agreementVersion, agreementAcceptedAt: then, adultConfirmedAt: then } as never);
    const body = await (await account.GET()).json();
    expect(body.agreement).toMatchObject({ needsAgreement: false, acceptedAt: '2026-09-23T10:00:00.000Z' });
  });

  it('is 401 when signed out', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as AuthReturn);
    expect((await account.GET()).status).toBe(401);
  });
});

describe('POST /api/account/agreement', () => {
  it('records the version on screen with the server\'s own time', async () => {
    vi.mocked(prisma.user.update).mockResolvedValue({ agreementVersion: LEGAL.agreementVersion, agreementAcceptedAt: new Date(), adultConfirmedAt: new Date() } as never);
    const res = await post({ agreementVersion: LEGAL.agreementVersion, agree: true, adult: true });
    expect(res.status).toBe(200);
    const data = vi.mocked(prisma.user.update).mock.calls[0][0].data as Record<string, unknown>;
    expect(data.agreementVersion).toBe(LEGAL.agreementVersion);
    expect(data.agreementAcceptedAt).toBeInstanceOf(Date);
    expect(data.adultConfirmedAt).toBeInstanceOf(Date);
  });

  it('refuses without both boxes ticked, or with anything but true', async () => {
    for (const body of [
      { agreementVersion: LEGAL.agreementVersion, agree: true },
      { agreementVersion: LEGAL.agreementVersion, adult: true },
      { agreementVersion: LEGAL.agreementVersion, agree: 'yes', adult: true },
      { agreementVersion: LEGAL.agreementVersion, agree: true, adult: 1 },
    ]) {
      expect((await post(body)).status).toBe(400);
    }
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('refuses a version that is not the current one, so nobody agrees to text they did not see', async () => {
    const res = await post({ agreementVersion: '2020-01-01', agree: true, adult: true });
    expect(res.status).toBe(409);
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('GET /api/account/export', () => {
  it('returns only the caller\'s data, as a no-store attachment', async () => {
    const res = await exportRoute.GET();
    expect(exportUserData).toHaveBeenCalledWith('user_me');
    expect(res.headers.get('Content-Disposition')).toMatch(/^attachment; filename="multi-hustle-data-\d{4}-\d{2}-\d{2}\.json"$/);
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(await res.json()).toEqual({ account: { id: 'user_me' }, transactions: [] });
  });
});

describe('DELETE /api/account', () => {
  it('deletes the data, then the sign-in account', async () => {
    const res = await account.DELETE();
    expect(res.status).toBe(200);
    expect(deleteUserData).toHaveBeenCalledWith('user_me');
    expect(deleteUser).toHaveBeenCalledWith('user_me');
    expect(await res.json()).toMatchObject({ deleted: true, bankConnectionsRevoked: 1 });
  });

  it('does not touch the sign-in account if the data could not be deleted', async () => {
    vi.mocked(deleteUserData).mockRejectedValueOnce(new Error('db down'));
    const res = await account.DELETE();
    expect(res.status).toBe(500);
    expect(deleteUser).not.toHaveBeenCalled();
  });

  it('says plainly when the data is gone but Clerk failed', async () => {
    deleteUser.mockRejectedValueOnce(new Error('clerk down'));
    const res = await account.DELETE();
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ dataDeleted: true });
  });
});
