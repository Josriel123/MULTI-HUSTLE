import { prisma } from './prisma';

/**
 * Every row the federal estimate reads, for one user and one tax year.
 *
 * The summary and the chart both load through here and then hand the result to
 * `summaryPayload` / `chartPayload` (src/lib/dashboard.ts), so they cannot
 * disagree about what feeds the engine; the e2e audit of 2026-09-16 found them
 * each wiring it separately, with mileage missing from both.
 *
 * Everything is year-scoped. The form tables hold one row per user per year
 * (an unfiltered include would apply another year's 1098-T), W-2s and
 * estimated payments are keyed by the tax year they belong to, and
 * transactions and trips by date.
 */
export async function loadEstimateRows(userId: string, taxYear: number) {
  const dateRange = { gte: new Date(Date.UTC(taxYear, 0, 1)), lt: new Date(Date.UTC(taxYear + 1, 0, 1)) };
  const [user, transactions, mileageLogs, w2Forms, estimatedPayments] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      include: {
        form1098T: { where: { taxYear } },
        form1098E: { where: { taxYear } },
        homeOffice: { where: { taxYear } },
      },
    }),
    prisma.transaction.findMany({
      where: { userId, date: dateRange },
      include: { incomeSource: { select: { name: true, type: true } } },
      orderBy: { date: 'asc' },
    }),
    prisma.mileageLog.findMany({ where: { userId, date: dateRange }, orderBy: { date: 'asc' } }),
    prisma.w2Form.findMany({ where: { userId, taxYear }, orderBy: { createdAt: 'asc' } }),
    prisma.estimatedTaxPayment.findMany({ where: { userId, taxYear }, orderBy: { paidOn: 'asc' } }),
  ]);

  return {
    taxYear,
    user,
    transactions,
    mileageLogs,
    // The compound unique on (userId, taxYear) means at most one row each.
    form1098T: user?.form1098T[0] ?? null,
    form1098E: user?.form1098E[0] ?? null,
    homeOffice: user?.homeOffice[0] ?? null,
    w2Forms,
    estimatedPayments,
  };
}
