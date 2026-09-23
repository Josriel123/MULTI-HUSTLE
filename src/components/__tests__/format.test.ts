import { describe, expect, it, vi } from 'vitest';
import { categoryLabel, defaultTransactionDate, filingStatusLabel, formatCurrency, formatDate, formatMiles, formatPercent, homeOfficeMethodLabel, humanizeSlug } from '../format';

describe('formatCurrency', () => {
  it('formats numbers and the decimal strings the API sends', () => {
    expect(formatCurrency(18400)).toBe('$18,400');
    expect(formatCurrency('18400.00')).toBe('$18,400');
    expect(formatCurrency('45.67', { cents: true })).toBe('$45.67');
    expect(formatCurrency(1077.17)).toBe('$1,077');
    expect(formatCurrency(-4000)).toBe('-$4,000');
  });

  it('renders a dash, not $0, for missing or unparsable values', () => {
    expect(formatCurrency(null)).toBe('—');
    expect(formatCurrency(undefined)).toBe('—');
    expect(formatCurrency('')).toBe('—');
    expect(formatCurrency('abc')).toBe('—');
    expect(formatCurrency(0)).toBe('$0');
  });
});

describe('other formatters', () => {
  it('formats miles, percents and dates', () => {
    expect(formatMiles('1204.50')).toBe('1,204.5 mi');
    expect(formatMiles(0)).toBe('0 mi');
    expect(formatPercent(0.15)).toBe('15%');
    expect(formatPercent(0.17647)).toBe('17.6%');
    expect(formatDate('2026-04-18T04:20:11.479Z')).toBe('Apr 18, 2026');
    expect(formatDate(null)).toBe('—');
  });
});

describe('defaultTransactionDate', () => {
  it('defaults to today when taxYear matches current calendar year or is omitted', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

    expect(defaultTransactionDate(2026)).toBe('2026-07-15');
    expect(defaultTransactionDate(undefined)).toBe('2026-07-15');

    vi.useRealTimers();
  });

  it('defaults to the start of the selected tax year when not the current calendar year', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T12:00:00Z'));

    expect(defaultTransactionDate(2025)).toBe('2025-01-01');
    expect(defaultTransactionDate(2027)).toBe('2027-01-01');

    vi.useRealTimers();
  });
});

describe('labels', () => {
  it('never shows a raw category slug', () => {
    expect(categoryLabel('other_business_expense')).toBe('Other business expense');
    expect(categoryLabel('business_income')).toBe('Business income (gig, freelance, contract)');
    expect(categoryLabel('equipment')).toMatch(/^Equipment/);
    expect(categoryLabel('not_a_real_category')).toBe('Not a real category');
    expect(categoryLabel(null)).toBe('Uncategorised');
    expect(categoryLabel('')).toBe('Uncategorised');
  });

  it('labels filing statuses and home office methods', () => {
    expect(filingStatusLabel('married_filing_jointly')).toBe('Married filing jointly');
    expect(filingStatusLabel(undefined)).toBe('Single');
    expect(homeOfficeMethodLabel('simplified')).toMatch(/Simplified/);
    expect(homeOfficeMethodLabel('none')).toBe('No deduction this year');
    expect(humanizeSlug('head_of_household')).toBe('Head of household');
  });
});

describe('formatDollarRate', () => {
  it('keeps the half cent and always shows cents', async () => {
    const { formatDollarRate } = await import('../format');
    expect(formatDollarRate('0.7250')).toBe('$0.725/mi');
    expect(formatDollarRate('0.7000')).toBe('$0.70/mi');
    expect(formatDollarRate('0.7600')).toBe('$0.76/mi');
  });
});

describe('normalizeMoneyText', () => {
  it('drops a dollar sign and well-placed thousands separators, and nothing else', async () => {
    const { normalizeMoneyText } = await import('../moneyText');
    expect(normalizeMoneyText(' $1,200.50 ')).toBe('1200.50');
    expect(normalizeMoneyText('12,345,678')).toBe('12345678');
    expect(normalizeMoneyText('45.10')).toBe('45.10');
    // Ambiguous: passed through for the server to refuse, never guessed at.
    expect(normalizeMoneyText('1.200,50')).toBe('1.200,50');
    expect(normalizeMoneyText('1,20')).toBe('1,20');
  });
});
