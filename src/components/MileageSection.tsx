'use client';

import { useState, type FormEvent } from 'react';
import { Car, Gauge, Plus, Route, Trash2 } from 'lucide-react';
import {
  createMileage,
  deleteMileage,
  errorText,
  type EstimatePayload,
  type HustleItem,
  type MileageLogItem,
  type MileageRatePeriodPayload,
} from './api';
import { defaultTransactionDate, formatCurrency, formatDate, formatDollarRate, formatMiles, mileageRateSummary } from './format';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import { Callout } from './ui/Callout';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { useConfirm } from './ui/ConfirmDialog';
import { EmptyState } from './ui/EmptyState';
import { Field, FieldGrid, Input, Select } from './ui/Field';
import { InlineStatus } from './ui/InlineStatus';
import { StatCard } from './ui/StatCard';
import { Term } from './ui/Term';

export interface MileageSectionProps {
  logs: MileageLogItem[];
  totalMiles: string;
  /** The selected year's standard mileage rate(s), from the API. */
  ratePeriods: MileageRatePeriodPayload[];
  /** The engine's line 9 result for the year, from the summary: what was actually deducted, and by which method. */
  vehicle: EstimatePayload['scheduleC']['mileage'] | null;
  hustles: readonly HustleItem[];
  taxYear?: number;
  onRefresh: () => Promise<void>;
}

/**
 * Business miles: log trips, see what they are worth, and what the estimate
 * actually deducted. Those two can differ: a car is deducted either at the
 * standard rate or at its actual costs, never both (Pub. 463), and the engine
 * applies whichever is larger, so the "deducted" card reads the engine's
 * choice rather than assuming the miles won.
 */
export function MileageSection({ logs, totalMiles, ratePeriods, vehicle, hustles, taxYear, onRefresh }: MileageSectionProps) {
  const [confirm, confirmDialog] = useConfirm();
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [listStatus, setListStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState(() => ({ date: defaultTransactionDate(taxYear), miles: '', purpose: '', incomeSourceId: '' }));

  const [prevTaxYear, setPrevTaxYear] = useState(taxYear);
  if (taxYear !== prevTaxYear) {
    setPrevTaxYear(taxYear);
    setForm((prev) => ({ ...prev, date: defaultTransactionDate(taxYear) }));
  }

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!form.miles) return;
    setSubmitting(true);
    setStatus(null);
    try {
      await createMileage({ date: form.date, miles: form.miles.trim(), purpose: form.purpose || undefined, incomeSourceId: form.incomeSourceId || undefined });
      setForm((f) => ({ ...f, miles: '', purpose: '' }));
      setStatus({ kind: 'ok', text: 'Trip saved. It is priced at the IRS rate for its date.' });
      await onRefresh();
    } catch (err: unknown) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not save the trip.') });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(log: MileageLogItem) {
    const ok = await confirm({
      title: 'Delete this trip?',
      body: `${formatMiles(log.miles)} on ${formatDate(log.date)} comes off your mileage and the estimate is worked out again. This cannot be undone.`,
      confirmLabel: 'Delete trip',
      tone: 'danger',
    });
    if (!ok) return;
    setListStatus(null);
    try {
      await deleteMileage(log.id);
      await onRefresh();
      setListStatus({ kind: 'ok', text: 'Trip deleted.' });
    } catch (err: unknown) {
      setListStatus({ kind: 'error', text: errorText(err, 'Could not delete the trip.') });
    }
  }

  // From the engine, via the API; never a rate typed into this file.
  const rate = mileageRateSummary(ratePeriods, new Date().toISOString().slice(0, 10));
  const method = vehicle?.methodApplied ?? 'none';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Route size={16} />} label="Business miles" value={formatMiles(totalMiles)} caption={`${logs.length} ${logs.length === 1 ? 'trip' : 'trips'} logged this year.`} />
        <StatCard icon={<Gauge size={16} />} label={<Term k="standardMileage">IRS mileage rate</Term>} value={rate?.rate ?? '—'} caption={rate?.caption ?? 'No rate on file for this year.'} />
        <StatCard
          icon={<Car size={16} />}
          tone={method === 'none' ? 'default' : 'accent'}
          label="Deducted for your car"
          value={formatCurrency(vehicle?.line9 ?? 0)}
          caption={
            method === 'standard_mileage'
              ? 'Your logged miles at the standard rate.'
              : method === 'actual_expenses'
                ? 'Your actual car costs, because they are larger than your miles are worth.'
                : 'Log business trips, or record actual car costs, to claim this.'
          }
        />
      </div>

      {method === 'actual_expenses' && vehicle && (
        <Callout tone="info" title="The estimate uses your actual car costs instead of your miles">
          Your miles are worth {formatCurrency(vehicle.standardMileageBeforeMethod)} at the standard rate, but you recorded {formatCurrency(vehicle.actualVehicleExpenses)} of actual car
          costs (gas, repairs, insurance). A car is deducted one way or the other in a year, not both, so the larger one counts. If those costs are for a different car, keep logging trips
          and talk to a tax professional.
        </Callout>
      )}
      {method === 'standard_mileage' && vehicle && vehicle.actualVehicleExpenses > 0 && (
        <Callout tone="info" title="Your miles beat your actual car costs">
          The {formatCurrency(vehicle.actualVehicleExpenses)} of actual car costs you recorded is left out, because the standard rate on your miles is worth more and a car is deducted one
          way or the other in a year.
        </Callout>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card padding="lg" className="self-start">
          <form onSubmit={handleCreate} className="flex flex-col gap-4">
            <div>
              <CardTitle>Log a trip</CardTitle>
              <CardDescription>Driving for your hustle: deliveries, rides, trips to clients or suppliers. Not your commute.</CardDescription>
            </div>
            <FieldGrid className="sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field htmlFor="trip-date" label="Date">
                <Input id="trip-date" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} required />
              </Field>
              <Field htmlFor="trip-miles" label="Miles">
                <Input
                  id="trip-miles"
                  type="text"
                  inputMode="decimal"
                  placeholder="e.g. 24.5"
                  value={form.miles}
                  onChange={(e) => setForm((f) => ({ ...f, miles: e.target.value }))}
                  required
                />
              </Field>
            </FieldGrid>
            <Field htmlFor="trip-purpose" label="What was it for?" hint="The IRS expects a business purpose for each trip.">
              <Input
                id="trip-purpose"
                value={form.purpose}
                maxLength={200}
                placeholder="e.g. Evening deliveries downtown"
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
              />
            </Field>
            {hustles.length > 0 && (
              <Field htmlFor="trip-hustle" label="Hustle" aside="Optional">
                <Select id="trip-hustle" value={form.incomeSourceId} onChange={(e) => setForm((f) => ({ ...f, incomeSourceId: e.target.value }))}>
                  <option value="">No hustle</option>
                  {hustles.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </Select>
              </Field>
            )}
            <Button type="submit" variant="primary" loading={submitting} icon={<Plus size={16} aria-hidden />}>
              Save trip
            </Button>
            {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
          </form>
        </Card>

        <Card padding="md">
          <CardHeader>
            <div>
              <CardTitle>Trips</CardTitle>
              <CardDescription>Each trip is priced at the IRS rate in force on its date.</CardDescription>
            </div>
          </CardHeader>
          {listStatus && <InlineStatus kind={listStatus.kind} className="mb-3">{listStatus.text}</InlineStatus>}
          {logs.length === 0 ? (
            <EmptyState icon={<Car size={20} />} title="No trips logged yet">
              Each business mile you log can lower your taxable profit. Log trips as you go; a note of the date, the miles and why is the record the IRS asks for.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {logs.map((log) => (
                <li key={log.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {formatMiles(log.miles)}
                      <span className="font-normal text-fg-faint"> · {formatDate(log.date)}</span>
                    </p>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                      <span className="truncate text-xs text-fg-muted">{log.purpose || 'No purpose noted'}</span>
                      {log.incomeSource && <Badge>{log.incomeSource.name}</Badge>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold tabular-nums">{formatCurrency(log.deduction, { cents: true })}</p>
                    <p className="text-xs text-fg-faint">at {formatDollarRate(log.ratePerMile)}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="px-2 hover:text-danger"
                    aria-label={`Delete the trip of ${formatMiles(log.miles)} on ${formatDate(log.date)}`}
                    onClick={() => void handleDelete(log)}
                  >
                    <Trash2 size={15} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
      {confirmDialog}
    </div>
  );
}
