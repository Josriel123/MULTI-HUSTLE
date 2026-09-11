import type { ReactNode } from 'react';
import { Card, type CardAccent } from './Card';
import { cn } from '../cn';

export interface StatCardProps {
  /** Short, uppercase-styled label: "Total income". */
  label: string;
  /** Already formatted: pass `formatCurrency(x)`, never a number. */
  value: string;
  /** What the number is, in one line, ideally with the form line it comes from. */
  caption?: ReactNode;
  accent?: CardAccent;
  /** Colour of the big number. `danger` for tax owed, `accent` for money in the user's favour. */
  tone?: 'default' | 'accent' | 'danger';
  className?: string;
}

/**
 * One headline figure. A page that shows a tax liability in one of these
 * MUST render an `<EstimateNotice>` on the same screen (see EstimateNotice.tsx).
 */
export function StatCard({ label, value, caption, accent = 'none', tone = 'default', className }: StatCardProps) {
  const toneClass = { default: 'text-fg', accent: 'text-accent', danger: 'text-danger' }[tone];
  return (
    <Card accent={accent} hover className={cn('flex flex-col gap-2', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-[0.05em] text-fg-muted md:text-sm">{label}</h3>
      <div className={cn('text-3xl font-bold leading-none tabular-nums md:text-[2.5rem]', toneClass)}>{value}</div>
      {caption && <p className="text-sm leading-snug text-fg-muted">{caption}</p>}
    </Card>
  );
}
