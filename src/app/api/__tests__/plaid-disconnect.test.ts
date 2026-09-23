import { beforeEach, describe, expect, it, vi } from 'vitest';

/** "Disconnect bank": the route reports whether Plaid confirmed the revocation. */

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/userData', () => ({ disconnectBanks: vi.fn() }));

import { auth } from '@clerk/nextjs/server';
import { disconnectBanks } from '@/lib/userData';
import { POST } from '../plaid/disconnect/route';

type AuthReturn = Awaited<ReturnType<typeof auth>>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(auth).mockResolvedValue({ userId: 'user_me' } as unknown as AuthReturn);
});

describe('POST /api/plaid/disconnect', () => {
  it('disconnects and says Plaid confirmed', async () => {
    vi.mocked(disconnectBanks).mockResolvedValue({ plaidItemsRevoked: 1, plaidErrors: [], connectionsRemoved: 1 });
    const res = await POST();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ disconnected: true, connectionsRemoved: 1, revokedAtPlaid: true });
    expect(disconnectBanks).toHaveBeenCalledWith('user_me');
  });

  it('still disconnects when Plaid fails, and says Plaid did not confirm', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(disconnectBanks).mockResolvedValue({ plaidItemsRevoked: 0, plaidErrors: ['timeout'], connectionsRemoved: 1 });
    const body = await (await POST()).json();
    expect(body).toMatchObject({ disconnected: true, revokedAtPlaid: false });
  });

  it('is 500 with a readable message when the database fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.mocked(disconnectBanks).mockRejectedValue(new Error('db down'));
    const res = await POST();
    expect(res.status).toBe(500);
    expect((await res.json()).error).toMatch(/Could not disconnect/);
  });

  it('is 401 when signed out, and touches nothing', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as AuthReturn);
    expect((await POST()).status).toBe(401);
    expect(disconnectBanks).not.toHaveBeenCalled();
  });
});
