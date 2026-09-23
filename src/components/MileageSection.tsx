'use client';

import { useState, type FormEvent } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import {
  createMileage,
  deleteMileage,
  errorText,
  type MileageLogItem,
  type MileageRatePeriodPayload,
} from './api';
import { defaultTransactionDate, formatCurrency, formatDate, formatMiles, mileageRateSummary } from './format';
import { Button } from './ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { useConfirm } from './ui/ConfirmDialog';
import { Field, FieldGrid, Input } from './ui/Field';
import { InlineStatus } from './ui/InlineStatus';
import { StatCard } from './ui/StatCard';

export interface MileageSectionProps {
  logs: MileageLogItem[];
  totalMiles: string;
  totalDeduction: string;
  /** The selected year's standard mileage rate(s), from the API. */
  ratePeriods: MileageRatePeriodPayload[];
  taxYear?: number;
  onRefresh: () => Promise<void>;
}

export function MileageSection({
  logs,
  totalMiles,
  totalDeduction,
  ratePeriods,
  taxYear,
  onRefresh,
}: MileageSectionProps) {
  const [confirm, confirmDialog] = useConfirm();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [listStatus, setListStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState(() => ({
    date: defaultTransactionDate(taxYear),
    miles: '',
    purpose: '',
  }));

  const [prevTaxYear, setPrevTaxYear] = useState(taxYear);
  if (taxYear !== prevTaxYear) {
    setPrevTaxYear(taxYear);
    setFormData((prev) => ({
      ...prev,
      date: defaultTransactionDate(taxYear),
    }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!formData.miles) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await createMileage({
        date: formData.date,
        miles: formData.miles,
        purpose: formData.purpose || undefined,
      });
      setFormData({
        date: defaultTransactionDate(taxYear),
        miles: '',
        purpose: '',
      });
      setStatus({ kind: 'ok', text: 'Business trip logged and priced at statutory IRS rate.' });
      await onRefresh();
    } catch (err: unknown) {
      setStatus({ kind: 'error', text: err instanceof Error ? err.message : 'Failed to log mileage.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Delete this trip?',
      body: 'Its miles come off Schedule C line 9 and the estimate is recalculated. This cannot be undone.',
      confirmLabel: 'Delete trip',
      tone: 'danger',
    });
    if (!ok) return;
    setListStatus(null);
    try {
      await deleteMileage(id);
      await onRefresh();
      setListStatus({ kind: 'ok', text: 'Trip deleted.' });
    } catch (err: unknown) {
      setListStatus({ kind: 'error', text: errorText(err, 'Failed to delete the trip.') });
    }
  }

  // From the engine, via the API. This used to copy the rate off the latest
  // trip and, once the last trip was deleted, fall back to a '0.725' typed
  // into this file — the Jan-Jun 2026 rate, wrong from July 1 and for every
  // other year (second e2e pass, S2).
  const rate = mileageRateSummary(ratePeriods, new Date().toISOString().slice(0, 10));

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      {/* Metrics Row */}
      <div className="grid gap-4 sm:grid-cols-3 md:gap-6">
        <StatCard
          label="Total Business Miles"
          value={formatMiles(totalMiles)}
          caption="Verified business miles logged for Schedule C"
          accent="neutral"
        />
        <StatCard
          label="IRS standard mileage rate"
          value={rate?.rate ?? '—'}
          caption={rate?.caption ?? 'No rate on file for this tax year.'}
          accent="info"
          tone="default"
        />
        <StatCard
          // Not "Standard Deduction": that is Form 1040 line 12, a different
          // figure entirely. This is the mileage deduction on Schedule C.
          label="Mileage deduction"
          value={formatCurrency(totalDeduction, { cents: true })}
          // Deliberately conditional. When actual vehicle costs are larger,
          // the engine applies those on line 9 and takes none of this
          // (Pub. 463: one method per vehicle per year), and says so in a
          // vehicle_method_conflict warning below. Showing the applied figure
          // here instead is an open item in PLAN.md.
          caption="Logged miles at each trip's rate (Schedule C line 9), unless actual vehicle costs are larger — then the estimate uses those instead"
          accent="accent"
          tone="accent"
        />
      </div>

      {/* Log Mileage Form */}
      <Card padding="lg">
        <form onSubmit={handleCreate} className="flex flex-col gap-6">
          <div>
            <CardTitle>Record Business Mileage</CardTitle>
            <CardDescription>
              Log business trips. The engine automatically prices each trip based on the exact date and applicable statutory rate.
            </CardDescription>
          </div>

          <FieldGrid>
            <Field htmlFor="mileage-date" label="Trip Date">
              <Input
                id="mileage-date"
                type="date"
                value={formData.date}
                onChange={(e) => setFormData((f) => ({ ...f, date: e.target.value }))}
                required
              />
            </Field>

            <Field htmlFor="mileage-miles" label="Miles Driven" hint="Decimals accepted, e.g. 24.5">
              <Input
                id="mileage-miles"
                type="number"
                inputMode="decimal"
                min="0.1"
                step="0.1"
                placeholder="e.g. 45.2"
                value={formData.miles}
                onChange={(e) => setFormData((f) => ({ ...f, miles: e.target.value }))}
                required
              />
            </Field>
          </FieldGrid>

          <Field
            htmlFor="mileage-purpose"
            label="Business Purpose (Optional)"
            hint="IRS requires substantiating the business character of the transportation"
          >
            <Input
              id="mileage-purpose"
              type="text"
              placeholder="e.g. Customer food delivery run in downtown"
              value={formData.purpose}
              onChange={(e) => setFormData((f) => ({ ...f, purpose: e.target.value }))}
            />
          </Field>

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              icon={<PlusCircle size={18} aria-hidden />}
            >
              Log Mileage
            </Button>
            {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
          </div>
        </form>
      </Card>

      {/* Mileage Ledger */}
      <Card padding="md">
        <CardHeader>
          <div>
            <CardTitle>Trip History</CardTitle>
            <CardDescription>
              {logs.length} {logs.length === 1 ? 'trip' : 'trips'} recorded under IRC §162
            </CardDescription>
          </div>
        </CardHeader>

        {/* Delete results belong next to the list they changed, not in the form above. */}
        {listStatus && (
          <div className="mb-4">
            <InlineStatus kind={listStatus.kind}>{listStatus.text}</InlineStatus>
          </div>
        )}

        {logs.length === 0 ? (
          <div className="py-12 text-center text-sm text-fg-muted">
            No mileage entries logged yet. Record your business trips above to claim standard mileage deductions.
          </div>
        ) : (
          <>
            {/* Desktop Table: visible at md and above */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wider text-fg-faint">
                    <th className="pb-3 pl-2 pr-4 font-semibold">Date</th>
                    <th className="pb-3 px-4 font-semibold">Distance</th>
                    <th className="pb-3 px-4 font-semibold">Applicable Rate</th>
                    <th className="pb-3 px-4 font-semibold">Business Purpose</th>
                    <th className="pb-3 px-4 text-right font-semibold">Deduction</th>
                    <th className="pb-3 pl-4 pr-2 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {logs.map((log) => (
                    <tr key={log.id} className="transition-colors hover:bg-surface/50">
                      <td className="py-3.5 pl-2 pr-4 tabular-nums text-fg-muted whitespace-nowrap">
                        {formatDate(log.date)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold tabular-nums text-fg whitespace-nowrap">
                        {formatMiles(log.miles)}
                      </td>
                      <td className="py-3.5 px-4 text-fg-muted tabular-nums whitespace-nowrap">
                        ${log.ratePerMile}/mi
                      </td>
                      <td className="py-3.5 px-4 text-fg-muted">
                        <span className="truncate max-w-[280px] block">
                          {log.purpose || 'Business transportation'}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right font-bold tabular-nums text-accent whitespace-nowrap">
                        {formatCurrency(log.deduction, { cents: true })}
                      </td>
                      <td className="py-3.5 pl-4 pr-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label="Delete trip"
                          onClick={() => handleDelete(log.id)}
                        >
                          <Trash2 size={15} className="text-danger" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Stacked Cards: visible below md (eliminates horizontal overflow on 375px screens) */}
            <div className="flex flex-col gap-3 md:hidden">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-3.5 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-fg text-base tabular-nums">{formatMiles(log.miles)}</div>
                      <div className="text-xs text-fg-muted">{formatDate(log.date)}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-accent tabular-nums text-base">
                        {formatCurrency(log.deduction, { cents: true })}
                      </div>
                      <div className="text-xs text-fg-faint">${log.ratePerMile}/mi</div>
                    </div>
                  </div>

                  <div className="text-xs text-fg-muted">
                    {log.purpose || 'Business transportation'}
                  </div>

                  <div className="flex justify-end border-t border-border pt-2">
                    <Button
                      variant="danger"
                      size="sm"
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDelete(log.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {confirmDialog}
    </div>
  );
}
