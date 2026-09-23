'use client';

import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { Check, Home, Save } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { errorText, fetchHomeOfficeForm, fetchSummary, saveHomeOfficeForm, type HomeOfficeFormResponse, type SummaryResponse } from '@/components/api';
import { cn } from '@/components/cn';
import { formatCurrency, formatPercent } from '@/components/format';
import { normalizeMoneyText } from '@/components/moneyText';
import { useLoad } from '@/components/useLoad';
import { defaultTaxYear, useTaxYear } from '@/components/useTaxYear';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Callout } from '@/components/ui/Callout';
import { Card, CardDescription, CardTitle, DataRow } from '@/components/ui/Card';
import { Field, FieldGrid, Input, MoneyInput } from '@/components/ui/Field';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { Term } from '@/components/ui/Term';

interface FormState {
  totalSqFt: string;
  officeSqFt: string;
  rentAmount: string;
  utilitiesAmount: string;
}

const fromSaved = (saved: HomeOfficeFormResponse): FormState =>
  saved.form
    ? {
        totalSqFt: String(saved.form.totalSqFt),
        officeSqFt: String(saved.form.officeSqFt),
        rentAmount: String(saved.form.rentAmount),
        utilitiesAmount: String(saved.form.utilitiesAmount),
      }
    : { totalSqFt: '', officeSqFt: '', rentAmount: '', utilitiesAmount: '' };

/**
 * Home office (Schedule C line 30). The inputs are saved per tax year; the
 * comparison of the two methods is read from `estimate.scheduleC.homeOffice`,
 * which the engine computed. Nothing on this page multiplies anything.
 *
 * This is also the page a bad home office record is fixed from, so the form
 * loads and saves on its own even when the estimate fails (D21).
 */
export default function HomeOfficePage() {
  const [taxYear] = useTaxYear();
  const key = String(taxYear ?? 'default');
  const loadForm = useCallback(() => fetchHomeOfficeForm(taxYear), [taxYear]);
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const form = useLoad(key, loadForm);
  const summary = useLoad(key, loadSummary);
  const year = form.data?.taxYear ?? summary.data?.taxYear ?? taxYear ?? defaultTaxYear();
  const data = summary.data;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Home office"
        description="Work from a room or corner of your home that you use only for your hustle? Part of your rent and utilities can come off your hustle profit."
        icon={<Home size={22} />}
        iconTone="accent"
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {form.data ? (
          <OfficeForm key={`${year}:${JSON.stringify(form.data.form)}`} year={year} saved={form.data} onSaved={summary.reload} />
        ) : form.error !== null ? (
          <InlineStatus kind="error">{errorText(form.error, 'Could not load your home office details.')}</InlineStatus>
        ) : (
          <Card>Loading…</Card>
        )}
        <Comparison summary={data} busy={summary.loading} />
      </div>

      {summary.error !== null && (
        <InlineStatus kind="error">
          {errorText(summary.error, 'The estimate could not be worked out.')} The form above still works; correct the values and save to recalculate.
        </InlineStatus>
      )}

      <Card padding="lg">
        <CardTitle as="h2">Can I take this?</CardTitle>
        <ul className="mt-3 grid gap-3 text-sm text-fg-muted sm:grid-cols-3">
          {[
            ['It is for your hustles', 'The deduction is for self-employment income. A W-2 job at home does not qualify.'],
            ['Only for work', 'The space is used for your business and nothing else: not a guest room, not the family computer.'],
            ['Regularly', 'You use it for work on an ongoing basis, not now and then.'],
          ].map(([title, body]) => (
            <li key={title} className="flex gap-2.5">
              <Check size={16} className="mt-0.5 shrink-0 text-accent" aria-hidden />
              <span>
                <span className="block font-medium text-fg">{title}</span>
                {body}
              </span>
            </li>
          ))}
        </ul>
      </Card>

      {data && <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} />}
    </div>
  );
}

function OfficeForm({ year, saved, onSaved }: { year: number; saved: HomeOfficeFormResponse; onSaved: () => Promise<void> }) {
  const [form, setForm] = useState<FormState>(() => fromSaved(saved));
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const update = (k: keyof FormState) => (e: ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function save(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    // The save and the refresh are reported separately: a failing estimate
    // once produced "Failed to save" after the row had been written.
    try {
      await saveHomeOfficeForm({
        taxYear: year,
        totalSqFt: normalizeMoneyText(form.totalSqFt) || '0',
        officeSqFt: normalizeMoneyText(form.officeSqFt) || '0',
        rentAmount: normalizeMoneyText(form.rentAmount) || '0',
        utilitiesAmount: normalizeMoneyText(form.utilitiesAmount) || '0',
      });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not save.') });
      setSaving(false);
      return;
    }
    setStatus({ kind: 'ok', text: `Saved for ${year}.` });
    await onSaved();
    setSaving(false);
  }

  return (
    <Card padding="lg">
      <form onSubmit={save} className="flex flex-col gap-5">
        <div>
          <CardTitle>Your space</CardTitle>
          <CardDescription>Square feet. A rough measurement is fine: length times width of each room.</CardDescription>
        </div>
        <FieldGrid>
          <Field htmlFor="totalSqFt" label="Whole home">
            <Input id="totalSqFt" inputMode="decimal" placeholder="e.g. 900" value={form.totalSqFt} onChange={update('totalSqFt')} />
          </Field>
          <Field htmlFor="officeSqFt" label="Office space" hint="Only the part used for work.">
            <Input id="officeSqFt" inputMode="decimal" placeholder="e.g. 120" value={form.officeSqFt} onChange={update('officeSqFt')} />
          </Field>
        </FieldGrid>
        <div>
          <CardTitle>Monthly costs</CardTitle>
          <CardDescription>What you pay each month. The estimate counts twelve months.</CardDescription>
        </div>
        <FieldGrid>
          <Field htmlFor="rentAmount" label="Rent or mortgage interest">
            <MoneyInput id="rentAmount" value={form.rentAmount} onChange={update('rentAmount')} />
          </Field>
          <Field htmlFor="utilitiesAmount" label="Utilities and internet">
            <MoneyInput id="utilitiesAmount" value={form.utilitiesAmount} onChange={update('utilitiesAmount')} />
          </Field>
        </FieldGrid>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" variant="primary" loading={saving} icon={<Save size={16} aria-hidden />}>
            Save for {year}
          </Button>
          {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
        </div>
      </form>
    </Card>
  );
}

function Comparison({ summary, busy }: { summary: SummaryResponse | null; busy: boolean }) {
  const office = summary?.estimate.scheduleC.homeOffice ?? null;
  if (!office) {
    return (
      <Card padding="lg" className="flex flex-col justify-center">
        <CardTitle>What you can deduct</CardTitle>
        <p className="mt-2 text-sm text-fg-muted">
          {summary ? 'Save your space and costs to see what the two methods allow.' : 'Loading…'}
        </p>
      </Card>
    );
  }
  const winner = office.method;
  const methods = [
    {
      key: 'simplified',
      title: 'Simplified method',
      value: office.simplified.beforeLimit,
      how: `${office.simplified.allowableSquareFeet} sq ft at ${formatCurrency(office.simplified.ratePerSquareFoot)} a square foot`,
    },
    {
      key: 'regular',
      title: 'Actual costs',
      value: office.regular.beforeLimit,
      how: `${formatPercent(office.regular.businessUsePercentage)} of ${formatCurrency(office.regular.annualRentAndUtilities)} a year in rent and utilities`,
    },
  ] as const;

  return (
    <Busy busy={busy}>
      <Card padding="lg" className="flex h-full flex-col gap-4">
        <div>
          <CardTitle>What you can deduct</CardTitle>
          <CardDescription>
            There are two ways to work out the <Term k="homeOffice">home office deduction</Term>. The estimate uses the larger one.
          </CardDescription>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {methods.map((m) => (
            <div key={m.key} className={cn('rounded-xl border p-4', winner === m.key ? 'border-accent bg-accent/5 ring-1 ring-accent' : 'border-border')}>
              <p className="flex items-center justify-between gap-2 text-sm font-medium">
                {m.title}
                {winner === m.key && (
                  <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-on-accent">Used</span>
                )}
              </p>
              <p className="mt-1 text-xl font-bold tabular-nums">{formatCurrency(m.value)}</p>
              <p className="mt-1 text-xs leading-relaxed text-fg-faint">{m.how}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl bg-surface px-4 py-1">
          <DataRow label="Limit: your hustle profit before this" hint="The deduction cannot create a loss." value={formatCurrency(office.grossIncomeLimit)} tone="muted" />
          {office.regular.carryover > 0 && <DataRow label="Carried to next year" hint="Actual-cost method only" value={formatCurrency(office.regular.carryover)} tone="muted" />}
          <DataRow label="Deducted this year" value={formatCurrency(office.deduction)} tone="accent" emphasis />
        </div>
        {winner === 'none' && (
          <Callout tone="tip">Nothing is deducted: either no office space is saved, or there is no hustle profit for it to reduce.</Callout>
        )}
      </Card>
    </Busy>
  );
}
