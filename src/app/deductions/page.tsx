'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, Car, Receipt } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { MileageSection } from '@/components/MileageSection';
import { TaxYearSelect } from '@/components/TaxYearSelect';
import { TransactionLedger } from '@/components/TransactionLedger';
import { useTaxYear } from '@/components/useTaxYear';
import {
  errorText,
  fetchMileage,
  fetchSummary,
  fetchTransactions,
  type MileageLogItem,
  type MileageRatePeriodPayload,
  type SummaryResponse,
  type TransactionItem,
} from '@/components/api';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { PageHeader } from '@/components/ui/PageHeader';

/**
 * Deductions & Business Mileage Hub.
 *
 * Coordinates transaction auditing and Schedule C mileage logging.
 * Zero local tax arithmetic: figures are derived by the tax engine and
 * priced via statutory IRS standard mileage rate parameters.
 */
export default function DeductionsPage() {
  const [taxYear, setTaxYear] = useTaxYear();
  const [activeTab, setActiveTab] = useState<'transactions' | 'mileage'>('transactions');

  const [summary, setSummary] = useState<SummaryResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [mileageLogs, setMileageLogs] = useState<MileageLogItem[]>([]);
  const [totalMiles, setTotalMiles] = useState('0.00');
  const [totalMileageDeduction, setTotalMileageDeduction] = useState('0.00');
  const [ratePeriods, setRatePeriods] = useState<MileageRatePeriodPayload[]>([]);
  /** The year the mileage endpoint answered for; independent of the estimate. */
  const [dataYear, setDataYear] = useState<number | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  // Loading is derived from request key
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = taxYear === undefined ? 'default' : String(taxYear);
  const loading = resolvedKey !== requestKey;

  // The three requests are independent, so each result is applied on its own.
  // With Promise.all, a failing estimate discarded the ledger and the trip log
  // too, although both had loaded — the same coupling the e2e audit found on
  // the student and home office pages (F8), which were fixed first.
  const fetchAll = useCallback(
    () => Promise.allSettled([fetchSummary(taxYear), fetchTransactions(taxYear), fetchMileage(taxYear)]),
    [taxYear],
  );

  // Only state setters and a module import: stable across renders.
  const apply = useCallback(([sumRes, txRes, mileRes]: Awaited<ReturnType<typeof fetchAll>>) => {
    setSummary(sumRes.status === 'fulfilled' ? sumRes.value : null);
    if (txRes.status === 'fulfilled') setTransactions(txRes.value);
    if (mileRes.status === 'fulfilled') {
      setMileageLogs(mileRes.value.logs || []);
      setTotalMiles(mileRes.value.totalMiles || '0.00');
      setTotalMileageDeduction(mileRes.value.totalDeduction || '0.00');
      setRatePeriods(mileRes.value.ratePeriods || []);
      setDataYear(mileRes.value.taxYear);
    }
    const failed = [sumRes, txRes, mileRes].find((r) => r.status === 'rejected');
    if (failed) console.error('Failed to load part of the deductions page', failed.reason);
    setError(failed ? errorText(failed.reason, 'Failed to load part of this page.') : null);
  }, []);

  async function loadData() {
    apply(await fetchAll());
  }

  useEffect(() => {
    let ignore = false;
    fetchAll()
      .then((results) => {
        if (!ignore) apply(results);
      })
      .finally(() => {
        if (!ignore) setResolvedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [fetchAll, apply, requestKey]);

  // The mileage response states its year, independent of the estimate, so a
  // failing estimate no longer leaves this undefined.
  const shownYear = summary?.taxYear ?? dataYear ?? taxYear;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 pb-12 md:gap-8">
      <PageHeader
        icon={<Receipt size={26} aria-hidden />}
        iconTone="accent"
        title="Deductions &amp; Mileage Hub"
        description="Log hardware and operating expenses, audit transaction classifications, and record Schedule C business mileage."
        actions={<TaxYearSelect value={shownYear} onChange={setTaxYear} />}
      />

      {error && (
        <div className="rounded-lg border border-danger bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      )}

      {/* Mode Switcher Tabs: wraps cleanly on 375px screens */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-4">
        <Button
          variant={activeTab === 'transactions' ? 'primary' : 'secondary'}
          size="md"
          icon={<Activity size={17} aria-hidden />}
          onClick={() => setActiveTab('transactions')}
        >
          Transaction Ledger ({transactions.length})
        </Button>
        <Button
          variant={activeTab === 'mileage' ? 'primary' : 'secondary'}
          size="md"
          icon={<Car size={17} aria-hidden />}
          onClick={() => setActiveTab('mileage')}
        >
          Business Mileage ({mileageLogs.length})
        </Button>
      </div>

      <Busy busy={loading} className="flex flex-col gap-6 md:gap-8">
        {activeTab === 'transactions' ? (
          <TransactionLedger
            transactions={transactions}
            taxYear={shownYear}
            onRefresh={loadData}
          />
        ) : (
          <MileageSection
            logs={mileageLogs}
            totalMiles={totalMiles}
            totalDeduction={totalMileageDeduction}
            ratePeriods={ratePeriods}
            taxYear={shownYear}
            onRefresh={loadData}
          />
        )}

        {/* Mandatory EstimateNotice */}
        <EstimateNotice
          disclaimer={summary?.disclaimer}
          warnings={summary?.warnings}
          assumptions={summary?.assumptions}
          notModeled={summary?.notModeled}
        />
      </Busy>
    </div>
  );
}
