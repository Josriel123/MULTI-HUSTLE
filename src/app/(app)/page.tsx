'use client';

import { useCallback, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRight, Wallet } from 'lucide-react';
import { EstimateNotice } from '@/components/EstimateNotice';
import { errorText, fetchChart, fetchSummary } from '@/components/api';
import { filingStatusLabel, formatCurrency } from '@/components/format';
import { HustleIncome } from '@/components/overview/HustleIncome';
import { SetupChecklist, ShowSetupLink } from '@/components/overview/SetupChecklist';
import { TaxBreakdown } from '@/components/overview/TaxBreakdown';
import { TaxHero } from '@/components/overview/TaxHero';
import { YearChart } from '@/components/overview/YearChart';
import { useLoad } from '@/components/useLoad';
import { useTaxYear, useYearHref } from '@/components/useTaxYear';
import { LinkButton } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Callout } from '@/components/ui/Callout';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { Term } from '@/components/ui/Term';

/**
 * Overview. Every number on this page is read from the summary and chart
 * responses and formatted; nothing is computed here. The disclaimer and
 * warnings render under the figures they qualify (EstimateNotice), on every
 * load, for every year.
 */
export default function Overview() {
  const [taxYear] = useTaxYear();
  const yearHref = useYearHref();
  const key = String(taxYear ?? 'default');
  const loadSummary = useCallback(() => fetchSummary(taxYear), [taxYear]);
  const loadChart = useCallback(() => fetchChart(taxYear), [taxYear]);
  const summary = useLoad(key, loadSummary);
  const chart = useLoad(key, loadChart);
  const data = summary.data;

  const uncategorised = data ? data.transactions.uncategorised.incomeCount + data.transactions.uncategorised.expenseCount : 0;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Overview"
        description={
          data ? (
            <>
              Your federal tax picture for {data.taxYear}, from what you have entered so far. Filing as{' '}
              <LinkButtonInline href={yearHref('/profile')}>{filingStatusLabel(data.filingStatus).toLowerCase()}</LinkButtonInline>
              {data.filingStatusSource === 'default' && ' (assumed until you set it)'}.
            </>
          ) : (
            'Your federal tax picture, from what you have entered so far.'
          )
        }
        actions={<ShowSetupLink />}
      />

      {summary.error !== null && <InlineStatus kind="error">{errorText(summary.error, 'Could not load your estimate.')}</InlineStatus>}

      {data && <SetupChecklist data={data} yearHref={yearHref} />}

      <Busy busy={summary.loading && data !== null} className="flex flex-col gap-6">
        <TaxHero data={data} yearHref={yearHref} />

        {data && uncategorised > 0 && (
          <Callout
            tone="warning"
            title={`${uncategorised} ${uncategorised === 1 ? 'transaction needs' : 'transactions need'} a category`}
            action={
              <LinkButton href={yearHref('/transactions?show=uncategorised')} size="sm" trailingIcon={<ArrowRight size={14} aria-hidden />}>
                Review
              </LinkButton>
            }
          >
            Until you choose, money in counts as business income and money out is not deducted, so the estimate is on the high side.
          </Callout>
        )}

        {data && (
          <>
            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
              <StatCard
                icon={<Wallet size={16} />}
                tone="accent"
                label={<Term k="safeToSpend">Safe to spend</Term>}
                value={formatCurrency(data.summary.net)}
                caption={
                  data.estimate.payments.estimatedPayments > 0
                    ? `From ${formatCurrency(data.summary.hustleIncome)} your hustles brought in, after ${formatCurrency(data.summary.spent)} spent, ${formatCurrency(data.estimate.payments.estimatedPayments)} already paid to the IRS and ${formatCurrency(data.summary.leftToPay)} set aside for the tax still to pay.`
                    : `From ${formatCurrency(data.summary.hustleIncome)} your hustles brought in, after ${formatCurrency(data.summary.spent)} spent and ${formatCurrency(data.summary.leftToPay)} set aside for the tax still to pay.`
                }
              />
              <HustleIncome data={data} yearHref={yearHref} />
            </div>

            <TaxBreakdown data={data} />
          </>
        )}

        {data && <YearChart chart={chart.data} taxYear={data.taxYear} />}

        {data && <EstimateNotice disclaimer={data.disclaimer} warnings={data.warnings} assumptions={data.assumptions} notModeled={data.notModeled} rules={data.rules} />}
      </Busy>
    </div>
  );
}

function LinkButtonInline({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="font-medium text-accent underline-offset-2 hover:underline">
      {children}
    </Link>
  );
}
