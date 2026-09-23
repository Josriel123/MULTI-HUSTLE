'use client';

import { useMemo, useState } from 'react';
import { Landmark, Pencil, Search, Trash2 } from 'lucide-react';
import { deleteTransaction, errorText, updateTransaction, type HustleItem, type TransactionItem } from '../api';
import { CategorySelect } from '../CategorySelect';
import { treatmentOf, type Treatment } from '../categoryOptions';
import { cn } from '../cn';
import { categoryLabel, formatCurrency, formatDate } from '../format';
import { Badge, type BadgeTone } from '../ui/Badge';
import { Button } from '../ui/Button';
import { useConfirm } from '../ui/ConfirmDialog';
import { Input, Select } from '../ui/Field';
import { InlineStatus } from '../ui/InlineStatus';
import { SegmentedControl } from '../ui/SegmentedControl';

export type ListFilter = 'all' | 'in' | 'out' | 'uncategorised';

const TREATMENT_TONE: Record<Treatment, BadgeTone> = {
  deductible: 'accent',
  half: 'accent',
  school: 'info',
  not_deducted: 'muted',
  taxable: 'accent',
  not_income: 'muted',
  elsewhere: 'muted',
  uncategorised: 'warning',
};

const MONTH = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const PAGE = 60;

/**
 * The ledger: every transaction in the year, newest first, grouped by month,
 * filterable by direction, hustle and "needs a category". A row with no
 * category gets its category picker right in the list, so reviewing a batch
 * of bank imports is one choice per row, not an edit dialog each.
 */
export function TransactionList({
  transactions,
  hustles,
  filter,
  onFilterChange,
  hustleFilter,
  onHustleFilterChange,
  onEdit,
  onChanged,
}: {
  transactions: readonly TransactionItem[];
  hustles: readonly HustleItem[];
  filter: ListFilter;
  onFilterChange: (f: ListFilter) => void;
  /** '' all hustles, 'none' no hustle, or a hustle id. */
  hustleFilter: string;
  onHustleFilterChange: (h: string) => void;
  onEdit: (tx: TransactionItem) => void;
  onChanged: () => Promise<void>;
}) {
  const [confirm, confirmDialog] = useConfirm();
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(PAGE);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const counts = useMemo(
    () => ({
      all: transactions.length,
      in: transactions.filter((t) => t.type === 'Income').length,
      out: transactions.filter((t) => t.type === 'Expense').length,
      uncategorised: transactions.filter((t) => !t.category).length,
    }),
    [transactions],
  );

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return transactions.filter((t) => {
      if (filter === 'in' && t.type !== 'Income') return false;
      if (filter === 'out' && t.type !== 'Expense') return false;
      if (filter === 'uncategorised' && t.category) return false;
      if (hustleFilter === 'none' && t.incomeSource) return false;
      if (hustleFilter && hustleFilter !== 'none' && t.incomeSource?.id !== hustleFilter) return false;
      if (q && !`${t.description ?? ''} ${categoryLabel(t.category)} ${t.incomeSource?.name ?? ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [transactions, filter, hustleFilter, query]);

  const groups = useMemo(() => {
    const out: { month: string; rows: TransactionItem[] }[] = [];
    for (const tx of shown.slice(0, limit)) {
      const month = MONTH.format(new Date(tx.date));
      const last = out[out.length - 1];
      if (last?.month === month) last.rows.push(tx);
      else out.push({ month, rows: [tx] });
    }
    return out;
  }, [shown, limit]);

  async function setCategory(tx: TransactionItem, category: string) {
    if (!category) return;
    setSavingId(tx.id);
    setStatus(null);
    try {
      await updateTransaction(tx.id, { category });
      await onChanged();
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not save the category.') });
    } finally {
      setSavingId(null);
    }
  }

  async function remove(tx: TransactionItem) {
    const ok = await confirm({
      title: 'Delete this transaction?',
      body: `${tx.type === 'Income' ? 'Money in' : 'Money out'} of ${formatCurrency(tx.amount, { cents: true })} on ${formatDate(tx.date)} leaves the list, and the estimate is worked out again without it. This cannot be undone.`,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    setStatus(null);
    try {
      await deleteTransaction(tx.id);
      await onChanged();
      setStatus({ kind: 'ok', text: 'Transaction deleted.' });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not delete the transaction.') });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <SegmentedControl
          label="Show"
          size="sm"
          fullWidth
          className="sm:inline-flex sm:w-auto"
          value={filter}
          onChange={onFilterChange}
          options={[
            { value: 'all', label: 'All', count: counts.all },
            { value: 'in', label: 'Money in', count: counts.in },
            { value: 'out', label: 'Money out', count: counts.out },
            { value: 'uncategorised', label: 'To review', count: counts.uncategorised },
          ]}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select aria-label="Filter by hustle" value={hustleFilter} onChange={(e) => onHustleFilterChange(e.target.value)} className="h-9 text-sm sm:w-44">
            <option value="">All hustles</option>
            <option value="none">No hustle chosen</option>
            {hustles.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </Select>
          <div className="relative sm:w-56">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint" aria-hidden />
            <Input aria-label="Search transactions" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search" className="h-9 pl-8 text-sm" />
          </div>
        </div>
      </div>

      {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}

      {shown.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border-strong px-4 py-10 text-center text-sm text-fg-muted">
          {filter === 'uncategorised' ? 'Everything has a category. Nice.' : 'Nothing matches these filters.'}
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <section key={group.month} aria-label={group.month}>
              <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-[0.08em] text-fg-faint">{group.month}</h3>
              <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                {group.rows.map((tx) => {
                  const treatment = treatmentOf(tx.type, tx.category);
                  const income = tx.type === 'Income';
                  return (
                    <li key={tx.id} className={cn('flex flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center', savingId === tx.id && 'opacity-60')}>
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className="w-11 shrink-0 pt-0.5 text-xs leading-tight text-fg-faint tabular-nums">{formatDate(tx.date).replace(/, \d{4}$/, '')}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-fg">{tx.description || (income ? 'Money in' : 'Money out')}</p>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            {tx.category ? (
                              <span className="text-xs text-fg-muted">{categoryLabel(tx.category)}</span>
                            ) : (
                              <CategorySelect
                                type={income ? 'Income' : 'Expense'}
                                allowEmpty
                                value=""
                                aria-label={`Category for ${tx.description || 'this transaction'}`}
                                disabled={savingId === tx.id}
                                onChange={(e) => void setCategory(tx, e.target.value)}
                                className="h-8 max-w-full border-warning/50 text-xs sm:max-w-xs"
                              />
                            )}
                            <Badge tone={TREATMENT_TONE[treatment.kind]}>{treatment.label}</Badge>
                            {tx.incomeSource && <Badge tone="neutral">{tx.incomeSource.name}</Badge>}
                            {tx.plaidTransactionId && (
                              <Badge tone="info">
                                <Landmark size={11} aria-hidden /> From your bank
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-2 pl-14 sm:pl-0">
                        <span className={cn('text-sm font-semibold tabular-nums sm:w-28 sm:text-right', income ? 'text-accent' : 'text-fg')}>
                          {income ? '+' : '−'}
                          {formatCurrency(tx.amount, { cents: true })}
                        </span>
                        <span className="flex gap-0.5">
                          <Button variant="ghost" size="sm" className="px-2" aria-label={`Edit ${tx.description || 'transaction'}`} onClick={() => onEdit(tx)}>
                            <Pencil size={15} aria-hidden />
                          </Button>
                          <Button variant="ghost" size="sm" className="px-2 hover:text-danger" aria-label={`Delete ${tx.description || 'transaction'}`} onClick={() => void remove(tx)}>
                            <Trash2 size={15} aria-hidden />
                          </Button>
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          {shown.length > limit && (
            <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)} className="self-center">
              Show more ({shown.length - limit} left)
            </Button>
          )}
        </div>
      )}
      {confirmDialog}
    </div>
  );
}
