import { Prisma } from '@prisma/client';

/**
 * Validation for the numeric fields that reach DECIMAL(12,2) columns.
 *
 * The e2e audit (2026-09-16) found two variants of one habit: `PATCH
 * /api/transactions/[id]` turned a submitted -9 into 9 with `.abs()`, and the
 * home office route turned a negative area into 0 with `Math.max(0, …)`.
 * Neither told the user anything. Silently rewriting a number someone typed
 * into a tax app is worse than refusing it — they believe the value they
 * entered is the value that was stored.
 *
 * A third variant had no guard at all: an amount beyond what DECIMAL(12,2)
 * can hold reached Prisma and came back as "Failed to post transaction",
 * which says nothing about which field or why.
 */

/** DECIMAL(12,2): ten digits before the point, two after. */
export const MONEY_MAX = new Prisma.Decimal('9999999999.99');

export type ParsedMoney = { ok: true; value: Prisma.Decimal } | { ok: false; error: string };

/**
 * Parse a user-supplied number for a DECIMAL(12,2) column.
 *
 * Rejects rather than corrects: not a number, negative, or out of range. The
 * caller decides the status code; every message names the field and says what
 * would have been acceptable.
 */
export function parseMoneyInput(value: unknown, field: string): ParsedMoney {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { ok: false, error: `${field} is required.` };
  }

  let decimal: Prisma.Decimal;
  try {
    decimal = new Prisma.Decimal(String(value).trim());
  } catch {
    return { ok: false, error: `${field} must be a number.` };
  }

  if (!decimal.isFinite()) {
    return { ok: false, error: `${field} must be a finite number.` };
  }

  if (decimal.isNegative()) {
    // Deliberately not abs(). Expense vs income is `type`, not the sign, and a
    // negative here means the user meant something the form cannot express.
    return {
      ok: false,
      error: `${field} cannot be negative. Record money going out as an expense rather than a negative amount.`,
    };
  }

  if (decimal.greaterThan(MONEY_MAX)) {
    return {
      ok: false,
      error: `${field} must be ${MONEY_MAX.toFixed(2)} or less.`,
    };
  }

  // The column keeps two decimals and Postgres would round a third away
  // without a word, the same silent rewrite as the others above.
  if (decimal.decimalPlaces() > 2) {
    return { ok: false, error: `${field} can have at most two decimal places.` };
  }

  return { ok: true, value: decimal };
}

/**
 * Same rules for a box that may be left blank, such as W-2 box 7 when there
 * were no tips: blank means zero. Anything typed is parsed exactly as above.
 */
export function parseOptionalMoneyInput(value: unknown, field: string): ParsedMoney {
  if (value === undefined || value === null || String(value).trim() === '') {
    return { ok: true, value: new Prisma.Decimal(0) };
  }
  return parseMoneyInput(value, field);
}

export type ParsedDate = { ok: true; value: Date } | { ok: false; error: string };

/**
 * A calendar date as YYYY-MM-DD, stored at UTC midnight like every other date
 * here. `new Date('2025-02-30')` quietly becomes March 2, so the parts are
 * checked after parsing.
 */
export function parseDateInput(value: unknown, field: string): ParsedDate {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.trim())) {
    return { ok: false, error: `${field} must be a date (YYYY-MM-DD).` };
  }
  const iso = value.trim();
  const date = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== iso) {
    return { ok: false, error: `${field} is not a real date.` };
  }
  return { ok: true, value: date };
}

export type ParsedHomeOffice =
  | { ok: true; values: { totalSqFt: Prisma.Decimal; officeSqFt: Prisma.Decimal; rentAmount: Prisma.Decimal; utilitiesAmount: Prisma.Decimal } }
  | { ok: false; error: string };

/**
 * Validate a home office record as a whole, before it is persisted.
 *
 * The audit's F8: the route checked only for NaN, so an office larger than the
 * home was stored and the engine rejected it afterwards. Every later estimate
 * for that user then failed, which blanked unrelated pages. The relationship
 * between the two areas has to be checked here, where it can still be refused.
 */
export function parseHomeOfficeInput(body: {
  totalSqFt?: unknown;
  officeSqFt?: unknown;
  rentAmount?: unknown;
  utilitiesAmount?: unknown;
}): ParsedHomeOffice {
  const fields = [
    ['totalSqFt', 'Total home area', body.totalSqFt],
    ['officeSqFt', 'Office area', body.officeSqFt],
    ['rentAmount', 'Monthly rent', body.rentAmount],
    ['utilitiesAmount', 'Monthly utilities', body.utilitiesAmount],
  ] as const;

  const parsed: Record<string, Prisma.Decimal> = {};
  for (const [key, label, raw] of fields) {
    const result = parseMoneyInput(raw, label);
    if (!result.ok) return { ok: false, error: result.error };
    parsed[key] = result.value;
  }

  if (parsed.officeSqFt.greaterThan(parsed.totalSqFt)) {
    return {
      ok: false,
      error: `Office area (${parsed.officeSqFt.toFixed(2)} sq ft) cannot exceed the total home area (${parsed.totalSqFt.toFixed(2)} sq ft).`,
    };
  }

  if (parsed.totalSqFt.isZero() && parsed.officeSqFt.greaterThan(0)) {
    return { ok: false, error: 'Total home area is required when an office area is given.' };
  }

  return {
    ok: true,
    values: {
      totalSqFt: parsed.totalSqFt,
      officeSqFt: parsed.officeSqFt,
      rentAmount: parsed.rentAmount,
      utilitiesAmount: parsed.utilitiesAmount,
    },
  };
}
