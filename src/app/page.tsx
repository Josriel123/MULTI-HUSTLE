'use client';

import { useEffect, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertCircle, ArrowRight, BrainCircuit, Car, CheckCircle2, Layers, X, Zap, type LucideIcon } from 'lucide-react';
import PlaidLinkButton from '@/components/PlaidLinkButton';
import { EstimateNotice } from '@/components/EstimateNotice';
import { TaxYearSelect } from '@/components/TaxYearSelect';
import { useTaxYear } from '@/components/useTaxYear';
import { fetchChart, fetchSummary, type ChartPoint, type SummaryResponse } from '@/components/api';
import { filingStatusLabel, formatCurrency, formatMiles } from '@/components/format';
import { Button, LinkButton } from '@/components/ui/Button';
import { Busy } from '@/components/ui/Busy';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { InlineStatus } from '@/components/ui/InlineStatus';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';

/**
 * Dashboard. Reference implementation for the component set: every number on
 * this page is read from the summary response and formatted; nothing is
 * computed here. The disclaimer and warnings render directly under the
 * figures they qualify (EstimateNotice), on every load, for every year.
 */
export default function Dashboard() {
  // `undefined` means "let the server pick the current year"; the response tells us which it chose.
  const [taxYear, setTaxYear] = useTaxYear();
  const [data, setData] = useState<SummaryResponse | null>(null);
  const [chart, setChart] = useState<ChartPoint[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [onboardingOpen, setOnboardingOpen] = useState(true);
  // Loading is derived, not set: the page is busy until the response for the
  // currently requested year has landed (or failed).
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const requestKey = taxYear === undefined ? 'default' : String(taxYear);
  const loading = resolvedKey !== requestKey;

  useEffect(() => {
    let ignore = false;
    Promise.all([fetchSummary(taxYear), fetchChart(taxYear)])
      .then(([summary, points]) => {
        if (ignore) return;
        setData(summary);
        setChart(points.points);
        setError(null);
      })
      .catch((err: unknown) => {
        if (ignore) return;
        console.error('Failed to load dashboard data', err);
        setError(err instanceof Error ? err.message : 'Failed to load dashboard data.');
      })
      .finally(() => {
        if (!ignore) setResolvedKey(requestKey);
      });
    return () => {
      ignore = true;
    };
  }, [taxYear, requestKey]);

  const shownYear = data?.taxYear ?? taxYear;

  return (
    <div className="flex flex-col gap-6 md:gap-8">
      <PageHeader
        title="Overview"
        description={
          data
            ? `Federal estimate for tax year ${data.taxYear}, filing as ${filingStatusLabel(data.filingStatus).toLowerCase()}.`
            : 'Federal tax estimate from your transactions and forms.'
        }
        actions={<TaxYearSelect value={shownYear} onChange={setTaxYear} />}
      />

      {error && <InlineStatus kind="error">{error}</InlineStatus>}

      {onboardingOpen && (
        <Card className="relative overflow-hidden border-info bg-info/5 animate-slide-up">
          <div className="absolute inset-y-0 left-0 w-1 bg-info" aria-hidden />
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
            <div className="min-w-0 flex-1">
              <div className="mb-3 flex items-center gap-3">
                <BrainCircuit size={24} className="text-info" aria-hidden />
                <h2 className="text-xl font-semibold">Connect your accounts</h2>
              </div>
              <p className="mb-5 max-w-prose leading-relaxed text-fg-muted">
                Link a bank in the Plaid sandbox to import transactions, then categorise them on the Deductions page. The
                estimate updates from what you enter; it never guesses from a description.
              </p>
              <PlaidLinkButton />
            </div>
            <div className="shrink-0 rounded-card border border-border bg-bg p-5 text-sm">
              <div className="mb-2 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-accent" aria-hidden />
                <span>Database connected</span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle size={16} className="text-danger" aria-hidden />
                <span>Plaid in sandbox mode</span>
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="absolute right-3 top-3 px-2"
            aria-label="Dismiss setup card"
            onClick={() => setOnboardingOpen(false)}
          >
            <X size={18} aria-hidden />
          </Button>
        </Card>
      )}

      <Busy busy={loading} className="flex flex-col gap-6 md:gap-8">
        {/* Headline figures. The notice below is part of this block on purpose. */}
        <section aria-label="Estimate summary" className="flex flex-col gap-4 md:gap-6 animate-slide-up">
          <div className="grid gap-4 md:grid-cols-3 md:gap-6">
            <StatCard
              label="Safe to spend"
              value={formatCurrency(data?.summary.net)}
              caption="Deposits counted as income, less every expense and the estimated federal tax"
              accent="accent"
            />
            <StatCard label="Total income" value={formatCurrency(data?.summary.gross)} caption="Form 1040 line 9" accent="neutral" />
            <StatCard
              label="Estimated federal tax"
              value={formatCurrency(data?.summary.taxLiability)}
              caption="Form 1040 line 24, before credits. An estimate that runs high, not an amount owed."
              accent="danger"
              tone="danger"
            />
          </div>
          <EstimateNotice disclaimer={data?.disclaimer} warnings={data?.warnings} assumptions={data?.assumptions} notModeled={data?.notModeled} />
        </section>

        <Card className="animate-slide-up">
          <CardHeader>
            <div>
              <CardTitle>Income and net through the year</CardTitle>
              <CardDescription>Cumulative by month: total income, and what is left after expenses and the estimated tax.</CardDescription>
            </div>
          </CardHeader>
          <div className="h-[260px] w-full md:h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chart} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--accent-green)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="var(--accent-green)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorGross" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--border-color)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--border-color)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" vertical={false} />
                <XAxis dataKey="month" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                <YAxis stroke="var(--text-secondary)" tickLine={false} axisLine={false} width={64} tickFormatter={(v: number) => formatCurrency(v)} />
                <Tooltip
                  formatter={(v) => formatCurrency(typeof v === 'number' || typeof v === 'string' ? v : null)}
                  contentStyle={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', borderRadius: '8px' }}
                  itemStyle={{ color: 'var(--text-primary)' }}
                />
                <Area type="monotone" dataKey="gross" name="Total income" stroke="var(--text-secondary)" strokeWidth={2} fill="url(#colorGross)" />
                <Area type="monotone" dataKey="net" name="Net" stroke="var(--accent-green)" strokeWidth={3} fill="url(#colorNet)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {(() => {
          const deductionsHref = taxYear ? `/deductions?taxYear=${taxYear}` : '/deductions';
          return (
            <section aria-label="Income by source" className="grid gap-4 md:grid-cols-2 md:gap-6 animate-slide-up">
              <SourceCard
                title="Freelance income"
                icon={Zap}
                amount={formatCurrency(data?.sources.freelance.income)}
                details={[
                  ['Deductible expenses', formatCurrency(data?.sources.freelance.deductions)],
                  ['Home office deduction', formatCurrency(data?.sources.freelance.homeOfficeDeduction)],
                ]}
                action={{ href: deductionsHref, label: 'Log an expense' }}
              />
              <SourceCard
                title="Delivery income"
                icon={Car}
                amount={formatCurrency(data?.sources.delivery.income)}
                details={[
                  ['Miles logged', formatMiles(data?.sources.delivery.mileage)],
                  ['Standard mileage deduction', formatCurrency(data?.sources.delivery.mileageDeduction)],
                ]}
                action={{ href: deductionsHref, label: 'Log mileage' }}
              />
              {data && data.sources.other.income > 0 && (
                <SourceCard
                  title="Other income"
                  icon={Layers}
                  amount={formatCurrency(data.sources.other.income)}
                  details={[['Deductible expenses', formatCurrency(data.sources.other.deductions)]]}
                  action={{ href: deductionsHref, label: 'Review transactions' }}
                />
              )}
            </section>
          );
        })()}
      </Busy>
    </div>
  );
}

function SourceCard({
  title,
  icon: Icon,
  amount,
  details,
  action,
}: {
  title: string;
  icon: LucideIcon;
  amount: string;
  details: Array<[label: string, value: string]>;
  action: { href: string; label: string };
}) {
  return (
    <Card hover className="flex flex-col">
      <CardHeader className="mb-4 items-center">
        <CardTitle as="h3">{title}</CardTitle>
        <Icon size={20} className="text-accent" aria-hidden />
      </CardHeader>
      <div className="mb-3 text-3xl font-semibold tabular-nums">{amount}</div>
      <dl className="mb-5 flex flex-col gap-1 text-sm text-fg-muted">
        {details.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-4">
            <dt>{label}</dt>
            <dd className="font-semibold tabular-nums text-fg">{value}</dd>
          </div>
        ))}
      </dl>
      <LinkButton href={action.href} variant="secondary" fullWidth className="mt-auto" trailingIcon={<ArrowRight size={16} aria-hidden />}>
        {action.label}
      </LinkButton>
    </Card>
  );
}
