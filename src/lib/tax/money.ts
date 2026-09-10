import Decimal from 'decimal.js';

/**
 * Money arithmetic for the tax engine.
 *
 * Every dollar amount inside `src/lib/tax` is a decimal.js `Decimal`, never a
 * JavaScript `number`. Binary floating point cannot represent most cents
 * exactly (0.1 + 0.2 !== 0.3), and a tax estimate that drifts by a cent per
 * transaction is not defensible.
 *
 * Prisma returns `Prisma.Decimal` for `DECIMAL(12,2)` columns. That is a
 * bundled copy of the same decimal.js library, but instances from two copies
 * are not `instanceof`-compatible. `money()` therefore normalises every input
 * through its string form instead of trusting the prototype chain.
 *
 * Rounding policy: amounts are rounded to whole cents with ROUND_HALF_UP at
 * the points where an IRS form line would be written down (each function
 * documents where). Intermediate products keep full precision. The IRS permits
 * rounding to whole dollars (Form 1040 instructions, "Rounding Off to Whole
 * Dollars"), so cents-level precision is always at least as exact as a filed
 * return.
 */

// An isolated constructor so configuration here cannot leak into other users
// of decimal.js (and theirs cannot leak into us). 40 significant digits is far
// beyond what DECIMAL(12,2) inputs multiplied by four-decimal rates need.
export const Money = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -20,
  toExpPos: 40,
});

export type Money = InstanceType<typeof Money>;

/** Anything `money()` accepts: a Decimal from any copy of decimal.js, a numeric string, or a finite number. */
export type MoneyInput = Decimal | Money | string | number | { toString(): string };

export class TaxInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxInputError';
  }
}

/** Normalise any supported input to a `Money`. Throws `TaxInputError` on non-finite or unparsable values. */
export function money(value: MoneyInput, field = 'amount'): Money {
  if (value instanceof Money) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TaxInputError(`${field}: expected a finite number, got ${value}`);
    // Route through the shortest round-trip string so 0.1 becomes "0.1", not
    // its 55-digit binary expansion.
    return new Money(String(value));
  }
  const text = typeof value === 'string' ? value.trim() : String(value);
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(text)) {
    throw new TaxInputError(`${field}: expected a decimal string, got ${JSON.stringify(text)}`);
  }
  return new Money(text);
}

/** Like `money()` but rejects negative values, for fields where a negative has no meaning (gross receipts, form boxes). */
export function nonNegativeMoney(value: MoneyInput, field: string): Money {
  const m = money(value, field);
  if (m.lessThan(0)) throw new TaxInputError(`${field}: must not be negative, got ${m.toString()}`);
  return m;
}

export const ZERO: Money = new Money(0);

/** Round to whole cents, half up. This is the only rounding used in the engine. */
export function cents(value: Money): Money {
  return value.toDecimalPlaces(2, Money.ROUND_HALF_UP);
}

/** Round to whole dollars, half up. Used only where a rule is defined in whole dollars. */
export function dollars(value: Money): Money {
  return value.toDecimalPlaces(0, Money.ROUND_HALF_UP);
}

/**
 * Strictly greater than zero. decimal.js's own `isPositive()` returns true for
 * zero (it tests the sign bit), which is never what a tax rule means. Use
 * these instead of `isPositive()` / `isNegative()` everywhere in this package.
 */
export function isAboveZero(value: Money): boolean {
  return value.greaterThan(0);
}

/** Strictly less than zero. See `isAboveZero`. */
export function isBelowZero(value: Money): boolean {
  return value.lessThan(0);
}

/** `max(0, value)`: IRS worksheets phrase this as "if zero or less, enter -0-". */
export function notBelowZero(value: Money): Money {
  return isBelowZero(value) ? ZERO : value;
}

export function sum(values: Iterable<Money>): Money {
  let total: Money = ZERO;
  for (const v of values) total = total.plus(v);
  return total;
}

export function min(a: Money, b: Money): Money {
  return a.lessThanOrEqualTo(b) ? a : b;
}

export function max(a: Money, b: Money): Money {
  return a.greaterThanOrEqualTo(b) ? a : b;
}

/** Multiply by a rate given as an exact decimal string, e.g. `times(x, '0.9235')`. */
export function times(value: Money, rate: string): Money {
  return value.times(new Money(rate));
}

/**
 * Serialise for JSON / API responses. Returns a JS number with at most two
 * decimals. This is the ONLY place the engine converts to `number`, and it
 * must only be called on already-rounded output values.
 */
export function toNumber(value: Money): number {
  return Number(cents(value).toFixed(2));
}

/** Serialise as a fixed two-decimal string ("1234.50"), for logs and test fixtures. */
export function toFixed2(value: Money): string {
  return cents(value).toFixed(2);
}
