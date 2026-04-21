import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { box1 } = data;

    const parsedBox1 = parseFloat(box1);

    if (isNaN(parsedBox1)) {
      return NextResponse.json({ error: 'Invalid numbers provided' }, { status: 400 });
    }

    const form1098e = await prisma.form1098E.upsert({
      where: { userId },
      update: {
        box1: Math.max(0, parsedBox1)
      },
      create: {
        userId,
        box1: Math.max(0, parsedBox1)
      }
    });

    return NextResponse.json({ success: true, form: form1098e });
  } catch (error) {
    console.error("Failed to save 1098-E:", error);
    return NextResponse.json({ error: 'Failed to process tax form' }, { status: 500 });
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const form = await prisma.form1098E.findUnique({
      where: { userId }
    });
    
    return NextResponse.json({ form });
  } catch (error) {
    console.error("Failed to fetch 1098-E:", error);
    return NextResponse.json({ error: 'Failed to fetch tax form', form: null }, { status: 500 });
  }
}
