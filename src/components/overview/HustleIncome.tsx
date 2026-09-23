import Link from 'next/link';
import { Bike, Briefcase, Store, Tag, type LucideIcon } from 'lucide-react';
import type { SummaryResponse } from '../api';
import { formatCurrency } from '../format';
import { LinkButton } from '../ui/Button';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { EmptyState } from '../ui/EmptyState';
import { Term } from '../ui/Term';

const KIND_ICON: Record<string, LucideIcon> = { Delivery: Bike, Freelance: Briefcase, Other: Store };

/** Income counted this year, per hustle, largest first. Shares come from the server. */
export function HustleIncome({ data, yearHref }: { data: SummaryResponse; yearHref: (path: string) => string }) {
  const rows = data.incomeBySource;
  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div>
          <CardTitle>Income by <Term k="hustle">hustle</Term></CardTitle>
          <CardDescription>What each income source brought in during {data.taxYear}.</CardDescription>
        </div>
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyState
          icon={<Tag size={20} />}
          title="No hustle income yet"
          action={
            <LinkButton href={yearHref('/transactions?add=income')} variant="primary" size="sm">
              Add income
            </LinkButton>
          }
          className="py-6"
        >
          Deposits you add or bring in from your bank show up here, grouped by the hustle you choose for them.
        </EmptyState>
      ) : (
        <ul className="flex flex-col gap-3.5">
          {rows.map((row) => {
            const Icon = (row.type && KIND_ICON[row.type]) || Tag;
            return (
              <li key={`${row.type}:${row.name ?? ''}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface text-fg-muted" aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{row.name ?? 'No hustle chosen'}</span>
                      <span className="block text-xs text-fg-faint">
                        {row.count} {row.count === 1 ? 'deposit' : 'deposits'}
                        {row.name === null && (
                          <>
                            {' · '}
                            <Link href={yearHref('/transactions?hustle=none')} className="font-medium text-accent hover:underline">
                              Assign them
                            </Link>
                          </>
                        )}
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCurrency(row.income)}</span>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface" aria-hidden>
                  <div className="h-full rounded-full bg-accent/70" style={{ width: `${row.share * 100}%` }} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
