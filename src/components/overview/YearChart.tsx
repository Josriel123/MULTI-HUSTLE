'use client';

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ChartResponse } from '../api';
import { formatCurrency } from '../format';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Term } from '../ui/Term';

/**
 * Cumulative total income and safe-to-spend by month, straight from the chart
 * endpoint (a full estimate per month). Colours are the theme's tokens, so the
 * chart follows light and dark mode.
 */
export function YearChart({ chart, taxYear }: { chart: ChartResponse | null; taxYear: number }) {
  const points = chart?.points ?? [];
  return (
    <Card>
      <CardHeader>
        <div>
          <CardTitle>Your year so far</CardTitle>
          <CardDescription>
            Running totals for {taxYear}: total income, and what was <Term k="safeToSpend">safe to spend</Term> at the end of each month.
            {chart?.w2Spread && ' W-2 wages are spread evenly across the months, because a W-2 has no dates.'}
          </CardDescription>
        </div>
        <div className="flex flex-wrap gap-4 text-xs text-fg-muted" aria-hidden>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-fg-faint" />
            Total income
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-4 rounded-full bg-accent" />
            Safe to spend
          </span>
        </div>
      </CardHeader>
      <div className="h-64 w-full md:h-72" role="img" aria-label={`Chart of total income and safe to spend by month for ${taxYear}`}>
        {points.length > 0 && (
          // A starting size, so the first render (before the container is
          // measured) is not a -1 x -1 chart, which Recharts warns about.
          <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 720, height: 288 }}>
            <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--c-accent)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--c-accent)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="fillGross" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--c-fg-faint)" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="var(--c-fg-faint)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--c-border)" vertical={false} />
              <XAxis dataKey="month" stroke="var(--c-fg-faint)" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis stroke="var(--c-fg-faint)" tickLine={false} axisLine={false} width={64} fontSize={12} tickFormatter={(v: number) => formatCurrency(v)} />
              <Tooltip
                formatter={(value) => formatCurrency(typeof value === 'number' ? value : Number(value))}
                contentStyle={{
                  backgroundColor: 'var(--c-card)',
                  border: '1px solid var(--c-border)',
                  borderRadius: 10,
                  boxShadow: 'var(--c-shadow-pop)',
                  fontSize: 13,
                }}
                labelStyle={{ color: 'var(--c-fg)', fontWeight: 600 }}
                itemStyle={{ color: 'var(--c-fg-muted)' }}
              />
              <Area type="monotone" dataKey="gross" name="Total income" stroke="var(--c-fg-faint)" strokeWidth={2} fill="url(#fillGross)" />
              <Area type="monotone" dataKey="net" name="Safe to spend" stroke="var(--c-accent)" strokeWidth={2.5} fill="url(#fillNet)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
