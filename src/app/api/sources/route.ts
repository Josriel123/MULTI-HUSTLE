import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';
import { isHustleKind, parseHustleName } from '@/lib/hustles';
import { findOrCreateHustle } from '@/lib/hustleStore';

/**
 * The user's hustles (IncomeSource rows), across all years: a hustle outlives
 * a tax year.
 *
 * GET  /api/sources  [{ id, name, type, transactionCount, tripCount }], by name
 * POST /api/sources  { name, type? }  finds by name (ignoring case) or creates
 */

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const sources = await prisma.incomeSource.findMany({
      where: { userId },
      orderBy: { name: 'asc' },
      include: { _count: { select: { transactions: true, mileageLogs: true } } },
    });
    return NextResponse.json(
      sources.map((s) => ({ id: s.id, name: s.name, type: s.type, transactionCount: s._count.transactions, tripCount: s._count.mileageLogs })),
    );
  } catch (error) {
    console.error('Failed to read hustles:', error);
    return NextResponse.json({ error: 'Failed to read hustles' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  const name = parseHustleName(body?.name);
  if (!name.ok) return NextResponse.json({ error: name.error }, { status: 400 });
  if (body.type !== undefined && !isHustleKind(body.type)) {
    return NextResponse.json({ error: 'Hustle type must be Delivery, Freelance or Other.' }, { status: 400 });
  }

  try {
    const source = await findOrCreateHustle(userId, name.name, isHustleKind(body.type) ? body.type : 'Other');
    return NextResponse.json({ id: source.id, name: source.name, type: source.type }, { status: 201 });
  } catch (error) {
    console.error('Failed to save hustle:', error);
    return NextResponse.json({ error: 'Failed to save hustle' }, { status: 500 });
  }
}
