import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { isDeductibleExpenseCategory, isExpenseCategory, isIncomeCategory } from '@/lib/tax';
import { parseMoneyInput } from '@/lib/validation';
import { isHustleKind, parseHustleName } from '@/lib/hustles';
import { findOrCreateHustle } from '@/lib/hustleStore';

/**
 * PATCH /api/transactions/[id]
 *
 * Updates an existing transaction.
 *
 * Ownership rule:
 * Users may only modify their own transactions. Touching another user's rows returns 403.
 *
 * Plaid constraint:
 * Transactions synchronized via Plaid (`plaidTransactionId != null`) are immutable
 * with respect to `amount` and `date`, because subsequent sync runs overwrite them.
 * Callers may update `category` and the hustle. If `amount` or `date`
 * alterations are attempted on a Plaid transaction, the route returns 400 with
 * an explicit error.
 *
 * Hustle: `incomeSourceId` (an existing hustle, or null to unassign) or
 * `sourceName` with an optional `sourceType` (found ignoring case, else
 * created). Allowed on Plaid rows too: the sync never overwrites it.
 *
 * Tax treatment (e2e audit 2026-09-16, F2):
 * `category` alone decides it. `taxDeductible` is derived from the category
 * whenever the category changes and is never taken from the body; a body value
 * is ignored. Categorise an expense `personal` to make it non-deductible.
 */
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });

  try {
    const existing = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json();
    const { amount, date, description, category, incomeSourceId, sourceName, sourceType } = body;

    const isPlaid = Boolean(existing.plaidTransactionId);

    if (isPlaid) {
      if (amount !== undefined && amount !== null) {
        const attemptedDecimal = new Prisma.Decimal(amount).abs();
        if (attemptedDecimal.toFixed(2) !== existing.amount.toFixed(2)) {
          return NextResponse.json(
            {
              error:
                'Cannot modify amount of a Plaid-sourced transaction; next bank sync would overwrite it. Only the tax category may be edited.',
            },
            { status: 400 }
          );
        }
      }

      if (date !== undefined && date !== null) {
        const attemptedIso = new Date(date).toISOString().slice(0, 10);
        const existingIso = existing.date.toISOString().slice(0, 10);
        if (attemptedIso !== existingIso) {
          return NextResponse.json(
            {
              error:
                'Cannot modify date of a Plaid-sourced transaction; next bank sync would overwrite it. Only the tax category may be edited.',
            },
            { status: 400 }
          );
        }
      }
    }

    const dataToUpdate: Prisma.TransactionUpdateInput = {};

    if (!isPlaid) {
      if (amount !== undefined && amount !== null) {
        // Was .abs(), which turned a submitted -9 into a stored 9 with no
        // explanation: the editor reopened showing 9.00 and the user had no
        // way to know their input had been rewritten.
        const parsedAmount = parseMoneyInput(amount, 'Amount');
        if (!parsedAmount.ok) {
          return NextResponse.json({ error: parsedAmount.error }, { status: 400 });
        }
        dataToUpdate.amount = parsedAmount.value;
      }
      if (date !== undefined && date !== null) {
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) {
          return NextResponse.json({ error: 'Invalid date provided' }, { status: 400 });
        }
        dataToUpdate.date = parsedDate;
      }
      if (description !== undefined) {
        dataToUpdate.description = description ? String(description).trim() : '';
      }
    }

    if (sourceName !== undefined && sourceName !== null && sourceName !== '') {
      const parsedName = parseHustleName(sourceName);
      if (!parsedName.ok) return NextResponse.json({ error: parsedName.error }, { status: 400 });
      if (sourceType !== undefined && !isHustleKind(sourceType)) {
        return NextResponse.json({ error: 'Hustle type must be Delivery, Freelance or Other.' }, { status: 400 });
      }
      const source = await findOrCreateHustle(userId, parsedName.name, isHustleKind(sourceType) ? sourceType : 'Other');
      dataToUpdate.incomeSource = { connect: { id: source.id } };
    } else if (incomeSourceId !== undefined) {
      if (incomeSourceId) {
        const source = await prisma.incomeSource.findFirst({
          where: { id: incomeSourceId, userId },
        });
        if (!source) {
          return NextResponse.json({ error: 'Specified income source does not belong to user.' }, { status: 400 });
        }
        dataToUpdate.incomeSource = { connect: { id: incomeSourceId } };
      } else {
        dataToUpdate.incomeSource = { disconnect: true };
      }
    }

    if (category !== undefined) {
      let nextCategory: string | null = null;
      if (category) {
        const targetType = existing.type;
        if (targetType === 'Income' && !isIncomeCategory(category)) {
          return NextResponse.json({ error: `Category "${category}" is not a valid income category.` }, { status: 400 });
        }
        if (targetType === 'Expense' && !isExpenseCategory(category)) {
          return NextResponse.json({ error: `Category "${category}" is not a valid expense category.` }, { status: 400 });
        }
        nextCategory = category;
      }
      dataToUpdate.category = nextCategory;
      // The flag follows the category and is never set from the body. The
      // validation above already guarantees an income row cannot carry an
      // expense category, so the category alone decides.
      dataToUpdate.taxDeductible = isDeductibleExpenseCategory(nextCategory);
    }

    const updated = await prisma.transaction.update({
      where: { id },
      data: dataToUpdate,
      include: { incomeSource: true },
    });

    return NextResponse.json({
      ...updated,
      amount: updated.amount.toFixed(2),
    });
  } catch (error) {
    console.error('Failed to update transaction:', error);
    return NextResponse.json({ error: 'Failed to update transaction' }, { status: 500 });
  }
}

/**
 * DELETE /api/transactions/[id]
 *
 * Deletes a transaction row with strict ownership verification.
 */
export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: 'Transaction ID is required' }, { status: 400 });

  try {
    const existing = await prisma.transaction.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
    }

    if (existing.userId !== userId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    await prisma.transaction.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to delete transaction:', error);
    return NextResponse.json({ error: 'Failed to delete transaction' }, { status: 500 });
  }
}
