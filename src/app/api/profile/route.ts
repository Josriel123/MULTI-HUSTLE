import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/user';
import { parseProfileInput } from '@/lib/formInput';

/**
 * The tax profile: filing status, whether someone can claim the user as a
 * dependent, and (married filing separately only) whether the spouse
 * itemizes. Not year-scoped: the fields sit on User. `saved` is false until
 * the user saves once, and the estimate reports the default status as an
 * assumption until then.
 */

const SELECT = { filingStatus: true, claimedAsDependent: true, spouseItemizes: true, taxProfileSavedAt: true } as const;

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: SELECT });
    return NextResponse.json({
      filingStatus: user?.filingStatus ?? 'single',
      claimedAsDependent: user?.claimedAsDependent ?? false,
      spouseItemizes: user?.spouseItemizes ?? false,
      saved: Boolean(user?.taxProfileSavedAt),
    });
  } catch (error) {
    console.error('Failed to read tax profile:', error);
    return NextResponse.json({ error: 'Failed to read tax profile' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Request body must be JSON.' }, { status: 400 });
  }
  const parsed = parseProfileInput(body ?? {});
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { ...parsed.values, taxProfileSavedAt: new Date() },
      select: SELECT,
    });
    return NextResponse.json({
      filingStatus: user.filingStatus,
      claimedAsDependent: user.claimedAsDependent,
      spouseItemizes: user.spouseItemizes,
      saved: true,
    });
  } catch (error) {
    console.error('Failed to save tax profile:', error);
    return NextResponse.json({ error: 'Failed to save tax profile' }, { status: 500 });
  }
}
