import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The Clerk user.deleted webhook deletes through the same function as the
 * in-app deletion, so neither can forget a table the other deletes. What that
 * function deletes is tested in src/lib/__tests__/user-data.test.ts.
 */

vi.mock('@clerk/nextjs/webhooks', () => ({ verifyWebhook: vi.fn() }));
vi.mock('@/lib/user', () => ({ upsertUser: vi.fn() }));
vi.mock('@/lib/userData', () => ({ deleteUserData: vi.fn(async () => ({ plaidItemsRevoked: 0, plaidErrors: [] })) }));

import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { deleteUserData } from '@/lib/userData';
import { POST } from '../webhooks/clerk/route';

describe('POST /api/webhooks/clerk, user.deleted', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes the user\'s data through the shared deletion', async () => {
    vi.mocked(verifyWebhook).mockResolvedValue({ type: 'user.deleted', data: { id: 'user_gone' } } as never);
    const res = await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }));
    expect(res.status).toBe(200);
    expect(deleteUserData).toHaveBeenCalledWith('user_gone');
  });

  it('asks Clerk to retry when the deletion fails', async () => {
    vi.mocked(verifyWebhook).mockResolvedValue({ type: 'user.deleted', data: { id: 'user_gone' } } as never);
    vi.mocked(deleteUserData).mockRejectedValueOnce(new Error('db down'));
    const res = await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }));
    expect(res.status).toBe(500);
  });

  it('refuses an unsigned request', async () => {
    vi.mocked(verifyWebhook).mockRejectedValue(new Error('bad signature'));
    const res = await POST(new NextRequest('http://localhost/api/webhooks/clerk', { method: 'POST' }));
    expect(res.status).toBe(400);
    expect(deleteUserData).not.toHaveBeenCalled();
  });
});
