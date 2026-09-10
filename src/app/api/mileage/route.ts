import { NextResponse, type NextRequest } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import { requireUser } from '@/lib/user';
import {
  computeStandardMileageDeduction,
  getTaxYearParameters,
  isSupportedTaxYear,
  latestSupportedTaxYear,
  ZERO,
} from '@/lib/tax';

/**
 * Money and Mileage over-the-wire contract:
 * Miles are stored as DECIMAL(10,2) in PostgreSQL. Prisma returns `Prisma.Decimal`.
 * Over the wire (JSON), `miles` is serialised as a decimal string (e.g. "45.50")
 * to avoid floating-point drift.
 */

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const requestedTaxYear = request.nextUrl.searchParams.get('taxYear');
  let dateFilter: { gte: Date; lt: Date } | undefined;

  if (requestedTaxYear !== null) {
    const year = Number(requestedTaxYear);
    if (!Number.isNaN(year)) {
      dateFilter = {
        gte: new Date(Date.UTC(year, 0, 1)),
        lt: new Date(Date.UTC(year + 1, 0, 1)),
      };
    }
  }

  try {
    const logs = await prisma.mileageLog.findMany({
      where: {
        userId,
        ...(dateFilter ? { date: dateFilter } : {}),
      },
      orderBy: { date: 'desc' },
      include: {
        incomeSource: { select: { id: true, name: true, type: true } },
      },
    });

    let totalMilesMoney = ZERO;
    let totalDeductionMoney = ZERO;

    const formattedLogs = logs.map((log) => {
      const isoDate = log.date.toISOString().slice(0, 10);
      const logYear = log.date.getUTCFullYear();
      const yearForPricing = isSupportedTaxYear(logYear) ? logYear : latestSupportedTaxYear();
      const params = getTaxYearParameters(yearForPricing);

      const pricing = computeStandardMileageDeduction(log.miles, isoDate, params);
      totalMilesMoney = totalMilesMoney.plus(pricing.miles);
      totalDeductionMoney = totalDeductionMoney.plus(pricing.deduction);

      return {
        id: log.id,
        date: log.date.toISOString(),
        miles: log.miles.toFixed(2),
        purpose: log.purpose,
        incomeSourceId: log.incomeSourceId,
        incomeSource: log.incomeSource,
        ratePerMile: pricing.ratePerMile.toFixed(4),
        deduction: pricing.deduction.toFixed(2),
        ratePeriod: {
          from: pricing.period.from,
          to: pricing.period.to,
          centsPerMile: pricing.period.centsPerMile,
        },
        citation: pricing.period.citation,
        createdAt: log.createdAt.toISOString(),
      };
    });

    return NextResponse.json({
      logs: formattedLogs,
      totalMiles: totalMilesMoney.toFixed(2),
      totalDeduction: totalDeductionMoney.toFixed(2),
    });
  } catch (error) {
    console.error('Failed to fetch mileage logs:', error);
    return NextResponse.json({ error: 'Failed to fetch mileage logs' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const userId = await requireUser();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const { date, miles, purpose, incomeSourceId } = body;

    if (!date || isNaN(new Date(date).getTime())) {
      return NextResponse.json({ error: 'A valid date is required.' }, { status: 400 });
    }

    if (miles === undefined || miles === null || String(miles).trim() === '') {
      return NextResponse.json({ error: 'Miles driven is required.' }, { status: 400 });
    }

    let decimalMiles: Prisma.Decimal;
    try {
      decimalMiles = new Prisma.Decimal(miles);
      if (decimalMiles.isNegative() || decimalMiles.isZero()) {
        return NextResponse.json({ error: 'Miles driven must be greater than zero.' }, { status: 400 });
      }
    } catch {
      return NextResponse.json({ error: 'Invalid decimal value for miles.' }, { status: 400 });
    }

    if (incomeSourceId) {
      const source = await prisma.incomeSource.findFirst({
        where: { id: incomeSourceId, userId },
      });
      if (!source) {
        return NextResponse.json({ error: 'Specified income source does not belong to user.' }, { status: 400 });
      }
    }

    const tripDate = new Date(date);
    const isoDate = tripDate.toISOString().slice(0, 10);
    const tripYear = tripDate.getUTCFullYear();
    const yearForPricing = isSupportedTaxYear(tripYear) ? tripYear : latestSupportedTaxYear();
    const params = getTaxYearParameters(yearForPricing);

    const pricing = computeStandardMileageDeduction(decimalMiles, isoDate, params);

    const log = await prisma.mileageLog.create({
      data: {
        userId,
        date: tripDate,
        miles: decimalMiles,
        purpose: purpose ? String(purpose).trim() : null,
        incomeSourceId: incomeSourceId || null,
      },
      include: {
        incomeSource: { select: { id: true, name: true, type: true } },
      },
    });

    return NextResponse.json(
      {
        log: {
          id: log.id,
          date: log.date.toISOString(),
          miles: log.miles.toFixed(2),
          purpose: log.purpose,
          incomeSourceId: log.incomeSourceId,
          incomeSource: log.incomeSource,
          ratePerMile: pricing.ratePerMile.toFixed(4),
          deduction: pricing.deduction.toFixed(2),
          createdAt: log.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Failed to log mileage:', error);
    return NextResponse.json({ error: 'Failed to create mileage log' }, { status: 500 });
  }
}
