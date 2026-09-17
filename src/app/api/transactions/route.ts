import { type NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@clerk/nextjs/server';
import { requireUser } from '@/lib/user';
import { isDeductibleExpenseCategory, isExpenseCategory, isIncomeCategory } from '@/lib/tax';
import { resolveTaxYear } from '@/lib/taxYear';
import { parseMoneyInput } from '@/lib/validation';

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
 *
 * Tax treatment contract (e2e audit 2026-09-16, F2):
 * ---------------------------------------------------
 * `category` is the only thing that decides how a transaction is taxed. The
 * `taxDeductible` column is DERIVED from it here (an expense in a Schedule C
 * category) and is never read by the tax engine; a `taxDeductible` value in the
 * request body is ignored. To record a non-deductible expense, categorise it
 * `personal`. An expense with no category is treated as personal and flagged.
 */

export async function POST(req: Request) {
  // The inline user upsert that used to live here is now `requireUser`, shared
  // by every write route — it was the only place a User row got created, which
  // is why every other form failed on a foreign key for new accounts.
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const data = await req.json();
    const { amount, type, description, sourceName, category, date } = data;

    // Rejects rather than corrects: negative, non-numeric, or beyond what
    // DECIMAL(12,2) holds. The out-of-range case previously reached Prisma and
    // surfaced as "Failed to post transaction", which named neither the field
    // nor the limit.
    const parsedAmount = parseMoneyInput(amount, 'Amount');
    if (!parsedAmount.ok) {
      return NextResponse.json({ error: parsedAmount.error }, { status: 400 });
    }
    const decimalAmount = parsedAmount.value;

    const txType = type === 'Income' ? 'Income' : 'Expense';

    // A category, when given, must be one the engine knows for this side of
    // the ledger. Storing an unknown string used to be allowed; the engine then
    // treated the row as uncategorised while the UI showed the string, which is
    // two different answers to one question.
    let cleanCategory: string | null = null;
    if (category !== undefined && category !== null && category !== '') {
      const valid = txType === 'Income' ? isIncomeCategory(category) : isExpenseCategory(category);
      if (!valid) {
        return NextResponse.json(
          { error: `Category ${JSON.stringify(category)} is not a valid ${txType.toLowerCase()} category.` },
          { status: 400 }
        );
      }
      cleanCategory = category;
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

    const txDate = date ? new Date(date) : new Date();

    const transaction = await prisma.transaction.create({
      data: {
        amount: decimalAmount,
        type: txType,
        date: txDate,
        description: description ? String(description).trim() : '',
        // Derived, never taken from the body. See the contract above.
        taxDeductible: txType === 'Expense' && isDeductibleExpenseCategory(cleanCategory),
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

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const resolved = resolveTaxYear(request.nextUrl.searchParams.get('taxYear'));
  if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: 400 });
  const { taxYear } = resolved;

  try {
    const transactions = await prisma.transaction.findMany({
      where: {
        userId,
        date: {
          gte: new Date(Date.UTC(taxYear, 0, 1)),
          lt: new Date(Date.UTC(taxYear + 1, 0, 1)),
        },
      },
      orderBy: { date: 'desc' },
      include: { incomeSource: true },
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
