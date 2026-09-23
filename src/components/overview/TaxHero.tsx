import { ArrowRight, Landmark, PiggyBank, Receipt } from 'lucide-react';
import type { SummaryResponse } from '../api';
import { formatCurrency, formatPercent } from '../format';
import { LinkButton } from '../ui/Button';
import { Skeleton } from '../ui/Busy';
import { Card } from '../ui/Card';
import { ProgressBar } from '../ui/ProgressBar';
import { Term } from '../ui/Term';

/**
 * The first thing on the overview: what this year's federal tax comes to,
 * how much of it is already paid, and what is left. Every figure is read from
 * the summary response; nothing is added up here.
 */
export function TaxHero({ data, yearHref }: { data: SummaryResponse | null; yearHref: (path: string) => string }) {
  if (!data) {
    return (
      <Card padding="lg" aria-busy>
        <Skeleton className="h-4 w-48" />
        <Skeleton className="mt-4 h-10 w-40" />
        <Skeleton className="mt-6 h-2 w-full" />
      </Card>
    );
  }

  const { summary, estimate, counts } = data;
  const nothingEntered = counts.transactions === 0 && counts.w2Forms === 0 && !counts.has1098T;

  if (nothingEntered) {
    return (
      <Card padding="lg" className="relative overflow-hidden">
        <div className="max-w-xl">
          <p className="text-sm font-medium text-fg-muted">Estimated federal tax for {data.taxYear}</p>
          <p className="mt-2 text-2xl font-bold tracking-tight md:text-3xl">Your estimate will appear here</p>
          <p className="mt-2 text-[0.95rem] leading-relaxed text-fg-muted">
            Add the money your hustles brought in, and the costs that went with it. The estimate updates as you go, so you always know how
            much to set aside.
          </p>
          <div className="mt-5 flex flex-wrap gap-2.5">
            <LinkButton href={yearHref('/transactions?add=income')} variant="primary" trailingIcon={<ArrowRight size={16} aria-hidden />}>
              Add your first income
            </LinkButton>
            <LinkButton href={yearHref('/transactions')} variant="secondary">
              Connect a bank instead
            </LinkButton>
          </div>
        </div>
      </Card>
    );
  }

  const refund = summary.refund > 0;
  return (
    <Card padding="lg" accent="accent">
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-fg-muted">
            <Receipt size={16} aria-hidden />
            <Term k="estimatedTax">Estimated federal tax</Term> for {data.taxYear}
          </p>
          <p className="mt-2 text-4xl font-bold tracking-tight tabular-nums md:text-5xl">{formatCurrency(summary.taxLiability)}</p>
          <p className="mt-2 text-sm leading-relaxed text-fg-muted">
            {formatCurrency(estimate.incomeTax.tax)} <Term k="incomeTax">income tax</Term> and{' '}
            {formatCurrency(estimate.otherTaxes.selfEmploymentTax)} <Term k="selfEmploymentTax">self-employment tax</Term>
            {estimate.otherTaxes.additionalMedicareTax > 0 && (
              <>
                , plus {formatCurrency(estimate.otherTaxes.additionalMedicareTax)} <Term k="additionalMedicare">Additional Medicare Tax</Term>
              </>
            )}
            {estimate.effectiveRate !== null && (
              <>
                . That is {formatPercent(estimate.effectiveRate)} of your {formatCurrency(summary.gross)} total income.
              </>
            )}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-surface p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              <Landmark size={16} aria-hidden />
              <Term k="paidSoFar">Paid so far</Term>
            </span>
            <span className="font-semibold tabular-nums">{formatCurrency(summary.paid)}</span>
          </div>
          {summary.paidShare !== null && <ProgressBar value={summary.paidShare} label={`${formatPercent(summary.paidShare, 0)} of the estimated tax is paid`} />}
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm text-fg-muted">
              <PiggyBank size={16} aria-hidden />
              {refund ? 'Expected refund' : <Term k="leftToPay">Left to pay</Term>}
            </span>
            <span className={refund ? 'text-lg font-bold text-accent tabular-nums' : 'text-lg font-bold tabular-nums'}>
              {formatCurrency(refund ? summary.refund : summary.leftToPay)}
            </span>
          </div>
          <LinkButton href={yearHref('/payments')} variant="secondary" size="sm" className="mt-1" trailingIcon={<ArrowRight size={14} aria-hidden />}>
            {counts.estimatedPayments > 0 ? 'See your payments' : 'Record a payment'}
          </LinkButton>
        </div>
      </div>
    </Card>
  );
}
