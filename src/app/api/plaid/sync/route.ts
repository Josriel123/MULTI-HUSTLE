import { NextResponse } from 'next/server';
import { Configuration, PlaidApi, PlaidEnvironments, Transaction as PlaidTransaction } from 'plaid';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

const configuration = new Configuration({
  basePath: PlaidEnvironments.sandbox,
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const connection = await prisma.plaidConnection.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    if (!connection) {
      return NextResponse.json({ error: 'No Plaid connection found. Please link a bank account first.' }, { status: 404 });
    }

    let cursor = connection.cursor || undefined;
    let added: PlaidTransaction[] = [];
    let hasMore = true;

    // Fetch all available transaction updates
    while (hasMore) {
      const request = {
        access_token: connection.accessToken,
        cursor: cursor,
      };
      const response = await plaidClient.transactionsSync(request);
      const data = response.data;
      
      added = added.concat(data.added);
      hasMore = data.has_more;
      cursor = data.next_cursor;
    }

    // Save the new cursor so we don't fetch duplicates next time
    await prisma.plaidConnection.update({
      where: { id: connection.id },
      data: { cursor: cursor }
    });

    const currentYear = new Date().getFullYear();
    const currentYearAdded = added.filter((txn) => {
      const txnYear = new Date(txn.date).getFullYear();
      return txnYear === currentYear;
    });

    let syncCount = 0;

    // Categorization Pipeline
    for (const txn of currentYearAdded) {
      const isIncome = txn.amount < 0; 
      const amountAbs = Math.abs(txn.amount);

      // Simple heuristic for deductions (in real life, match against IRS rules)
      const isDeductible = !isIncome && (
        txn.category?.includes("Travel") || 
        txn.category?.includes("Food and Drink") || 
        txn.category?.includes("Shops") ||
        txn.category?.includes("Transportation")
      );

      // Find or create IncomeSource for Plaid if income
      let sourceId = undefined;
      if (isIncome) {
        let sourceName = txn.name || "Unknown Bank Deposit";
        let source = await prisma.incomeSource.findFirst({
          where: { userId, name: sourceName }
        });
        if (!source) {
          source = await prisma.incomeSource.create({
             data: { userId, name: sourceName, type: "Delivery" }
          });
        }
        sourceId = source.id;
      }

      await prisma.transaction.create({
        data: {
          userId,
          amount: amountAbs,
          type: isIncome ? 'Income' : 'Expense',
          date: new Date(txn.date),
          description: txn.name || 'Bank Transaction',
          taxDeductible: isDeductible ? true : false,
          incomeSourceId: sourceId
        }
      });
      syncCount++;
    }

    return NextResponse.json({ success: true, count: syncCount });
  } catch (error: any) {
    console.error('Error syncing Plaid transactions:', error.response?.data || error.message);
    return NextResponse.json({ error: 'Failed to sync transactions', details: error.message }, { status: 500 });
  }
}
