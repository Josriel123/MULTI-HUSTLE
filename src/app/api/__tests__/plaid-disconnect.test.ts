import { beforeEach, describe, expect, it, vi } from 'vitest';

/** "Disconnect bank": the route reports whether Plaid confirmed the revocation. */

vi.mock('@clerk/nextjs/server', () => ({ auth: vi.fn() }));
vi.mock('@/lib/userData', () => ({ disconnectBanks: vi.fn() }));

import { auth } from '@clerk/nextjs/server';
import { disconnectBanks } from '@/lib/userData';
import { POST as disconnect } from '../plaid/disconnect/route';

const POST = (body?: unknown) =>
  disconnect(new Request('http://localhost/api/plaid/disconnect', { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }));

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
    expect(disconnectBanks).toHaveBeenCalledWith('user_me', undefined);
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

  it('disconnects one bank when asked for it by id', async () => {
    vi.mocked(disconnectBanks).mockResolvedValue({ plaidItemsRevoked: 1, plaidErrors: [], connectionsRemoved: 1 });
    const res = await POST({ connectionId: 'conn_2' });
    expect(res.status).toBe(200);
    expect(disconnectBanks).toHaveBeenCalledWith('user_me', 'conn_2');
  });

  it("is 404 for a bank that is not connected (or not this user's), and 400 for a malformed id", async () => {
    vi.mocked(disconnectBanks).mockResolvedValue({ plaidItemsRevoked: 0, plaidErrors: [], connectionsRemoved: 0 });
    expect((await POST({ connectionId: 'someone_elses' })).status).toBe(404);
    expect((await POST({ connectionId: 42 })).status).toBe(400);
    expect((await POST({ connectionId: '' })).status).toBe(400);
  });

  it('is 401 when signed out, and touches nothing', async () => {
    vi.mocked(auth).mockResolvedValue({ userId: null } as unknown as AuthReturn);
    expect((await POST()).status).toBe(401);
    expect(disconnectBanks).not.toHaveBeenCalled();
  });
});
