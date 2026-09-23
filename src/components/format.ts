import { EXPENSE_CATEGORIES, INCOME_CATEGORIES } from '@/lib/tax/categories';

/**
 * Display formatting for values that arrive from the API.
 *
 * These functions format; they never compute a tax figure. Every number shown
 * on a page comes from the estimate payload as-is. Converting a decimal string
 * such as "18400.00" to a Number for `Intl.NumberFormat` is formatting, not
 * arithmetic.
 */

const usd = (fractionDigits: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });

const WHOLE_DOLLARS = usd(0);
const CENTS = usd(2);

/**
 * Format a dollar amount. Whole dollars by default (dashboard figures);
 * `cents: true` for ledgers. Accepts the decimal strings the API sends for
 * Prisma Decimal columns. Null, undefined or unparsable input renders as "—"
 * rather than "$0", so a missing value is never mistaken for a zero one.
 */
export function formatCurrency(value: number | string | null | undefined, options: { cents?: boolean } = {}): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return (options.cents ? CENTS : WHOLE_DOLLARS).format(n);
}

/**
 * Default date string (YYYY-MM-DD) for transaction and mileage entry forms.
 *
 * e2e audit 2026-09-16, F4:
 * When viewing a prior or future tax year, forms should default within that
 * tax year rather than today's date, preventing accidental entry into the wrong year.
 */
export function defaultTransactionDate(taxYear?: number): string {
  const today = new Date();
  const currentYear = today.getFullYear();
  if (!taxYear || taxYear === currentYear) {
    return today.toISOString().slice(0, 10);
  }
  return `${taxYear}-01-01`;
}

/** Miles with one decimal at most, e.g. "1,204.5 mi". */
export function formatMiles(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return '—';
  const n = typeof value === 'string' ? Number(value) : value;
  if (!Number.isFinite(n)) return '—';
  return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(n)} mi`;
}

/** A fraction such as 0.15 as "15%". */
export function formatPercent(fraction: number | null | undefined, maximumFractionDigits = 1): string {
  if (fraction === null || fraction === undefined || !Number.isFinite(fraction)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'percent', maximumFractionDigits }).format(fraction);
}

/** "other_business_expense" -> "Other business expense". Last resort for a slug with no known label. */
export function humanizeSlug(slug: string): string {
  const words = slug.replace(/[_-]+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * User-facing label for a `Transaction.category` slug, from the tax engine's
 * own vocabulary so the UI and the rules agree. Unknown or empty slugs fall
 * back to a humanised form; a raw slug must never reach the screen.
 */
export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return 'Uncategorised';
  if (Object.prototype.hasOwnProperty.call(INCOME_CATEGORIES, slug)) {
    return INCOME_CATEGORIES[slug as keyof typeof INCOME_CATEGORIES].label;
  }
  if (Object.prototype.hasOwnProperty.call(EXPENSE_CATEGORIES, slug)) {
    return EXPENSE_CATEGORIES[slug as keyof typeof EXPENSE_CATEGORIES].label;
  }
  return humanizeSlug(slug);
}

const FILING_STATUS_LABELS: Record<string, string> = {
  single: 'Single',
  married_filing_jointly: 'Married filing jointly',
  married_filing_separately: 'Married filing separately',
  head_of_household: 'Head of household',
  qualifying_surviving_spouse: 'Qualifying surviving spouse',
};

export function filingStatusLabel(status: string | null | undefined): string {
  if (!status) return 'Single';
  return FILING_STATUS_LABELS[status] ?? humanizeSlug(status);
}

const HOME_OFFICE_METHOD_LABELS: Record<string, string> = {
  simplified: 'Simplified method ($5 per square foot)',
  regular: 'Regular method (Form 8829)',
  none: 'No deduction this year',
};

export function homeOfficeMethodLabel(method: string | null | undefined): string {
  if (!method) return HOME_OFFICE_METHOD_LABELS.none;
  return HOME_OFFICE_METHOD_LABELS[method] ?? humanizeSlug(method);
}

/** ISO or Date to "Sep 10, 2026". */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-07-01" to "Jul 1", read as a calendar date with no time zone involved. */
function shortDate(iso: string): string {
  const [, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}`;
}

/**
 * Cents per mile ("72.5", "76") to a dollar rate ("$0.725/mi", "$0.76/mi").
 *
 * Done on the string, not as floating point: shifting the decimal point two
 * places is exact, and the IRS announces rates to the half cent.
 */
export function formatMileageRate(centsPerMile: string): string {
  const [whole, frac = ''] = centsPerMile.trim().split('.');
  const digits = whole.padStart(3, '0'); // "72" -> "072": at least one dollar digit
  const dollars = digits.slice(0, -2).replace(/^0+(?=\d)/, '');
  const decimals = (digits.slice(-2) + frac).replace(/0+$/, '').padEnd(2, '0');
  return `$${dollars}.${decimals}/mi`;
}

export interface MileageRateSummary {
  /** The rate to headline. */
  rate: string;
  /** One line under it: the notice for a single rate, or every period when there are several. */
  caption: string;
}

/**
 * What the mileage rate card shows for a tax year.
 *
 * One period: that rate, captioned with the notice that set it. Several (the
 * IRS raised the 2026 rate on July 1): the rate in force today when today falls
 * inside the year, otherwise the last one, with every period in the caption so
 * a mid-year change is never hidden — trips before the change are priced at
 * the earlier rate. `todayIso` is a parameter so this stays a pure function.
 */
export function mileageRateSummary(
  periods: ReadonlyArray<{ from: string; to: string; centsPerMile: string; citation: string }>,
  todayIso: string,
): MileageRateSummary | null {
  if (periods.length === 0) return null;
  if (periods.length === 1) {
    return { rate: formatMileageRate(periods[0].centsPerMile), caption: periods[0].citation };
  }
  const inForce = periods.find((p) => p.from <= todayIso && todayIso <= p.to) ?? periods[periods.length - 1];
  const list = periods.map((p) => `${formatMileageRate(p.centsPerMile).replace('/mi', '')} ${shortDate(p.from)}–${shortDate(p.to)}`);
  return {
    rate: formatMileageRate(inForce.centsPerMile),
    caption: `Changed mid-year: ${list.join(', ')}. Each trip is priced on its date.`,
  };
}
