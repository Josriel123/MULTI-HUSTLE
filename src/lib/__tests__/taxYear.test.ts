import { describe, it, expect, afterEach, vi } from 'vitest';
import { SUPPORTED_TAX_YEARS, latestSupportedTaxYear } from '@/lib/tax';
import { resolveTaxYear, resolveTaxYearFromRequest } from '@/lib/taxYear';

/**
 * These pin the rule that decides which year's data a request sees. Getting it
 * wrong is invisible — the estimate still returns a confident number, just for
 * the wrong year.
 */

afterEach(() => {
  vi.useRealTimers();
});

/** Pretend "now" is midday UTC on 1 July of the given year. */
function freezeYear(year: number) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(Date.UTC(year, 6, 1, 12)));
}

describe('resolveTaxYear', () => {
  it('accepts an explicit supported year', () => {
    const year = SUPPORTED_TAX_YEARS[0];
    const r = resolveTaxYear(String(year));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.taxYear).toBe(year);
      expect(r.warnings).toHaveLength(0);
    }
  });

  it('rejects an unsupported year rather than silently substituting one', () => {
    const r = resolveTaxYear('1999');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('taxYear must be one of');
  });

  it('rejects a non-numeric year', () => {
    expect(resolveTaxYear('last-april').ok).toBe(false);
  });

  it('defaults to the current calendar year when it is supported', () => {
    const year = latestSupportedTaxYear();
    freezeYear(year);
    const r = resolveTaxYear(null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.taxYear).toBe(year);
      expect(r.warnings).toHaveLength(0);
    }
  });

  it('falls back to the latest supported year WITH a warning, never silently', () => {
    // A year past the end of the parameter tables: the estimate can still be
    // produced, but the caller has to be able to say which rules were applied.
    freezeYear(latestSupportedTaxYear() + 5);
    const r = resolveTaxYear(null);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.taxYear).toBe(latestSupportedTaxYear());
      expect(r.warnings.map((w) => w.code)).toContain('tax_year_fallback');
    }
  });
});

describe('resolveTaxYearFromRequest', () => {
  const [first] = SUPPORTED_TAX_YEARS;
  const last = latestSupportedTaxYear();

  it('prefers the body over the query string', () => {
    const r = resolveTaxYearFromRequest(String(first), last);
    expect(r.ok && r.taxYear).toBe(last);
  });

  it('falls back to the query string when the body omits the year', () => {
    for (const empty of [undefined, null, '']) {
      const r = resolveTaxYearFromRequest(String(first), empty);
      expect(r.ok && r.taxYear).toBe(first);
    }
  });

  it('rejects a bad body year instead of falling through to the query string', () => {
    // Silently ignoring an explicit-but-invalid year would write the row under
    // a different year than the caller asked for.
    const r = resolveTaxYearFromRequest(String(first), 1999);
    expect(r.ok).toBe(false);
  });
});
