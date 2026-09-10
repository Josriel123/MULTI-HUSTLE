import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from './prisma';

/**
 * User bootstrap.
 *
 * Every table in this schema hangs off `User.id`, and that id is the Clerk
 * user id. Before this existed, only `POST /api/transactions` created the row
 * (via an inline upsert) — so a freshly signed-up user hit a foreign-key error
 * on any other write: 1098-T, 1098-E, home office, or linking a bank.
 *
 * The Clerk webhook (`/api/webhooks/clerk`) is the primary path. `ensureUser`
 * is the safety net for when it hasn't landed — in local dev there's usually no
 * public URL for Clerk to call at all, so the webhook never fires. Call it at
 * the top of any route that writes user-owned rows.
 */

/** Idempotently ensure a User row exists for this Clerk id. Returns the id. */
export async function ensureUser(userId: string): Promise<string> {
  const existing = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });
  if (existing) return existing.id;

  // Only reach for Clerk's API when we actually need to create the row.
  let name = 'New User';
  let email = `${userId}@placeholder.local`;
  try {
    const clerkUser = await currentUser();
    if (clerkUser) {
      const primary =
        clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId) ??
        clerkUser.emailAddresses[0];
      if (primary?.emailAddress) email = primary.emailAddress;
      const full = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(' ').trim();
      if (full) name = full;
    }
  } catch {
    // currentUser() is unavailable outside a request context (e.g. webhooks).
    // Placeholders are fine — the webhook backfills real values.
  }

  return upsertUser({ id: userId, name, email });
}

/** Shared upsert used by both `ensureUser` and the Clerk webhook. */
export async function upsertUser(input: {
  id: string;
  name: string;
  email: string;
}): Promise<string> {
  const user = await prisma.user.upsert({
    where: { id: input.id },
    update: { name: input.name, email: input.email },
    create: { id: input.id, name: input.name, email: input.email },
    select: { id: true },
  });
  return user.id;
}

/**
 * Auth guard for route handlers: returns the Clerk user id with a User row
 * guaranteed to exist, or null if the caller isn't signed in.
 *
 * Use in write paths. For read-only routes, `auth()` alone is enough — no need
 * to create a row just to return an empty list.
 */
export async function requireUser(): Promise<string | null> {
  const { userId } = await auth();
  if (!userId) return null;
  return ensureUser(userId);
}
