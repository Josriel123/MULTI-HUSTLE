import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { likelyTransferIds, transferWarnings, type TransferCandidate } from '../transfers';

/**
 * With money split across accounts, moving it between them looks like
 * income. The check suggests those deposits; it must not catch real income
 * (a client's Zelle payment is often labelled a transfer too).
 */

const d = (iso: string) => new Date(`${iso}T00:00:00Z`);
let n = 0;
function row(over: Partial<TransferCandidate>): TransferCandidate {
  n += 1;
  return {
    id: `t${n}`,
    type: 'Income',
    amount: new Prisma.Decimal('500.00'),
    date: d('2026-03-10'),
    category: null,
    plaidTransactionId: `p${n}`,
    plaidAccountId: 'savings',
    plaidCategory: 'TRANSFER_IN',
    ...over,
  };
}
const outflow = (over: Partial<TransferCandidate> = {}) =>
  row({ type: 'Expense', plaidAccountId: 'checking', plaidCategory: 'TRANSFER_OUT', ...over });

describe('likelyTransferIds', () => {
  it('pairs a deposit with the same amount leaving another of your accounts within three days', () => {
    const deposit = row({});
    expect([...likelyTransferIds([deposit, outflow({ date: d('2026-03-08') })])]).toEqual([deposit.id]);
  });

  it('compares amounts exactly, as decimals: a cent apart is not a match', () => {
    const deposit = row({ amount: '500.00' });
    expect(likelyTransferIds([deposit, outflow({ amount: new Prisma.Decimal('500.01') })]).size).toBe(0);
    expect(likelyTransferIds([deposit, outflow({ amount: '500.0' })]).has(deposit.id)).toBe(true);
  });

  it('needs the other leg in a different account, within the window', () => {
    expect(likelyTransferIds([row({}), outflow({ plaidAccountId: 'savings' })]).size).toBe(0);
    expect(likelyTransferIds([row({}), outflow({ date: d('2026-03-14') })]).size).toBe(0);
  });

  it('leaves a lone deposit labelled a transfer alone: that is how a client payment by Zelle looks', () => {
    expect(likelyTransferIds([row({ plaidCategory: 'TRANSFER_IN' })]).size).toBe(0);
  });

  it('needs both legs labelled as moving money, and ignores deposits already given a category', () => {
    expect(likelyTransferIds([row({ plaidCategory: 'INCOME' }), outflow()]).size).toBe(0);
    expect(likelyTransferIds([row({}), outflow({ plaidCategory: 'GENERAL_MERCHANDISE' })]).size).toBe(0);
    expect(likelyTransferIds([row({ category: 'business_income' }), outflow()]).size).toBe(0);
    expect(likelyTransferIds([row({ plaidTransactionId: null }), outflow()]).size).toBe(0);
  });

  it('counts a credit card payment, which Plaid files under loan payments', () => {
    const payment = row({ plaidAccountId: 'card', plaidCategory: 'LOAN_PAYMENTS' });
    expect(likelyTransferIds([payment, outflow({ plaidCategory: 'LOAN_PAYMENTS' })]).has(payment.id)).toBe(true);
  });

  it('uses each outflow once: two deposits need two outflows', () => {
    const a = row({});
    const b = row({ date: d('2026-03-11') });
    expect(likelyTransferIds([a, b, outflow()]).size).toBe(1);
    expect(likelyTransferIds([a, b, outflow(), outflow()]).size).toBe(2);
  });
});

describe('transferWarnings', () => {
  it('says how many deposits and how much, and is empty when there are none', () => {
    expect(transferWarnings([row({})])).toEqual([]);
    const [w] = transferWarnings([row({ amount: '120.50' }), outflow({ amount: '120.50' }), row({ amount: '79.50' }), outflow({ amount: '79.50' })]);
    expect(w.code).toBe('possible_transfers');
    expect(w.amount).toBe('200.00');
    expect(w.message).toMatch(/^2 deposits look like money you moved between your own accounts/);
  });
});
