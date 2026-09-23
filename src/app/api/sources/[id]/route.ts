import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { isHustleKind, parseHustleName } from '@/lib/hustles';
import { ownedHustle } from '@/lib/hustleStore';

/**
 * PATCH  /api/sources/[id]  { name?, type? }
 *   Renaming a hustle to the name of another of the user's hustles (ignoring
 *   case) merges them: this one's transactions and trips move to the other and
 *   this one is removed. That is how the per-deposit hustles the old Plaid sync
 *   created ("Uber 063015 SF**POOL**", "Uber 072515 SF**POOL**") become one
 *   "Uber". The response says which happened.
 * DELETE /api/sources/[id]
 *   Removes the hustle only. Its transactions and trips stay, unassigned; a
 *   hustle is a label, so nothing about the estimate changes.
 */

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }

  let name: string | undefined;
  if (body?.name !== undefined) {
    const parsed = parseHustleName(body.name);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    name = parsed.name;
  }
  if (body?.type !== undefined && !isHustleKind(body.type)) {
    return NextResponse.json({ error: 'Hustle type must be Delivery, Freelance or Other.' }, { status: 400 });
  }
  const type = isHustleKind(body?.type) ? body.type : undefined;

  try {
    const existing = await ownedHustle(userId, id);
    if (!existing) return NextResponse.json({ error: 'Hustle not found' }, { status: 404 });

    if (name !== undefined) {
      const twin = await prisma.incomeSource.findFirst({
        where: { userId, id: { not: id }, name: { equals: name, mode: 'insensitive' } },
        orderBy: { id: 'asc' },
      });
      if (twin) {
        const [moved, trips] = await prisma.$transaction([
          prisma.transaction.updateMany({ where: { userId, incomeSourceId: id }, data: { incomeSourceId: twin.id } }),
          prisma.mileageLog.updateMany({ where: { userId, incomeSourceId: id }, data: { incomeSourceId: twin.id } }),
          prisma.incomeSource.delete({ where: { id } }),
        ]);
        return NextResponse.json({ merged: true, into: { id: twin.id, name: twin.name, type: twin.type }, moved: moved.count, movedTrips: trips.count });
      }
    }

    const updated = await prisma.incomeSource.update({ where: { id }, data: { name, type } });
    return NextResponse.json({ merged: false, source: { id: updated.id, name: updated.name, type: updated.type } });
  } catch (error) {
    console.error('Failed to update hustle:', error);
    return NextResponse.json({ error: 'Failed to update hustle' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  try {
    const existing = await ownedHustle(userId, id);
    if (!existing) return NextResponse.json({ error: 'Hustle not found' }, { status: 404 });
    const [detached, trips] = await prisma.$transaction([
      prisma.transaction.updateMany({ where: { userId, incomeSourceId: id }, data: { incomeSourceId: null } }),
      prisma.mileageLog.updateMany({ where: { userId, incomeSourceId: id }, data: { incomeSourceId: null } }),
      prisma.incomeSource.delete({ where: { id } }),
    ]);
    return NextResponse.json({ success: true, unassigned: detached.count, unassignedTrips: trips.count });
  } catch (error) {
    console.error('Failed to delete hustle:', error);
    return NextResponse.json({ error: 'Failed to delete hustle' }, { status: 500 });
  }
}
