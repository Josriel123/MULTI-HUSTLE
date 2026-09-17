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
