import { describe, expect, it } from 'vitest';
import { MONEY_MAX, parseHomeOfficeInput, parseMoneyInput } from '@/lib/validation';

/**
 * E2E audit 2026-09-16. Each block below reproduces the scenario the auditor
 * actually ran, so a regression shows up as this test failing rather than as a
 * silently rewritten number.
 */

describe('F9: a negative amount is refused, not silently made positive', () => {
  it('the audit scenario: editing an amount to -9 is rejected', () => {
    const r = parseMoneyInput('-9', 'Amount');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('cannot be negative');
  });

  it('the error explains what to do instead of just refusing', () => {
    const r = parseMoneyInput('-100', 'Amount');
    // The old behaviour stored 9 for -9. A user who meant "money going out"
    // needs to be told the sign is not how that is expressed here.
    if (!r.ok) expect(r.error).toMatch(/expense/i);
  });
});

describe('P3: an out-of-range amount names the field and the limit', () => {
  it('the audit scenario: $10,000,000,000 exceeds DECIMAL(12,2)', () => {
    const r = parseMoneyInput('10000000000', 'Amount');
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('Amount');
      expect(r.error).toContain(MONEY_MAX.toFixed(2));
    }
  });

  it('accepts the largest value the column can actually hold', () => {
    const r = parseMoneyInput(MONEY_MAX.toFixed(2), 'Amount');
    expect(r.ok).toBe(true);
  });
});

describe('parseMoneyInput: the ordinary cases still work', () => {
  it('accepts a normal amount and keeps its precision', () => {
    const r = parseMoneyInput('123.45', 'Amount');
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.toFixed(2)).toBe('123.45');
  });

  it('accepts zero', () => {
    expect(parseMoneyInput('0', 'Amount').ok).toBe(true);
  });

  it('rejects text, blanks and non-finite values', () => {
    for (const bad of ['abc', '', '   ', null, undefined, 'Infinity', 'NaN']) {
      expect(parseMoneyInput(bad, 'Amount').ok).toBe(false);
    }
  });
});

describe('F8: an office larger than the home is refused before it is stored', () => {
  const VALID = { totalSqFt: '1000', officeSqFt: '100', rentAmount: '1000', utilitiesAmount: '100' };

  it('the audit scenario: 1,001 sq ft of office in a 1,000 sq ft home', () => {
    const r = parseHomeOfficeInput({ ...VALID, officeSqFt: '1001' });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain('cannot exceed');
      // Both figures appear, so the user can see which one to change.
      expect(r.error).toContain('1001.00');
      expect(r.error).toContain('1000.00');
    }
  });

  it('accepts an office exactly equal to the home', () => {
    expect(parseHomeOfficeInput({ ...VALID, officeSqFt: '1000' }).ok).toBe(true);
  });

  it('accepts the valid record the auditor saved first', () => {
    const r = parseHomeOfficeInput(VALID);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.values.officeSqFt.toFixed(2)).toBe('100.00');
  });

  it('refuses a negative area rather than clamping it to zero', () => {
    // Math.max(0, …) used to turn -50 into 0 and save it.
    const r = parseHomeOfficeInput({ ...VALID, officeSqFt: '-50' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('cannot be negative');
  });

  it('names the offending field so a four-field form can show where', () => {
    const r = parseHomeOfficeInput({ ...VALID, utilitiesAmount: 'abc' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('Monthly utilities');
  });

  it('requires a home area when an office area is given', () => {
    const r = parseHomeOfficeInput({ ...VALID, totalSqFt: '0', officeSqFt: '0' });
    expect(r.ok).toBe(true); // both zero is "no home office", which is fine
    const bad = parseHomeOfficeInput({ ...VALID, totalSqFt: '0' });
    expect(bad.ok).toBe(false);
  });
});
