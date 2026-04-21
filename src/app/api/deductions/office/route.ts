import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { totalSqFt, officeSqFt, rentAmount, utilitiesAmount } = data;

    const tSqFt = parseFloat(totalSqFt);
    const oSqFt = parseFloat(officeSqFt);
    const rent = parseFloat(rentAmount);
    const utils = parseFloat(utilitiesAmount);

    if (isNaN(tSqFt) || isNaN(oSqFt) || isNaN(rent) || isNaN(utils)) {
      return NextResponse.json({ error: 'Invalid numbers provided' }, { status: 400 });
    }

    const homeOffice = await prisma.homeOfficeDeduction.upsert({
      where: { userId },
      update: {
        totalSqFt: Math.max(0, tSqFt),
        officeSqFt: Math.max(0, oSqFt),
        rentAmount: Math.max(0, rent),
        utilitiesAmount: Math.max(0, utils)
      },
      create: {
        userId,
        totalSqFt: Math.max(0, tSqFt),
        officeSqFt: Math.max(0, oSqFt),
        rentAmount: Math.max(0, rent),
        utilitiesAmount: Math.max(0, utils)
      }
    });

    return NextResponse.json({ success: true, form: homeOffice });
  } catch (error) {
    console.error("Failed to save Home Office Deduction:", error);
    return NextResponse.json({ error: 'Failed to process deduction form' }, { status: 500 });
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  
  try {
    const form = await prisma.homeOfficeDeduction.findUnique({
      where: { userId }
    });
    return NextResponse.json({ form });
  } catch (error) {
    console.error("Failed to fetch Home Office Deduction:", error);
    return NextResponse.json({ error: 'Failed to fetch deduction form', form: null }, { status: 500 });
  }
}
