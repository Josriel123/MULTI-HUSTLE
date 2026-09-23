import type { Prisma } from '@prisma/client';
import { getTaxYearParameters, isFilingStatus, type FilingStatus } from '@/lib/tax';
import { parseDateInput, parseMoneyInput, parseOptionalMoneyInput } from './validation';

/**
 * Request-body validation for the W-2, estimated payment and tax profile
 * routes. Same rule as validation.ts: refuse and say why, never correct.
 */

type Result<T> = { ok: true; values: T } | { ok: false; error: string };

export const EMPLOYER_NAME_MAX = 80;

export interface W2Values {
  employer: string;
  wages: Prisma.Decimal;
  federalWithheld: Prisma.Decimal;
  socialSecurityWages: Prisma.Decimal;
  socialSecurityTips: Prisma.Decimal;
  medicareWages: Prisma.Decimal;
  medicareWithheld: Prisma.Decimal;
  ownedByTaxpayer: boolean;
}

/**
 * A W-2 for `taxYear`. Boxes 1, 3 and 5 are required (0 is allowed: box 3 is
 * 0 for, say, a student exempt from FICA); 2, 6 and 7 may be blank.
 *
 * One cross-check: an employer stops withholding Social Security at the wage
 * base, so boxes 3 and 7 together cannot exceed it on a real W-2. A larger
 * figure is a typo, and it would quietly erase the Social Security part of
 * self-employment tax, so it is refused.
 */
export function parseW2Input(body: Record<string, unknown>, taxYear: number): Result<W2Values> {
  const employer = typeof body.employer === 'string' ? body.employer.trim().replace(/\s+/g, ' ') : '';
  if (employer === '') return { ok: false, error: 'Employer name is required.' };
  if (employer.length > EMPLOYER_NAME_MAX) return { ok: false, error: `Employer name must be ${EMPLOYER_NAME_MAX} characters or fewer.` };

  const fields = [
    ['wages', 'Box 1 (wages, tips, other compensation)', true],
    ['federalWithheld', 'Box 2 (federal income tax withheld)', false],
    ['socialSecurityWages', 'Box 3 (Social Security wages)', true],
    ['socialSecurityTips', 'Box 7 (Social Security tips)', false],
    ['medicareWages', 'Box 5 (Medicare wages and tips)', true],
    ['medicareWithheld', 'Box 6 (Medicare tax withheld)', false],
  ] as const;
  const money: Record<string, Prisma.Decimal> = {};
  for (const [key, label, required] of fields) {
    const parsed = required ? parseMoneyInput(body[key], label) : parseOptionalMoneyInput(body[key], label);
    if (!parsed.ok) return { ok: false, error: parsed.error };
    money[key] = parsed.value;
  }

  const base = getTaxYearParameters(taxYear).selfEmployment.socialSecurityWageBase;
  const ssTotal = money.socialSecurityWages.plus(money.socialSecurityTips);
  if (ssTotal.greaterThan(base)) {
    return {
      ok: false,
      error: `Boxes 3 and 7 together (${ssTotal.toFixed(2)}) can't be more than the ${taxYear} Social Security wage base of ${Number(base).toLocaleString('en-US')}. An employer stops at the base; check the form.`,
    };
  }

  if (body.ownedByTaxpayer !== undefined && typeof body.ownedByTaxpayer !== 'boolean') {
    return { ok: false, error: 'ownedByTaxpayer must be true or false.' };
  }

  return {
    ok: true,
    values: {
      employer,
      wages: money.wages,
      federalWithheld: money.federalWithheld,
      socialSecurityWages: money.socialSecurityWages,
      socialSecurityTips: money.socialSecurityTips,
      medicareWages: money.medicareWages,
      medicareWithheld: money.medicareWithheld,
      ownedByTaxpayer: body.ownedByTaxpayer ?? true,
    },
  };
}

export const PAYMENT_NOTE_MAX = 120;

export interface PaymentValues {
  paidOn: Date;
  amount: Prisma.Decimal;
  note: string | null;
}

/** An estimated tax payment. The amount must be more than zero; a zero payment records nothing. */
export function parsePaymentInput(body: Record<string, unknown>): Result<PaymentValues> {
  const amount = parseMoneyInput(body.amount, 'Amount');
  if (!amount.ok) return { ok: false, error: amount.error };
  if (amount.value.isZero()) return { ok: false, error: 'Amount must be more than zero.' };

  const paidOn = parseDateInput(body.paidOn, 'Date paid');
  if (!paidOn.ok) return { ok: false, error: paidOn.error };

  let note: string | null = null;
  if (body.note !== undefined && body.note !== null) {
    if (typeof body.note !== 'string') return { ok: false, error: 'Note must be text.' };
    const trimmed = body.note.trim();
    if (trimmed.length > PAYMENT_NOTE_MAX) return { ok: false, error: `Note must be ${PAYMENT_NOTE_MAX} characters or fewer.` };
    note = trimmed === '' ? null : trimmed;
  }

  return { ok: true, values: { paidOn: paidOn.value, amount: amount.value, note } };
}

export interface ProfileValues {
  filingStatus: FilingStatus;
  claimedAsDependent: boolean;
  spouseItemizes: boolean;
}

/**
 * The tax profile. `spouseItemizes` only means something when married filing
 * separately (IRC §63(c)(6)(A)); set with any other status it is refused, so
 * a stale tick cannot sit unseen behind a status that ignores it.
 */
export function parseProfileInput(body: Record<string, unknown>): Result<ProfileValues> {
  if (!isFilingStatus(body.filingStatus)) return { ok: false, error: 'Choose a filing status.' };
  for (const key of ['claimedAsDependent', 'spouseItemizes'] as const) {
    if (body[key] !== undefined && typeof body[key] !== 'boolean') return { ok: false, error: `${key} must be true or false.` };
  }
  const spouseItemizes = (body.spouseItemizes as boolean | undefined) ?? false;
  if (spouseItemizes && body.filingStatus !== 'married_filing_separately') {
    return { ok: false, error: '"My spouse itemizes" applies only when married filing separately.' };
  }
  return {
    ok: true,
    values: {
      filingStatus: body.filingStatus,
      claimedAsDependent: (body.claimedAsDependent as boolean | undefined) ?? false,
      spouseItemizes,
    },
  };
}
