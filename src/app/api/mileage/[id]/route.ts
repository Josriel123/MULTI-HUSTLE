import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Log ID is required' }, { status: 400 });

  try {
    const existing = await prisma.mileageLog.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Mileage log not found' }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.mileageLog.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete mileage log:', error);
    return NextResponse.json({ error: 'Failed to delete mileage log' }, { status: 500 });
  }
}
