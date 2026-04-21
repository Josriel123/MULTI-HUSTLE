import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { amount, type, description, taxDeductible, sourceName } = data;

    // VERY MINIMAL UPSERT OF USER TO ENSURE DB INTEGRITY WITHOUT WEBHOOKS
    await prisma.user.upsert({
      where: { id: userId },
      update: {},
      create: { id: userId, name: 'Clerk Client', email: `${userId}@multi-hustle.app` }
    });

    // Find the associated income source (e.g. "Freelance Dev Income")
    let incomeSource = null;
    if (sourceName) {
      incomeSource = await prisma.incomeSource.findFirst({
        where: { name: sourceName, userId: userId }
      });
      // Fallback fallback if doesn't exist yet
      if (!incomeSource) {
         incomeSource = await prisma.incomeSource.create({
            data: { name: sourceName, type: 'Other', userId: userId }
         });
      }
    }

    const transaction = await prisma.transaction.create({
      data: {
        amount: Math.abs(parseFloat(amount)) || 0,
        type,
        date: new Date(),
        description: description || '',
        taxDeductible: taxDeductible || false,
        userId: userId,
        incomeSourceId: incomeSource ? incomeSource.id : undefined
      }
    });

    return NextResponse.json(transaction);
  } catch (error) {
    console.error("Failed to post transaction:", error);
    return NextResponse.json({ error: 'Failed to post transaction' }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: { incomeSource: true }
    });
    return NextResponse.json(transactions);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

