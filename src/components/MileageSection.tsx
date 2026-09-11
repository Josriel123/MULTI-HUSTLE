'use client';

import { useState, type FormEvent } from 'react';
import { PlusCircle, Trash2 } from 'lucide-react';
import {
  createMileage,
  deleteMileage,
  type MileageLogItem,
} from './api';
import { formatCurrency, formatDate, formatMiles } from './format';
import { Button } from './ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from './ui/Card';
import { Field, FieldGrid, Input } from './ui/Field';
import { InlineStatus } from './ui/InlineStatus';
import { StatCard } from './ui/StatCard';

export interface MileageSectionProps {
  logs: MileageLogItem[];
  totalMiles: string;
  totalDeduction: string;
  onRefresh: () => Promise<void>;
}

export function MileageSection({
  logs,
  totalMiles,
  totalDeduction,
  onRefresh,
}: MileageSectionProps) {
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().slice(0, 10),
    miles: '',
    purpose: '',
  });

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
        date: new Date().toISOString().slice(0, 10),
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
    if (!confirm('Are you sure you want to delete this mileage entry?')) return;
    try {
      await deleteMileage(id);
      await onRefresh();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete mileage log.');
    }
  }

  // Derive current statutory rate from latest log or state
  const latestRate = logs.length > 0 ? logs[0].ratePerMile : '0.725';

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
          label="Current IRS Rate"
          value={`$${latestRate}/mi`}
          caption="Notice 2026-10 / Announcement 2026-11 statutory pricing"
          accent="info"
          tone="default"
        />
        <StatCard
          label="Standard Deduction"
          value={formatCurrency(totalDeduction, { cents: true })}
          caption="Schedule C line 9 deduction applied to delivery income"
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
    </div>
  );
}
