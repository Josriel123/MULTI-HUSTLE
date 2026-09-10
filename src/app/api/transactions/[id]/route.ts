import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { isExpenseCategory, isIncomeCategory } from '@/lib/tax';

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
 * Callers may update `category` and `taxDeductible`. If `amount` or `date` alterations
 * are attempted on a Plaid transaction, the route returns 400 with an explicit error.
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
    const { amount, date, description, category, taxDeductible, incomeSourceId } = body;

    const isPlaid = Boolean(existing.plaidTransactionId);

    if (isPlaid) {
      if (amount !== undefined && amount !== null) {
        const attemptedDecimal = new Prisma.Decimal(amount).abs();
        if (attemptedDecimal.toFixed(2) !== existing.amount.toFixed(2)) {
          return NextResponse.json(
            {
              error:
                'Cannot modify amount of a Plaid-sourced transaction; next bank sync would overwrite it. Only category and tax deductible status may be edited.',
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
                'Cannot modify date of a Plaid-sourced transaction; next bank sync would overwrite it. Only category and tax deductible status may be edited.',
            },
            { status: 400 }
          );
        }
      }
    }

    const dataToUpdate: Prisma.TransactionUpdateInput = {};

    if (!isPlaid) {
      if (amount !== undefined && amount !== null) {
        dataToUpdate.amount = new Prisma.Decimal(amount).abs();
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
      if (incomeSourceId !== undefined) {
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
    }

    if (taxDeductible !== undefined) {
      dataToUpdate.taxDeductible = Boolean(taxDeductible);
    }

    if (category !== undefined) {
      if (!category) {
        dataToUpdate.category = null;
      } else {
        const targetType = existing.type;
        if (targetType === 'Income' && !isIncomeCategory(category)) {
          return NextResponse.json({ error: `Category "${category}" is not a valid income category.` }, { status: 400 });
        }
        if (targetType === 'Expense' && !isExpenseCategory(category)) {
          return NextResponse.json({ error: `Category "${category}" is not a valid expense category.` }, { status: 400 });
        }
        dataToUpdate.category = category;
      }
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
