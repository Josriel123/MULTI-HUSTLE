import { describe, expect, it } from 'vitest';
import { getTaxYearParameters, SUPPORTED_TAX_YEARS } from '@/lib/tax';
import { formatMileageRate, mileageRateSummary } from '../format';

/**
 * Second e2e pass, S2: deleting the last trip changed the displayed 2026 rate
 * from $0.7600/mi to $0.725/mi, because the card copied the rate off the latest
 * trip and fell back to a '0.725' typed into the component. The card now reads
 * the engine's periods. These tests use the engine's real parameter tables, so
 * a rate change in the parameters flows through without editing the UI.
 */

const periodsFor = (year: number) =>
  getTaxYearParameters(year).standardMileage.map((p) => ({
    from: p.from,
    to: p.to,
    centsPerMile: p.centsPerMile,
    citation: p.citation.label,
  }));

describe('formatMileageRate: exact, on the string', () => {
  it.each([
    ['72.5', '$0.725/mi'],
    ['76', '$0.76/mi'],
    ['70', '$0.70/mi'],
    ['70.0', '$0.70/mi'],
    ['65.5', '$0.655/mi'],
    ['7', '$0.07/mi'],
    ['100', '$1.00/mi'],
  ])('%s cents -> %s', (cents, expected) => {
    expect(formatMileageRate(cents)).toBe(expected);
  });
});

describe('mileageRateSummary: 2026, which changed on July 1', () => {
  const p2026 = periodsFor(2026);

  it('has two periods in the engine, so this test is exercising the real case', () => {
    expect(p2026).toHaveLength(2);
  });

  it('the audit scenario: in September 2026 it shows 76 cents, trips or no trips', () => {
    // The old card showed $0.725 here once the last trip was deleted.
    const s = mileageRateSummary(p2026, '2026-09-23');
    expect(s?.rate).toBe('$0.76/mi');
  });

  it('shows the earlier rate on a date before the change', () => {
    expect(mileageRateSummary(p2026, '2026-03-01')?.rate).toBe('$0.725/mi');
  });

  it('switches exactly on the boundary', () => {
    expect(mileageRateSummary(p2026, '2026-06-30')?.rate).toBe('$0.725/mi');
    expect(mileageRateSummary(p2026, '2026-07-01')?.rate).toBe('$0.76/mi');
  });

  it('never hides the mid-year change: both periods are in the caption', () => {
    const s = mileageRateSummary(p2026, '2026-09-23');
    expect(s?.caption).toContain('$0.725 Jan 1–Jun 30');
    expect(s?.caption).toContain('$0.76 Jul 1–Dec 31');
  });

  it('viewed after the year ends, shows the rate the year ended on', () => {
    expect(mileageRateSummary(p2026, '2027-02-01')?.rate).toBe('$0.76/mi');
  });
});

describe('mileageRateSummary: single-rate years', () => {
  it.each(SUPPORTED_TAX_YEARS.filter((y) => periodsFor(y).length === 1))('%i shows its own rate and notice', (year) => {
    const [only] = periodsFor(year);
    const s = mileageRateSummary(periodsFor(year), '2026-09-23');
    expect(s?.rate).toBe(formatMileageRate(only.centsPerMile));
    expect(s?.caption).toBe(only.citation);
    // The old fallback was 2026's first rate, whatever year was selected.
    if (year !== 2026) expect(s?.rate).not.toBe('$0.725/mi');
  });

  it('returns nothing to show rather than inventing a rate', () => {
    expect(mileageRateSummary([], '2026-09-23')).toBeNull();
  });
});
