'use client';

import { useCallback, useState } from 'react';
import { Briefcase, Pencil, Plus, Trash2 } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { W2Dialog } from '@/components/jobs/W2Dialog';
import { deleteW2, errorText, fetchSummary, fetchW2s, type W2Item } from '@/components/api';
import { filingStatusLabel, formatCurrency } from '@/components/format';
import { useLoad } from '@/components/useLoad';
import { defaultTaxYear, useTaxYear, useYearHref } from '@/components/useTaxYear';
import { Badge } from '@/components/ui/Badge';
import { Button, LinkButton } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Callout } from '@/components/ui/Callout';
import { Card } from '@/components/ui/Card';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Term } from '@/components/ui/Term';

/**
 * W-2 jobs. A day job changes the tax on a side hustle twice: its wages push
 * the hustle profit into higher brackets, and its withholding already pays
 * part of the bill. Paycheck deposits are never counted as wages; the W-2's
 * own boxes are.
 */
export default function JobsPage() {
  const [taxYear] = useTaxYear();
  const yearHref = useYearHref();
  const key = String(taxYear ?? 'default');
  const loadForms = useCallback(() => fetchW2s(taxYear), [taxYear]);
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const forms = useLoad(key, loadForms);
  const summary = useLoad(key, loadSummary);
  const [confirm, confirmDialog] = useConfirm();
  const [dialog, setDialog] = useState<{ editing: W2Item | null } | null>(null);
  const [status, setStatus] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const reloadForms = forms.reload;
  const reloadSummary = summary.reload;
  const refresh = useCallback(async () => {
    await Promise.allSettled([reloadForms(), reloadSummary()]);
  }, [reloadForms, reloadSummary]);

  const data = summary.data;
  const list = forms.data?.forms ?? [];
  const year = forms.data?.taxYear ?? data?.taxYear ?? taxYear ?? defaultTaxYear();
  const joint = data?.filingStatus === 'married_filing_jointly';
  const spouseLeftOut = !joint && list.some((f) => !f.ownedByTaxpayer);
  const error = forms.error ?? summary.error;

  async function remove(form: W2Item) {
    const ok = await confirm({
      title: `Delete the W-2 from ${form.employer}?`,
      body: 'Its wages and withholding come off the estimate. This cannot be undone.',
      confirmLabel: 'Delete W-2',
      tone: 'danger',
    });
    if (!ok) return;
    setStatus(null);
    try {
      await deleteW2(form.id);
      await refresh();
      setStatus({ kind: 'ok', text: 'W-2 deleted.' });
    } catch (err) {
      setStatus({ kind: 'error', text: errorText(err, 'Could not delete the W-2.') });
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="W-2 jobs"
        description="Have a regular job too? Its wages and the tax already taken out of your paychecks both change what your hustles owe."
        icon={<Briefcase size={22} />}
        iconTone="accent"
        actions={
          <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setDialog({ editing: null })}>
            Add a W-2
          </Button>
        }
      />

      {error !== null && <InlineStatus kind="error">{errorText(error, 'Could not load your W-2s.')}</InlineStatus>}
      {status && <InlineStatus kind={status.kind}>{status.text}</InlineStatus>}

      {spouseLeftOut && (
        <Callout
          tone="warning"
          title="A spouse's W-2 is left out"
          action={
            <LinkButton href={yearHref('/profile')} size="sm">
              Check filing status
            </LinkButton>
          }
        >
          You file as {filingStatusLabel(data?.filingStatus).toLowerCase()}, and a spouse&rsquo;s wages are only on your return when you file jointly.
        </Callout>
      )}

      {list.length > 0 && data && (
        <Busy busy={summary.loading} className="grid gap-4 sm:grid-cols-2">
          <StatCard label="Wages on your return" value={formatCurrency(data.estimate.income.wages)} caption={`From ${list.length} W-2${list.length === 1 ? '' : 's'} for ${year}.`} />
          <StatCard
            tone="accent"
            label={<Term k="withholding">Federal tax withheld</Term>}
            value={formatCurrency(data.estimate.payments.withholding)}
            caption="Box 2 of your W-2s. It counts toward what you owe, the same as a payment."
          />
        </Busy>
      )}

      <Card padding={list.length === 0 ? 'md' : 'none'}>
        {forms.data === null && forms.loading ? (
          <p className="py-10 text-center text-sm text-fg-muted">Loading…</p>
        ) : list.length === 0 ? (
          <EmptyState
            icon={<Briefcase size={20} />}
            title={`No W-2s for ${year}`}
            action={
              <Button variant="primary" icon={<Plus size={16} aria-hidden />} onClick={() => setDialog({ editing: null })}>
                Add a W-2
              </Button>
            }
          >
            No regular job? Skip this page. If you do have one, add its W-2, or your latest pay stub&rsquo;s year-to-date totals until the W-2 arrives in January.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-border">
            {list.map((form) => (
              <li key={form.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center md:px-6">
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface text-fg-muted" aria-hidden>
                    <Briefcase size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 font-semibold">
                      {form.employer}
                      {!form.ownedByTaxpayer && <Badge tone={joint ? 'neutral' : 'warning'}>{joint ? "Spouse's" : "Spouse's, left out"}</Badge>}
                    </p>
                    <p className="mt-0.5 text-sm text-fg-muted">
                      {formatCurrency(form.wages, { cents: true })} wages · {formatCurrency(form.federalWithheld, { cents: true })} withheld
                    </p>
                  </div>
                </div>
                <div className="flex gap-1 self-end sm:self-center">
                  <Button variant="secondary" size="sm" icon={<Pencil size={14} aria-hidden />} onClick={() => setDialog({ editing: form })}>
                    Edit
                  </Button>
                  <Button variant="ghost" size="sm" className="px-2 hover:text-danger" aria-label={`Delete ${form.employer}`} onClick={() => void remove(form)}>
                    <Trash2 size={15} aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Callout tone="tip" title="Paycheck deposits are not wages here">
        A paycheck in your bank is after taxes and deductions, so it would understate your wages and miss the tax already withheld. Categorize those deposits as a paycheck
        and enter the W-2 here instead.
      </Callout>

      {data && <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} />}

      <W2Dialog
        open={dialog !== null}
        onClose={() => setDialog(null)}
        editing={dialog?.editing ?? null}
        taxYear={year}
        jointReturn={joint}
        onSaved={refresh}
      />
      {confirmDialog}
    </div>
  );
}
