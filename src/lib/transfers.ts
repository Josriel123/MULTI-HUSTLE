import { money, sum, toFixed2, type MoneyInput, type Warning } from '@/lib/tax';

/** What the transfer check reads from a transaction row. */
export interface TransferCandidate {
  id: string;
  type: string;
  /** A Prisma Decimal or a decimal string: compared exactly, never as a JS number (AGENTS.md invariant 2). */
  amount: MoneyInput;
  date: Date;
  category: string | null;
  plaidTransactionId: string | null;
  plaidAccountId?: string | null;
  plaidCategory?: string | null;
}

/** Two legs of one move between banks can post a few days apart. */
export const TRANSFER_WINDOW_DAYS = 3;
const DAY_MS = 86_400_000;

// Plaid's primary categories for money moving between accounts. A credit
// card payment shows up under LOAN_PAYMENTS on one or both sides.
const IN_LABELS = new Set(['TRANSFER_IN', 'LOAN_PAYMENTS']);
const OUT_LABELS = new Set(['TRANSFER_OUT', 'LOAN_PAYMENTS']);

/**
 * Deposits that look like money moved between the user's own accounts rather
 * than income (D52): an uncategorised bank deposit that Plaid labels a
 * transfer, matched by an outflow of exactly the same amount that Plaid also
 * labels a transfer, in a different one of the user's connected accounts,
 * within three days. Each outflow pairs with one deposit at most.
 *
 * Both legs have to sit in accounts the user connected, which is what makes
 * the match mean something: a client's Zelle payment, which Plaid may also
 * call TRANSFER_IN, has no matching outflow in the user's own accounts. It is
 * a suggestion only. The category the user picks stays the only thing that
 * decides tax (D17), because treating real income as a transfer would
 * understate the tax.
 */
export function likelyTransferIds(rows: readonly TransferCandidate[]): Set<string> {
  const outs = rows.filter(
    (r) => r.type === 'Expense' && r.plaidTransactionId && r.plaidAccountId && r.plaidCategory && OUT_LABELS.has(r.plaidCategory),
  );
  const deposits = rows
    .filter((r) => r.type === 'Income' && !r.category && r.plaidTransactionId && r.plaidAccountId && r.plaidCategory && IN_LABELS.has(r.plaidCategory))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const paired = new Set<string>();
  const likely = new Set<string>();
  for (const deposit of deposits) {
    const amount = money(deposit.amount);
    const match = outs.find(
      (o) =>
        !paired.has(o.id) &&
        o.plaidAccountId !== deposit.plaidAccountId &&
        money(o.amount).equals(amount) &&
        Math.abs(o.date.getTime() - deposit.date.getTime()) <= TRANSFER_WINDOW_DAYS * DAY_MS,
    );
    if (match) {
      paired.add(match.id);
      likely.add(deposit.id);
    }
  }
  return likely;
}

/**
 * The estimate's warning for those deposits: until they are marked as
 * transfers they are counted as income, so income (and the tax) run high.
 */
export function transferWarnings(rows: readonly TransferCandidate[]): Warning[] {
  const ids = likelyTransferIds(rows);
  if (ids.size === 0) return [];
  const total = sum(rows.filter((r) => ids.has(r.id)).map((r) => money(r.amount)));
  const n = ids.size;
  return [
    {
      code: 'possible_transfers',
      message: `${n} ${n === 1 ? 'deposit looks' : 'deposits look'} like money you moved between your own accounts, and ${n === 1 ? 'is' : 'are'} counted as income until you say otherwise. If ${n === 1 ? 'it is' : 'they are'}, mark ${n === 1 ? 'it' : 'them'} "Transfer between your own accounts" on Income & expenses.`,
      amount: toFixed2(total),
    },
  ];
}
