import { describe, expect, it } from 'vitest';
import { parsePaymentInput, parseProfileInput, parseW2Input } from '../formInput';
import { isHustleKind, matchHustle, parseHustleName } from '../hustles';
import { parseDateInput, parseOptionalMoneyInput } from '../validation';

const W2 = { employer: '  Blue  Bottle Cafe ', wages: '31000.50', socialSecurityWages: '31000.50', medicareWages: '31000.50' };

describe('parseW2Input', () => {
  it('accepts a W-2 with only the required boxes, blanks meaning zero, and tidies the employer name', () => {
    const r = parseW2Input({ ...W2, federalWithheld: '', socialSecurityTips: null }, 2025);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.employer).toBe('Blue Bottle Cafe');
    expect(r.values.wages.toFixed(2)).toBe('31000.50');
    expect(r.values.federalWithheld.toFixed(2)).toBe('0.00');
    expect(r.values.socialSecurityTips.toFixed(2)).toBe('0.00');
    expect(r.values.ownedByTaxpayer).toBe(true);
  });

  it('requires boxes 1, 3 and 5 and names the box that is missing', () => {
    for (const [key, box] of [['wages', 'Box 1'], ['socialSecurityWages', 'Box 3'], ['medicareWages', 'Box 5']] as const) {
      const r = parseW2Input({ ...W2, [key]: '' }, 2025);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error).toContain(box);
    }
  });

  it('refuses a negative box instead of dropping the sign', () => {
    const r = parseW2Input({ ...W2, federalWithheld: '-100' }, 2025);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('cannot be negative');
  });

  it('refuses Social Security wages above the year\'s wage base: no employer withholds past it', () => {
    const r = parseW2Input({ ...W2, wages: '200000', socialSecurityWages: '176000', socialSecurityTips: '200', medicareWages: '200000' }, 2025);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('176,100');
    // Exactly at the base is a real W-2.
    expect(parseW2Input({ ...W2, wages: '200000', socialSecurityWages: '176100', medicareWages: '200000' }, 2025).ok).toBe(true);
  });

  it('requires an employer name and a real boolean for the owner', () => {
    expect(parseW2Input({ ...W2, employer: '   ' }, 2025).ok).toBe(false);
    expect(parseW2Input({ ...W2, ownedByTaxpayer: 'yes' }, 2025).ok).toBe(false);
    const spouse = parseW2Input({ ...W2, ownedByTaxpayer: false }, 2025);
    expect(spouse.ok && spouse.values.ownedByTaxpayer).toBe(false);
  });
});

describe('parsePaymentInput', () => {
  it('accepts a payment with a date and an optional note', () => {
    const r = parsePaymentInput({ amount: '1250.00', paidOn: '2026-01-15', note: ' Q4 ' });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.values.paidOn.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(r.values.note).toBe('Q4');
  });

  it('refuses a zero payment, a missing date and an impossible date', () => {
    expect(parsePaymentInput({ amount: '0', paidOn: '2025-06-16' }).ok).toBe(false);
    expect(parsePaymentInput({ amount: '10' }).ok).toBe(false);
    const feb30 = parsePaymentInput({ amount: '10', paidOn: '2025-02-30' });
    expect(feb30.ok).toBe(false);
    if (!feb30.ok) expect(feb30.error).toContain('not a real date');
  });
});

describe('parseProfileInput', () => {
  it('accepts every filing status', () => {
    for (const s of ['single', 'married_filing_jointly', 'married_filing_separately', 'head_of_household', 'qualifying_surviving_spouse']) {
      expect(parseProfileInput({ filingStatus: s }).ok).toBe(true);
    }
  });

  it('refuses an unknown status and non-boolean flags', () => {
    expect(parseProfileInput({ filingStatus: 'married' }).ok).toBe(false);
    expect(parseProfileInput({ filingStatus: 'single', claimedAsDependent: 'no' }).ok).toBe(false);
  });

  it('allows "spouse itemizes" only when married filing separately', () => {
    expect(parseProfileInput({ filingStatus: 'married_filing_separately', spouseItemizes: true }).ok).toBe(true);
    expect(parseProfileInput({ filingStatus: 'single', spouseItemizes: true }).ok).toBe(false);
    const off = parseProfileInput({ filingStatus: 'single', spouseItemizes: false });
    expect(off.ok && off.values.spouseItemizes).toBe(false);
  });
});

describe('dates and optional money', () => {
  it('parses YYYY-MM-DD at UTC midnight and nothing else', () => {
    expect(parseDateInput('2025-04-15', 'Date').ok).toBe(true);
    expect(parseDateInput('04/15/2025', 'Date').ok).toBe(false);
    expect(parseDateInput('2025-13-01', 'Date').ok).toBe(false);
    expect(parseDateInput(20250415, 'Date').ok).toBe(false);
  });

  it('reads blank as zero but still refuses junk', () => {
    const blank = parseOptionalMoneyInput('  ', 'Box 7');
    expect(blank.ok && blank.value.toFixed(2)).toBe('0.00');
    expect(parseOptionalMoneyInput('12,00', 'Box 7').ok).toBe(false);
  });
});

describe('hustles', () => {
  it('names: trimmed, spaces collapsed, never empty or over-long', () => {
    expect(parseHustleName('  Logo   design ')).toEqual({ ok: true, name: 'Logo design' });
    expect(parseHustleName('').ok).toBe(false);
    expect(parseHustleName('x'.repeat(61)).ok).toBe(false);
    expect(parseHustleName(42).ok).toBe(false);
  });

  it('kinds are the three the UI offers', () => {
    expect(['Delivery', 'Freelance', 'Other'].every(isHustleKind)).toBe(true);
    expect(isHustleKind('delivery')).toBe(false);
  });

  it('matches a deposit to a hustle the user named, by whole words, longest name first', () => {
    const hustles = [{ name: 'Uber' }, { name: 'Uber Eats' }, { name: 'Etsy' }];
    expect(matchHustle('Uber 072515 SF**POOL**', hustles)?.name).toBe('Uber');
    expect(matchHustle('UBER EATS PAYOUT', hustles)?.name).toBe('Uber Eats');
    expect(matchHustle('ETSY, INC. DEPOSIT', hustles)?.name).toBe('Etsy');
  });

  it('does not match inside another word, or with nothing to match', () => {
    expect(matchHustle('SUBERVISOR PAYROLL', [{ name: 'Uber' }])).toBeNull();
    expect(matchHustle('INTRST PYMNT', [{ name: 'Uber' }])).toBeNull();
    expect(matchHustle(null, [{ name: 'Uber' }])).toBeNull();
    expect(matchHustle('Anything', [{ name: '***' }])).toBeNull();
  });
});
