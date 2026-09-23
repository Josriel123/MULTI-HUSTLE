'use client';

import { useCallback, useState, type FormEvent } from 'react';
import { CalendarCheck, Landmark, PiggyBank, Plus, Receipt, Trash2 } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { createPayment, deletePayment, errorText, fetchPayments, fetchSummary, type PaymentItem } from '@/components/api';
import { formatCurrency, formatDate } from '@/components/format';
import { normalizeMoneyText } from '@/components/moneyText';
import { useLoad } from '@/components/useLoad';
import { defaultTaxYear, useTaxYear } from '@/components/useTaxYear';
import { Button } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Callout } from '@/components/ui/Callout';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field, FieldGrid, Input, MoneyInput } from '@/components/ui/Field';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Term } from '@/components/ui/Term';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Estimated tax payments (Form 1040-ES) sent for the selected tax year. The
 * app records them; it never sends money. Each is filed under the year it was
 * paid for, so January's payment for last year belongs to last year.
 */
export default function PaymentsPage() {
  const [taxYear] = useTaxYear();
  const key = String(taxYear ?? 'default');
  const loadPayments = useCallback(() => fetchPayments(taxYear), [taxYear]);
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const payments = useLoad(key, loadPayments);
  const summary = useLoad(key, loadSummary);
  const [confirm, confirmDialog] = useConfirm();
  const [form, setForm] = useState({ paidOn: today(), amount: '', note: '' });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const reloadPayments = payments.reload;
  const reloadSummary = summary.reload;
  const refresh = useCallback(async () => {
    await Promise.allSettled([reloadPayments(), reloadSummary()]);
  }, [reloadPayments, reloadSummary]);

  const data = summary.data;
  const list = payments.data?.payments ?? [];
  const year = payments.data?.taxYear ?? data?.taxYear ?? taxYear ?? defaultTaxYear();
  const error = payments.error ?? summary.error;

  async function add(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setStatus(null);
    try {
      await createPayment({ taxYear: year, paidOn: form.paidOn, amount: normalizeMoneyText(form.amount), note: form.note.trim() || undefined });
      setForm({ paidOn: today(), amount: '', note: '' });
      await refresh();
      setStatus({ kind: 'ok', text: `Payment recorded for ${year}.` });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not record the payment.') });
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: PaymentItem) {
    const ok = await confirm({
      title: 'Delete this payment?',
      body: `${formatCurrency(p.amount, { cents: true })} paid on ${formatDate(p.paidOn)} comes off what you have paid for ${p.taxYear}. This only changes the record here; it does not affect the IRS.`,
      confirmLabel: 'Delete payment',
      tone: 'danger',
    });
    if (!ok) return;
    setStatus(null);
    try {
      await deletePayment(p.id);
      await refresh();
      setStatus({ kind: 'ok', text: 'Payment deleted.' });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not delete the payment.') });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Tax payments"
        description={`Estimated tax payments you have sent the IRS for ${year}. They count toward what you owe, just like tax withheld from a paycheck.`}
        icon={<Landmark size={22} />}
        iconTone="accent"
      />

      {error !== null && <InlineStatus kind="error">{errorText(error, 'Could not load your payments.')}</InlineStatus>}

      <Busy busy={(payments.loading && payments.data !== null) || (summary.loading && data !== null)} className="grid gap-4 sm:grid-cols-3">
        <StatCard icon={<Receipt size={16} />} label={<Term k="estimatedTax">Estimated tax</Term>} value={data ? formatCurrency(data.summary.taxLiability) : '—'} caption={`For ${year}, from everything entered.`} />
        <StatCard
          icon={<CalendarCheck size={16} />}
          tone="accent"
          label={<Term k="estimatedPayments">Estimated payments</Term>}
          value={payments.data ? formatCurrency(payments.data.total) : '—'}
          caption={`${list.length} ${list.length === 1 ? 'payment' : 'payments'} recorded for ${year}.`}
        />
        <StatCard
          icon={<PiggyBank size={16} />}
          label={data && data.summary.refund > 0 ? 'Expected refund' : <Term k="leftToPay">Left to pay</Term>}
          value={data ? formatCurrency(data.summary.refund > 0 ? data.summary.refund : data.summary.leftToPay) : '—'}
          caption="After these payments and any tax withheld from a W-2 job."
        />
      </Busy>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
        <Card padding="lg" className="self-start">
          <form onSubmit={add} className="flex flex-col gap-4">
            <div>
              <CardTitle>Record a payment</CardTitle>
              <CardDescription>For {year}. This records a payment you made; it does not send one.</CardDescription>
            </div>
            <FieldGrid className="sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              <Field htmlFor="pay-date" label="Date paid">
                <Input id="pay-date" type="date" value={form.paidOn} onChange={(e) => setForm((f) => ({ ...f, paidOn: e.target.value }))} required />
              </Field>
              <Field htmlFor="pay-amount" label="Amount">
                <MoneyInput id="pay-amount" value={form.amount} onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))} required />
              </Field>
            </FieldGrid>
            <Field htmlFor="pay-note" label="Note" aside="Optional">
              <Input id="pay-note" value={form.note} maxLength={120} placeholder="e.g. 2nd quarter, IRS Direct Pay" onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))} />
            </Field>
            <Button type="submit" variant="primary" loading={saving} icon={<Plus size={16} aria-hidden />}>
              Record payment
            </Button>
            {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}
          </form>
        </Card>

        <Card padding="md">
          <CardHeader>
            <div>
              <CardTitle>Payments for {year}</CardTitle>
              <CardDescription>Include last year&rsquo;s refund if you applied it to this year instead of taking it back.</CardDescription>
            </div>
          </CardHeader>
          {list.length === 0 ? (
            <EmptyState icon={<Landmark size={20} />} title="No payments recorded">
              If you have paid estimated tax for {year}, record each payment here so the estimate knows it is already covered.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
              {list.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{formatDate(p.paidOn)}</p>
                    {p.note && <p className="truncate text-xs text-fg-muted">{p.note}</p>}
                  </div>
                  <span className="text-sm font-semibold tabular-nums">{formatCurrency(p.amount, { cents: true })}</span>
                  <Button variant="ghost" size="sm" className="px-2 hover:text-danger" aria-label={`Delete payment of ${formatCurrency(p.amount, { cents: true })}`} onClick={() => void remove(p)}>
                    <Trash2 size={15} aria-hidden />
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Callout tone="tip" title="How estimated payments work">
        Nobody withholds tax from hustle income, so the IRS expects it during the year, in quarterly <Term k="estimatedPayments">estimated payments</Term>. You pay the IRS
        directly, for example with IRS Direct Pay at irs.gov/payments. This estimate does not work out due dates or penalties for paying late or too little.
      </Callout>

      {data && <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} rules={data.rules} />}
      {confirmDialog}
    </div>
  );
}
