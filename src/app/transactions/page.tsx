'use client';

import { useCallback, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeftRight, CircleDollarSign, Plus, ReceiptText, Settings2, TriangleAlert } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { errorText, fetchHustles, fetchSummary, fetchTransactions, type TransactionItem } from '@/components/api';
import { formatCurrency } from '@/components/format';
import { BankCard } from '@/components/transactions/BankCard';
import { HustleManager } from '@/components/transactions/HustleManager';
import { TransactionDialog, type TransactionDialogMode } from '@/components/transactions/TransactionDialog';
import { TransactionList, type ListFilter } from '@/components/transactions/TransactionList';
import { useLoad } from '@/components/useLoad';
import { useTaxYear } from '@/components/useTaxYear';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Term } from '@/components/ui/Term';

const loadHustles = () => fetchHustles();

/**
 * Income & expenses: every transaction in the tax year, added by hand or
 * brought in from a bank, and the category that decides how each is taxed.
 *
 * `?add=income|expense` opens the add dialog, `?show=uncategorised` and
 * `?hustle=none` preset the list filters, so other pages can link straight
 * to a task.
 */
export default function TransactionsPage() {
  const [taxYear] = useTaxYear();
  const params = useSearchParams();
  const key = String(taxYear ?? 'default');

  const loadTransactions = useCallback(() => fetchTransactions(taxYear), [taxYear]);
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const transactions = useLoad(key, loadTransactions);
  const summary = useLoad(key, loadSummary);
  const hustles = useLoad('hustles', loadHustles);

  const add = params.get('add');
  const [dialog, setDialog] = useState<TransactionDialogMode | null>(() =>
    add === 'income' ? { kind: 'create', type: 'Income' } : add === 'expense' ? { kind: 'create', type: 'Expense' } : null,
  );
  const [managing, setManaging] = useState(false);
  const [filter, setFilter] = useState<ListFilter>(() => (params.get('show') === 'uncategorised' ? 'uncategorised' : 'all'));
  const [hustleFilter, setHustleFilter] = useState(() => (params.get('hustle') === 'none' ? 'none' : ''));

  const reloadTransactions = transactions.reload;
  const reloadSummary = summary.reload;
  const reloadHustles = hustles.reload;
  const refreshAll = useCallback(async () => {
    await Promise.allSettled([reloadTransactions(), reloadSummary(), reloadHustles()]);
  }, [reloadTransactions, reloadSummary, reloadHustles]);

  const list = transactions.data ?? [];
  const data = summary.data;
  const uncategorised = data ? data.transactions.uncategorised.incomeCount + data.transactions.uncategorised.expenseCount : 0;
  const firstLoad = transactions.data === null && transactions.loading;
  const loadError = transactions.error ?? summary.error;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Income & expenses"
        description="Everything your hustles earned and spent this year. The category on each one decides how it is taxed."
        icon={<ArrowLeftRight size={22} />}
        iconTone="accent"
        actions={
          <>
            <Button variant="secondary" icon={<Settings2 size={16} aria-hidden />} onClick={() => setManaging(true)}>
              Hustles
            </Button>
            <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setDialog({ kind: 'create', type: 'Income' })}>
              Add
            </Button>
          </>
        }
      />

      {loadError !== null && <InlineStatus kind="error">{errorText(loadError, 'Could not load everything on this page.')}</InlineStatus>}

      <Busy busy={summary.loading && data !== null} className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <StatCard
          icon={<CircleDollarSign size={16} />}
          tone="accent"
          label="Counted as income"
          value={data ? formatCurrency(data.summary.hustleIncome) : '—'}
          caption="Deposits that are taxable. Transfers, loans and refunds are left out."
          captionClassName="hidden sm:block"
        />
        <StatCard
          icon={<ReceiptText size={16} />}
          label={<Term k="deductible">Deductible costs</Term>}
          value={data ? formatCurrency(data.estimate.scheduleC.totalExpenses) : '—'}
          caption="Business costs the estimate subtracts, mileage included, after limits such as the one on business meals."
          captionClassName="hidden sm:block"
        />
        <StatCard
          icon={<TriangleAlert size={16} />}
          className="col-span-2 sm:col-span-1"
          tone={uncategorised > 0 ? 'warning' : 'default'}
          label={<Term k="uncategorised">Needs a category</Term>}
          value={data ? String(uncategorised) : '—'}
          caption={uncategorised > 0 ? 'Pick one for each so the estimate knows how to treat them.' : 'Every transaction has a category.'}
          footer={
            uncategorised > 0 && filter !== 'uncategorised' ? (
              <button type="button" className="self-start text-sm font-semibold text-accent hover:underline" onClick={() => setFilter('uncategorised')}>
                Show them
              </button>
            ) : null
          }
        />
      </Busy>

      <BankCard onSynced={refreshAll} />

      <Card padding="md">
        {firstLoad ? (
          <div className="py-10 text-center text-sm text-fg-muted">Loading transactions…</div>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<ArrowLeftRight size={20} />}
            title="No transactions this year yet"
            action={
              <>
                <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setDialog({ kind: 'create', type: 'Income' })}>
                  Add money in
                </Button>
                <Button variant="secondary" onClick={() => setDialog({ kind: 'create', type: 'Expense' })}>
                  Add a cost
                </Button>
              </>
            }
          >
            Add what your hustles brought in and what you spent on them, or connect a bank above to bring it in automatically.
          </EmptyState>
        ) : (
          <Busy busy={transactions.loading}>
            <TransactionList
              transactions={list}
              hustles={hustles.data ?? []}
              filter={filter}
              onFilterChange={setFilter}
              hustleFilter={hustleFilter}
              onHustleFilterChange={setHustleFilter}
              onEdit={(tx: TransactionItem) => setDialog({ kind: 'edit', transaction: tx })}
              onChanged={refreshAll}
            />
          </Busy>
        )}
      </Card>

      {data && <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} />}

      <TransactionDialog mode={dialog} onClose={() => setDialog(null)} hustles={hustles.data ?? []} taxYear={taxYear} onSaved={refreshAll} />
      <HustleManager open={managing} onClose={() => setManaging(false)} hustles={hustles.data ?? []} onChanged={refreshAll} />
    </div>
  );
}
