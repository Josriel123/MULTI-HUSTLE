import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { isExpenseCategory, isIncomeCategory } from '@/lib/tax';

/**
 * Money-over-the-wire contract:
 * ----------------------------
 * Transaction amounts are stored in PostgreSQL as DECIMAL(12,2) and returned by
 * Prisma as `Prisma.Decimal`. Over JSON HTTP APIs, amounts are serialized as
 * decimal strings (e.g. "18400.00", "2200.50") to prevent IEEE-754 floating point
 * precision loss and rounding drift.
 *
 * Rules for callers and frontend consumers:
 * 1. Keep amounts as strings; do NOT convert to JavaScript numbers for math in components.
 * 2. Do NOT scatter `parseFloat` or `Number(...)` arithmetic in `.tsx` files.
 * 3. Format values strictly at the render edge using `Intl.NumberFormat`.
 * 4. Tax liability and deduction arithmetic must always be derived by the audited
 *    tax engine (`src/lib/tax`), never in UI code.
 */

export async function POST(req: Request) {
  // The inline user upsert that used to live here is now `requireUser`, shared
  // by every write route — it was the only place a User row got created, which
  // is why every other form failed on a foreign key for new accounts.
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { amount, type, description, taxDeductible, sourceName, category, date } = data;

    if (amount === undefined || amount === null || String(amount).trim() === '') {
      return NextResponse.json({ error: 'Amount is required' }, { status: 400 });
    }

    let decimalAmount: Prisma.Decimal;
    try {
      decimalAmount = new Prisma.Decimal(amount).abs();
    } catch {
      return NextResponse.json({ error: 'Invalid decimal amount' }, { status: 400 });
    }

    // Find or create the associated income source (e.g. "Freelance Dev Income")
    let incomeSource = null;
    if (sourceName) {
      incomeSource = await prisma.incomeSource.findFirst({
        where: { name: sourceName, userId: userId }
      });
      if (!incomeSource) {
        incomeSource = await prisma.incomeSource.create({
          data: { name: sourceName, type: 'Other', userId: userId }
        });
      }
    }

    // Validate category if provided
    let cleanCategory: string | null = null;
    if (category) {
      if (type === 'Income' && isIncomeCategory(category)) {
        cleanCategory = category;
      } else if (type === 'Expense' && isExpenseCategory(category)) {
        cleanCategory = category;
      } else {
        cleanCategory = String(category);
      }
    }

    const txDate = date ? new Date(date) : new Date();

    const transaction = await prisma.transaction.create({
      data: {
        amount: decimalAmount,
        type: type === 'Income' ? 'Income' : 'Expense',
        date: txDate,
        description: description ? String(description).trim() : '',
        taxDeductible: Boolean(taxDeductible),
        category: cleanCategory,
        userId: userId,
        incomeSourceId: incomeSource ? incomeSource.id : undefined
      },
      include: { incomeSource: true }
    });

    return NextResponse.json({
      ...transaction,
      amount: transaction.amount.toFixed(2),
    }, { status: 201 });
  } catch (error) {
    console.error("Failed to post transaction:", error);
    return NextResponse.json({ error: 'Failed to post transaction' }, { status: 500 });
  }
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { date: 'desc' },
      include: { incomeSource: true }
    });

    const formatted = transactions.map((tx) => ({
      ...tx,
      amount: tx.amount.toFixed(2),
    }));

    return NextResponse.json(formatted);
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 });
  }
}

