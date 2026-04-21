import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const form = await prisma.form1098T.findUnique({
      where: { userId }
    });
    return NextResponse.json({ form });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { box1, box5 } = await req.json();

    const form = await prisma.form1098T.upsert({
      where: { userId },
      update: { box1: Math.max(0, Number(box1) || 0), box5: Math.max(0, Number(box5) || 0) },
      create: {
        userId,
        box1: Math.max(0, Number(box1) || 0),
        box5: Math.max(0, Number(box5) || 0)
      }
    });

    return NextResponse.json({ success: true, form });
  } catch (error) {
    console.error("1098-T error:", error);
    return NextResponse.json({ error: 'Failed to save Form 1098-T' }, { status: 500 });
  }
}
