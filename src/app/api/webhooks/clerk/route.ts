import type { NextRequest } from 'next/server';
import { verifyWebhook } from '@clerk/nextjs/webhooks';
import { prisma } from '@/lib/prisma';
import { upsertUser } from '@/lib/user';

/**
 * Clerk webhook — keeps the local User table in step with Clerk.
 *
 * Configure in Clerk Dashboard -> Webhooks: endpoint `/api/webhooks/clerk`,
 * subscribed to `user.created`, `user.updated`, `user.deleted`. Copy the
 * signing secret into CLERK_WEBHOOK_SIGNING_SECRET.
 *
 * This route must stay public — Clerk calls it unauthenticated and the
 * signature is the authentication. It's excluded in `src/proxy.ts`.
 */

export async function POST(req: NextRequest) {
  let evt;
  try {
    // Verifies the Svix signature against CLERK_WEBHOOK_SIGNING_SECRET.
    evt = await verifyWebhook(req);
  } catch (err) {
    console.error('Clerk webhook verification failed:', err);
    return new Response('Invalid signature', { status: 400 });
  }

  try {
    switch (evt.type) {
      case 'user.created':
      case 'user.updated': {
        const data = evt.data;
        const primary =
          data.email_addresses?.find((e) => e.id === data.primary_email_address_id) ??
          data.email_addresses?.[0];
        const name =
          [data.first_name, data.last_name].filter(Boolean).join(' ').trim() || 'New User';

        await upsertUser({
          id: data.id,
          name,
          email: primary?.email_address ?? `${data.id}@placeholder.local`,
        });
        break;
      }

      case 'user.deleted': {
        const id = evt.data.id;
        if (!id) break;
        // Children are deleted explicitly: the schema has no cascade rules, so
        // deleting the User alone would fail on its foreign keys.
        await prisma.$transaction([
          prisma.transaction.deleteMany({ where: { userId: id } }),
          prisma.incomeSource.deleteMany({ where: { userId: id } }),
          prisma.plaidConnection.deleteMany({ where: { userId: id } }),
          prisma.form1098T.deleteMany({ where: { userId: id } }),
          prisma.form1098E.deleteMany({ where: { userId: id } }),
          prisma.homeOfficeDeduction.deleteMany({ where: { userId: id } }),
          prisma.user.deleteMany({ where: { id } }),
        ]);
        break;
      }

      default:
        // Other event types are subscribed-but-unused; acknowledge so Clerk
        // doesn't retry.
        break;
    }
  } catch (err) {
    // Returning 500 tells Clerk to retry, which is what we want for a
    // transient database failure.
    console.error(`Clerk webhook handler failed for ${evt.type}:`, err);
    return new Response('Handler error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
}
