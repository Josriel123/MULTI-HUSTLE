import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { parseW2Input } from '@/lib/formInput';
import { serializeW2 } from '../serialize';

/**
 * PATCH  /api/w2/[id]  replaces every box (the form is small; partial updates
 *                      would need the same cross-checks anyway)
 * DELETE /api/w2/[id]
 *
 * Another user's W-2 is 404, not 403: whether an id exists is not theirs to learn.
 */

type Context = { params: Promise<{ id: string }> };

async function owned(userId: string, id: string) {
  return prisma.w2Form.findFirst({ where: { id, userId } });
}

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

  try {
    const existing = await owned(userId, id);
    if (!existing) return NextResponse.json({ error: 'W-2 not found' }, { status: 404 });
    // The year is the form's own; moving a W-2 to another year is delete and re-add.
    const parsed = parseW2Input(body ?? {}, existing.taxYear);
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    const form = await prisma.w2Form.update({ where: { id }, data: parsed.values });
    return NextResponse.json(serializeW2(form));
  } catch (error) {
    console.error('Failed to update W-2:', error);
    return NextResponse.json({ error: 'Failed to update W-2' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, context: Context) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await context.params;

  try {
    const existing = await owned(userId, id);
    if (!existing) return NextResponse.json({ error: 'W-2 not found' }, { status: 404 });
    await prisma.w2Form.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete W-2:', error);
    return NextResponse.json({ error: 'Failed to delete W-2' }, { status: 500 });
  }
}
