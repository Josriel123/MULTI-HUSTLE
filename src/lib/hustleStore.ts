import { prisma } from './prisma';
import type { HustleKind } from './hustles';

/**
 * The user's hustle with this name, ignoring case, or a new one of `kind`.
 * Names are unique per user in practice (the API never creates a second
 * "uber" beside "Uber"); nothing in the schema enforces it, because existing
 * rows created by the old Plaid sync may already collide.
 */
export async function findOrCreateHustle(userId: string, name: string, kind: HustleKind = 'Other') {
  const existing = await prisma.incomeSource.findFirst({
    where: { userId, name: { equals: name, mode: 'insensitive' } },
    orderBy: { id: 'asc' },
  });
  if (existing) return existing;
  return prisma.incomeSource.create({ data: { userId, name, type: kind } });
}

/** The hustle if it belongs to the user, else null. */
export async function ownedHustle(userId: string, id: string) {
  return prisma.incomeSource.findFirst({ where: { id, userId } });
}
